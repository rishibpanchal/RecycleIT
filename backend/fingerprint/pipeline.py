"""
fingerprint/pipeline.py
========================
High-level orchestration: runs the full Material Fingerprint pipeline
(preprocess → feature engineer → build fingerprints → cluster → insights)
in a single call.

This is the primary entry point used by the FastAPI routes.
"""

from __future__ import annotations

from typing import Any

from .preprocessor import preprocess
from .feature_engineering import engineer_features
from .fingerprint_builder import build_fingerprints, FINGERPRINT_KEYS
from .clustering import cluster_fingerprints
from .insight_generator import generate_insights


def run_pipeline(
    records: list[dict[str, Any]],
    k: int = 3,
) -> dict[str, Any]:
    """
    Execute the full fingerprint pipeline.

    Parameters
    ----------
    records : list[dict]
        Raw lifecycle records (see data_generator schema).
    k : int
        Number of K-Means clusters.

    Returns
    -------
    dict with keys:
      - ``fingerprints``        : list[dict]  (batch_id, fingerprint, raw_fingerprint)
      - ``all_features``        : list[dict]  (full feature dict per batch)
      - ``cluster_result``      : dict        (clusters, batch_cluster_map, centroids)
      - ``insights``            : list[str]
    """
    # Step 1 — Preprocess
    grouped = preprocess(records)

    # Step 2 — Feature engineering
    all_features = engineer_features(grouped)

    # Step 3 — Build fingerprints
    fingerprint_store = build_fingerprints(all_features)

    # Step 4 — Cluster
    cluster_result = cluster_fingerprints(
        fingerprint_store,
        k=k,
        feature_labels=FINGERPRINT_KEYS,
    )

    # Attach cluster label to each fingerprint entry
    batch_cluster: dict[str, str] = cluster_result.get("batch_cluster_map", {})
    for fp in fingerprint_store:
        fp["cluster"] = batch_cluster.get(fp["batch_id"], "unknown")

    # Step 5 — Insights
    insights = generate_insights(all_features, cluster_result, fingerprint_store)

    return {
        "fingerprints": fingerprint_store,
        "all_features": all_features,
        "cluster_result": cluster_result,
        "insights": insights,
    }
