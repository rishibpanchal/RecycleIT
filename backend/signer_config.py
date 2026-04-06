"""
EAS Signer Configuration for Worker Attestations

This module manages the universal signing key used for all worker attestations.
Workers sign batch transformations with this system-wide key.

Environment Variables:
- SIGNING_PRIVATE_KEY: Private key (0x...) for signing attestations
"""

import os
from eth_account import Account
from eth_keys import keys

# Load signing private key from environment
# Use Monad private key if available, fallback to SIGNING_PRIVATE_KEY
import os
from dotenv import load_dotenv

load_dotenv()

SIGNING_PRIVATE_KEY = os.getenv('MONAD_PRIVATE_KEY') or os.getenv('SIGNING_PRIVATE_KEY')

if not SIGNING_PRIVATE_KEY:
    raise ValueError(
        "SIGNING_PRIVATE_KEY environment variable not set. "
        "Please set it to a valid Ethereum private key (hex format: 0x...)"
    )

# Ensure it starts with 0x
if not SIGNING_PRIVATE_KEY.startswith('0x'):
    SIGNING_PRIVATE_KEY = '0x' + SIGNING_PRIVATE_KEY

# Create account from private key
try:
    SIGNER_ACCOUNT = Account.from_key(SIGNING_PRIVATE_KEY)
    SIGNER_ADDRESS = SIGNER_ACCOUNT.address
    # Use eth_keys to get public key from private key bytes if needed
    from eth_keys import keys
    SIGNER_PUBLIC_KEY = keys.PrivateKey(SIGNER_ACCOUNT.key).public_key
except Exception as e:
    raise ValueError(f"Invalid SIGNING_PRIVATE_KEY: {str(e)}")

# EAS Configuration
EAS_SCHEMA_UID = os.getenv('EAS_SCHEMA_UID', '0x0000000000000000000000000000000000000000000000000000000000000000')
EAS_NETWORK = os.getenv('EAS_NETWORK', 'sepolia')  # sepolia or mainnet

# Supported networks
EAS_NETWORKS = {
    'sepolia': {
        'name': 'Sepolia Testnet',
        'chain_id': 11155111,
        'explorer': 'https://sepolia.etherscan.io',
    },
    'mainnet': {
        'name': 'Ethereum Mainnet',
        'chain_id': 1,
        'explorer': 'https://etherscan.io',
    }
}

def get_public_key_hex() -> str:
    """Get the signer's public key in hex format"""
    return '0x' + SIGNER_PUBLIC_KEY.to_checksum_address()


def sign_data(data: dict) -> str:
    """
    Sign attestation data using the universal private key.

    Args:
        data: Dictionary to sign (will be JSON serialized)

    Returns:
        Signature in hex format (0x...)
    """
    import json
    from eth_account.messages import encode_defunct

    # Convert dict to JSON string - Use compact separators to match JS JSON.stringify
    message_str = json.dumps(data, sort_keys=True, separators=(',', ':'), default=str)

    # Create message hash
    message = encode_defunct(text=message_str)

    # Sign message
    signed_message = SIGNER_ACCOUNT.sign_message(message)

    return signed_message.signature.hex()


def verify_signature(data: dict, signature: str, expected_signer: str = None) -> bool:
    """
    Verify that a signature was created by our signer.

    Args:
        data: Dictionary that was signed
        signature: Signature to verify (0x...)
        expected_signer: Optional expected signer address (defaults to our signer)

    Returns:
        True if signature is valid, False otherwise
    """
    import json
    from eth_account.messages import encode_defunct
    from eth_account import Account

    if expected_signer is None:
        expected_signer = SIGNER_ADDRESS

    try:
        # Recreate message - Use compact separators to match JS JSON.stringify
        message_str = json.dumps(data, sort_keys=True, separators=(',', ':'), default=str)
        message = encode_defunct(text=message_str)

        # Recover signer address
        recovered_address = Account.recover_message(message, signature=signature)

        # Check if matches expected signer
        return recovered_address.lower() == expected_signer.lower()
    except Exception:
        return False


# Configuration summary
if __name__ == '__main__':
    print("EAS Signer Configuration")
    print("=" * 50)
    print(f"Signer Address: {SIGNER_ADDRESS}")
    print(f"Public Key: {SIGNER_PUBLIC_KEY.to_checksum_address()}")
    print(f"Network: {EAS_NETWORK} ({EAS_NETWORKS[EAS_NETWORK]['name']})")
    print(f"Schema UID: {EAS_SCHEMA_UID}")
