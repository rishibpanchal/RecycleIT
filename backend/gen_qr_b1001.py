"""
gen_qr_b1001.py
---------------
Generate signed EAS attestation QR codes for batches INV-B1001-1 to INV-B1001-4.

DB target: d:\Hackniche\traceability.db  (same path the API reads via ROOT_DIR)
"""

import sys
import sqlite3
import os
from pathlib import Path

# The API resolves DB as: routes/attestation.py -> .parent.parent.parent / traceability.db
# i.e.  d:\Hackniche\backend\routes  -> backend  -> Hackniche  -> traceability.db
BACKEND_DIR = Path(__file__).parent          # d:\Hackniche\backend
ROOT_DIR    = BACKEND_DIR.parent             # d:\Hackniche
DB_PATH     = str(ROOT_DIR / "traceability.db")

sys.path.insert(0, str(BACKEND_DIR))

print(f"[DB] Using database: {DB_PATH}")

# ── Ensure table exists ────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.execute("""
    CREATE TABLE IF NOT EXISTS worker_attestations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        stage INTEGER NOT NULL,
        worker_name TEXT NOT NULL,
        warehouse_code TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        signature TEXT NOT NULL,
        attestation_uid TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT 1,
        scenario_id TEXT DEFAULT '1',
        created_at TEXT NOT NULL
    )
""")
conn.commit()
conn.close()
print("[DB] worker_attestations table ready.")

# ── Stage definitions ─────────────────────────────────────────────────────────
#  Each entry: (batch_id, stage_num, stage_name, from_batch, worker, warehouse,
#               inputQty, outputQty, lossPercent, remarks)
STAGES = [
    ("INV-B1001-1", 1, "INWARD",       None,          "Worker_A", "WH-INWARD-01",
     1000, 1000, 0.0,  "Initial inward receipt of recycled material lot"),
    ("INV-B1001-2", 2, "SEGREGATION",  "INV-B1001-1", "Worker_B", "WH-SEG-01",
     1000,  960, 4.0,  "Material segregated by grade; 4% rejected waste removed"),
    ("INV-B1001-3", 3, "BALING",       "INV-B1001-2", "Worker_C", "WH-BALE-01",
      960,  950, 1.0,  "Compressed into standard bales; minor moisture loss"),
    ("INV-B1001-4", 4, "DISPATCH",     "INV-B1001-3", "Worker_D", "WH-DISP-01",
      950,  950, 0.0,  "Final quality check passed; dispatched to processor"),
]

# ── Generate QR codes ─────────────────────────────────────────────────────────
from attestation_generator import AttestationGenerator

gen = AttestationGenerator(DB_PATH)

for (batch_id, stage_num, stage_name, from_batch,
     worker, warehouse, in_qty, out_qty, loss_pct, remarks) in STAGES:

    step_meta = {
        "transform_id":           stage_num,
        "stageName":              stage_name,
        "from":                   from_batch,
        "to":                     batch_id,
        "mode":                   stage_name,
        # Fields the frontend BatchJourney component reads
        "inputQty":               in_qty,
        "outputQty":              out_qty,
        "lossPercent":            loss_pct,
        "remarks":                remarks,
        # Extra context
        "source_inventory_id":    from_batch,
        "target_inventory_id":    batch_id,
    }

    result = gen.create_worker_attestation(
        batch_id=batch_id,
        stage=stage_num,
        worker_name=worker,
        warehouse_code=warehouse,
        batch_metadata={"history": [step_meta], "latest_step": step_meta},
        scenario_id="1",
        skip_db_validation=True,
    )

    if result["success"]:
        print(f"\n✅  {batch_id}  [Stage {stage_num} – {stage_name}]")
        print(f"    Worker  : {worker} @ {warehouse}")
        print(f"    Qty     : {in_qty} → {out_qty}  (loss {loss_pct}%)")
        print(f"    QR      : {result['qr_code_path']}")
        print(f"    UID     : {result['attestationUID']}")
    else:
        print(f"\n❌  {batch_id}: {result.get('error')}")

print("\n🎉 All QR codes generated successfully!")
print(f"   Serve them via: http://localhost:8000/api/qr/attest_INV-B1001-X_stageY.png")

