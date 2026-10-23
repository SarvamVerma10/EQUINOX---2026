'use client';

import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Clock, CheckCircle2, AlertCircle, BookOpen, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { apiClient, getOrCreateSessionId, resetSessionId } from '../services/apiClient';
import type { DisposalHistoryRecord } from '../types/api';

interface HistoryViewProps {
  onSelectHistoryItem?: (record: DisposalHistoryRecord) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelectHistoryItem }) => {
  const [history, setHistory] = useState<DisposalHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedSession, setCopiedSession] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentSessionId(getOrCreateSessionId());
      const data = await apiClient.getHistory();
      setHistory(data.history || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch scan history from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCopySession = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentSessionId);
      setCopiedSession(true);
      setTimeout(() => setCopiedSession(false), 2000);
    }
  };

  const handleResetSession = () => {
    if (confirm('Start a new session? This will generate a fresh session ID for future scans.')) {
      const newId = resetSessionId();
      setCurrentSessionId(newId);
      loadHistory();
    }
  };

  const toggleExpand = (historyId: string) => {
    setExpandedId((prev) => (prev === historyId ? null : historyId));
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const getCategoryBadgeClass = (category?: string | null) => {
    if (!category) return 'bg-stone-200 text-stone-800';
    const lower = category.toLowerCase();
    if (lower.includes('organic') || lower.includes('wet') || lower.includes('green')) {
      return 'bg-wetGreen text-white';
    }
    if (lower.includes('recycl') || lower.includes('blue')) {
      return 'bg-dryBlue text-white';
    }
    if (lower.includes('hazard') || lower.includes('e-waste') || lower.includes('special')) {
      return 'bg-hazRed text-white';
    }
    return 'bg-neutralGrey text-white';
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-deepGreen flex items-center gap-2">
            <History className="w-5 h-5 text-forest" />
            Session Disposal History
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Logs of your packaging analyses and verified sorting decisions for this session.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="p-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Session Isolation Banner */}
      <div className="px-6 py-3 bg-stone-100/60 border-b border-stone-200/80 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 text-stone-600">
          <span className="font-semibold text-stone-700">Session ID:</span>
          <code className="bg-stone-200/80 px-2 py-0.5 rounded font-mono text-[11px] text-stone-800">
            {currentSessionId}
          </code>
          <button
            type="button"
            onClick={handleCopySession}
            className="p-1 text-stone-500 hover:text-stone-800 transition-colors"
            title="Copy Session ID"
          >
            {copiedSession ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-stone-500">
            Total Scans: <strong className="text-stone-800">{history.length}</strong>
          </span>
          <button
            type="button"
            onClick={handleResetSession}
            className="text-[11px] text-stone-500 hover:text-red-700 font-medium underline"
          >
            Reset Session
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {loading && history.length === 0 && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-forest animate-spin mx-auto" />
            <p className="text-xs text-stone-500">Loading your verified sorting history...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Could not load history</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="py-12 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-softGreen text-forest flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-800">No disposal scans recorded yet</h3>
            <p className="text-xs text-stone-500">
              When you scan packaging items with the camera or search for items, your verified sorting decisions are recorded
              here with full evidence provenance.
            </p>
          </div>
        )}

        {/* History Item Cards */}
        {history.length > 0 && (
          <div className="space-y-3">
            {history.map((record) => {
              const isExpanded = expandedId === record.historyId;
              const itemName = (record.itemSnapshot?.name as string) || 'Waste Item';
              const category = record.recommendationSnapshot?.category as string | undefined;
              const explanation = record.recommendationSnapshot?.explanation as string | undefined;
              const instructions = record.recommendationSnapshot?.instructions as string[] | undefined;

              return (
                <div
                  key={record.historyId}
                  className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-xs hover:border-forest/40 transition-colors"
                >
                  <div
                    onClick={() => toggleExpand(record.historyId)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-stone-50/70 transition-colors gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getCategoryBadgeClass(category)}`}>
                          {category || 'Unresolved'}
                        </span>
                        <h4 className="font-bold text-sm text-stone-900">{itemName}</h4>
                      </div>
                      <p className="text-xs text-stone-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {formatTimestamp(record.timestamp)}
                        {record.evidenceSnapshot?.length > 0 && (
                          <span className="text-[11px] text-stone-400">
                            • {record.evidenceSnapshot.length} verified excerpt(s)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-stone-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded Details Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-stone-100 bg-stone-50/50 space-y-3 text-xs">
                      {explanation && (
                        <div>
                          <span className="font-semibold text-stone-700 block mb-0.5">Disposal Rationale:</span>
                          <p className="text-stone-600 leading-relaxed">{explanation}</p>
                        </div>
                      )}

                      {instructions && instructions.length > 0 && (
                        <div>
                          <span className="font-semibold text-stone-700 block mb-1">Preparation:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-stone-600">
                            {instructions.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Evidence snapshot */}
                      {record.evidenceSnapshot && record.evidenceSnapshot.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="font-semibold text-amber-900 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-amber-700" /> Local Guide Provenance:
                          </span>
                          {record.evidenceSnapshot.map((ev, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/60 space-y-1 text-[11px]">
                              <p className="italic text-stone-800">&ldquo;{ev.sourceExcerpt}&rdquo;</p>
                              <div className="flex items-center justify-between text-[10px] text-stone-500">
                                <span>{ev.pageNumber ? `Page ${ev.pageNumber}` : 'Page N/A'} {ev.sectionTitle ? `• ${ev.sectionTitle}` : ''}</span>
                                <span className="font-mono">Rule: {ev.ruleId}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
