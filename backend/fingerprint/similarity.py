"""
fingerprint/similarity.py
==========================
Cosine similarity search over materialied fingerprint vectors.

Usage::

    results = top_k_similar(
        query_batch_id="B102",
        fingerprint_store=[{"batch_id": ..., "fingerprint": [...]}, ...],
        k=5,
    )
"""

from __future__ import annotations

import math
from typing import Any


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Cosine similarity:  (A · B) / (||A|| * ||B||)
    Returns 0.0 if either vector is zero-length.
    """
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def top_k_similar(
    query_batch_id: str,
    fingerprint_store: list[dict[str, Any]],
    k: int = 5,
) -> list[dict[str, Any]]:
    """
    Return the top-k most similar batches to *query_batch_id*.

    Parameters
    ----------
    query_batch_id : str
        The batch to search from.
    fingerprint_store : list[dict]
        List of ``{"batch_id": str, "fingerprint": list[float]}`` dicts.
    k : int
        Number of results to return.

    Returns
    -------
    list[dict]
        Sorted list of ``{"batch_id": str, "similarity": float}`` dicts,
        highest similarity first.  The query batch itself is excluded.

    Raises
    ------
    KeyError
        If *query_batch_id* is not found in *fingerprint_store*.
    """
    query_vec: list[float] | None = None
    for fp in fingerprint_store:
        if fp["batch_id"] == query_batch_id:
            query_vec = fp["fingerprint"]
            break

    if query_vec is None:
        raise KeyError(f"batch_id '{query_batch_id}' not found in fingerprint store.")

    scores: list[dict[str, Any]] = []
    for fp in fingerprint_store:
        if fp["batch_id"] == query_batch_id:
            continue
        sim = _cosine_similarity(query_vec, fp["fingerprint"])
        scores.append({"batch_id": fp["batch_id"], "similarity": round(sim, 6)})

    scores.sort(key=lambda x: x["similarity"], reverse=True)
    return scores[:k]
