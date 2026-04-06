/**
 * ScanPage.tsx
 * ============
 * Batch traceability scanner with automatic journey display
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import WorkerSignoff from './WorkerSignoff';
import BatchJourney from './BatchJourney';
import { getWorkerStats, getRecentActivity, WorkerStatsResponse, ActivityItem } from '@/lib/attestation-submit';
import { formatTimestamp, getStageName } from '@/lib/signature-verifier';
import jsQR from 'jsqr';

interface ScanPageProps {
  onToast: (message: string) => void;
}

export default function ScanPage({ onToast }: ScanPageProps) {
  // Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  //App state
  const [batchId, setBatchId] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [scannedQRData, setScannedQRData] = useState<string | null>(null);
  
  // Dashboard data
  const [stats, setStats] = useState<WorkerStatsResponse | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load dashboard insights
  const loadInsights = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [s, r] = await Promise.all([
        getWorkerStats(),
        getRecentActivity(5)
      ]);
      setStats(s);
      setRecentActivity(r);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Scan QR code frame by frame
  const scanTick = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          // Found QR code
          const data = code.data;
          setScannedQRData(data); // Store raw string for later use in chaining
          scanningRef.current = false;
          setIsScanning(false);

          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
          }

          // Handle the scanned data
          try {
            const parsed = JSON.parse(data);
            if (parsed.batchId) {
              setBatchId(parsed.batchId);
              setShowJourney(true);
              onToast(`Scanned EAS: ${parsed.batchId}`);
            } else if (parsed.attestation && parsed.attestation.batchId) {
              // Handle deep EAS structure
              setBatchId(parsed.attestation.batchId);
              setShowJourney(true);
              onToast(`Scanned EAS Chain: ${parsed.attestation.batchId}`);
            } else {
              setBatchId(data);
              setShowJourney(true);
              onToast(`Scanned: ${data}`);
            }
          } catch {
            setBatchId(data);
            setShowJourney(true);
            onToast(`Scanned: ${data}`);
          }
          return;
        }
      }
    }

    if (scanningRef.current) {
      requestAnimationFrame(scanTick);
    }
  }, [stream, onToast]);

  // Start camera
  const startCamera = async () => {
    setCameraLoading(true);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });

      setStream(mediaStream);
      scanningRef.current = true;
      setIsScanning(true);
      setCameraLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        try {
          await videoRef.current.play();
          console.log('Video playing, starting scan loop');
          requestAnimationFrame(scanTick);
        } catch (err) {
          console.error('Video play error:', err);
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              console.log('Video playing via loadedmetadata, starting scan loop');
              requestAnimationFrame(scanTick);
            } catch (e) {
              console.error('Metadata play error:', e);
              onToast('Could not start video playback');
              setCameraLoading(false);
            }
          };
        }
      }
    } catch (err) {
      onToast('Camera access denied. Please enable camera permissions.');
      console.error('Camera error:', err);
      scanningRef.current = false;
      setIsScanning(false);
      setCameraLoading(false);
    }
  };

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    setIsScanning(false);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Handle manual input
  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      setBatchId(manualInput.trim());
      setShowJourney(true);
      setManualInput('');
      onToast(`Manually entered batch: ${manualInput.trim()}`);
    }
  };

  // Handle QR code image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e. target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            try {
              const parsed = JSON.parse(code.data);
              setScannedQRData(code.data);
              if (parsed.batchId) {
                setBatchId(parsed.batchId);
                setShowJourney(true);
                onToast(`✅ Decoded batch: ${parsed.batchId}`);
              } else if (parsed.attestation && parsed.attestation.batchId) {
                setBatchId(parsed.attestation.batchId);
                setShowJourney(true);
                onToast(`✅ Decoded EAS chain: ${parsed.attestation.batchId}`);
              } else {
                setBatchId(code.data);
                setShowJourney(true);
                onToast(`✅ Decoded: ${code.data}`);
              }
            } catch {
              setBatchId(code.data);
              setScannedQRData(code.data);
              setShowJourney(true);
              onToast(`✅ Decoded: ${code.data}`);
            }
          } else {
            onToast('❌ No QR code found in image');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle stage selection
  const handleStageSelect = (stage: number) => {
    setSelectedStage(stage);
    setShowSignoffModal(true);
    setShowStageSelector(false);
  };

  // Lifecycle stages (0-11)
  const stages = [
    { stage: 0, name: 'Unknown' },
    { stage: 1, name: 'Collection/Inward' },
    { stage: 2, name: 'Segregation/Sorting' },
    { stage: 3, name: 'Baling' },
    { stage: 4, name: 'Transfer/Shipment' },
    { stage: 5, name: 'Receipt at Facility' },
    { stage: 6, name: 'Washing' },
    { stage: 7, name: 'QC - Quality Control' },
    { stage: 8, name: 'Recycling/Granulation' },
    { stage: 9, name: 'Mixing/Blending' },
    { stage: 10, name: 'Production' },
    { stage: 11, name: 'Dispatch' },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      {/* Batch ID Input Section */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--foreground)' }}>
          Batch Identification
        </h3>

        {/* Scanner Button */}
        <button
          onClick={isScanning ? stopCamera : startCamera}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: isScanning ? '#ef4444' : 'var(--accent)',
            color: '#0a0a0a',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2 a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2 a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          </svg>
          {isScanning ? 'Stop Scanner' : 'Scan QR Code'}
        </button>

        {/* Video Preview */}
        <div
          style={{
            position: 'relative',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 16,
            aspectRatio: '4/3',
            background: '#000',
            border: '2px solid var(--accent)',
            display: isScanning ? 'block' : 'none',
          }}
        >
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameraLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Initializing camera...
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '70%',
                  aspectRatio: '1',
                  maxWidth: 250,
                  border: '2px solid var(--accent)',
                }}
              >
                <div style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTop: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTop: '4px solid var(--accent)', borderRight: '4px solid var(--accent)' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottom: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottom: '4px solid var(--accent)', borderRight: '4px solid var(--accent)' }} />
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 0,
                right: 0,
                textAlign: 'center',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                pointerEvents: 'none',
              }}
            >
              Align QR code within frame
            </div>
          </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, textAlign: 'center', display: isScanning ? 'block' : 'none' }}>OR</div>

        {/* Upload QR Image */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="qr-upload"
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 20px',
              borderRadius: 10,
              border: '2px dashed var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload QR Image
          </label>
          <input
            id="qr-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, textAlign: 'center' }}>OR</div>

        {/* Paste Attestation JSON (Bypass QR) 
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
            Paste Raw Attestation JSON (QR Bypass)
          </label>
          <textarea
            value={scannedQRData || ''}
            onChange={(e) => setScannedQRData(e.target.value)}
            placeholder='{"attestation": {...}, "signature": "0x..."}'
            rows={6}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 12,
              fontFamily: 'monospace',
              marginBottom: 8,
              resize: 'vertical'
            }}
          />
          <button
            onClick={() => {
              if (!scannedQRData) return;
              try {
                const parsed = JSON.parse(scannedQRData);
                if (parsed.batchId) {
                  setBatchId(parsed.batchId);
                  setShowJourney(true);
                  onToast(`✅ Loaded batch: ${parsed.batchId}`);
                } else if (parsed.attestation && parsed.attestation.batchId) {
                  setBatchId(parsed.attestation.batchId);
                  setShowJourney(true);
                  onToast(`✅ Loaded EAS chain: ${parsed.attestation.batchId}`);
                } else {
                  setBatchId(scannedQRData);
                  setShowJourney(true);
                  onToast(`✅ Loaded raw data`);
                }
              } catch {
                setBatchId(scannedQRData);
                setShowJourney(true);
                onToast(`✅ Loaded non-JSON data`);
              }
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#0a0a0a',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none'
            }}
          >
            Process JSON Payload
          </button>
        </div>
        */}


        {/* Manual Input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            placeholder="Enter batch ID manually"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 14,
            }}
          />
          <button
            onClick={handleManualSubmit}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#0a0a0a',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>

        {/* Current Batch Display */}
        {batchId && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              background: 'var(--background)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Current Batch</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{batchId}</div>
            </div>
            <button
              onClick={() => {
                setBatchId('');
                setManualInput('');
                setShowJourney(false);
                setScannedQRData(null);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Insights Section */}
      {!batchId && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
              Warehouse Insights
            </h3>
            <button 
              onClick={loadInsights}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Total Lots Signed</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{stats?.totalAttestations || 0}</div>
            </div>
            <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Unique Batches</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{stats?.uniqueBatches || 0}</div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></span>
            Recent Activity Feed
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentActivity.length > 0 ? recentActivity.map((act, i) => (
              <div 
                key={i}
                onClick={() => {
                  setBatchId(act.batchId);
                  setShowJourney(true);
                }}
                style={{ 
                  background: 'var(--surface)', 
                  padding: '12px 16px', 
                  borderRadius: 10, 
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{act.batchId}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {getStageName(act.stage)} • {act.workerName.split(' ')[0]}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                  {formatTimestamp(act.timestamp).split(',')[1]}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', borderStyle: 'dashed' }}>
                No recent activity found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Journey - Auto-display when batch ID is set */}
      {batchId && (
        <>
          {/* Add Signoff Button */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowStageSelector(true)}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: '#0a0a0a',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add New Worker Sign-off
            </button>
          </div>

          {/* View Journey Button (shown when journey is hidden) */}
          {!showJourney && (
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowJourney(true)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View Batch Journey Timeline
              </button>
            </div>
          )}
        </>
      )}

      {/* Journey Timeline Modal */}
      {batchId && showJourney && (
        <BatchJourney
          batchId={batchId}
          scenario="1"
          onClose={() => setShowJourney(false)}
        />
      )}

      {/* Stage Selector Modal */}
      {showStageSelector && (
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
          onClick={() => setShowStageSelector(false)}
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
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--foreground)' }}>
              Select Processing Stage
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 10 }}>
              {(() => {
                let currentStage = -1;
                try {
                  if (scannedQRData) {
                    const parsed = JSON.parse(scannedQRData);
                    currentStage = parsed.attestation?.stage ?? parsed.stage ?? -1;
                  }
                } catch (e) {}
                
                return stages
                  .filter(s => s.stage > currentStage)
                  .map((stage) => (
                    <button
                      key={stage.stage}
                      onClick={() => handleStageSelect(stage.stage)}
                      style={{
                        padding: '16px 20px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage {stage.stage}</div>
                      <div style={{ fontSize: 15 }}>{stage.name}</div>
                    </button>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Worker Signoff Modal */}
      {showSignoffModal && selectedStage !== null && batchId && (
        <WorkerSignoff
          batchId={batchId}
          stage={selectedStage}
          previousQRData={scannedQRData || undefined}
          onClose={() => setShowSignoffModal(false)}
          onSuccess={(message) => {
            onToast(message);
            setShowSignoffModal(false);
            // Trigger reload of journey by updating batch ID state
            const currentBatch = batchId;
            setBatchId('');
            setShowJourney(false);
            setTimeout(() => {
              setBatchId(currentBatch);
              setShowJourney(true);
            }, 10);
          }}
          onError={(message) => {
            onToast(message);
          }}
        />
      )}
    </div>
  );
}
