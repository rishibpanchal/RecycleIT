/**
 * BatchJourney.tsx
 * ================
 * Timeline view showing all signatures for a batch with export capability
 */

'use client';

import { useState, useEffect } from 'react';
import { getBatchJourney, BatchJourneyResponse } from '@/lib/attestation-submit';
import SignatureBadge from './SignatureBadge';

interface BatchJourneyProps {
  batchId: string;
  scenario?: string;
  onClose: () => void;
}

export default function BatchJourney({ batchId, scenario = '1', onClose }: BatchJourneyProps) {
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<BatchJourneyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);

  useEffect(() => {
    loadJourney();
  }, [batchId, scenario]);

  const loadJourney = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getBatchJourney(batchId, scenario);
      setJourney(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch journey');
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = () => {
    if (!journey) return;

    const dataStr = JSON.stringify(journey, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-${batchId}-journey.json`;
    link.click();
    URL.revokeObjectURL(url);
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
          background: 'var(--background)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 700,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--foreground)',
              }}
            >
              Batch Journey
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Batch ID: <strong style={{ color: 'var(--foreground)' }}>{batchId}</strong>
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            Loading journey...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: '#ef444422',
              border: '1px solid #ef4444',
              color: '#ef4444',
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Journey Summary */}
        {journey && journey.summary && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 20,
                padding: 16,
                background: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Total Stages</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
                  {journey.summary.totalStages || 0}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Verification</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: journey.summary.allValid ? '#22c55e' : '#ef4444',
                  }}
                >
                  {journey.summary.allValid ? '✓ All Valid' : '✗ Issues Found'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>First Stage</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                  {journey.summary.firstTimestamp ? new Date(journey.summary.firstTimestamp).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Last Stage</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                  {journey.summary.lastTimestamp ? new Date(journey.summary.lastTimestamp).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={exportJSON}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export JSON
              </button>
            </div>

            {/* Interactive Flow Diagram */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 0,
              overflowX: 'auto',
              padding: '20px 10px',
              marginBottom: 24,
              scrollbarWidth: 'none', // Hide scrollbar for cleaner look
              msOverflowStyle: 'none'
            }} className="no-scrollbar">
              {journey.stages && journey.stages.map((stage, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Stage Node */}
                  <div
                    onClick={() => setSelectedStageIndex(index)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: index === selectedStageIndex ? 'var(--accent)' : 'var(--surface)',
                        border: `2px solid ${index === selectedStageIndex ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: index === selectedStageIndex ? '#0a0a0a' : 'var(--muted)',
                        fontWeight: 800,
                        fontSize: 14,
                        boxShadow: index === selectedStageIndex ? '0 0 15px var(--accent)' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    >
                      {stage.stage}
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      marginTop: 8,
                      color: index === selectedStageIndex ? 'var(--accent)' : 'var(--muted)',
                      whiteSpace: 'nowrap',
                      maxWidth: 80,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {stage.stageName.split('/')[0]}
                    </div>
                  </div>

                  {/* Connector Line (except for last node) */}
                  {index < journey.stages.length - 1 && (
                    <div style={{
                      width: 40,
                      height: 2,
                      background: index < selectedStageIndex ? 'var(--accent)' : 'var(--border)',
                      marginTop: -18, // Center between node labels
                      zIndex: 1,
                      transition: 'background 0.5s'
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Selected Stage Detail Display */}
            {journey.stages && journey.stages.length > 0 ? (
              <div style={{
                animation: 'fadeIn 0.4s ease-out'
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  Processing Node Details
                </div>

                <SignatureBadge
                  stage={journey.stages[selectedStageIndex].stage}
                  workerName={journey.stages[selectedStageIndex].workerName}
                  warehouseCode={journey.stages[selectedStageIndex].warehouseCode}
                  timestamp={journey.stages[selectedStageIndex].timestamp}
                  signature={journey.stages[selectedStageIndex].signature}
                  isValid={journey.stages[selectedStageIndex].isValid}
                  metadata={journey.stages[selectedStageIndex].metadata}
                />
                
                {/* Visual Connector for extra premium feel */}
                <div style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 12,
                  fontStyle: 'italic',
                  opacity: 0.6
                }}>
                  Showing record {selectedStageIndex + 1} of {journey.summary.totalStages}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 14,
                }}
              >
                No stages recorded yet for this batch
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
