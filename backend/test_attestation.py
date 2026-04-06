import os
import sys
import json
from datetime import datetime, timezone
import uuid
import logging

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from signer_config import sign_data, verify_signature, SIGNER_ADDRESS, EAS_SCHEMA_UID, EAS_NETWORK
from attestation_generator import AttestationGenerator

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_signer_config():
    logger.info("--- Testing Signer Configuration ---")
    logger.info(f"Signer Address: {SIGNER_ADDRESS}")
    logger.info(f"Network: {EAS_NETWORK}")
    logger.info(f"Schema UID: {EAS_SCHEMA_UID}")

    # Check that we're using the expected Monad Wallet Address
    monad_wallet_env = os.getenv("MONAD_WALLET_ADDRESS")
    if monad_wallet_env and monad_wallet_env.lower() == SIGNER_ADDRESS.lower():
        logger.info("✅ Signer Address matches MONAD_WALLET_ADDRESS from .env")
    elif monad_wallet_env:
        logger.warning(f"⚠️ Signer Address does NOT match MONAD_WALLET_ADDRESS from .env ({monad_wallet_env})")
    
    return True

def test_signing_and_verification():
    logger.info("\n--- Testing Signing and Verification ---")
    
    test_data = {
        "batchId": "TEST-123",
        "stage": 1,
        "workerName": "Alice",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "attestationUID": "0x" + uuid.uuid4().hex[:32],
        "schemaUID": EAS_SCHEMA_UID
    }
    
    logger.info(f"Test Data: {json.dumps(test_data, indent=2)}")
    
    try:
        signature = sign_data(test_data)
        logger.info(f"Created Signature: {signature}")
        
        is_valid = verify_signature(test_data, signature)
        
        if is_valid:
            logger.info("✅ Signature verification successful!")
            return True
        else:
            logger.error("❌ Signature verification failed!")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error during signing/verification: {str(e)}")
        return False

def main():
    logger.info("Starting EAS Attestation Service Tests...")
    
    success = True
    
    if not test_signer_config():
        success = False
        
    if not test_signing_and_verification():
        success = False
        
    try:
        logger.info("\n--- Testing QR Code Generation ---")
        generator = AttestationGenerator(os.path.join(os.path.dirname(__file__), "scenarios.db"))
        qr_path = generator._generate_qr_code(
            attestation_uid="0x" + uuid.uuid4().hex[:32], 
            batch_id="TEST-QR-123", 
            stage=1
        )
        if os.path.exists(qr_path):
            logger.info(f"✅ QR Code generated successfully at: {qr_path}")
        else:
            logger.error("❌ Failed to generate QR Code")
            success = False
    except Exception as e:
        logger.error(f"❌ Error testing QR generation: {str(e)}")
        success = False

    if success:
        logger.info("\n✅ All attestation tests passed successfully!")
        sys.exit(0)
    else:
        logger.error("\n❌ Some attestation tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
