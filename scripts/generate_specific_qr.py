import qrcode
import json
import os
from pathlib import Path

# The data provided by the user
data = {
    "attestation": {
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
    },
    "signature": "e3000f9875cd73680199848412fb81533b30c8c209ddea91f9c70a4f4354088211baab4eb6abc077663a66e9b260ade826af9b8ba1fd9c84f8ac0bd05a24121e1c",
    "network": "monad-testnet"
}

def generate_qr():
    # Convert to compact JSON string
    qr_data = json.dumps(data)
    
    # Generate QR
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save path
    output_path = Path("d:/Hackniche/qr_codes/batch_inv103_final.png")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    img.save(output_path)
    print(f"QR code generated successfully at: {output_path}")

if __name__ == "__main__":
    generate_qr()
