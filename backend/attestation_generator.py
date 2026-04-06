"""
Worker Attestation Generator

Manages creation, signing, and verification of worker attestations for batch processing.
Attestations are ECDSA-signed records of workers processing lots through lifecycle stages.
"""

import json
from datetime import datetime, timezone
from typing import Dict, Optional, List, Tuple
from sqlalchemy import create_engine, text
import uuid
from signer_config import sign_data, verify_signature, SIGNER_ADDRESS, EAS_SCHEMA_UID


class AttestationGenerator:
    """Generates and manages worker attestations for batch transformations."""

    def __init__(self, db_path: str):
        """
        Initialize with database path.

        Args:
            db_path: Path to SQLite database
        """
        self.engine = create_engine(f"sqlite:///{db_path}")
        self.db_path = db_path

    def _generate_qr_code(self, full_attestation_data: dict, signature: str, batch_id: str, stage: int) -> str:
        """
        Generate a QR code containing the FULL attestation payload for offline verification.
        
        Args:
            full_attestation_data: The complete attestation block
            signature: The generated signature
            batch_id: The batch ID
            stage: The stage number
            
        Returns:
            Path to the generated QR code image
        """
        import os
        import qrcode
        
        # Ensure qr_codes directory exists
        qr_dir = os.path.join(os.path.dirname(self.db_path), "qr_codes")
        os.makedirs(qr_dir, exist_ok=True)
        
        # Include full data to allow 100% offline verification across workers
        verification_data = json.dumps({
            "attestation": full_attestation_data,
            "signature": signature,
            "network": "monad-testnet"
        })
        
        # We use version=None and fit=True to auto-size the QR code
        # since the payload might be large due to historical transactions.
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=4,  # Smaller box size for larger payloads
            border=4,
        )
        qr.add_data(verification_data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        filename = f"attest_{batch_id}_stage{stage}.png"
        filepath = os.path.join(qr_dir, filename)
        
        img.save(filepath)
        return filepath

    def create_worker_attestation(
        self,
        batch_id: str,
        stage: int,
        worker_name: str,
        warehouse_code: str,
        batch_metadata: Dict,
        scenario_id: str = "1",
        skip_db_validation: bool = False,
    ) -> Dict:
        """
        Create and sign a worker attestation for a batch transformation.

        Args:
            batch_id: Batch/lot identifier (e.g., "INV-101")
            stage: Lifecycle stage number (0-11)
            worker_name: Name of worker who processed the batch
            warehouse_code: Warehouse/facility code (e.g., "WH-SEG-01")
            batch_metadata: Dictionary with {history: [], ...}
            scenario_id: Scenario identifier
            skip_db_validation: If True, bypasses database checks (useful for offline generation)

        Returns:
            Dictionary with {success, signature, attestationUID, message, error}
        """
        try:
            # Validate inputs
            if not batch_id or not isinstance(batch_id, str):
                return {
                    "success": False,
                    "error": "Invalid batch_id",
                }

            if not isinstance(stage, int) or stage < 0 or stage > 11:
                return {
                    "success": False,
                    "error": f"Invalid stage {stage}, must be 0-11",
                }

            # Validate batch exists in database if strictly enforced
            if not skip_db_validation:
                with self.engine.connect() as conn:
                    result = conn.execute(
                        text(
                            "SELECT id FROM graph_nodes WHERE id = ? AND scenario_id = ? LIMIT 1"
                        ),
                        [batch_id, scenario_id],
                    )
                    if not result.fetchone():
                        return {
                            "success": False,
                            "error": f"Batch {batch_id} not found in scenario {scenario_id}",
                        }

            # Create attestation data object
            attestation_uid = "0x" + uuid.uuid4().hex[:32]
            timestamp_str = datetime.now(timezone.utc).isoformat()

            attestation_data = {
                "batchId": batch_id,
                "tenantId": "1",
                "stage": stage,
                "stageNumber": stage,
                "workerName": worker_name,
                "warehouseCode": warehouse_code,
                "timestamp": timestamp_str,
                "batchMetadata": batch_metadata,
                "attestationUID": attestation_uid,
                "schemaUID": EAS_SCHEMA_UID,
                "scenarioId": scenario_id,
            }

            # Sign the attestation
            signature = sign_data(attestation_data)

            # Store in database
            with self.engine.connect() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO worker_attestations
                        (batch_id, stage, worker_name, warehouse_code, timestamp, metadata, signature, attestation_uid, is_verified, scenario_id, created_at)
                        VALUES (:batch_id, :stage, :worker_name, :warehouse_code, :timestamp, :metadata, :signature, :attestation_uid, :is_verified, :scenario_id, :created_at)
                        """
                    ),
                    {
                        "batch_id": batch_id,
                        "stage": stage,
                        "worker_name": worker_name,
                        "warehouse_code": warehouse_code,
                        "timestamp": timestamp_str,
                        "metadata": json.dumps(attestation_data),
                        "signature": signature,
                        "attestation_uid": attestation_uid,
                        "is_verified": 1,
                        "scenario_id": scenario_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                conn.commit()

            # Generate QR Code
            qr_filepath = self._generate_qr_code(attestation_data, signature, batch_id, stage)

            return {
                "success": True,
                "signature": signature,
                "attestationUID": attestation_uid,
                "timestamp": timestamp_str,
                "message": f"Attestation created and signed for {worker_name}",
                "qr_code_path": qr_filepath,
                "attestation_data": attestation_data
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to create attestation: {str(e)}",
            }

    def append_attestation(
        self,
        previous_qr_data: str,
        new_batch_id: str,
        new_stage: int,
        worker_name: str,
        warehouse_code: str,
        step_metadata: Dict,
        scenario_id: str = "1",
        skip_db_validation: bool = False,
    ) -> Dict:
        """
        Takes a scanned QR payload, verifies it, appends a new transformation step,
        and generates a new attestation QR code tracking the entire history.
        """
        try:
            # 1. Parse and verify previous QR data
            prev_payload = json.loads(previous_qr_data)
            prev_attestation = prev_payload.get("attestation")
            prev_signature = prev_payload.get("signature")
            
            if not prev_attestation or not prev_signature:
                raise ValueError("Invalid QR data format. Missing attestation or signature.")
                
            if not verify_signature(prev_attestation, prev_signature, SIGNER_ADDRESS):
                raise ValueError("Previous attestation signature is invalid! Tampering detected.")
                
            # 2. Extract history
            history = prev_attestation.get("batchMetadata", {}).get("history", [])
            
            # 3. Append to history
            new_history = list(history)
            new_history.append(step_metadata)
            
            # 4. Generate new attestation metadata
            batch_metadata = {
                "history": new_history,
                "latest_step": step_metadata
            }
            
            return self.create_worker_attestation(
                batch_id=new_batch_id,
                stage=new_stage,
                worker_name=worker_name,
                warehouse_code=warehouse_code,
                batch_metadata=batch_metadata,
                scenario_id=prev_attestation.get("scenarioId", scenario_id),
                skip_db_validation=skip_db_validation
            )
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to append attestation: {str(e)}"
            }

    def get_batch_signatures(
        self, batch_id: str, scenario_id: str = "1"
    ) -> Tuple[List[Dict], bool]:
        """
        Retrieve all signatures for a batch in chronological order.

        Args:
            batch_id: Batch identifier
            scenario_id: Scenario identifier

        Returns:
            Tuple of (signatures_list, all_valid)
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        WITH RECURSIVE lineage AS (
                            SELECT batch_id, stage, worker_name, warehouse_code, timestamp, metadata, signature, attestation_uid, is_verified, scenario_id
                            FROM worker_attestations
                            WHERE batch_id = :batch_id AND scenario_id = :scenario_id
                            UNION ALL
                            SELECT w.batch_id, w.stage, w.worker_name, w.warehouse_code, w.timestamp, w.metadata, w.signature, w.attestation_uid, w.is_verified, w.scenario_id
                            FROM worker_attestations w
                            JOIN lineage l ON w.batch_id = json_extract(l.metadata, '$.batchMetadata.latest_step.source_inventory_id')
                            WHERE w.scenario_id = :scenario_id
                        )
                        SELECT batch_id, stage, worker_name, warehouse_code, timestamp, metadata, signature, attestation_uid, is_verified
                        FROM lineage
                        ORDER BY timestamp ASC

                        """
                    ),
                    {"batch_id": batch_id, "scenario_id": scenario_id},
                )

                signatures = []
                all_valid = True

                for row in result:
                    sig_dict = {
                        "batchId": row[0],
                        "stage": row[1],
                        "workerName": row[2],
                        "warehouseCode": row[3],
                        "timestamp": row[4],
                        "metadata": json.loads(row[5]) if isinstance(row[5], str) else row[5],
                        "signature": row[6],
                        "attestationUID": row[7],
                        "isVerified": bool(row[8]),
                    }

                    # Verify signature
                    try:
                        attestation_data = json.loads(row[5]) if isinstance(row[5], str) else row[5]
                        is_valid = verify_signature(attestation_data, row[6], SIGNER_ADDRESS)
                        sig_dict["signatureValid"] = is_valid
                        if not is_valid:
                            all_valid = False
                    except Exception:
                        sig_dict["signatureValid"] = False
                        all_valid = False

                    signatures.append(sig_dict)

                return signatures, all_valid

        except Exception as e:
            return [], False

    def verify_worker_signature(
        self, attestation_data: Dict, signature: str
    ) -> Dict:
        """
        Verify that a signature is valid.

        Args:
            attestation_data: Attestation data that was signed
            signature: Signature to verify (0x...)

        Returns:
            Dictionary with {isValid, recoveredAddress, message}
        """
        try:
            is_valid = verify_signature(attestation_data, signature, SIGNER_ADDRESS)

            return {
                "isValid": is_valid,
                "signerAddress": SIGNER_ADDRESS,
                "message": "Signature valid" if is_valid else "Signature invalid",
            }

        except Exception as e:
            return {
                "isValid": False,
                "error": f"Verification failed: {str(e)}",
            }

    def get_batch_journey(self, batch_id: str, scenario_id: str = "1") -> Dict:
        """
        Get the complete journey of a batch with all signatures.

        Args:
            batch_id: Batch identifier
            scenario_id: Scenario identifier

        Returns:
            Dictionary with batch journey including all signatures
        """
        signatures, all_valid = self.get_batch_signatures(batch_id, scenario_id)

        return {
            "batchId": batch_id,
            "scenarioId": scenario_id,
            "journey": signatures,
            "allSignaturesValid": all_valid,
            "totalSignatures": len(signatures),
            "verificationStatus": "ALL_SIGNATURES_VALID" if all_valid else "SOME_SIGNATURES_INVALID",
        }
