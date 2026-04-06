"""
fingerprint/preprocessor.py
============================
Preprocessing step for lifecycle data before feature engineering.

Input record schema::

    {
        "batch_id": str,
        "material_type": str,
        "vendor": str,
        "stage": str,    # collection | sorting | processing | recycling | dispatch
        "quantity_in": float,
        "quantity_out": float,
        "timestamp": str,  # ISO-8601
    }

Output: dict[batch_id -> list[record]] where records are sorted by timestamp
and normalised stage names are validated.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

# Canonical stage ordering for gap/null detection
STAGE_ORDER: list[str] = [
    "collection",
    "sorting",
    "processing",
    "recycling",
    "dispatch",
]

_STAGE_ALIASES: dict[str, str] = {
    # common alternate spellings / abbreviations
    "collect": "collection",
    "collection": "collection",
    "collection / inward": "collection",
    "sort": "sorting",
    "sorting": "sorting",
    "segregation / sorting": "sorting",
    "process": "processing",
    "processing": "processing",
    "washing": "processing",
    "baling": "processing",
    "recycle": "recycling",
    "recycling": "recycling",
    "recycling / granulation": "recycling",
    "dispatch": "dispatch",
    "ship": "dispatch",
    "transfer / shipment": "dispatch",
    "dispatchment": "dispatch",
}


def _parse_ts(value: str | datetime) -> datetime:
    """Parse an ISO timestamp or return as-is if already a datetime."""
    if isinstance(value, datetime):
        return value
    # Handle both 'Z' suffix and '+00:00' timezone
    value = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        # Fallback: date-only strings like '2024-01-15'
        return datetime.fromisoformat(value.split("T")[0])


def _normalize_stage(stage: str) -> str | None:
    """Map raw stage string to canonical name; returns None if unknown."""
    return _STAGE_ALIASES.get(str(stage).strip().lower())


def preprocess(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Group records by batch_id, sort each group by timestamp, and normalise stage names.

    Parameters
    ----------
    records : list[dict]
        Raw lifecycle records.

    Returns
    -------
    dict[str, list[dict]]
        Mapping of batch_id → sorted list of enriched records.
        Each record gains:
          - ``stage_canonical``: normalised stage name (or None if unknown)
          - ``timestamp_dt``: parsed datetime object
    """
    grouped: dict[str, list[dict]] = defaultdict(list)

    for raw in records:
        rec = dict(raw)  # shallow copy to avoid mutating input

        # Parse timestamp
        ts_raw = rec.get("timestamp", "")
        try:
            rec["timestamp_dt"] = _parse_ts(ts_raw)
        except Exception:
            rec["timestamp_dt"] = None

        # Normalise stage
        rec["stage_canonical"] = _normalize_stage(rec.get("stage", ""))

        grouped[rec["batch_id"]].append(rec)

    # Sort each batch's events by timestamp (Nones go last)
    for batch_id, evts in grouped.items():
        grouped[batch_id] = sorted(
            evts,
            key=lambda r: r["timestamp_dt"] or datetime.max,
        )

    return dict(grouped)


def get_stage_record(
    batch_events: list[dict],
    stage: str,
) -> dict | None:
    """Return the first record matching the canonical stage, or None."""
    canon = _normalize_stage(stage)
    for evt in batch_events:
        if evt.get("stage_canonical") == canon:
            return evt
    return None


def fill_missing_stages(
    batch_events: list[dict],
) -> dict[str, dict | None]:
    """
    Return an ordered dict of stage → record (or None if that stage is absent).
    """
    stage_map: dict[str, dict | None] = {}
    for stage in STAGE_ORDER:
        stage_map[stage] = get_stage_record(batch_events, stage)
    return stage_map
