'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  History,
  BookOpen,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Globe,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { apiClient, getOrCreateSessionId } from '../services/apiClient';
import type { AnalysisResponse, GuideResponse, HealthResponse } from '../types/api';
import { CameraUpload } from '../components/CameraUpload';
import { ResultCard } from '../components/ResultCard';
import { ClarificationModal } from '../components/ClarificationModal';
import { CorrectionModal } from '../components/CorrectionModal';
import { HistoryView } from '../components/HistoryView';

export default function WasteWisePage() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'guide'>('scan');
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  // Backend Integration State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [activeGuide, setActiveGuide] = useState<GuideResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Active Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResponse | null>(null);

  // Modals
  const [showClarification, setShowClarification] = useState<boolean>(false);
  const [showCorrection, setShowCorrection] = useState<boolean>(false);

  // Initialize session & fetch backend health + active guide
  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      setBackendError(null);
      const [healthData, guideData] = await Promise.all([
        apiClient.getHealth().catch((e) => {
          console.warn('Backend health check note:', e.message);
          return null;
        }),
        apiClient.getActiveGuide('metro-central').catch((e) => {
          console.warn('Active guide fetch note:', e.message);
          return null;
        })
      ]);

      if (healthData) setHealth(healthData);
      if (guideData) setActiveGuide(guideData);
    } catch (err: any) {
      setBackendError(err?.message || 'Cannot connect to backend service.');
    }
  };

  // Handlers for CameraUpload
  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
    setBackendError(null);
  };

  const handleAnalysisSuccess = (result: AnalysisResponse) => {
    setIsAnalyzing(false);
    setCurrentAnalysis(result);

    // If clarification is required, auto-open clarification modal
    if (result.status === 'clarification_required' || result.clarification?.required) {
      setShowClarification(true);
    }
  };

  const handleAnalysisError = (err: Error) => {
    setIsAnalyzing(false);
    setBackendError(err.message || 'An error occurred during analysis.');
  };

  // Handlers for Clarification & Correction
  const handleClarificationSuccess = (updated: AnalysisResponse) => {
    setCurrentAnalysis(updated);
    setShowClarification(false);
  };

  const handleCorrectionSuccess = (updated: AnalysisResponse) => {
    setCurrentAnalysis(updated);
    setShowCorrection(false);
  };

  const handleResetAnalysis = () => {
    setCurrentAnalysis(null);
    setShowClarification(false);
    setShowCorrection(false);
    setBackendError(null);
  };

  return (
    <main className="min-h-screen bg-[#F7F8F4] text-[#132A13] selection:bg-forest selection:text-white pb-16">
      {/* 1. Top Municipal Active Guide Status Banner */}
      <aside aria-label="Municipal Guide Status" className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-950">
              {activeGuide?.isActive ? 'Verified Local Guide' : 'Development Seed Guide'}
            </span>
            <span className="font-semibold truncate max-w-md">
              {activeGuide?.title || 'Metro Central Municipal Waste & Recycling Authority Guidelines (2026.1)'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-amber-800 hidden sm:inline">
              Locality: <strong className="font-mono">{activeGuide?.localityId || 'metro-central'}</strong>
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              Backend: {health?.status === 'ok' ? 'Connected (v1)' : 'Offline / Standalone'}
            </span>
          </div>
        </div>
      </aside>

      {/* 2. Global Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest flex items-center justify-center text-white shadow-md shadow-forest/20">
              <ShieldCheck className="w-6 h-6 text-accentLime" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-deepGreen">WasteWise</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-softGreen text-forest uppercase">
                  AI + Verified
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Know it. Sort it. Save it. • Evidence-grounded sorting
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav aria-label="Main Navigation" className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'scan'
                  ? 'bg-forest text-white shadow-xs'
                  : 'text-stone-600 hover:text-deepGreen hover:bg-stone-100'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Scan & Sort</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'history'
                  ? 'bg-forest text-white shadow-xs'
                  : 'text-stone-600 hover:text-deepGreen hover:bg-stone-100'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'guide'
                  ? 'bg-forest text-white shadow-xs'
                  : 'text-stone-600 hover:text-deepGreen hover:bg-stone-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Guide Rules</span>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="ml-2 px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-700 flex items-center gap-1"
              title="Toggle English / Hindi"
            >
              <Globe className="w-3.5 h-3.5 text-forest" />
              {lang === 'en' ? 'हिन्दी' : 'EN'}
            </button>
          </nav>
        </div>
      </header>

      {/* 3. Main Body Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Error Notification Banner */}
        {backendError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Service Notice</p>
                <p className="text-red-800 mt-0.5 leading-relaxed">{backendError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBackendError(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4. Tab 1: Scan & Sort View */}
        {activeTab === 'scan' && (
          <div className="space-y-6">
            {!currentAnalysis ? (
              <CameraUpload
                localityId={activeGuide?.localityId || 'metro-central'}
                onAnalysisStart={handleAnalysisStart}
                onAnalysisSuccess={handleAnalysisSuccess}
                onError={handleAnalysisError}
                isLoading={isAnalyzing}
              />
            ) : (
              <div className="space-y-4">
                <ResultCard
                  analysis={currentAnalysis}
                  onOpenClarification={() => setShowClarification(true)}
                  onOpenCorrection={() => setShowCorrection(true)}
                  onReset={handleResetAnalysis}
                />
              </div>
            )}
          </div>
        )}

        {/* 5. Tab 2: Session Disposal History */}
        {activeTab === 'history' && <HistoryView />}

        {/* 6. Tab 3: Verified Municipal Guide Rules Info */}
        {activeTab === 'guide' && (
          <div className="w-full bg-white rounded-3xl shadow-sm border border-stone-200/90 p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-forest uppercase tracking-wider">
                <BookOpen className="w-4 h-4" /> Verified Municipal Guidelines
              </div>
              <h2 className="text-xl font-black text-deepGreen mt-1">
                {activeGuide?.title || 'Metro Central Municipal Waste & Recycling Authority Guidelines'}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                Version {activeGuide?.version || '2026.1'} • {activeGuide?.processedChunks || 12} verified rule chunks indexed
              </p>
            </div>

            {/* Verified Sorting Categories */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-800">Standard Waste Streams & Categories</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    title: 'Recycling / Blue Bin',
                    color: 'border-blue-400 bg-blue-50/60 text-blue-950',
                    desc: 'Clean paperboard, aluminum cans, rigid plastic containers (#1 through #5).'
                  },
                  {
                    title: 'Organics / Green Bin',
                    color: 'border-emerald-400 bg-emerald-50/60 text-emerald-950',
                    desc: 'Fruit peels, vegetable scraps, greasy pizza boxes, compostable food waste.'
                  },
                  {
                    title: 'Hazardous Waste / Special Drop-off',
                    color: 'border-red-400 bg-red-50/60 text-red-950',
                    desc: 'Single-use alkaline batteries, lithium-ion rechargeable batteries, electronics, chemicals.'
                  },
                  {
                    title: 'Landfill / Residual Waste',
                    color: 'border-stone-400 bg-stone-100 text-stone-900',
                    desc: 'Poly-coated hot beverage cups, broken ceramics, laminated blister packs, sanitary waste.'
                  }
                ].map((cat) => (
                  <div key={cat.title} className={`p-4 rounded-2xl border ${cat.color} space-y-1`}>
                    <h4 className="font-bold text-xs uppercase tracking-wide">{cat.title}</h4>
                    <p className="text-xs opacity-90 leading-relaxed">{cat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Invariant Anti-Hallucination Guardrails Explainer */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2 text-xs text-amber-900">
              <span className="font-bold flex items-center gap-1.5 text-amber-950">
                <ShieldCheck className="w-4 h-4 text-forest" /> Zero-Drift Anti-Hallucination Architecture:
              </span>
              <p className="leading-relaxed text-stone-700">
                WasteWise enforces strict evidence-grounding. The AI multimodal layer only decomposes packaging components.
                Final disposal recommendations, preparation steps, and quoted excerpts strictly come from verified rule chunks
                in the local municipality guide. If an item is ungrounded or absent from the guide, WasteWise outputs{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">no_supported_rule</code> rather than guessing.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 7. Clarification Modal */}
      {showClarification && currentAnalysis && (
        <ClarificationModal
          analysisId={currentAnalysis.analysisId}
          questions={
            currentAnalysis.clarification?.questions?.length > 0
              ? currentAnalysis.clarification.questions
              : ['Could you clarify what material or lining this item contains?']
          }
          itemName={currentAnalysis.item?.name || 'Item'}
          onSuccess={handleClarificationSuccess}
          onClose={() => setShowClarification(false)}
        />
      )}

      {/* 8. User Correction Modal */}
      {showCorrection && currentAnalysis && (
        <CorrectionModal
          analysisId={currentAnalysis.analysisId}
          initialItemName={currentAnalysis.item?.name || ''}
          initialComponents={currentAnalysis.item?.components || []}
          onSuccess={handleCorrectionSuccess}
          onClose={() => setShowCorrection(false)}
        />
      )}
    </main>
  );
}
