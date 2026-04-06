/**
 * attestation-submit.ts
 * =====================
 * API client for worker attestation submission and retrieval
 */

import { API, apiFetch } from './api';
import { getStageName } from './signature-verifier';

export interface WorkerSignoffData {
  batchId: string;
  stage: number;
  workerName: string;
  warehouseCode: string;
  metadata: {
    inputQty: number;
    outputQty: number;
    lossPercent: number;
    remarks: string;
  };
  scenario?: string;
  previousQRData?: string; // Add this for appending to chains
}

export interface WorkerSignoffResponse {
  success: boolean;
  signature?: string;
  attestationUID?: string;
  timestamp?: string;
  message: string;
  error?: string;
}

export interface BatchSignature {
  stage: number;
  workerName: string;
  warehouseCode: string;
  timestamp: string;
  signature: string;
  attestationUID: string;
  metadata: {
    inputQty: number;
    outputQty: number;
    lossPercent: number;
    remarks: string;
  };
  isValid?: boolean;
}

export interface BatchSignaturesResponse {
  batchId: string;
  scenarioId: string;
  signatures: BatchSignature[];
  allSignaturesValid: boolean;
  totalSignatures: number;
  verificationStatus: string;
}

export interface BatchJourneyResponse {
  batchId: string;
  scenarioId: string;
  stages: Array<{
    stage: number;
    stageName: string;
    workerName: string;
    warehouseCode: string;
    timestamp: string;
    metadata: any;
    signature: string;
    attestationUID: string;
    isValid: boolean;
  }>;
  summary: {
    totalStages: number;
    firstTimestamp: string;
    lastTimestamp: string;
    allValid: boolean;
  };
}

/**
 * Submit a worker signoff for a batch
 */
export async function submitWorkerSignoff(
  data: WorkerSignoffData
): Promise<WorkerSignoffResponse> {
  try {
    const response = await apiFetch('/api/attest/worker-sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  } catch (error) {
    return {
      success: false,
      message: 'Failed to submit worker signoff',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Append to an existing attestation chain using scanned QR data
 */
export async function appendWorkerAttestation(
  data: WorkerSignoffData & { previousQRData: string }
): Promise<WorkerSignoffResponse & { qr_code_path?: string; attestation_data?: any }> {
  try {
    const response = await apiFetch('/api/attest/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        previousQRData: data.previousQRData,
        newBatchId: data.batchId,
        newStage: data.stage,
        workerName: data.workerName,
        warehouseCode: data.warehouseCode,
        stepMetadata: data.metadata,
        scenario: data.scenario || '1',
      }),
    });
    return response;
  } catch (error) {
    return {
      success: false,
      message: 'Failed to append worker attestation',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get all signatures for a batch
 */
export async function getBatchSignatures(
  batchId: string,
  scenario: string = '1'
): Promise<BatchSignaturesResponse> {
  return apiFetch(`/api/attest/batch/${batchId}?scenario=${scenario}`);
}

export async function getBatchJourney(
  batchId: string,
  scenario: string = '1'
): Promise<BatchJourneyResponse> {
  const data = await apiFetch(`/api/attest/batch/${batchId}/journey?scenario=${scenario}`);
  
  // Transform python backend response to expected BatchJourneyResponse shape
  if (data && Array.isArray(data.journey)) {
    return {
      batchId: data.batchId || batchId,
      scenarioId: data.scenarioId || scenario,
      stages: data.journey.map((s: any) => ({
        ...s,
        stageName: getStageName(s.stage),
        isValid: s.signatureValid !== false && s.isVerified !== false,
      })),
      summary: {
        totalStages: data.totalSignatures || data.journey.length,
        firstTimestamp: data.journey[0]?.timestamp || new Date().toISOString(),
        lastTimestamp: data.journey[data.journey.length - 1]?.timestamp || new Date().toISOString(),
        allValid: data.allSignaturesValid !== false,
      },
    };
  }
  
  return data;
}

/**
 * Get the signer address for offline verification
 */
export async function getSignerAddress(): Promise<{ signerAddress: string; network: string }> {
  return apiFetch('/api/attest/signer-address');
}

/**
 * Check if batch has complete signatures for all stages
 */
export function checkSignatureCompleteness(signatures: BatchSignature[]): {
  complete: boolean;
  missingStages: number[];
  completedStages: number[];
} {
  const completedStages = signatures.map((s) => s.stage).sort((a, b) => a - b);
  const allStages = Array.from({ length: 12 }, (_, i) => i); // 0-11
  const missingStages = allStages.filter((stage) => !completedStages.includes(stage));

  return {
    complete: missingStages.length === 0,
    missingStages,
    completedStages,
  };
}

export interface WorkerStatsResponse {
  totalAttestations: number;
  uniqueBatches: number;
  stageDistribution: Record<number, number>;
  status: string;
}

export interface ActivityItem {
  batchId: string;
  stage: number;
  workerName: string;
  timestamp: string;
  uid: string;
}

/**
 * Get stats for worker dashboard
 */
export async function getWorkerStats(scenario: string = '1'): Promise<WorkerStatsResponse> {
  return apiFetch(`/api/attest/stats?scenario=${scenario}`);
}

/**
 * Get recent activity feed
 */
export async function getRecentActivity(limit: number = 5, scenario: string = '1'): Promise<ActivityItem[]> {
  return apiFetch(`/api/attest/recent?limit=${limit}&scenario=${scenario}`);
}
