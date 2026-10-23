'use client';

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  BookOpen,
  Layers,
  Edit3,
  RotateCcw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { AnalysisResponse } from '../types/api';

interface ResultCardProps {
  analysis: AnalysisResponse;
  onOpenClarification?: () => void;
  onOpenCorrection: () => void;
  onReset: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  analysis,
  onOpenClarification,
  onOpenCorrection,
  onReset
}) => {
  const { status, item, recommendation, evidence, clarification, uncertaintyNotes } = analysis;

  // Determine category badge styling and theme
  const categoryName = recommendation?.category || (status === 'clarification_required' ? 'Needs Clarification' : 'Unresolved / No Supported Rule');

  const getCategoryTheme = () => {
    const lower = categoryName.toLowerCase();
    if (lower.includes('organic') || lower.includes('wet') || lower.includes('bio') || lower.includes('green')) {
      return {
        bg: 'bg-emerald-50 border-emerald-300',
        badge: 'bg-wetGreen text-white',
        text: 'text-emerald-950',
        subtext: 'text-emerald-800',
        icon: CheckCircle,
        binName: 'Green Organics / Wet Waste Bin'
      };
    }
    if (lower.includes('recycl') || lower.includes('blue') || lower.includes('paper') || lower.includes('plastic') || lower.includes('can')) {
      return {
        bg: 'bg-blue-50 border-blue-300',
        badge: 'bg-dryBlue text-white',
        text: 'text-blue-950',
        subtext: 'text-blue-800',
        icon: CheckCircle,
        binName: 'Blue Recycling Bin'
      };
    }
    if (lower.includes('hazard') || lower.includes('e-waste') || lower.includes('electron') || lower.includes('batter') || lower.includes('special') || lower.includes('drop-off')) {
      return {
        bg: 'bg-red-50 border-red-300',
        badge: 'bg-hazRed text-white',
        text: 'text-red-950',
        subtext: 'text-red-800',
        icon: ShieldAlert,
        binName: 'Hazardous / Dedicated Collection Point'
      };
    }
    return {
      bg: 'bg-stone-100 border-stone-300',
      badge: 'bg-neutralGrey text-white',
      text: 'text-stone-900',
      subtext: 'text-stone-700',
      icon: HelpCircle,
      binName: 'Non-Standard / General Residual Waste'
    };
  };

  const theme = getCategoryTheme();
  const IconComponent = theme.icon;

  return (
    <div className="w-full bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 1. Header Banner with Category & Status */}
      <div className={`p-6 border-b ${theme.bg}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badge}`}>
              {status === 'recommendation_ready' ? 'Verified Guideline' : status.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-medium text-stone-500">ID: {analysis.analysisId.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCorrection}
              className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-xs font-semibold text-stone-700 border border-stone-300/80 shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-stone-500" />
              Report Correction
            </button>
          </div>
        </div>

        {/* Item Name & Target Disposal Bin */}
        <div className="mt-4">
          <h1 className="text-2xl font-black text-deepGreen tracking-tight">
            {item.name || 'Identified Packaging Item'}
          </h1>
          <p className="text-sm font-semibold mt-1 flex items-center gap-2">
            <IconComponent className="w-4 h-4 shrink-0" />
            <span className={theme.text}>{categoryName}</span>
            <span className="text-xs font-normal text-stone-500">({theme.binName})</span>
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 2. Clarification Needed Warning if status === 'clarification_required' */}
        {clarification.required && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Clarification Required</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  The AI detected multiple components or ambiguous material conditions that affect the proper bin category.
                </p>
              </div>
            </div>

            <ul className="text-xs text-amber-900 list-disc list-inside space-y-1 bg-white/70 p-3 rounded-xl border border-amber-100 font-medium">
              {clarification.questions.map((q, idx) => (
                <li key={idx}>{q}</li>
              ))}
            </ul>

            {onOpenClarification && (
              <button
                type="button"
                onClick={onOpenClarification}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                Answer Clarification Questions <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 3. Actionable Preparation Steps & Instructions */}
        {recommendation && recommendation.instructions && recommendation.instructions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-deepGreen flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-forest" />
              Disposal Preparation Steps
            </h3>
            <div className="space-y-2">
              {recommendation.instructions.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs sm:text-sm text-stone-800"
                >
                  <span className="w-5 h-5 rounded-full bg-softGreen text-forest font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="font-medium leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Grounded Explanation */}
        {recommendation && recommendation.explanation && (
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs sm:text-sm text-stone-700 space-y-1">
            <span className="font-bold text-deepGreen block text-xs uppercase tracking-wider">
              Disposal Rationale & Policy
            </span>
            <p className="leading-relaxed text-stone-600">{recommendation.explanation}</p>
          </div>
        )}

        {/* 5. Multimodal Item & Component Breakdown */}
        {item.components && item.components.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-deepGreen flex items-center gap-2">
              <Layers className="w-4 h-4 text-forest" />
              Packaging & Material Decomposition
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {item.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900 block">{comp.name}</span>
                    <span className="text-stone-500 font-medium">{comp.material}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase ${
                      comp.confidence === 'high'
                        ? 'bg-emerald-100 text-emerald-800'
                        : comp.confidence === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {comp.confidence} confidence
                  </span>
                </div>
              ))}
            </div>

            {item.alternatives && item.alternatives.length > 0 && (
              <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">Detected item aliases:</span>
                {item.alternatives.map((alt, idx) => (
                  <span key={idx} className="bg-stone-100 px-2 py-0.5 rounded-md text-stone-600">
                    {alt}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Evidence Provenance & Anti-Hallucination Source Box */}
        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-800" />
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Evidence Provenance (Local Municipal Guide)
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
              Deterministic Chunk Match
            </span>
          </div>

          {evidence && evidence.length > 0 ? (
            <div className="space-y-3">
              {evidence.map((ev, idx) => (
                <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200/60 space-y-2 text-xs">
                  <blockquote className="italic text-stone-800 border-l-2 border-amber-500 pl-3 leading-relaxed">
                    &ldquo;{ev.sourceExcerpt}&rdquo;
                  </blockquote>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                    <span className="font-semibold text-stone-700">
                      {ev.pageNumber ? `Page ${ev.pageNumber}` : 'Page N/A'}
                      {ev.sectionTitle ? ` • ${ev.sectionTitle}` : ''}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">Rule: {ev.ruleId}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs text-stone-500 italic">
              {status === 'no_supported_rule'
                ? 'No exact rule chunk found in the active local municipal guide for this item.'
                : 'No explicit guide excerpt attached to this evaluation.'}
            </div>
          )}
        </div>

        {/* 7. Uncertainty Notes */}
        {uncertaintyNotes && uncertaintyNotes.length > 0 && (
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
            <span className="font-bold text-stone-700 block mb-1">Diagnostic Notes:</span>
            <ul className="list-disc list-inside space-y-0.5">
              {uncertaintyNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 8. Reset Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-3 px-5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Sort Another Waste Item
          </button>
        </div>
      </div>
    </div>
  );
};
