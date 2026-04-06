"""
generate_mock_data.py
=====================
Generates realistic mock data for the Plastic Recycling Traceability system.

Creates 3 scenarios:
  Scenario 1 — Clean, normal supply chain (happy path, no anomalies)
  Scenario 2 — Ghost Inventory anomalies (REJECTED lots that keep flowing)
  Scenario 3 — Complex graph with splits, merges, cancellations, and rework

Output structure:
  problem_statement_3/
    Scenario 1/
      inventory_transforms.csv
      transaction_events.csv
    Scenario 2/
      ...
    Scenario 3/
      ...

Run:
    python generate_mock_data.py
"""

import os
import random
import csv
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()
random.seed(42)
Faker.seed(42)

# ─────────────────────────────────────────────────────────────
#  CONSTANTS
# ─────────────────────────────────────────────────────────────

TENANT_ID = "TENANT-001"

WAREHOUSES = {
    "WH-COLLECT": "Collection Center",
    "WH-WASH":    "Washing Plant",
    "WH-RECY":    "Recycling Plant",
    "WH-FACT":    "Manufacturing Factory",
}

# Process codes per warehouse — defines valid operations at each location
WAREHOUSE_PROCESS_MAP = {
    "WH-COLLECT": ["PR", "SEG", "MB"],   # Inward, Segregation, Baling
    "WH-WASH":    ["WTR", "MB", "QC"],   # Receipt, Washing, QC
    "WH-RECY":    ["WTR", "MB"],          # Receipt, Recycling/Granulation
    "WH-FACT":    ["PR", "MB", "SD"],     # Receipt, Production, Dispatch
}

# Loss percent ranges per lifecycle step — realistic values
LOSS_RANGES = {
    "PR":  (0.0,  2.0),   # Inward — minimal loss
    "SEG": (2.0,  8.0),   # Segregation — some contaminants removed
    "MB":  (1.0,  5.0),   # Baling — minor compression loss
    "WT":  (0.0,  1.0),   # Transfer — negligible
    "WTR": (0.0,  1.0),   # Receipt — negligible
    "QC":  (0.0,  3.0),   # QC — sample testing loss
    "SD":  (0.0,  1.0),   # Dispatch — negligible
}

# Quantity ranges per step (kg) — realistic recycling batch sizes
QUANTITY_RANGES = {
    "INWARD":    (800,  2000),
    "BALE":      (400,  900),
    "WASH":      (300,  800),
    "GRAN":      (200,  600),
    "PROD":      (150,  500),
}

VENDORS = [f"VENDOR-{i:02d}" for i in range(1, 8)]
REMARKS_NORMAL = [
    "Batch processed successfully.",
    "Standard operation completed.",
    "No issues observed.",
    "Material quality within acceptable range.",
    "Process completed as per SOP.",
    "",
]
REMARKS_ANOMALY = [
    "Material found contaminated post-processing.",
    "Operator error — batch progressed despite rejection.",
    "System override applied — escalated for review.",
    "Contamination detected but workflow continued.",
    "QC failure noted — batch forwarded in error.",
]

# ─────────────────────────────────────────────────────────────
#  ID GENERATORS
# ─────────────────────────────────────────────────────────────

_counters = {}

def _next_id(prefix: str) -> str:
    _counters[prefix] = _counters.get(prefix, 0) + 1
    return f"{prefix}-{_counters[prefix]:04d}"

def reset_counters():
    _counters.clear()

def txn_id():    return _next_id("TXN")
def trf_id():    return _next_id("TRF")
def inv_id(prefix): return _next_id(prefix)

# ─────────────────────────────────────────────────────────────
#  DATE HELPERS
# ─────────────────────────────────────────────────────────────

def start_date():
    return datetime(2024, 1, 1)

def advance_date(base: datetime, days_min=1, days_max=3) -> datetime:
    return base + timedelta(days=random.randint(days_min, days_max))

def fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

# ─────────────────────────────────────────────────────────────
#  CORE ROW BUILDERS
# ─────────────────────────────────────────────────────────────

def make_event(transaction_id, process_code, status, warehouse_code, date, remarks=""):
    """Build one row for transaction_events.csv"""
    return {
        "transaction_id":   transaction_id,
        "tenant_id":        TENANT_ID,
        "process_code":     process_code,
        "status":           status,
        "warehouse_code":   warehouse_code,
        "transaction_date": date,
        "remarks":          remarks or random.choice(REMARKS_NORMAL),
    }

