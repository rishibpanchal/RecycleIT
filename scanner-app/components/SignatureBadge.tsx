/**
 * SignatureBadge.tsx
 * ==================
 * Display a single signature with verification status
 */

'use client';

import { getStageName, formatTimestamp, abbreviateAddress } from '@/lib/signature-verifier';

interface SignatureBadgeProps {
  stage: number;
  workerName: string;
  warehouseCode: string;
  timestamp: string;
  signature: string;
  isValid?: boolean;
  metadata?: {
    inputQty?: number;
    outputQty?: number;
    lossPercent?: number;
    remarks?: string;
  };
}

export default function SignatureBadge({
  stage,
  workerName,
  warehouseCode,
  timestamp,
  signature,
  isValid = true,
  metadata,
}: SignatureBadgeProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isValid ? 'var(--accent)' : '#ef4444'}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: isValid ? 'var(--accent)' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#0a0a0a',
            }}
          >
            {stage}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
              {getStageName(stage)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {formatTimestamp(timestamp)}
            </div>
          </div>
        </div>

        {/* Verification badge */}
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            background: isValid ? '#22c55e22' : '#ef444422',
            border: `1px solid ${isValid ? '#22c55e' : '#ef4444'}`,
            fontSize: 11,
            fontWeight: 600,
            color: isValid ? '#22c55e' : '#ef4444',
          }}
        >
          {isValid ? '✓ Verified' : '✗ Invalid'}
        </div>
      </div>

      {/* Details */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Worker</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            {workerName}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Warehouse</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            {warehouseCode}
          </div>
        </div>
      </div>

      {/* Quantities */}
      {metadata && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 10,
            padding: '10px',
            background: 'var(--background)',
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Input</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              {metadata.inputQty?.toFixed(2)} kg
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Output</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              {metadata.outputQty?.toFixed(2)} kg
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Loss</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
              {metadata.lossPercent?.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Remarks */}
      {metadata?.remarks && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            fontStyle: 'italic',
            marginBottom: 10,
            padding: '8px 10px',
            background: 'var(--background)',
            borderRadius: 6,
          }}
        >
          "{metadata.remarks}"
        </div>
      )}

      {/* Signature */}
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          fontFamily: 'monospace',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingTop: 8,
          borderTop: '1px solid var(--border)',
        }}
      >
        <strong>Signature:</strong> {abbreviateAddress(signature)}
      </div>
    </div>
  );
}
