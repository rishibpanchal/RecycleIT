/**
 * signature-verifier.ts
 * ====================
 * Offline ECDSA signature verification using ethers.js
 * No blockchain calls required - pure cryptographic verification
 */

import { ethers } from 'ethers';

export interface VerificationResult {
  isValid: boolean;
  recoveredAddress?: string;
  expectedAddress?: string;
  error?: string;
}

/**
 * Stage names mapping (0-11)
 */
export const STAGE_NAMES: Record<number, string> = {
  0: 'Unknown',
  1: 'Collection/Inward',
  2: 'Segregation/Sorting',
  3: 'Baling',
  4: 'Transfer/Shipment',
  5: 'Receipt at Facility',
  6: 'Washing',
  7: 'QC - Quality Control',
  8: 'Recycling/Granulation',
  9: 'Mixing/Blending',
  10: 'Production',
  11: 'Dispatch',
};

/**
 * Get stage name from stage number
 */
export function getStageName(stage: number): string {
  return STAGE_NAMES[stage] || 'Unknown';
}

/**
 * Verify a worker signature offline using ECDSA recovery
 *
 * @param attestationData - The original attestation data object
 * @param signature - The signature to verify (0x...)
 * @param expectedSigner - The expected signer address
 * @returns Verification result with recovered address
 */
export async function verifySignature(
  attestationData: any,
  signature: string,
  expectedSigner: string
): Promise<VerificationResult> {
  try {
    // Recreate the message that was signed
    // Must match the backend's JSON.stringify with sorted keys and compact separators
    const messageStr = JSON.stringify(attestationData, (key, value) => {
      // Handle any special values (e.g., dates)
      if (value instanceof Date) return value.toISOString();
      return value;
    });

    // Sort keys to match backend
    const sortedData = JSON.parse(messageStr);
    const sortedKeys = Object.keys(sortedData).sort();
    const sortedObj: any = {};
    for (const key of sortedKeys) {
      sortedObj[key] = sortedData[key];
    }

    // Create compact JSON (no spaces) to match backend
    const compactMessage = JSON.stringify(sortedObj, null, 0)
      .replace(/\s+/g, '') // Remove any whitespace
      .replace(/,/g, ',') // Ensure compact separators
      .replace(/:/g, ':');

    // Hash the message (EIP-191 personal sign)
    const messageHash = ethers.hashMessage(compactMessage);

    // Recover the signer address from the signature
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);

    // Compare with expected signer (case-insensitive)
    const isValid = recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();

    return {
      isValid,
      recoveredAddress,
      expectedAddress: expectedSigner,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify a batch's entire signature chain
 * Checks that all signatures are valid and in chronological order
 */
export async function verifyBatchChain(
  signatures: Array<{
    stage: number;
    timestamp: string;
    signature: string;
    metadata: any;
    workerName: string;
    warehouseCode: string;
  }>,
  batchId: string,
  expectedSigner: string
): Promise<{
  allValid: boolean;
  invalidSignatures: number[];
  chronologicalOrder: boolean;
}> {
  const invalidSignatures: number[] = [];

  // Verify each signature
  for (const sig of signatures) {
    const attestationData = {
      batchId,
      stage: sig.stage,
      workerName: sig.workerName,
      warehouseCode: sig.warehouseCode,
      timestamp: sig.timestamp,
      metadata: sig.metadata,
    };

    const result = await verifySignature(attestationData, sig.signature, expectedSigner);
    if (!result.isValid) {
      invalidSignatures.push(sig.stage);
    }
  }

  // Check chronological order (timestamps should be ascending)
  let chronologicalOrder = true;
  for (let i = 1; i < signatures.length; i++) {
    const prevTime = new Date(signatures[i - 1].timestamp).getTime();
    const currTime = new Date(signatures[i].timestamp).getTime();
    if (currTime < prevTime) {
      chronologicalOrder = false;
      break;
    }
  }

  return {
    allValid: invalidSignatures.length === 0,
    invalidSignatures,
    chronologicalOrder,
  };
}

/**
 * Verify chronological order of timestamps
 */
export function verifyChronologicalOrder(timestamps: string[]): boolean {
  for (let i = 1; i < timestamps.length; i++) {
    const prevTime = new Date(timestamps[i - 1]).getTime();
    const currTime = new Date(timestamps[i]).getTime();
    if (currTime < prevTime) {
      return false;
    }
  }
  return true;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Abbreviate Ethereum address
 */
export function abbreviateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
