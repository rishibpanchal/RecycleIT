"""
fingerprint/feature_engineering.py
=====================================
Computes all features defined in the Material Fingerprint spec.

Features per batch
------------------
Stage-level:
  loss_s            – (qty_in_s - qty_out_s) / qty_in_s  (0 if qty_in=0)
  efficiency_s      – qty_out_s / qty_in_s                (0 if qty_in=0)
  time_s            – hours between stage s and stage s+1

Batch-level:
  total_loss        – (Q_collection - Q_dispatch) / Q_collection
  avg_stage_loss    – mean(loss_s)
  total_time        – hours from collection to dispatch
  avg_stage_time    – mean(time_s)
  material_consistency – 1 if same material across all stages, else 0

Vendor-level (computed across all batches):
  vendor_reliability – 1 - average(total_loss) per vendor
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .preprocessor import STAGE_ORDER, fill_missing_stages
from meta_profit_engine import compute_meta_profit


# ── per-stage helpers ──────────────────────────────────────────────────────────

def _safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if denominator == 0:
        return default
    return numerator / denominator


def compute_stage_loss(qty_in: float, qty_out: float) -> float:
    return _safe_div(qty_in - qty_out, qty_in)


def compute_stage_efficiency(qty_in: float, qty_out: float) -> float:
    return _safe_div(qty_out, qty_in)


def compute_stage_time_hours(
    stage_map: dict[str, dict | None],
    stage: str,
) -> float | None:
    """Hours between the given stage and the next one in STAGE_ORDER."""
    idx = STAGE_ORDER.index(stage)
    if idx >= len(STAGE_ORDER) - 1:
        return None  # dispatch is the last stage — no "next"

    current = stage_map.get(stage)
    next_stage = stage_map.get(STAGE_ORDER[idx + 1])

    if current is None or next_stage is None:
        return None
    if current.get("timestamp_dt") is None or next_stage.get("timestamp_dt") is None:
        return None

    delta = next_stage["timestamp_dt"] - current["timestamp_dt"]
    return abs(delta.total_seconds()) / 3600


# ── batch-level ────────────────────────────────────────────────────────────────

def compute_batch_features(
    batch_id: str,
    batch_events: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Compute all features for a single batch.

    Returns a dict with keys:
      - batch_id
      - material_type, vendor (taken from first event)
      - stage_features: dict[stage -> {loss, efficiency, time_hours}]
      - total_loss
      - avg_stage_loss
      - total_time
      - avg_stage_time
      - material_consistency
    """
    stage_map = fill_missing_stages(batch_events)

    # ── stage-level ─────────────────────────────────────────────
    stage_features: dict[str, dict] = {}
    stage_losses: list[float] = []
    stage_times: list[float] = []

    for stage in STAGE_ORDER:
        rec = stage_map.get(stage)
        if rec is None:
            stage_features[stage] = {
                "loss": None,
                "efficiency": None,
                "time_hours": None,
            }
            continue

        qty_in = float(rec.get("quantity_in") or 0)
        qty_out = float(rec.get("quantity_out") or 0)

        loss = compute_stage_loss(qty_in, qty_out)
        eff = compute_stage_efficiency(qty_in, qty_out)

        # time is between this stage and next
        time_h = compute_stage_time_hours(stage_map, stage)

        stage_features[stage] = {
            "loss": loss,
            "efficiency": eff,
            "time_hours": time_h,
        }

        stage_losses.append(loss)
        if time_h is not None:
            stage_times.append(time_h)

    # ── total loss ───────────────────────────────────────────────
    coll_rec = stage_map.get("collection")
    disp_rec = stage_map.get("dispatch")

    if coll_rec is not None and disp_rec is not None:
        q_collection = float(coll_rec.get("quantity_out") or 0)
        q_dispatch = float(disp_rec.get("quantity_out") or 0)
        total_loss = _safe_div(q_collection - q_dispatch, q_collection)
    else:
        total_loss = None

    # ── total & avg times ────────────────────────────────────────
    if (
        coll_rec is not None
        and disp_rec is not None
        and coll_rec.get("timestamp_dt") is not None
        and disp_rec.get("timestamp_dt") is not None
    ):
        delta = disp_rec["timestamp_dt"] - coll_rec["timestamp_dt"]
        total_time = abs(delta.total_seconds()) / 3600
    else:
        total_time = None

    avg_stage_loss = sum(stage_losses) / len(stage_losses) if stage_losses else None
    avg_stage_time = sum(stage_times) / len(stage_times) if stage_times else None

    # ── material consistency ─────────────────────────────────────
    material_types = set(
        rec.get("material_type")
        for rec in batch_events
        if rec.get("material_type") is not None
    )
    material_consistency = 1 if len(material_types) <= 1 else 0

    # ── meta ─────────────────────────────────────────────────────
    first = batch_events[0] if batch_events else {}
    material_type = first.get("material_type")
    vendor = first.get("vendor")

    # ── meta profit ──────────────────────────────────────────────
    from datetime import datetime
    def parse_ts(ts: str) -> datetime:
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except (ValueError, TypeError, AttributeError):
            return datetime.min

    sorted_events = sorted(batch_events, key=lambda r: parse_ts(r.get("timestamp", "")))
    profit_metrics = compute_meta_profit(sorted_events)
    meta_profit = profit_metrics.get("meta_profit", 0.0)

    return {
        "batch_id": batch_id,
        "material_type": material_type,
        "vendor": vendor,
        "stage_features": stage_features,
        "total_loss": total_loss,
        "avg_stage_loss": avg_stage_loss,
        "total_time": total_time,
        "avg_stage_time": avg_stage_time,
        "material_consistency": material_consistency,
        "meta_profit": meta_profit,
    }


# ── cross-batch vendor reliability ────────────────────────────────────────────

def compute_vendor_reliability(
    all_batch_features: list[dict[str, Any]],
) -> dict[str, float]:
    """
    vendor_reliability = 1 - mean(total_loss for all batches from that vendor)

    Only batches with a non-None total_loss contribute.
    """
    vendor_losses: dict[str, list[float]] = defaultdict(list)

    for bf in all_batch_features:
        vendor = bf.get("vendor")
        total_loss = bf.get("total_loss")
        if vendor is not None and total_loss is not None:
            vendor_losses[vendor].append(total_loss)

    return {
        vendor: 1 - (sum(losses) / len(losses))
        for vendor, losses in vendor_losses.items()
    }


# ── main pipeline helper ──────────────────────────────────────────────────────

def engineer_features(
    grouped: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """
    Run feature engineering for every batch in *grouped*.

    Parameters
    ----------
    grouped : dict[str, list[dict]]
        Output of ``preprocessor.preprocess``.

    Returns
    -------
    list[dict]
        One feature dict per batch, augmented with ``vendor_reliability``.
    """
    all_features = [
        compute_batch_features(batch_id, events)
        for batch_id, events in grouped.items()
    ]

    vendor_reliability = compute_vendor_reliability(all_features)

    for bf in all_features:
        bf["vendor_reliability"] = vendor_reliability.get(bf.get("vendor"))

    return all_features
