/**
 * WorkerSignoff.tsx
 * ==================
 * Modal form for worker to sign off on a batch processing stage
 */

'use client';

import { useState } from 'react';
import { submitWorkerSignoff, WorkerSignoffData } from '@/lib/attestation-submit';
import { getStageName } from '@/lib/signature-verifier';

interface WorkerSignoffProps {
  batchId: string;
  stage: number;
  previousQRData?: string; // Scanned QR string for chaining
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

import { appendWorkerAttestation } from '@/lib/attestation-submit';
import Image from 'next/image';

export default function WorkerSignoff({
  batchId,
  stage,
  previousQRData,
  onClose,
  onSuccess,
  onError,
}: WorkerSignoffProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    workerName: '',
    warehouseCode: '',
    inputQty: '',
    outputQty: '',
    lossPercent: '',
    remarks: '',
  });
  const [successData, setSuccessData] = useState<{
    qrPath: string;
    uid: string;
    timestamp: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError(null);

    try {
      // Validate inputs
      const inputQty = parseFloat(formData.inputQty);
      const outputQty = parseFloat(formData.outputQty);
      const lossPercent = parseFloat(formData.lossPercent);

      if (isNaN(inputQty) || inputQty <= 0) {
        onError('Input quantity must be a positive number');
        setLoading(false);
        return;
      }

      if (isNaN(outputQty) || outputQty < 0) {
        onError('Output quantity must be a non-negative number');
        setLoading(false);
        return;
      }

      if (isNaN(lossPercent) || lossPercent < 0 || lossPercent > 100) {
        onError('Loss percentage must be between 0 and 100');
        setLoading(false);
        return;
      }

      if (!formData.workerName.trim()) {
        onError('Worker name is required');
        setLoading(false);
        return;
      }

      if (!formData.warehouseCode.trim()) {
        onError('Warehouse code is required');
        setLoading(false);
        return;
      }

      // Submit worker signoff
      const data: WorkerSignoffData = {
        batchId,
        stage,
        workerName: formData.workerName.trim(),
        warehouseCode: formData.warehouseCode.trim(),
        metadata: {
          inputQty,
          outputQty,
          lossPercent,
          remarks: formData.remarks.trim(),
        },
        scenario: '1',
      };

      let result: any;
      let isChain = false;
      
      if (previousQRData) {
        try {
          const parsed = JSON.parse(previousQRData);
          if (parsed.attestation && parsed.signature) {
            isChain = true;
          }
        } catch (e) {
          // not a valid JSON
        }
      }

      if (isChain) {
        // We have a cryptographic chain! Use the append API
        result = await appendWorkerAttestation({
          ...data,
          previousQRData: previousQRData!,
        });
      } else {
        // Genesis attestation or basic signoff
        result = await submitWorkerSignoff(data);
      }

      if (result.success) {
        if (result.qr_code_path) {
          // Store success data to show QR before closing
          setSuccessData({
            qrPath: result.qr_code_path,
            uid: result.attestationUID || 'Pending',
            timestamp: result.timestamp || new Date().toISOString(),
          });
        } else {
          onSuccess(`✅ Signed off stage ${stage}: ${getStageName(stage)}`);
          onClose();
        }
      } else {
        const errorMsg = result.error || result.message || 'Failed to submit signoff';
        setSubmitError(errorMsg);
        onError(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setSubmitError(errorMsg);
      onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success View with QR Code */}
        {successData ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--green)', color: '#0a0a0a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--foreground)' }}>
              Attestation Created!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              The transformation has been cryptographically signed and added to the batch history.
            </p>

            <div style={{
              background: 'white',
              padding: 16,
              borderRadius: 12,
              display: 'inline-block',
              marginBottom: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              {/* Handle both Windows and Unix path separators */}
              <img 
                src={`http://localhost:8000/api/qr/${successData.qrPath.replace(/^.*[\\\/]/, '')}`}
                alt="Attestation QR"
                width={200}
                height={200}
                crossOrigin="anonymous"
                style={{ display: 'block' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <a
                href={`http://localhost:8000/api/qr/${successData.qrPath.replace(/^.*[\\\/]/, '')}`}
                download={`attestation_${batchId}_stage${stage}.png`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download QR Ticket
              </a>
            </div>

            <div style={{
              textAlign: 'left',
              background: 'var(--background)',
              padding: 12,
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              marginBottom: 24,
              border: '1px solid var(--border)'
            }}>
              <div style={{ color: 'var(--muted)', marginBottom: 4 }}>ATTESTATION UID</div>
              <div style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{successData.uid}</div>
            </div>

            <button
              onClick={() => {
                onSuccess(`✅ Signed off stage ${stage}: ${getStageName(stage)}`);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: '#0a0a0a',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  marginBottom: 8,
                }}
              >
                Worker Sign-off
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>
                Batch ID: <strong>{batchId}</strong>
                {previousQRData && <span style={{ marginLeft: 8, color: 'var(--green)', fontSize: 11 }}>🔗 Linked Attestation Detected</span>}
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                Stage {stage}: {getStageName(stage)}
              </p>
            </div>

            {submitError && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                color: '#b91c1c',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Worker Name */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Worker Name *
                </label>
                <input
                  type="text"
                  value={formData.workerName}
                  onChange={(e) => setFormData({ ...formData, workerName: e.target.value })}
                  placeholder="Enter your name"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Warehouse Code */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Warehouse Code *
                </label>
                <input
                  type="text"
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value })}
                  placeholder="e.g., WH-COLLECT"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Input Quantity */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Input Quantity (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.inputQty}
                  onChange={(e) => setFormData({ ...formData, inputQty: e.target.value })}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Output Quantity */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Output Quantity (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.outputQty}
                  onChange={(e) => setFormData({ ...formData, outputQty: e.target.value })}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Loss Percent */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Loss Percentage (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.lossPercent}
                  onChange={(e) => setFormData({ ...formData, lossPercent: e.target.value })}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 6,
                  }}
                >
                  Remarks (Optional)
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--foreground)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: loading ? 'var(--muted)' : 'var(--accent)',
                    color: '#0a0a0a',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Signing...' : 'Sign & Submit'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
