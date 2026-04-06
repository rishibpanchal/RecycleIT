"""
routes/fingerprint.py
======================
FastAPI router for the Material Fingerprint API.

Endpoints
---------
POST  /fingerprint/compute          — Compute fingerprints from raw lifecycle data
GET   /fingerprint/similar/{batch_id} — Top-k cosine-similar batches
GET   /fingerprint/clusters         — K-Means cluster labels

Internal cache
--------------
After the first POST /fingerprint/compute call, the computed fingerprints are
cached in-process so that GET endpoints can query them without re-computation.
For production, this would be backed by Redis or a DB.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/fingerprint", tags=["fingerprint"])

# ── In-process store (reset on each compute call) ─────────────────────────────
_store: dict[str, Any] = {
    "fingerprints": [],   # list[dict] with batch_id, fingerprint, cluster
    "all_features": [],   # list[dict] full feature dicts
    "cluster_result": {}, # output of clustering.cluster_fingerprints
    "insights": [],       # list[str]
}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LifecycleRecord(BaseModel):
    batch_id: str
    material_type: str | None = None
    vendor: str | None = None
    stage: str
    quantity_in: float
    quantity_out: float
    timestamp: str

    model_config = {"extra": "allow"}


class ComputeRequest(BaseModel):
    data: list[LifecycleRecord] = Field(..., min_length=1)
    k: int = Field(default=3, ge=1, le=5, description="Number of K-Means clusters")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_computed() -> None:
    if not _store["fingerprints"]:
        raise HTTPException(
            status_code=400,
            detail=(
                "No fingerprints computed yet. "
                "Call POST /fingerprint/compute first."
            ),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/compute", summary="Compute Material Fingerprints")
def compute_fingerprints(request: ComputeRequest) -> dict[str, Any]:
    """
    Run the full fingerprint pipeline on the supplied lifecycle records.

    Returns the fingerprint for each batch along with its cluster label.
    """
    from fingerprint.pipeline import run_pipeline

    records = [rec.model_dump() for rec in request.data]
    result = run_pipeline(records, k=request.k)

    # Cache in-process
    _store.update(result)

    return {
        "status": "ok",
        "batch_count": len(result["fingerprints"]),
        "fingerprints": [
            {
                "batch_id": fp["batch_id"],
                "fingerprint": fp["fingerprint"],
                "cluster": fp.get("cluster", "unknown"),
                "feature_labels": fp.get("feature_labels", []),
            }
            for fp in result["fingerprints"]
        ],
        "insights": result["insights"],
    }


@router.get("/similar/{batch_id}", summary="Top-K Similar Batches")
def similar_batches(
    batch_id: str,
    k: int = Query(default=5, ge=1, le=50, description="Number of similar batches"),
) -> dict[str, Any]:
    """
    Return the top-k batches most similar to *batch_id* using cosine similarity
    on their fingerprint vectors.
    """
    _ensure_computed()

    from fingerprint.similarity import top_k_similar

    try:
        similar = top_k_similar(
            query_batch_id=batch_id,
            fingerprint_store=_store["fingerprints"],
            k=k,
        )
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"batch_id '{batch_id}' not found in computed fingerprints.",
        )

    return {
        "batch_id": batch_id,
        "k": k,
        "similar_batches": similar,
    }


@router.get("/clusters", summary="Batch Clusters")
def get_clusters() -> dict[str, Any]:
    """
    Return the cluster assignments for all computed batches.
    """
    _ensure_computed()

    cr = _store["cluster_result"]
    return {
        "k": cr.get("k"),
        "clusters": cr.get("clusters", {}),
        "centroids": cr.get("centroids", []),
        "insights": _store["insights"],
    }


@router.get("/batch/{batch_id}", summary="Single Batch Fingerprint")
def get_batch_fingerprint(batch_id: str) -> dict[str, Any]:
    """Return the fingerprint and cluster for a single batch."""
    _ensure_computed()

    for fp in _store["fingerprints"]:
        if fp["batch_id"] == batch_id:
            return {
                "batch_id": fp["batch_id"],
                "fingerprint": fp["fingerprint"],
                "raw_fingerprint": fp.get("raw_fingerprint", []),
                "cluster": fp.get("cluster", "unknown"),
                "feature_labels": fp.get("feature_labels", []),
            }

    raise HTTPException(
        status_code=404,
        detail=f"batch_id '{batch_id}' not found.",
    )


@router.post("/compute_from_report", summary="Compute fingerprints from actual system report data")
def compute_from_report(
    scenario: int = Query(default=1, ge=1, le=6),
    k: int = Query(default=3, ge=1, le=5)
) -> dict[str, Any]:
    """
    Extracts lifecycle events from a traceability report JSON and runs the fingerprint pipeline.
    """
    import json
    from pathlib import Path
    from fingerprint.pipeline import run_pipeline

    # Root of repo
    root_dir = Path(__file__).parent.parent.parent
    
    # Try the newly generated data folder first
    new_report_path = root_dir / f"backend/NEW_DATA/Scenario {scenario}/traceability_report.json"
    
    if new_report_path.exists():
        report_path = new_report_path
    else:
        # Fallback to original
        report_path = root_dir / f"traceability_report_scenario_{scenario}.json"

    if not report_path.exists():
        raise HTTPException(status_code=404, detail=f"Report scenario {scenario} not found.")

    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)

    edges = report.get("edge_summary", [])
    if not edges:
        raise HTTPException(status_code=400, detail="No edge data found in report.")

    # Transform edges to LifecycleRecords
    records = []
    for edge in edges:
        remarks = edge.get("remarks", "Unknown:Unknown")
        # Extract batch_id from remarks like "SCN-100:Inward" -> "SCN-100"
        batch_id = remarks.split(":")[0] if ":" in remarks else remarks
        
        # If we couldn't get a meaningful SCN ID, fallback to INV node or transaction_id
        if batch_id in ["Unknown", ""]:
            to_node = edge.get("to", "Unknown")
            from_node = edge.get("from", "Unknown")
            batch_id = to_node if to_node.startswith("INV-") else from_node if from_node.startswith("INV-") else edge.get("transaction_id", "Unknown")

        records.append({
            "batch_id": batch_id,
            "material_type": edge.get("label", "").split("|")[0].strip(),
            "vendor": edge.get("warehouse_label", "Unknown Facility"),
            "stage": edge.get("lifecycle_label", "Unknown"),
            "quantity_in": edge.get("quantity", 0),
            "quantity_out": edge.get("quantity", 0) - edge.get("loss_qty", 0),
            "timestamp": edge.get("transaction_date", "")
        })

    if not records:
        raise HTTPException(status_code=400, detail="Could not extract lifecycle records from report.")

    result = run_pipeline(records, k=k)

    _store.update(result)

    return {
        "status": "ok",
        "batch_count": len(result["fingerprints"]),
        "fingerprints": [
            {
                "batch_id": fp["batch_id"],
                "fingerprint": fp["fingerprint"],
                "cluster": fp.get("cluster", "unknown"),
                "feature_labels": fp.get("feature_labels", []),
            }
            for fp in result["fingerprints"]
        ],
        "insights": result["insights"],
    }


@router.post("/compute_synthetic", summary="Compute fingerprints from generated high-variance synthetic data")
def compute_synthetic(k: int = Query(default=3, ge=1, le=5)) -> dict[str, Any]:
    """
    Loads lifecycle events from two separate CSV files (events + transforms) 
    and joins them to run the fingerprint pipeline.
    """
    import csv
    from pathlib import Path
    from fingerprint.pipeline import run_pipeline

    root_dir = Path(__file__).parent.parent.parent
    events_path = root_dir / "backend/NEW_DATA/Scenario 1/transaction_events.csv"
    transforms_path = root_dir / "backend/NEW_DATA/Scenario 1/inventory_transforms.csv"

    if not events_path.exists() or not transforms_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="Synthetic data files not found. Run scenario_data_generator.py first."
        )

    # 1. Load transforms into a mapping by transaction_id
    transforms = {}
    with open(transforms_path, "r", newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            transforms[row["transaction_id"]] = {
                "quantity": float(row["quantity"]),
                "dest_qty": float(row.get("dest_qty", 0.0)),
                "loss_percent": float(row["loss_percent"])
            }

    # 2. Load events and join with transforms
    records = []
    with open(events_path, "r", newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            txn_id = row["transaction_id"]
            trans = transforms.get(txn_id, {"quantity": 0.0, "dest_qty": 0.0})
            
            # Reconstruct LifecycleRecord
            # We extract the stage from the remarks "B1001:Sorting"
            remarks = row.get("remarks", "Unknown:Unknown")
            stage = remarks.split(":")[1] if ":" in remarks else row.get("process_code", "Unknown")

            # Determine quantity out (either from transforms dest_qty or events quantity)
            # wait, events doesn't have quantity anymore; it was removed.
            # So quantity_out is precisely trans["dest_qty"]
            qty_out = trans["dest_qty"]

            records.append({
                "batch_id": row["batch_id"],
                "material_type": row["material_type"],
                "vendor": row.get("vendor", row.get("warehouse_code", "Unknown Facility")),
                "stage": stage,
                "quantity_in": trans["quantity"],
                "quantity_out": qty_out,
                "timestamp": row["transaction_date"]
            })

    if not records:
        raise HTTPException(status_code=400, detail="Data files are empty.")

    result = run_pipeline(records, k=k)
    _store.update(result)

    return {
        "status": "ok",
        "batch_count": len(result["fingerprints"]),
        "fingerprints": [
            {
                "batch_id": fp["batch_id"],
                "fingerprint": fp["fingerprint"],
                "cluster": fp.get("cluster", "unknown"),
                "feature_labels": fp.get("feature_labels", []),
            }
            for fp in result["fingerprints"]
        ],
        "insights": result["insights"],
    }

