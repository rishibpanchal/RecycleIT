export type TransformMode = 'INWARD' | 'SEGREGATION' | 'BALING' | 'SPINNING';

export interface BatchStepMetadata {
    transform_id: number;
    from?: string;
    to: string;
    mode: TransformMode;
    qty: number;
    loss_percent: number;
}

export interface AttestationMetadata {
    history: BatchStepMetadata[];
    latest_step: BatchStepMetadata;
}

export interface WorkerAttestation {
    batchId: string;
    tenantId: string;
    stage: number;
    stageNumber: number;
    workerName: string;
    warehouseCode: string;
    timestamp: string;
    batchMetadata: AttestationMetadata;
    attestationUID: string;
    schemaUID: string;
    scenarioId: string;
}

export interface QRPayload {
    attestation: WorkerAttestation;
    signature: string;
    network: string; // "monad-testnet"
}

export type PageId = 'scan' | 'traceability';