def make_transform(transform_id, transaction_id, source_inv, dest_inv, quantity, loss_percent):
    """Build one row for inventory_transforms.csv"""
    return {
        "transform_id":             transform_id,
        "transaction_id":           transaction_id,
        "tenant_id":                TENANT_ID,
        "source_inventory_id":      source_inv,
        "destination_inventory_id": dest_inv,
        "quantity":                 round(quantity, 2),
        "loss_percent":             round(loss_percent, 2),
        "mode":                     "",   # left blank — grapher resolves from process_code+warehouse
    }

def apply_loss(quantity: float, process_code: str) -> tuple[float, float]:
    """Returns (output_quantity, loss_percent) after applying realistic loss."""
    lo, hi = LOSS_RANGES.get(process_code, (0.0, 2.0))
    loss_pct = round(random.uniform(lo, hi), 2)
    out_qty = round(quantity * (1 - loss_pct / 100), 2)
    return out_qty, loss_pct

# ─────────────────────────────────────────────────────────────
#  SCENARIO 1 — Clean Happy Path
#  Multiple independent collection chains, each flowing cleanly
#  through all 13 steps to finished products.
#  Zero anomalies. Tests the core traceability pipeline.
# ─────────────────────────────────────────────────────────────

def generate_scenario_1(num_chains=5):
    """
    Each chain: INV → SEG → BALE → [WT] → [WTR] → WASH → QC_PASS
                → [WT] → [WTR] → GRAN → [SD] → [PR] → PROD
    All transactions APPROVED. No splits or merges.
    """
    events     = []
    transforms = []
    date       = start_date()

    for _ in range(num_chains):
        qty = random.uniform(*QUANTITY_RANGES["INWARD"])
        date = advance_date(date, 1, 2)

        # ── Step 1: Inward at Collection Center ──────────────────
        t1 = txn_id();  tr1 = trf_id()
        src_null = "NULL"
        inv_raw  = inv_id("INV")
        qty_out, loss = apply_loss(qty, "PR")
        events.append(make_event(t1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr1, t1, src_null, inv_raw, qty_out, loss))

        # ── Step 2: Segregation ───────────────────────────────────
        date = advance_date(date)
        t2 = txn_id();  tr2 = trf_id()
        inv_seg  = inv_id("INV")
        qty_out, loss = apply_loss(qty_out, "SEG")
        events.append(make_event(t2, "SEG", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr2, t2, inv_raw, inv_seg, qty_out, loss))

        # ── Step 3: Baling ────────────────────────────────────────
        date = advance_date(date)
        t3 = txn_id();  tr3 = trf_id()
        inv_bale = inv_id("BALE")
        qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t3, "MB", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr3, t3, inv_seg, inv_bale, qty_out, loss))

        # ── Step 4: Transfer to Washing Plant ─────────────────────
        date = advance_date(date, 2, 4)
        t4 = txn_id();  tr4 = trf_id()
        inv_ship = inv_id("SHIP")
        qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t4, "WT", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr4, t4, inv_bale, inv_ship, qty_out, loss))

        # ── Step 5: Receipt at Washing Plant ──────────────────────
        date = advance_date(date, 1, 2)
        t5 = txn_id();  tr5 = trf_id()
        inv_recv = inv_id("RECV")
        qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t5, "WTR", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr5, t5, inv_ship, inv_recv, qty_out, loss))

        # ── Step 6: Washing ───────────────────────────────────────
        date = advance_date(date)
        t6 = txn_id();  tr6 = trf_id()
        inv_wash = inv_id("WASH")
        qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t6, "MB", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr6, t6, inv_recv, inv_wash, qty_out, loss))

        # ── Step 7: QC Pass ───────────────────────────────────────
        date = advance_date(date)
        t7 = txn_id();  tr7 = trf_id()
        inv_qc   = inv_id("INV")
        qty_out, loss = apply_loss(qty_out, "QC")
        events.append(make_event(t7, "QC", "APPROVED", "WH-WASH", fmt(date), "QC passed — purity within spec."))
        transforms.append(make_transform(tr7, t7, inv_wash, inv_qc, qty_out, loss))

        # ── Step 8: Transfer to Recycling Plant ───────────────────
        date = advance_date(date, 2, 3)
        t8 = txn_id();  tr8 = trf_id()
        inv_ship2 = inv_id("SHIP")
        qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t8, "WT", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr8, t8, inv_qc, inv_ship2, qty_out, loss))

        # ── Step 9: Receipt at Recycling Plant ────────────────────
        date = advance_date(date, 1, 2)
        t9 = txn_id();  tr9 = trf_id()
        inv_recv2 = inv_id("RECV")
        qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t9, "WTR", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr9, t9, inv_ship2, inv_recv2, qty_out, loss))

        # ── Step 10: Recycling / Granulation ──────────────────────
        date = advance_date(date, 1, 2)
        t10 = txn_id(); tr10 = trf_id()
        inv_gran = inv_id("GRAN")
        qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t10, "MB", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr10, t10, inv_recv2, inv_gran, qty_out, loss))

        # ── Step 11: Dispatch to Factory ──────────────────────────
        date = advance_date(date, 2, 4)
        t11 = txn_id(); tr11 = trf_id()
        inv_disp = inv_id("SHIP")
        qty_out, loss = apply_loss(qty_out, "SD")
        events.append(make_event(t11, "SD", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr11, t11, inv_gran, inv_disp, qty_out, loss))

        # ── Step 12: Factory Receipt ──────────────────────────────
        date = advance_date(date, 1, 2)
        t12 = txn_id(); tr12 = trf_id()
        inv_fact_recv = inv_id("RECV")
        qty_out, loss = apply_loss(qty_out, "PR")
        events.append(make_event(t12, "PR", "APPROVED", "WH-FACT", fmt(date)))
        transforms.append(make_transform(tr12, t12, inv_disp, inv_fact_recv, qty_out, loss))

        # ── Step 13: Production ───────────────────────────────────
        date = advance_date(date, 1, 3)
        t13 = txn_id(); tr13 = trf_id()
        inv_prod = inv_id("PIPE")
        qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t13, "MB", "APPROVED", "WH-FACT", fmt(date), "Finished product manufactured."))
        transforms.append(make_transform(tr13, t13, inv_fact_recv, inv_prod, qty_out, loss))

    return events, transforms


