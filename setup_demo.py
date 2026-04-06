import os
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent / "backend"))

try:
    from attestation_generator import AttestationGenerator
    from signer_config import SIGNER_ADDRESS
except ImportError as e:
    print(f"Error importing backend modules: {e}")
    sys.exit(1)

def setup_demo():
    print("🚀 Setting up Clover Traceability EAS Chain Demo...")
    db_path = os.path.join(os.path.dirname(__file__), "traceability.db")
    
    generator = AttestationGenerator(db_path)
    
    # ---------------------------------------------------------
    # STAGE 1: INWARD (The starting point)
    print("\n[STAGE 1] Creating Genesis Attestation (INWARD for INV-101)")
    
    # Matching user's example data
    step_1_meta = {
        "transform_id": 1,
        "tenant_id": 1,
        "source_inventory_id": None,
        "destination_inventory_id": "INV-101",
        "mode": "INWARD",
        "quantity": 1000,
        "transaction_id": 101,
        "loss_percent": 0
    }
    
    res = generator.create_worker_attestation(
        batch_id="INV-101",
        stage=1,
        worker_name="Aditya (Warehouse Manager)",
        warehouse_code="WH-MUM-01",
        batch_metadata={"history": [step_1_meta], "latest_step": step_1_meta},
        skip_db_validation=True
    )
    
    if res["success"]:
        qr_path = res["qr_code_path"]
        print(f"✅ Genesis QR created and signed!")
        print(f"📍 Location: {qr_path}")
        print(f"🔑 Signer: {SIGNER_ADDRESS}")
        print(f"🆔 UID: {res['attestationUID']}")
        print("\nINSTRUCTIONS:")
        print("1. Start the backend: python backend/app.py")
        print("2. Start the scanner-app: cd scanner-app && npm run dev")
        print("3. Open the scanner app on your phone or browser.")
        print(f"4. Scan the QR code located at: {qr_path}")
        print("5. Add Stage 2 (SEGREGATION) for INV-102. The system will link it to this genesis attestation.")
    else:
        print(f"❌ Failed: {res.get('error')}")

if __name__ == "__main__":
    setup_demo()
