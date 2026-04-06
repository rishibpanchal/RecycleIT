"""
fingerprint/fingerprint_builder.py
=====================================
Build fixed-length fingerprint vectors from batch feature dicts and
apply Min-Max normalisation across all batches.

Fingerprint vector layout (indices 0-5)
----------------------------------------
  0: total_loss
  1: avg_stage_loss
  2: total_time             (hours)
  3: avg_stage_time         (hours)
  4: vendor_reliability
  5: material_consistency
"""

from __future__ import annotations

from typing import Any

import numpy as np

# Sentinel used when a feature is unavailable — filled via forward/back-fill
_MISSING = float("nan")

FINGERPRINT_KEYS: list[str] = [
    "total_loss",
    "total_time",
    "vendor_reliability",
    "material_consistency",
    "meta_profit",
]


def _extract_raw_vector(bf: dict[str, Any]) -> list[float]:
    """Pull the six fingerprint components out of a feature dict."""
    return [
        float(bf.get(k) if bf.get(k) is not None else _MISSING)
        for k in FINGERPRINT_KEYS
    ]


def _fill_missing(matrix: np.ndarray) -> np.ndarray:
    """
    Replace NaN entries column-wise with the column mean.
    If an entire column is NaN, fill with 0.
    """
    col_means = np.nanmean(matrix, axis=0)
    col_means = np.nan_to_num(col_means, nan=0.0)

    inds = np.where(np.isnan(matrix))
    matrix[inds] = np.take(col_means, inds[1])
    return matrix


def _minmax_scale(matrix: np.ndarray) -> np.ndarray:
    """
    Min-Max normalise each column to [0, 1].
    Columns with zero range are set to 0.
    """
    col_min = matrix.min(axis=0)
    col_max = matrix.max(axis=0)
    col_range = col_max - col_min

    # Avoid divide-by-zero
    safe_range = np.where(col_range == 0, 1.0, col_range)
    normalised = (matrix - col_min) / safe_range

    # Columns with zero range → 0
    normalised[:, col_range == 0] = 0.0
    return normalised


def build_fingerprints(
    all_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Build and normalise fingerprint vectors for all batches.

    Parameters
    ----------
    all_features : list[dict]
        Output of ``feature_engineering.engineer_features``.

    Returns
    -------
    list[dict]
        Each dict has:
          - ``batch_id``        : str
          - ``fingerprint``     : list[float]  (6 values, normalised)
          - ``raw_fingerprint`` : list[float]  (before normalisation)
          - ``feature_labels``  : list[str]    (names in order)
    """
    if not all_features:
        return []

    # Extract raw vectors
    raw_vectors = np.array(
        [_extract_raw_vector(bf) for bf in all_features],
        dtype=float,
    )

    # Handle NaNs
    filled = _fill_missing(raw_vectors.copy())

    # Normalise
    normalised = _minmax_scale(filled.copy())

    results: list[dict[str, Any]] = []
    for i, bf in enumerate(all_features):
        results.append(
            {
                "batch_id": bf["batch_id"],
                "fingerprint": normalised[i].tolist(),
                "raw_fingerprint": filled[i].tolist(),
                "feature_labels": FINGERPRINT_KEYS,
            }
        )

    return results