# ─────────────────────────────────────────────────────────────
#  SCENARIO 2 — Ghost Inventory Anomalies
#  Several chains where REJECTED/CANCELLED transactions
#  incorrectly allow material to keep flowing downstream.
#  This is the core anomaly the system must detect.
# ─────────────────────────────────────────────────────────────

def generate_scenario_2(num_normal=3, num_anomaly_chains=3):
    """
    Normal chains: fully clean as in Scenario 1.
    Anomaly chains: QC FAILS at the washing plant, but material
    still proceeds to the recycling plant — Ghost Inventory.
    Also includes CANCELLED transfers that still get receipted.
    """
    events     = []
    transforms = []
    date       = start_date()

    # ── Normal chains first ───────────────────────────────────
    for _ in range(num_normal):
        qty  = random.uniform(*QUANTITY_RANGES["INWARD"])
        date = advance_date(date, 1, 2)

        t1 = txn_id(); tr1 = trf_id()
        inv_raw  = inv_id("INV")
        qty_out, loss = apply_loss(qty, "PR")
        events.append(make_event(t1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr1, t1, "NULL", inv_raw, qty_out, loss))

        date = advance_date(date); t2 = txn_id(); tr2 = trf_id()
        inv_seg = inv_id("INV"); qty_out, loss = apply_loss(qty_out, "SEG")
        events.append(make_event(t2, "SEG", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr2, t2, inv_raw, inv_seg, qty_out, loss))

        date = advance_date(date); t3 = txn_id(); tr3 = trf_id()
        inv_bale = inv_id("BALE"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t3, "MB", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr3, t3, inv_seg, inv_bale, qty_out, loss))

        date = advance_date(date, 2, 4); t4 = txn_id(); tr4 = trf_id()
        inv_ship = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t4, "WT", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr4, t4, inv_bale, inv_ship, qty_out, loss))

        date = advance_date(date, 1, 2); t5 = txn_id(); tr5 = trf_id()
        inv_recv = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t5, "WTR", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr5, t5, inv_ship, inv_recv, qty_out, loss))

        date = advance_date(date); t6 = txn_id(); tr6 = trf_id()
        inv_wash = inv_id("WASH"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t6, "MB", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr6, t6, inv_recv, inv_wash, qty_out, loss))

        date = advance_date(date); t7 = txn_id(); tr7 = trf_id()
        inv_qc   = inv_id("INV"); qty_out, loss = apply_loss(qty_out, "QC")
        events.append(make_event(t7, "QC", "APPROVED", "WH-WASH", fmt(date), "QC passed."))
        transforms.append(make_transform(tr7, t7, inv_wash, inv_qc, qty_out, loss))

        date = advance_date(date, 2, 3); t8 = txn_id(); tr8 = trf_id()
        inv_ship2 = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t8, "WT", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr8, t8, inv_qc, inv_ship2, qty_out, loss))

        date = advance_date(date, 1, 2); t9 = txn_id(); tr9 = trf_id()
        inv_recv2 = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t9, "WTR", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr9, t9, inv_ship2, inv_recv2, qty_out, loss))

        date = advance_date(date, 1, 2); t10 = txn_id(); tr10 = trf_id()
        inv_gran = inv_id("GRAN"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t10, "MB", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr10, t10, inv_recv2, inv_gran, qty_out, loss))

        date = advance_date(date, 2, 4); t11 = txn_id(); tr11 = trf_id()
        inv_disp = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "SD")
        events.append(make_event(t11, "SD", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr11, t11, inv_gran, inv_disp, qty_out, loss))

        date = advance_date(date, 1, 2); t12 = txn_id(); tr12 = trf_id()
        inv_fact_recv = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "PR")
        events.append(make_event(t12, "PR", "APPROVED", "WH-FACT", fmt(date)))
        transforms.append(make_transform(tr12, t12, inv_disp, inv_fact_recv, qty_out, loss))

        date = advance_date(date, 1, 3); t13 = txn_id(); tr13 = trf_id()
        inv_prod = inv_id("PIPE"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t13, "MB", "APPROVED", "WH-FACT", fmt(date)))
        transforms.append(make_transform(tr13, t13, inv_fact_recv, inv_prod, qty_out, loss))

    # ── Anomaly Type A: QC REJECTED → material continues anyway ─
    for _ in range(num_anomaly_chains):
        qty  = random.uniform(*QUANTITY_RANGES["INWARD"])
        date = advance_date(date, 1, 2)

        t1 = txn_id(); tr1 = trf_id()
        inv_raw  = inv_id("INV"); qty_out, loss = apply_loss(qty, "PR")
        events.append(make_event(t1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr1, t1, "NULL", inv_raw, qty_out, loss))

        date = advance_date(date); t2 = txn_id(); tr2 = trf_id()
        inv_seg = inv_id("INV"); qty_out, loss = apply_loss(qty_out, "SEG")
        events.append(make_event(t2, "SEG", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr2, t2, inv_raw, inv_seg, qty_out, loss))

        date = advance_date(date); t3 = txn_id(); tr3 = trf_id()
        inv_bale = inv_id("BALE"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t3, "MB", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr3, t3, inv_seg, inv_bale, qty_out, loss))

        date = advance_date(date, 2, 4); t4 = txn_id(); tr4 = trf_id()
        inv_ship = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t4, "WT", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr4, t4, inv_bale, inv_ship, qty_out, loss))

        date = advance_date(date, 1, 2); t5 = txn_id(); tr5 = trf_id()
        inv_recv = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t5, "WTR", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr5, t5, inv_ship, inv_recv, qty_out, loss))

        date = advance_date(date); t6 = txn_id(); tr6 = trf_id()
        inv_wash = inv_id("WASH"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t6, "MB", "APPROVED", "WH-WASH", fmt(date)))
        transforms.append(make_transform(tr6, t6, inv_recv, inv_wash, qty_out, loss))

        # ⚠ ANOMALY: QC REJECTED — but lot still gets transferred
        date = advance_date(date)
        t7_reject = txn_id(); tr7 = trf_id()
        inv_reject = inv_id("REJECT")
        events.append(make_event(
            t7_reject, "QC", "REJECTED", "WH-WASH", fmt(date),
            random.choice(REMARKS_ANOMALY)
        ))
        transforms.append(make_transform(tr7, t7_reject, inv_wash, inv_reject, qty_out, 0.0))

        # Ghost: rejected lot continues to Transfer — this is the broken trace
        date = advance_date(date, 1, 2); t8 = txn_id(); tr8 = trf_id()
        inv_ship2 = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "WT")
        events.append(make_event(t8, "WT", "APPROVED", "WH-WASH", fmt(date),
                                  "Transfer processed — QC rejection not checked."))
        transforms.append(make_transform(tr8, t8, inv_reject, inv_ship2, qty_out, loss))

        date = advance_date(date, 1, 2); t9 = txn_id(); tr9 = trf_id()
        inv_recv2 = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "WTR")
        events.append(make_event(t9, "WTR", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr9, t9, inv_ship2, inv_recv2, qty_out, loss))

        date = advance_date(date, 1, 2); t10 = txn_id(); tr10 = trf_id()
        inv_gran = inv_id("GRAN"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t10, "MB", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr10, t10, inv_recv2, inv_gran, qty_out, loss))

        date = advance_date(date, 2, 4); t11 = txn_id(); tr11 = trf_id()
        inv_disp = inv_id("SHIP"); qty_out, loss = apply_loss(qty_out, "SD")
        events.append(make_event(t11, "SD", "APPROVED", "WH-RECY", fmt(date)))
        transforms.append(make_transform(tr11, t11, inv_gran, inv_disp, qty_out, loss))

        date = advance_date(date, 1, 2); t12 = txn_id(); tr12 = trf_id()
        inv_fact_recv = inv_id("RECV"); qty_out, loss = apply_loss(qty_out, "PR")
        events.append(make_event(t12, "PR", "APPROVED", "WH-FACT", fmt(date)))
        transforms.append(make_transform(tr12, t12, inv_disp, inv_fact_recv, qty_out, loss))

        date = advance_date(date, 1, 3); t13 = txn_id(); tr13 = trf_id()
        # Contaminated finished product — still gets produced
        inv_prod = inv_id("PIPE")
        events.append(make_event(t13, "MB", "APPROVED", "WH-FACT", fmt(date),
                                  "Finished product — contamination risk from upstream QC failure."))
        transforms.append(make_transform(tr13, t13, inv_fact_recv, inv_prod, qty_out, 0.0))

    # ── Anomaly Type B: CANCELLED transfer still gets receipted ──
    for _ in range(2):
        qty  = random.uniform(*QUANTITY_RANGES["INWARD"])
        date = advance_date(date, 1, 2)

        t1 = txn_id(); tr1 = trf_id()
        inv_raw  = inv_id("INV"); qty_out, loss = apply_loss(qty, "PR")
        events.append(make_event(t1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr1, t1, "NULL", inv_raw, qty_out, loss))

        date = advance_date(date); t2 = txn_id(); tr2 = trf_id()
        inv_bale = inv_id("BALE"); qty_out, loss = apply_loss(qty_out, "MB")
        events.append(make_event(t2, "MB", "APPROVED", "WH-COLLECT", fmt(date)))
        transforms.append(make_transform(tr2, t2, inv_raw, inv_bale, qty_out, loss))

        # ⚠ ANOMALY: WT CANCELLED — but receipt still happens
        date = advance_date(date, 2, 3)
        t_cancel = txn_id(); tr_cancel = trf_id()
        inv_cancel_ship = inv_id("SHIP")
        events.append(make_event(t_cancel, "WT", "CANCELLED", "WH-COLLECT", fmt(date),
                                  random.choice(REMARKS_ANOMALY)))
        transforms.append(make_transform(tr_cancel, t_cancel, inv_bale, inv_cancel_ship, qty_out, 0.0))

        date = advance_date(date, 1, 2)
        t_ghost_recv = txn_id(); tr_ghost = trf_id()
        inv_ghost_recv = inv_id("RECV")
        events.append(make_event(t_ghost_recv, "WTR", "APPROVED", "WH-WASH", fmt(date),
                                  "Receipt processed — transfer cancellation not propagated."))
        transforms.append(make_transform(tr_ghost, t_ghost_recv, inv_cancel_ship, inv_ghost_recv, qty_out, 0.0))

    return events, transforms


