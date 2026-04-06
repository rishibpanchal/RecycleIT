import json
import os
import sys
from pathlib import Path

# Add backend to path so we can import signer_config
backend_dir = Path("d:/Hackniche/backend")
sys.path.insert(0, str(backend_dir))
import signer_config
import qrcode

def generate_valid_qr():
    attestation = {
        "batchId": "INV-103",
        "tenantId": "1",
        "stage": 3,
        "stageNumber": 3,
        "workerName": "Vikram (Production Operative)",
        "warehouseCode": "WH-MUM-02",
        "timestamp": "2026-03-25T21:44:13.676905+00:00",
        "batchMetadata": {
            "history": [
                {
                    "transform_id": 1,
                    "tenant_id": 1,
                    "source_inventory_id": None,
                    "destination_inventory_id": "INV-101",
                    "mode": "INWARD",
                    "quantity": 1000,
                    "transaction_id": 101,
                    "loss_percent": 0,
                    "remarks": "Batch received from collection center."
                },
                {
                    "transform_id": 2,
                    "tenant_id": 1,
                    "source_inventory_id": "INV-101",
                    "destination_inventory_id": "INV-102",
                    "mode": "SEGREGATION",
                    "quantity": 980,
                    "transaction_id": 102,
                    "loss_percent": 2,
                    "remarks": "Sorted by plastic type (PET/HDPE)."
                },
                {
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
            ],
            "latest_step": {
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
        },
        "attestationUID": "0xba2012ed019a40cbb022c49e798b73e9",
        "schemaUID": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "scenarioId": "1"
    }

    # Generate REAL cryptographic signature based on local private key
    real_signature = signer_config.sign_data(attestation)

    final_payload = {
        "attestation": attestation,
        "signature": real_signature,
        "network": "monad-testnet"
    }

    qr_data = json.dumps(final_payload)
    output_path = Path("d:/Hackniche/qr_codes/batch_inv103_verified.png")
    
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path)
    print(f"Cryptographically valid QR generated at: {output_path}")

if __name__ == "__main__":
    generate_valid_qr()
