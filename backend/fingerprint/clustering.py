"""
fingerprint/clustering.py
==========================
K-Means clustering on fingerprint vectors.

Cluster labels are assigned by mapping cluster centroids to efficiency tiers:
  - Cluster with LOWEST avg total_loss  → "high_efficiency"
  - Cluster with HIGHEST avg total_loss → "low_efficiency"
  - Middle cluster(s)                   → "medium_efficiency"

Dependencies: scikit-learn (sklearn)
"""

from __future__ import annotations

from typing import Any

import numpy as np

try:
    from sklearn.cluster import KMeans
    from sklearn.exceptions import ConvergenceWarning
    import warnings

    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False


_LABEL_HIGH = "high_efficiency"
_LABEL_MED = "medium_efficiency"
_LABEL_LOW = "low_efficiency"


def _label_clusters(
    k: int,
    centroids: np.ndarray,
    feature_labels: list[str],
) -> dict[int, str]:
    """
    Sort clusters by the total_loss dimension (index 0) in the fingerprint.
    Lowest loss → high_efficiency, highest → low_efficiency.
    """
    total_loss_idx = feature_labels.index("total_loss") if "total_loss" in feature_labels else 0

    # rank cluster indices by their centroid's total_loss value
    ranked = sorted(range(k), key=lambda i: centroids[i][total_loss_idx])

    label_map: dict[int, str] = {}
    if k == 1:
        label_map[ranked[0]] = _LABEL_MED
    elif k == 2:
        label_map[ranked[0]] = _LABEL_HIGH
        label_map[ranked[1]] = _LABEL_LOW
    else:
        # First → high, Last → low, all middle → medium
        label_map[ranked[0]] = _LABEL_HIGH
        label_map[ranked[-1]] = _LABEL_LOW
        for idx in ranked[1:-1]:
            label_map[idx] = _LABEL_MED

    return label_map


def cluster_fingerprints(
    fingerprint_store: list[dict[str, Any]],
    k: int = 3,
    feature_labels: list[str] | None = None,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Apply K-Means clustering to the fingerprint vectors.

    Parameters
    ----------
    fingerprint_store : list[dict]
        Each dict must have ``batch_id`` and ``fingerprint`` keys.
    k : int
        Number of clusters (3–5 recommended).
    feature_labels : list[str], optional
        Names of fingerprint dimensions (used for label assignment).
    random_state : int
        Random seed for reproducibility.

    Returns
    -------
    dict with keys:
      - ``clusters``: dict[label -> list[batch_id]]
      - ``batch_cluster_map``: dict[batch_id -> label]
      - ``centroids``: list[list[float]]
      - ``k``: int
    """
    if not fingerprint_store:
        return {
            "clusters": {_LABEL_HIGH: [], _LABEL_MED: [], _LABEL_LOW: []},
            "batch_cluster_map": {},
            "centroids": [],
            "k": k,
        }

    if not _SKLEARN_AVAILABLE:
        raise RuntimeError(
            "scikit-learn is required for clustering. "
            "Install with: pip install scikit-learn"
        )

    if feature_labels is None:
        from .fingerprint_builder import FINGERPRINT_KEYS
        feature_labels = FINGERPRINT_KEYS

    batch_ids = [fp["batch_id"] for fp in fingerprint_store]
    matrix = np.array([fp["fingerprint"] for fp in fingerprint_store], dtype=float)

    # Ensure k ≤ n_samples
    effective_k = min(k, len(batch_ids))

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        kmeans = KMeans(n_clusters=effective_k, random_state=random_state, n_init="auto")
        labels_arr = kmeans.fit_predict(matrix)

    centroids: np.ndarray = kmeans.cluster_centers_

    label_map = _label_clusters(effective_k, centroids, feature_labels)

    # Build named clusters
    clusters: dict[str, list[str]] = {
        _LABEL_HIGH: [],
        _LABEL_MED: [],
        _LABEL_LOW: [],
    }
    batch_cluster_map: dict[str, str] = {}

    for batch_id, cluster_idx in zip(batch_ids, labels_arr):
        human_label = label_map[int(cluster_idx)]
        clusters[human_label].append(batch_id)
        batch_cluster_map[batch_id] = human_label

    return {
        "clusters": clusters,
        "batch_cluster_map": batch_cluster_map,
        "centroids": centroids.tolist(),
        "k": effective_k,
    }