# ─────────────────────────────────────────────────────────────
#  SCENARIO 3 — Complex Graph: Splits, Merges, Rework
#  Tests the most advanced graph structures:
#  - One lot split into multiple child lots
#  - Multiple lots merged into one blended batch
#  - A rejected lot that gets reworked and re-enters the chain
#  - A correctly terminated rejection (no downstream)
# ─────────────────────────────────────────────────────────────

def generate_scenario_3():
    events     = []
    transforms = []
    date       = start_date()

    # ── Chain A: A lot splits into 2 bales after segregation ─────
    qty_a = random.uniform(1500, 2000)
    date  = advance_date(date, 1, 2)

    tA1 = txn_id(); trA1 = trf_id()
    inv_A_raw = inv_id("INV"); qty_out_a, loss = apply_loss(qty_a, "PR")
    events.append(make_event(tA1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trA1, tA1, "NULL", inv_A_raw, qty_out_a, loss))

    date = advance_date(date); tA2 = txn_id(); trA2 = trf_id()
    inv_A_seg = inv_id("INV"); qty_out_a, loss = apply_loss(qty_out_a, "SEG")
    events.append(make_event(tA2, "SEG", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trA2, tA2, inv_A_raw, inv_A_seg, qty_out_a, loss))

    # ── SPLIT: One segregated lot → two bale lots ─────────────────
    date = advance_date(date)
    split_qty_1 = round(qty_out_a * 0.6, 2)
    split_qty_2 = round(qty_out_a * 0.4, 2)

    tA3a = txn_id(); trA3a = trf_id()
    inv_A_bale1 = inv_id("BALE")
    events.append(make_event(tA3a, "MB", "APPROVED", "WH-COLLECT", fmt(date), "Split batch — part 1 of 2"))
    transforms.append(make_transform(trA3a, tA3a, inv_A_seg, inv_A_bale1, split_qty_1, 1.5))

    tA3b = txn_id(); trA3b = trf_id()
    inv_A_bale2 = inv_id("BALE")
    events.append(make_event(tA3b, "MB", "APPROVED", "WH-COLLECT", fmt(date), "Split batch — part 2 of 2"))
    transforms.append(make_transform(trA3b, tA3b, inv_A_seg, inv_A_bale2, split_qty_2, 1.5))

    # ── Bale 1 flows normally to washing ─────────────────────────
    date = advance_date(date, 2, 4)
    tA4 = txn_id(); trA4 = trf_id()
    inv_A_ship1 = inv_id("SHIP"); qty_s1, loss = apply_loss(split_qty_1, "WT")
    events.append(make_event(tA4, "WT", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trA4, tA4, inv_A_bale1, inv_A_ship1, qty_s1, loss))

    date = advance_date(date, 1, 2)
    tA5 = txn_id(); trA5 = trf_id()
    inv_A_recv1 = inv_id("RECV"); qty_s1, loss = apply_loss(qty_s1, "WTR")
    events.append(make_event(tA5, "WTR", "APPROVED", "WH-WASH", fmt(date)))
    transforms.append(make_transform(trA5, tA5, inv_A_ship1, inv_A_recv1, qty_s1, loss))

    date = advance_date(date)
    tA6 = txn_id(); trA6 = trf_id()
    inv_A_wash1 = inv_id("WASH"); qty_s1, loss = apply_loss(qty_s1, "MB")
    events.append(make_event(tA6, "MB", "APPROVED", "WH-WASH", fmt(date)))
    transforms.append(make_transform(trA6, tA6, inv_A_recv1, inv_A_wash1, qty_s1, loss))

    # ── Bale 2: Transfer CANCELLED — correctly terminated ─────────
    date = advance_date(date, 2, 4)
    tA4b_cancel = txn_id(); trA4b = trf_id()
    inv_A_ship2_cancel = inv_id("SHIP")
    events.append(make_event(tA4b_cancel, "WT", "CANCELLED", "WH-COLLECT", fmt(date),
                              "Transfer cancelled — vehicle breakdown."))
    transforms.append(make_transform(trA4b, tA4b_cancel, inv_A_bale2, inv_A_ship2_cancel, split_qty_2, 0.0))
    # Note: inv_A_ship2_cancel has no outgoing edges — correctly terminated

    # ── Chain B: Independent collection, flows to same washing step ─
    qty_b = random.uniform(800, 1200)
    date  = advance_date(date, 1, 2)

    tB1 = txn_id(); trB1 = trf_id()
    inv_B_raw = inv_id("INV"); qty_out_b, loss = apply_loss(qty_b, "PR")
    events.append(make_event(tB1, "PR", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trB1, tB1, "NULL", inv_B_raw, qty_out_b, loss))

    date = advance_date(date); tB2 = txn_id(); trB2 = trf_id()
    inv_B_seg = inv_id("INV"); qty_out_b, loss = apply_loss(qty_out_b, "SEG")
    events.append(make_event(tB2, "SEG", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trB2, tB2, inv_B_raw, inv_B_seg, qty_out_b, loss))

    date = advance_date(date); tB3 = txn_id(); trB3 = trf_id()
    inv_B_bale = inv_id("BALE"); qty_out_b, loss = apply_loss(qty_out_b, "MB")
    events.append(make_event(tB3, "MB", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trB3, tB3, inv_B_seg, inv_B_bale, qty_out_b, loss))

    date = advance_date(date, 2, 4); tB4 = txn_id(); trB4 = trf_id()
    inv_B_ship = inv_id("SHIP"); qty_out_b, loss = apply_loss(qty_out_b, "WT")
    events.append(make_event(tB4, "WT", "APPROVED", "WH-COLLECT", fmt(date)))
    transforms.append(make_transform(trB4, tB4, inv_B_bale, inv_B_ship, qty_out_b, loss))

    date = advance_date(date, 1, 2); tB5 = txn_id(); trB5 = trf_id()
    inv_B_recv = inv_id("RECV"); qty_out_b, loss = apply_loss(qty_out_b, "WTR")
    events.append(make_event(tB5, "WTR", "APPROVED", "WH-WASH", fmt(date)))
    transforms.append(make_transform(trB5, tB5, inv_B_ship, inv_B_recv, qty_out_b, loss))

    date = advance_date(date); tB6 = txn_id(); trB6 = trf_id()
    inv_B_wash = inv_id("WASH"); qty_out_b, loss = apply_loss(qty_out_b, "MB")
    events.append(make_event(tB6, "MB", "APPROVED", "WH-WASH", fmt(date)))
    transforms.append(make_transform(trB6, tB6, inv_B_recv, inv_B_wash, qty_out_b, loss))

    # ── MERGE: Chain A wash1 + Chain B wash → single blended QC batch ─
    date = advance_date(date)
    merged_qty = round(qty_s1 + qty_out_b, 2)

    tM_qc = txn_id(); trM_A = trf_id(); trM_B = trf_id()
    inv_merged_qc = inv_id("INV")

    events.append(make_event(tM_qc, "QC", "APPROVED", "WH-WASH", fmt(date),
                              "QC on blended batch — both sources passed."))
    # Two transforms pointing to the same destination = MERGE
    transforms.append(make_transform(trM_A, tM_qc, inv_A_wash1, inv_merged_qc, qty_s1, 1.0))
    transforms.append(make_transform(trM_B, tM_qc, inv_B_wash, inv_merged_qc, qty_out_b, 1.0))

    # ── Merged batch flows normally to recycling and production ───
    date = advance_date(date, 2, 3); tR1 = txn_id(); trR1 = trf_id()
    inv_R_ship = inv_id("SHIP"); merged_qty, loss = apply_loss(merged_qty, "WT")
    events.append(make_event(tR1, "WT", "APPROVED", "WH-WASH", fmt(date)))
    transforms.append(make_transform(trR1, tR1, inv_merged_qc, inv_R_ship, merged_qty, loss))

    date = advance_date(date, 1, 2); tR2 = txn_id(); trR2 = trf_id()
    inv_R_recv = inv_id("RECV"); merged_qty, loss = apply_loss(merged_qty, "WTR")
    events.append(make_event(tR2, "WTR", "APPROVED", "WH-RECY", fmt(date)))
    transforms.append(make_transform(trR2, tR2, inv_R_ship, inv_R_recv, merged_qty, loss))

    # ── REWORK: First granulation attempt REJECTED, reworked and re-processed ─
    date = advance_date(date, 1, 2)
    t_gran_fail = txn_id(); tr_gran_fail = trf_id()
    inv_gran_reject = inv_id("REJECT")
    events.append(make_event(t_gran_fail, "MB", "REJECTED", "WH-RECY", fmt(date),
                              "Granulation failed — temperature variance. Sent for rework."))
    transforms.append(make_transform(tr_gran_fail, t_gran_fail, inv_R_recv, inv_gran_reject, merged_qty, 0.0))

    # Rework: rejected granules re-enter the recycling step
    date = advance_date(date, 2, 3)
    t_rework = txn_id(); tr_rework = trf_id()
    inv_rework = inv_id("GRAN")
    rework_qty = round(merged_qty * 0.90, 2)  # 10% lost in rework
    events.append(make_event(t_rework, "MB", "APPROVED", "WH-RECY", fmt(date),
                              "Rework batch — temperature corrected. Granulation successful."))
    transforms.append(make_transform(tr_rework, t_rework, inv_gran_reject, inv_rework, rework_qty, 10.0))

    date = advance_date(date, 2, 4); tF1 = txn_id(); trF1 = trf_id()
    inv_F_disp = inv_id("SHIP"); rework_qty, loss = apply_loss(rework_qty, "SD")
    events.append(make_event(tF1, "SD", "APPROVED", "WH-RECY", fmt(date)))
    transforms.append(make_transform(trF1, tF1, inv_rework, inv_F_disp, rework_qty, loss))

    date = advance_date(date, 1, 2); tF2 = txn_id(); trF2 = trf_id()
    inv_F_recv = inv_id("RECV"); rework_qty, loss = apply_loss(rework_qty, "PR")
    events.append(make_event(tF2, "PR", "APPROVED", "WH-FACT", fmt(date)))
    transforms.append(make_transform(trF2, tF2, inv_F_disp, inv_F_recv, rework_qty, loss))

    date = advance_date(date, 1, 3); tF3 = txn_id(); trF3 = trf_id()
    inv_F_prod = inv_id("PIPE"); rework_qty, loss = apply_loss(rework_qty, "MB")
    events.append(make_event(tF3, "MB", "APPROVED", "WH-FACT", fmt(date),
                              "Finished product from reworked granules."))
    transforms.append(make_transform(trF3, tF3, inv_F_recv, inv_F_prod, rework_qty, loss))

    return events, transforms


