import { ethers } from 'ethers';
import { QRPayload, WorkerAttestation } from '@/lib/types';

/**
 * Stringifies an object to a canonical JSON string (sorted keys, no whitespace).
 * Must match Python's json.dumps(obj, sort_keys=True, separators=(',', ':'))
 */
export function stableStringify(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/**
 * Verifies an EAS attestation signature from a payload.
 * Returns the recovered signer address and validity.
 */
export async function verifyAttestation(payload: QRPayload): Promise<{ isValid: boolean, signer: string }> {
    try {
        const { attestation, signature } = payload;
        
        // Reconstruct the exact string that was signed
        const messageStr = stableStringify(attestation);
        
        // Recover the address from the signature
        const recoveredAddress = ethers.verifyMessage(messageStr, signature);
        
        // In this flow, we consider it valid if the signature is mathematically correct
        // The UI will display WHO signed it (e.g. "Verified by: 0x123...")
        // In a real app, you'd check if recoveredAddress is in a trusted list
        
        return { 
            isValid: true, 
            signer: recoveredAddress 
        };
    } catch (error) {
        console.error("Signature verification failed:", error);
        return { isValid: false, signer: '' };
    }
}

/**
 * Signs an attestation using a private key (Worker/User).
 */
export async function signAttestation(attestation: WorkerAttestation, privateKey: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    const messageStr = stableStringify(attestation);
    return await wallet.signMessage(messageStr);
}

/**
 * Generic signer helper (legacy)
 */
export async function signData(data: any, privateKey: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    const messageStr = stableStringify(data);
    return wallet.signMessage(messageStr);
}
