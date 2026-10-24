'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraUpload, type CameraUploadHandle } from '../components/CameraUpload';
import { apiClient } from '../services/apiClient';
import type { AnalysisResponse } from '../types/api';

interface Guide {
  id?: string;
  guideName?: string;
  localityName?: string;
  issuingAuthority?: string;
  version?: string;
  effectiveDate?: string;
  isDemo?: boolean;
  isActive?: boolean;
  rules?: unknown[];
}

interface ReferenceMessage {
  source: 'wastewise-reference';
  type: string;
  [key: string]: unknown;
}

const frameUrl = '/wastewise.html?v=hindi-theme-fix-2026';
const wifiUrl = 'http://10.24.23.215:3000/';

/**
 * Robustly converts a Base64 data URL to a binary Blob in-memory.
 * Avoids browser fetch(dataUrl) which can fail with "Failed to fetch" on large image payloads.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const b64 = parts[1] || '';
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (err) {
    console.error('Failed to convert dataUrl to Blob:', err);
    throw new Error('The captured photo could not be prepared for analysis.');
  }
}

export default function WasteWisePage() {
  const cameraRef = useRef<CameraUploadHandle>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [showQrBadge, setShowQrBadge] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(wifiUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendToReference = useCallback((type: string, details: Record<string, unknown> = {}) => {
    frameRef.current?.contentWindow?.postMessage(
      { source: 'wastewise-app', type, ...details },
      window.location.origin
    );
  }, []);

  const setAnalyzing = useCallback((next: boolean) => {
    busyRef.current = next;
    setBusy(next);
    if (!next) sendToReference('analysis-finished');
  }, [sendToReference]);

  const handleAnalysisSuccess = useCallback((analysis: AnalysisResponse) => {
    setAnalyzing(false);
    sendToReference('analysis-result', { analysis });
  }, [sendToReference, setAnalyzing]);

  const handleAnalysisError = useCallback((error: Error) => {
    setAnalyzing(false);
    sendToReference('analysis-error', { error: error.message || 'Analysis failed. Please try again.' });
  }, [sendToReference, setAnalyzing]);

  const runTextAnalysis = useCallback(async (query: string, label?: string) => {
    if (busyRef.current) return;
    if (!query.trim()) {
      sendToReference('analysis-error', { error: 'Enter a waste item name.' });
      return;
    }
    setAnalyzing(true);
    sendToReference('analysis-start');
    await cameraRef.current?.analyzeText(query.trim(), label || query.trim());
  }, [sendToReference, setAnalyzing]);

  const runImageAnalysis = useCallback(async (dataUrl: string, filename: string) => {
    if (busyRef.current) return;
    try {
      const blob = dataUrlToBlob(dataUrl);
      const image = new File([blob], filename || 'wastewise-photo.jpg', {
        type: blob.type || 'image/jpeg'
      });
      const uploader = cameraRef.current;
      if (!uploader) throw new Error('The photo scanner is not ready yet.');
      setAnalyzing(true);
      sendToReference('analysis-start');
      await uploader.analyzeImageFile(image);
    } catch (error) {
      handleAnalysisError(error instanceof Error ? error : new Error('Unable to analyze this photo.'));
    }
  }, [handleAnalysisError, sendToReference, setAnalyzing]);

  const runGuideAction = useCallback(async (message: ReferenceMessage) => {
    const action = message.action === 'activate' ? 'activate' : 'preview';
    const rawText = typeof message.rawText === 'string' ? message.rawText : '';
    if (!rawText.trim()) {
      sendToReference('guide-result', { action, error: 'Add guide text before previewing or activating it.' });
      return;
    }

    let adminToken = process.env.NODE_ENV === 'development' ? 'CHANGE_ME_ADMIN_PASSCODE' : '';
    if (!adminToken) {
      adminToken = window.prompt('Enter the server-configured WASTEWISE_ADMIN_TOKEN to manage this guide:') || '';
    }
    if (!adminToken) {
      sendToReference('guide-result', { action, error: 'Guide management requires the configured admin token.' });
      return;
    }

    try {
      const response = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          action,
          rawText,
          localityName: message.localityName,
          guideName: message.guideName,
          issuingAuthority: message.issuingAuthority,
          version: message.version,
          effectiveDate: message.effectiveDate,
          isDemo: message.isDemo === true
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.reason || result.message || 'The guide could not be processed.');
      sendToReference('guide-result', {
        action,
        guide: result.guide,
        warnings: result.warnings || []
      });
    } catch (error) {
      sendToReference('guide-result', {
        action,
        error: error instanceof Error ? error.message : 'Unable to process the guide.'
      });
    }
  }, [sendToReference]);

  const handleReferenceMessage = useCallback(async (event: MessageEvent<ReferenceMessage>) => {
    if (
      event.origin !== window.location.origin ||
      event.source !== frameRef.current?.contentWindow ||
      event.data?.source !== 'wastewise-reference'
    ) return;

    const message = event.data;
    switch (message.type) {
      case 'reference-ready': {
        try {
          const response = await fetch('/api/guide');
          const data = await response.json();
          if (!response.ok) throw new Error(data.reason || 'Unable to load the active guide.');
          sendToReference('guide-state', { activeGuide: data.activeGuide });
        } catch (error) {
          sendToReference('analysis-error', {
            error: error instanceof Error ? error.message : 'Unable to load the active guide.'
          });
        }
        break;
      }
      case 'analyze-text':
        await runTextAnalysis(
          typeof message.query === 'string' ? message.query : '',
          typeof message.label === 'string' ? message.label : undefined
        );
        break;
      case 'analyze-image':
        if (typeof message.dataUrl === 'string') {
          await runImageAnalysis(message.dataUrl, typeof message.filename === 'string' ? message.filename : 'wastewise-photo.jpg');
        } else {
          handleAnalysisError(new Error('No photo data was received.'));
        }
        break;
      case 'guide-action':
        await runGuideAction(message);
        break;
      case 'clarify-analysis': {
        if (typeof message.analysisId !== 'string' || typeof message.question !== 'string' || typeof message.answer !== 'string') break;
        try {
          const result = await apiClient.clarifyAnalysis(message.analysisId, [
            { question: message.question, answer: message.answer }
          ]);
          handleAnalysisSuccess(result);
        } catch (error) {
          handleAnalysisError(error instanceof Error ? error : new Error('Unable to clarify this analysis.'));
        }
        break;
      }
      case 'correct-analysis': {
        if (typeof message.analysisId !== 'string' || !message.correction || typeof message.correction !== 'object') break;
        try {
          const correction = message.correction as {
            correctedItemName?: string;
            correctedComponents?: Array<{ name: string; material: string }>;
          };
          await apiClient.submitCorrection(message.analysisId, correction);
          sendToReference('correction-result', { correction });
        } catch (error) {
          sendToReference('correction-result', {
            error: error instanceof Error ? error.message : 'Unable to submit this correction.'
          });
        }
        break;
      }
    }
  }, [
    handleAnalysisError,
    handleAnalysisSuccess,
    runGuideAction,
    runImageAnalysis,
    runTextAnalysis,
    sendToReference
  ]);

  useEffect(() => {
    window.addEventListener('message', handleReferenceMessage);
    return () => window.removeEventListener('message', handleReferenceMessage);
  }, [handleReferenceMessage]);

  const handleFrameLoad = () => {
    frameRef.current?.contentWindow?.postMessage(
      { source: 'wastewise-app', type: 'app-ready' },
      window.location.origin
    );
  };

  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0b1220' }}>
      <iframe
        ref={frameRef}
        src={frameUrl}
        title="WasteWise"
        onLoad={handleFrameLoad}
        allow="camera *; microphone *; autoplay *; display-capture *"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />

      {/* Floating QR Code Badge for Laptop / Desktop Screen */}
      {showQrBadge && (
        <aside
          aria-label="Scan QR to open on mobile"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'linear-gradient(135deg, rgba(15, 20, 32, 0.97) 0%, rgba(20, 28, 45, 0.97) 100%)',
            border: '1px solid rgba(66, 133, 244, 0.45)',
            boxShadow: '0 12px 45px rgba(0, 0, 0, 0.85), 0 0 30px rgba(66, 133, 244, 0.25)',
            borderRadius: '24px',
            padding: '10px 14px 10px 10px',
            backdropFilter: 'blur(16px)',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '6px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(wifiUrl)}`}
              alt="Scan QR code with phone"
              width={78}
              height={78}
              style={{ borderRadius: '10px', display: 'block' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '145px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#4285F4', letterSpacing: '0.06em' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34A853', display: 'inline-block' }} />
                Mobile Scanner
              </span>
              <button
                type="button"
                onClick={() => setShowQrBadge(false)}
                title="Dismiss"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 0,
                  color: '#94A3B8',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '11px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            <span style={{ fontSize: '13px', fontWeight: 700, color: '#F3F4F8', lineHeight: 1.2 }}>
              📱 Scan with Phone
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#93C5FD' }}>
                10.24.23.215:3000
              </span>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: copied ? 'rgba(52, 168, 83, 0.25)' : 'rgba(66, 133, 244, 0.2)',
                  border: '1px solid rgba(66, 133, 244, 0.3)',
                  color: copied ? '#86EFAC' : '#93C5FD',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </aside>
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: 1,
          height: 1,
          overflow: 'hidden',
          visibility: 'hidden'
        }}
      >
        <CameraUpload
          ref={cameraRef}
          localityId="metro-central"
          onAnalysisStart={() => {
            busyRef.current = true;
            setBusy(true);
          }}
          onAnalysisSuccess={handleAnalysisSuccess}
          onError={handleAnalysisError}
          isLoading={busy}
        />
      </div>
    </main>
  );
}
