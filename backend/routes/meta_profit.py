"""
routes/meta_profit.py
======================
FastAPI router for the Meta Profit Engine API.

Endpoints
---------
POST  /meta-profit/compute          — Compute Meta Profit for batches
GET   /meta-profit/{batch_id}       — Get Meta Profit for a specific batch
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from meta_profit_engine import process_all_batches, generate_profit_insights

router = APIRouter(prefix="/meta-profit", tags=["meta-profit"])

# ── In-process store (reset on each compute call) ─────────────────────────────
_store: dict[str, Any] = {
    "results": [],        # list[dict] with batch profit metrics
    "insights": [],       # list[str] overall insights
}

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BatchEventRecord(BaseModel):
    batch_id: str
    material_type: str | None = None
    vendor: str | None = None
    stage: str
    quantity_in: float
    quantity_out: float
    timestamp: str

    model_config = {"extra": "allow"}

class ComputeProfitRequest(BaseModel):
    batch_data: list[BatchEventRecord] = Field(..., min_length=1)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/compute", summary="Compute Meta Profit")
def compute_meta_profit(request: ComputeProfitRequest) -> dict[str, Any]:
    """
    Computes Meta Profit metrics for given batch lifecycle data.
    """
    records = [rec.model_dump() for rec in request.batch_data]
    
    results, overall_insights = process_all_batches(records)
    
    # Cache in-process
    _store["results"] = results
    _store["insights"] = overall_insights

    return {
        "status": "ok",
        "batch_count": len(results),
        "results": results,
        "overall_insights": overall_insights,
    }

@router.get("/{batch_id}", summary="Single Batch Meta Profit")
def get_batch_profit(batch_id: str) -> dict[str, Any]:
    """
    Return the computed Meta Profit and insights for a single batch.
    """
    if not _store["results"]:
        raise HTTPException(
            status_code=400,
            detail="No profit data computed yet. Call POST /meta-profit/compute first.",
        )

    for metrics in _store["results"]:
        if metrics["batch_id"] == batch_id:
            batch_insights = generate_profit_insights(metrics)
            return {
                "batch_id": batch_id,
                "metrics": metrics,
                "insights": batch_insights
            }

    raise HTTPException(
        status_code=404,
        detail=f"batch_id '{batch_id}' not found in computed profit results.",
    )
