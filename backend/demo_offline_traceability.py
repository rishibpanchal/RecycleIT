import os
import sys
import json
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from attestation_generator import AttestationGenerator
import qrcode
from PIL import Image
# Helper to read QR code without pyzbar (which has DLL issues on Windows)
# For the demo, we literally generated the image so we can just read the QR content directly
# via cv2 and opencv, OR since this is a theoretical simulation we can just mock the 
# extraction for the demo to show the EAS chain link working perfectly

# But cv2's QRCodeDetector is a great offline alternative.
import cv2
def read_qr_code(filepath):
    img = cv2.imread(filepath)
    detector = cv2.QRCodeDetector()
    data, _, _ = detector.detectAndDecode(img)
    if data:
        return data
    return None

def main():
    print("🚀 Starting Offline Traceability Demo via EAS Attestations...")
    db_path = os.path.join(os.path.dirname(__file__), "scenarios.db")
    
    # Ensure table exists
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.execute('''
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
    ''')
    conn.commit()
    conn.close()

    # Optional: we can pass a dummy db path here since we will skip DB validation for the demo
    generator = AttestationGenerator(db_path)
    
    # ---------------------------------------------------------
    # STAGE 1: INWARD
    print("\n[STAGE 1] Creating Genesis Attestation for Lot (INWARD)")
    step_1_meta = {
        "transform_id": 1,
        "from": None,
        "to": "INV-101",
        "mode": "INWARD",
        "qty": 1000,
        "loss_percent": 0
    }
    
    stage1_res = generator.create_worker_attestation(
        batch_id="INV-101",
        stage=1,
        worker_name="Worker_A",
        warehouse_code="WH-01",
        batch_metadata={"history": [step_1_meta], "latest_step": step_1_meta},
        skip_db_validation=True
    )
    
    qr1_path = stage1_res["qr_code_path"]
    print(f"✅ Stage 1 QR Configured & Signed! Saved to: {qr1_path}")
    print(f"UID: {stage1_res['attestationUID']}")
    
    # ---------------------------------------------------------
    # STAGE 2: SEGREGATION (On-field worker scans previous QR)
    print("\n[STAGE 2] Worker B scans Stage 1 QR and adds SEGREGATION...")
    
    # 1. Read QR Code as strings (Simulating Mobile Scanner)
    scanned_qr_data = read_qr_code(qr1_path)
    if not scanned_qr_data:
        print("❌ Failed to scan QR Code.")
        return
        
    print("✅ Scanned previous QR. Validating and Appending new state...")
    
    step_2_meta = {
        "transform_id": 2,
        "from": "INV-101",
        "to": "INV-102",
        "mode": "SEGREGATION",
        "qty": 980,
        "loss_percent": 2
    }
    
    stage2_res = generator.append_attestation(
        previous_qr_data=scanned_qr_data,
        new_batch_id="INV-102",
        new_stage=2,
        worker_name="Worker_B",
        warehouse_code="WH-02",
        step_metadata=step_2_meta,
        skip_db_validation=True
    )
    
    if stage2_res.get("success"):
        qr2_path = stage2_res["qr_code_path"]
        print(f"✅ Stage 2 QR Configured & Signed! Saved to: {qr2_path}")
    else:
        print("❌ Failed stage 2:", stage2_res.get("error"))
        return

    # ---------------------------------------------------------
    # STAGE 3: BALING (Next worker)
    print("\n[STAGE 3] Worker C scans Stage 2 QR and adds BALING...")
    scanned_qr_data_2 = read_qr_code(qr2_path)
    
    step_3_meta = {
        "transform_id": 3,
        "from": "INV-102",
        "to": "INV-103",
        "mode": "BALING",
        "qty": 980,
        "loss_percent": 0
    }
    
    stage3_res = generator.append_attestation(
        previous_qr_data=scanned_qr_data_2,
        new_batch_id="INV-103",
        new_stage=3,
        worker_name="Worker_C",
        warehouse_code="WH-03",
        step_metadata=step_3_meta,
        skip_db_validation=True
    )
    
    if stage3_res.get("success"):
        qr3_path = stage3_res["qr_code_path"]
        print(f"✅ Stage 3 QR Configured & Signed! Saved to: {qr3_path}")
        print("\n🎉 Full Traceability Chain Created Offline! 3 interconnected steps in 1 cryptographic credential. Data stored inside final QR:")
        
        # Pretty print final payload
        final_history = stage3_res["attestation_data"]["batchMetadata"]["history"]
        print(json.dumps(final_history, indent=2))
        
    else:
        print("❌ Failed:", stage3_res.get("error"))

if __name__ == "__main__":
    main()
