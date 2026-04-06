import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

try:
    from attestation_generator import AttestationGenerator
    from signer_config import SIGNER_ADDRESS
except ImportError as e:
    print(f"Error importing backend modules: {e}")
    sys.exit(1)

def generate_journey():
    print("🎬 Generating 3-Stage Traceability Journey...")
    db_path = os.path.join(os.path.dirname(__file__), "traceability.db")
    
    # Initialize generator
    generator = AttestationGenerator(db_path)
    
    # Ensure qr_codes dir exists
    qr_dir = Path(__file__).parent / "qr_codes"
    if not qr_dir.exists():
        qr_dir.mkdir()

    # ---------------------------------------------------------
    # STAGE 1: INWARD (Genesis)
    # ---------------------------------------------------------
    print("\n[STAGE 1] Creating Genesis Attestation (INWARD)")
    step_1_meta = {
        "transform_id": 1,
        "tenant_id": 1,
        "source_inventory_id": None,
        "destination_inventory_id": "INV-101",
        "mode": "INWARD",
        "quantity": 1000,
        "transaction_id": 101,
        "loss_percent": 0,
        "remarks": "Batch received from collection center."
    }
    
    res1 = generator.create_worker_attestation(
        batch_id="INV-101",
        stage=1,
        worker_name="Aditya (Warehouse Manager)",
        warehouse_code="WH-MUM-01",
        batch_metadata={"history": [step_1_meta], "latest_step": step_1_meta},
        skip_db_validation=True
    )
    
    if not res1["success"]:
        print(f"❌ Failed Stage 1: {res1.get('error')}")
        return

    print(f"✅ Stage 1 QR: {res1['qr_code_path']}")
    
    # ---------------------------------------------------------
    # STAGE 2: SEGREGATION (Scan res1 and append)
    # ---------------------------------------------------------
    print("\n[STAGE 2] Worker B scanning Stage 1 QR and adding SEGREGATION...")
    
    # Using the raw data from res1 as if it were scanned from the QR
    # (The generator returns 'attestation_data' for use in the next step)
    previous_qr_payload = json.dumps({
        "attestation": res1["attestation_data"],
        "signature": res1["signature"],
        "network": "monad-testnet"
    })
    
    step_2_meta = {
        "transform_id": 2,
        "tenant_id": 1,
        "source_inventory_id": "INV-101",
        "destination_inventory_id": "INV-102",
        "mode": "SEGREGATION",
        "quantity": 980,
        "transaction_id": 102,
        "loss_percent": 2,
        "remarks": "Sorted by plastic type (PET/HDPE)."
    }
    
    res2 = generator.append_attestation(
        previous_qr_data=previous_qr_payload,
        new_batch_id="INV-102",
        new_stage=2,
        worker_name="Suresh (Floor Supervisor)",
        warehouse_code="WH-MUM-02",
        step_metadata=step_2_meta,
        skip_db_validation=True
    )
    
    if not res2["success"]:
        print(f"❌ Failed Stage 2: {res2.get('error')}")
        return

    print(f"✅ Stage 2 QR: {res2['qr_code_path']}")
    
    # ---------------------------------------------------------
    # STAGE 3: BALING (Scan res2 and append)
    # ---------------------------------------------------------
    print("\n[STAGE 3] Worker C scanning Stage 2 QR and adding BALING...")
    
    previous_qr_payload_2 = json.dumps({
        "attestation": res2["attestation_data"],
        "signature": res2["signature"],
        "network": "monad-testnet"
    })
    
    step_3_meta = {
        "transform_id": 3,
        "tenant_id": 1,
        "source_inventory_id": "INV-102",
        "destination_inventory_id": "INV-103",
        "mode": "BALING",
        "quantity": 980,
        "transaction_id": 103,
        "loss_percent": 0,
        "remarks": "Material compressed into export-ready bales."
    }
    
    res3 = generator.append_attestation(
        previous_qr_data=previous_qr_payload_2,
        new_batch_id="INV-103",
        new_stage=3,
        worker_name="Vikram (Production Operative)",
        warehouse_code="WH-MUM-02",
        step_metadata=step_3_meta,
        skip_db_validation=True
    )
    
    if not res3["success"]:
        print(f"❌ Failed Stage 3: {res3.get('error')}")
        return

    print(f"✅ Stage 3 QR: {res3['qr_code_path']}")
    
    # Final Output
    print("\n🎉 Full 3-Stage Traceability Journey Successfully Generated Offline!")
    print("=" * 60)
    print(f"FINAL BATCH: {res3['attestation_data']['batchId']}")
    print(f"FINAL UID: {res3['attestationUID']}")
    print(f"FULL QR IMAGE: {res3['qr_code_path']}")
    print(f"SIGNER ADDRESS: {SIGNER_ADDRESS}")
    print("\n🔍 Journey History Decoded from QR:")
    
    history = res3['attestation_data']['batchMetadata']['history']
    for i, step in enumerate(history):
        print(f"  [{i+1}] {step['mode']} | From: {step['source_inventory_id'] or 'SOURCE'} -> To: {step['destination_inventory_id']} | Qty: {step['quantity']}kg")
        
    print("\nInstructions:")
    print("1. Start your backend and open the scanner app.")
    print(f"2. Scan this final QR: {res3['qr_code_path']}")
    print("3. You will see the entire 3-stage journey instantly visualized on the frontend!")

if __name__ == "__main__":
    generate_journey()