# ─────────────────────────────────────────────────────────────
#  CSV WRITER
# ─────────────────────────────────────────────────────────────

EVENTS_FIELDS = [
    "transaction_id", "tenant_id", "process_code",
    "status", "warehouse_code", "transaction_date", "remarks",
]

TRANSFORMS_FIELDS = [
    "transform_id", "transaction_id", "tenant_id",
    "source_inventory_id", "destination_inventory_id",
    "quantity", "loss_percent", "mode",
]

def write_csv(filepath: str, fieldnames: list, rows: list):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written: {filepath}  ({len(rows)} rows)")


# ─────────────────────────────────────────────────────────────
#  ENTRYPOINT
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
    PROBLEM_DIR  = os.path.join(BASE_DIR, "new_data")

    scenarios = {
        "Scenario 1": generate_scenario_1,
        "Scenario 2": generate_scenario_2,
        "Scenario 3": generate_scenario_3,
    }

    for name, generator in scenarios.items():
        print(f"\n{'='*50}")
        print(f" Generating: {name}")
        print(f"{'='*50}")

        reset_counters()        # fresh IDs per scenario
        events, transforms = generator()

        out_dir = os.path.join(PROBLEM_DIR, name)
        write_csv(
            os.path.join(out_dir, "transaction_events.csv"),
            EVENTS_FIELDS,
            events,
        )
        write_csv(
            os.path.join(out_dir, "inventory_transforms.csv"),
            TRANSFORMS_FIELDS,
            transforms,
        )

        # Quick stats
        anomaly_count = sum(
            1 for e in events if e["status"] in ("REJECTED", "CANCELLED")
        )
        print(f"  Events: {len(events)}  |  Transforms: {len(transforms)}  |  Anomalies: {anomaly_count}")

    print("\n[OK] All mock data generated.")