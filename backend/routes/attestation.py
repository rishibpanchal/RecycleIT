"""
routes/attestation.py
=======================
Worker attestation endpoints for blockchain-based traceability.

Endpoints:
  POST /api/attest/worker-sign     → Submit worker attestation for a batch
  GET  /api/attest/batch/{batch_id} → Get all signatures for a batch
  GET  /api/attest/batch/{batch_id}/journey → Get full batch journey
"""

import json
import sqlite3
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

# Root of repository
ROOT_DIR = Path(__file__).parent.parent.parent
DB_PATH = ROOT_DIR / "traceability.db"

# Import our attestation generator
import sys
sys.path.insert(0, str(ROOT_DIR / "backend"))
from attestation_generator import AttestationGenerator


def _init_worker_attestations_table(db_path: str) -> None:
    """
    Ensure the worker_attestations table exists in the SQLite database.
    Previously this was imported from grapher.py, but that function was
    never added there — so we define it locally here.
    """
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


router = APIRouter(prefix="/api/attest", tags=["attestation"])

# Initialize database table on module load
try:
    _init_worker_attestations_table(str(DB_PATH))
except Exception as e:
    print(f"Warning: Could not initialize worker_attestations table: {e}")


@router.get("/signer-address")
def get_signer_address():
    """
    Get the universal signer address for client-side signature verification.

    Returns:
        Signer address and public key for offline ECDSA verification
    """
    try:
        from signer_config import SIGNER_ADDRESS
        return {
            "signerAddress": SIGNER_ADDRESS,
            "network": "sepolia",  # or read from env
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get signer address: {str(e)}")


class WorkerSignoffRequest(BaseModel):
    """Request model for worker sign-off"""
    batchId: str
    stage: int
    workerName: str
    warehouseCode: str
    metadata: dict  # {inputQty, outputQty, lossPercent, remarks}
    scenario: Optional[str] = "1"


class WorkerSignoffResponse(BaseModel):
    """Response model for worker sign-off"""
    success: bool
    signature: Optional[str] = None
    attestationUID: Optional[str] = None
    timestamp: Optional[str] = None
    message: str
    qr_code_path: Optional[str] = None
    attestation_data: Optional[dict] = None
    error: Optional[str] = None


class AppendAttestationRequest(BaseModel):
    """Request model for appending to an existing attestation chain"""
    previousQRData: str  # The full JSON string from the scanned QR
    newBatchId: str
    newStage: int
    workerName: str
    warehouseCode: str
    stepMetadata: dict  # {inputQty, outputQty, lossPercent, remarks, etc.}
    scenario: Optional[str] = "1"


@router.post("/worker-sign", response_model=WorkerSignoffResponse)
def submit_worker_signoff(request: WorkerSignoffRequest) -> WorkerSignoffResponse:
    """
    Submit a worker attestation for a batch transformation.

    Worker provides:
    - Batch ID (lot identifier)
    - Processing stage (0-11)
    - Worker name
    - Warehouse code
    - Batch metadata (quantities, loss, remarks)

    Backend:
    - Creates attestation JSON
    - Signs with universal private key
    - Stores in database
    - Returns signature + UID

    Args:
        request: Worker signoff details

    Returns:
        Signature, attestation UID, and success status
    """
    try:
        if not DB_PATH.exists():
            return WorkerSignoffResponse(
                success=False,
                message="Database not initialized",
                error="traceability.db not found",
            )

        # Create generator
        generator = AttestationGenerator(str(DB_PATH))

        # Create and sign attestation
        result = generator.create_worker_attestation(
            batch_id=request.batchId,
            stage=request.stage,
            worker_name=request.workerName,
            warehouse_code=request.warehouseCode,
            batch_metadata=request.metadata,
            scenario_id=request.scenario,
        )

        if result["success"]:
            return WorkerSignoffResponse(
                success=True,
                signature=result.get("signature"),
                attestationUID=result.get("attestationUID"),
                timestamp=result.get("timestamp"),
                message=result.get("message", "Attestation created and signed"),
                qr_code_path=result.get("qr_code_path"),
                attestation_data=result.get("attestation_data")
            )
        else:
            return WorkerSignoffResponse(
                success=False,
                message="Failed to create attestation",
                error=result.get("error"),
            )

    except Exception as e:
        return WorkerSignoffResponse(
            success=False,
            message="Server error",
            error=str(e),
        )


@router.post("/append", response_model=WorkerSignoffResponse)
def append_worker_attestation(request: AppendAttestationRequest) -> WorkerSignoffResponse:
    """
    Take a scanned QR code, verify it, and append a new stage to the traceability chain.
    
    This creates an interconnected cryptographic "certificate" that stores the
    entire history of the lot.
    """
    try:
        if not DB_PATH.exists():
            return WorkerSignoffResponse(
                success=False,
                message="Database not initialized",
                error="traceability.db not found",
            )

        # Create generator
        generator = AttestationGenerator(str(DB_PATH))

        # Append to attestation chain
        result = generator.append_attestation(
            previous_qr_data=request.previousQRData,
            new_batch_id=request.newBatchId,
            new_stage=request.newStage,
            worker_name=request.workerName,
            warehouse_code=request.warehouseCode,
            step_metadata=request.stepMetadata,
            scenario_id=request.scenario,
            skip_db_validation=True # Enable for demo/offline flow
        )

        if result["success"]:
            return WorkerSignoffResponse(
                success=True,
                signature=result.get("signature"),
                attestationUID=result.get("attestationUID"),
                timestamp=result.get("timestamp"),
                message=result.get("message", "Attestation appended successfully"),
                qr_code_path=result.get("qr_code_path"),
                attestation_data=result.get("attestation_data")
            )
        else:
            return WorkerSignoffResponse(
                success=False,
                message="Failed to append attestation",
                error=result.get("error"),
            )

    except Exception as e:
        return WorkerSignoffResponse(
            success=False,
            message="Server error",
            error=str(e),
        )


@router.get("/batch/{batch_id}")
def get_batch_signatures(batch_id: str, scenario: Optional[str] = "1"):
    """
    Get all worker signatures for a batch in chronological order.

    Args:
        batch_id: Batch/lot identifier
        scenario: Scenario ID (default: "1")

    Returns:
        Array of signatures with verification status
    """
    try:
        if not DB_PATH.exists():
            raise HTTPException(status_code=404, detail="Database not initialized")

        generator = AttestationGenerator(str(DB_PATH))
        signatures, all_valid = generator.get_batch_signatures(batch_id, scenario)

        return {
            "batchId": batch_id,
            "scenarioId": scenario,
            "signatures": signatures,
            "allSignaturesValid": all_valid,
            "totalSignatures": len(signatures),
            "verificationStatus": "ALL_SIGNATURES_VALID"
            if all_valid
            else "SOME_SIGNATURES_INVALID",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/{batch_id}/journey")
def get_batch_journey(batch_id: str, scenario: Optional[str] = "1"):
    """
    Get the complete journey of a batch with all signatures.

    Args:
        batch_id: Batch/lot identifier
        scenario: Scenario ID (default: "1")

    Returns:
        Complete batch journey with all signatures and timeline
    """
    try:
        if not DB_PATH.exists():
            raise HTTPException(status_code=404, detail="Database not initialized")

        generator = AttestationGenerator(str(DB_PATH))
        journey = generator.get_batch_journey(batch_id, scenario)

        return journey

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/stats")
def get_attestation_stats(scenario: Optional[str] = "1"):
    """
    Get high-level analytics for the worker dashboard.
    """
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(f"sqlite:///{DB_PATH}")
        with engine.connect() as conn:
            # Total attestations
            total = conn.execute(text("SELECT COUNT(*) FROM worker_attestations WHERE scenario_id = :s"), {"s": scenario}).scalar()
            
            # Unique batches
            batches = conn.execute(text("SELECT COUNT(DISTINCT batch_id) FROM worker_attestations WHERE scenario_id = :s"), {"s": scenario}).scalar()
            
            # Stages distribution
            stages_res = conn.execute(text("SELECT stage, COUNT(*) FROM worker_attestations WHERE scenario_id = :s GROUP BY stage"), {"s": scenario})
            stages_dist = {row[0]: row[1] for row in stages_res}
            
            return {
                "totalAttestations": total,
                "uniqueBatches": batches,
                "stageDistribution": stages_dist,
                "status": "Healthy"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recent")
def get_recent_activity(limit: int = 5, scenario: Optional[str] = "1"):
    """
    Get the most recent scans/attestations for the history feed.
    """
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(f"sqlite:///{DB_PATH}")
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT batch_id, stage, worker_name, timestamp, attestation_uid 
                    FROM worker_attestations 
                    WHERE scenario_id = :s 
                    ORDER BY timestamp DESC 
                    LIMIT :l
                """),
                {"s": scenario, "l": limit}
            )
            
            activity = []
            for row in result:
                activity.append({
                    "batchId": row[0],
                    "stage": row[1],
                    "workerName": row[2],
                    "timestamp": row[3],
                    "uid": row[4]
                })
            return activity
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
