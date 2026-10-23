'use client';

import React, { useState } from 'react';
import { HelpCircle, X, Send, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AnalysisResponse } from '../types/api';

interface ClarificationModalProps {
  analysisId: string;
  questions: string[];
  itemName: string;
  onSuccess: (updated: AnalysisResponse) => void;
  onClose: () => void;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  analysisId,
  questions,
  itemName,
  onSuccess,
  onClose
}) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const presetSuggestions = [
    'Paper with thin plastic (poly-coat) lining',
    'Unlined plain paper / cardboard',
    'Rigid plastic with resin code #5 (PP)',
    'Soft flexible plastic film / pouch',
    'Aluminum foil lined / multi-layer laminate',
    'Pure metal / aluminum can'
  ];

  const handleSelectSuggestion = (qIdx: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qIdx]: text
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Ensure all questions have an answer
    const formattedAnswers = questions.map((q, idx) => ({
      question: q,
      answer: answers[idx]?.trim() || 'Unspecified / standard material'
    }));

    if (formattedAnswers.every((a) => !a.answer || a.answer === 'Unspecified / standard material')) {
      setError('Please provide an answer to at least one question so the engine can determine the correct rule.');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await apiClient.clarifyAnalysis(analysisId, formattedAnswers);
      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit clarification answers.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Packaging Clarification</h3>
              <p className="text-xs text-amber-100">Item: {itemName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-stone-600 leading-relaxed">
            Local municipal recycling sorting rules require specific material verification for{' '}
            <strong className="text-stone-900">{itemName}</strong>. Please answer the clarification questions below:
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {questions.map((question, qIdx) => (
              <div key={qIdx} className="space-y-2 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <label className="block text-xs font-bold text-stone-800">
                  {qIdx + 1}. {question}
                </label>

                {/* Preset Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {presetSuggestions.map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleSelectSuggestion(qIdx, suggestion)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                        answers[qIdx] === suggestion
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold shadow-xs'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* Custom text answer */}
                <input
                  type="text"
                  placeholder="Or enter specific material or condition..."
                  value={answers[qIdx] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [qIdx]: e.target.value
                    }))
                  }
                  className="w-full mt-2 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white"
                />
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Re-evaluating Rules...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Clarification
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
