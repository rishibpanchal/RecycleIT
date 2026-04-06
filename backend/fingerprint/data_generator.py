"""
fingerprint/data_generator.py
==============================
Generates synthetic lifecycle data for testing the Material Fingerprint pipeline,
following the schema:

    {
        "batch_id": str,
        "material_type": str,
        "vendor": str,
        "stage": str,          # collection | sorting | processing | recycling | dispatch
        "quantity_in": float,
        "quantity_out": float,
        "timestamp": str,      # ISO-8601
    }
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any

STAGES = ["collection", "sorting", "processing", "recycling", "dispatch"]

MATERIAL_TYPES = ["PET", "HDPE", "PVC", "LDPE", "PP", "PS"]

VENDORS = [f"VENDOR-{i:02d}" for i in range(1, 8)]

# Loss % range per stage (min, max)
_STAGE_LOSS: dict[str, tuple[float, float]] = {
    "collection": (1.0, 4.0),
    "sorting": (3.0, 9.0),
    "processing": (2.0, 7.0),
    "recycling": (2.0, 6.0),
    "dispatch": (0.5, 2.0),
}

# Hours between stages (mean, std)
_STAGE_DELAY_HOURS: dict[str, tuple[float, float]] = {
    "collection": (24, 6),
    "sorting": (36, 12),
    "processing": (48, 12),
    "recycling": (72, 24),
    "dispatch": (24, 6),
}


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def generate_batch(
    batch_id: str,
    start_qty: float = 1000.0,
    start_dt: datetime | None = None,
    vendor: str | None = None,
    material_type: str | None = None,
    rng: random.Random | None = None,
    consistency: bool = True,
) -> list[dict[str, Any]]:
    """
    Generate one batch's worth of lifecycle records, one per stage.

    Parameters
    ----------
    batch_id : str
    start_qty : float
        Quantity at collection stage.
    start_dt : datetime, optional
        Start timestamp. Defaults to 2024-01-01.
    vendor : str, optional
        Fixed vendor for all stages. Random if None.
    material_type : str, optional
        Material type. Random if None. If consistency=False, changes at a random stage.
    rng : random.Random, optional
        RNG for reproducibility.
    consistency : bool
        If False, randomly change material_type at one stage.
    """
    if rng is None:
        rng = random.Random()
    if start_dt is None:
        start_dt = datetime(2025, 1, 1)
    if vendor is None:
        vendor = rng.choice(VENDORS)
    if material_type is None:
        material_type = rng.choice(MATERIAL_TYPES)

    # Optionally introduce material inconsistency
    change_at = None
    if not consistency:
        change_at = rng.choice(STAGES[1:])  # Never change at collection

    records: list[dict[str, Any]] = []
    qty_in = start_qty
    current_dt = start_dt

    # ~20% chance to be an incomplete batch (in stock/processing)
    num_stages = len(STAGES)
    if rng.random() < 0.2:
        num_stages = rng.randint(1, len(STAGES) - 1)

    for stage in STAGES[:num_stages]:
        lo, hi = _STAGE_LOSS[stage]
        loss_pct = rng.uniform(lo, hi) / 100
        qty_out = round(qty_in * (1 - loss_pct), 4)

        mat = material_type
        if change_at == stage:
            remaining = [m for m in MATERIAL_TYPES if m != material_type]
            mat = rng.choice(remaining)

        records.append(
            {
                "batch_id": batch_id,
                "material_type": mat,
                "vendor": vendor,
                "stage": stage,
                "quantity_in": round(qty_in, 4),
                "quantity_out": round(qty_out, 4),
                "timestamp": _iso(current_dt),
            }
        )

        # Advance time to next stage
        mean_h, std_h = _STAGE_DELAY_HOURS[stage]
        hours_delta = max(1.0, rng.gauss(mean_h, std_h))
        current_dt = current_dt + timedelta(hours=hours_delta)
        qty_in = qty_out  # next stage receives what this one output

    return records


def generate_dataset(
    n_batches: int = 20,
    seed: int = 42,
) -> list[dict[str, Any]]:
    """
    Generate a full synthetic dataset with *n_batches* batches.

    Returns a flat list of records (all batches interleaved by batch_id).
    """
    rng = random.Random(seed)
    all_records: list[dict[str, Any]] = []
    start = datetime(2024, 1, 1)

    for i in range(n_batches):
        batch_id = f"B{101 + i}"
        offset_days = rng.uniform(0, 10)
        batch_start = start + timedelta(days=offset_days)
        start_qty = rng.uniform(600, 2000)
        consistency = rng.random() > 0.15  # ~15% batches have material inconsistency

        records = generate_batch(
            batch_id=batch_id,
            start_qty=start_qty,
            start_dt=batch_start,
            rng=rng,
            consistency=consistency,
        )
        all_records.extend(records)

    return all_records
