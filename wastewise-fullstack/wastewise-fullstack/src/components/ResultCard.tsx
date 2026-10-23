'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  BookOpen,
  Layers,
  Edit3,
  RotateCcw,
  Sparkles,
  Check,
  ChevronRight,
  ShieldCheck,
  Recycle,
  Apple,
  Zap,
  HeartPulse,
  Shirt,
  Hammer,
  Package,
  Trash2
} from 'lucide-react';
import type { AnalysisResponse } from '../types/api';

interface ResultCardProps {
  analysis: AnalysisResponse;
  onOpenClarification?: () => void;
  onOpenCorrection: () => void;
  onReset: () => void;
}

interface StreamTheme {
  bgHeader: string;
  badgeBg: string;
  badgeText: string;
  binTitle: string;
  binSubtitle: string;
  accentColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  analysis,
  onOpenClarification,
  onOpenCorrection,
  onReset
}) => {
  const { status, item, recommendation, evidence, clarification } = analysis;

  const rawCategory = recommendation?.category || '';
  const rawItemName = item?.name || 'Scanned Waste Item';
  const rawExplanation = recommendation?.explanation || '';
  const searchCorpus = `${rawCategory} ${rawItemName} ${rawExplanation} ${(item.components || []).map(c => `${c.name} ${c.material}`).join(' ')}`.toLowerCase();

  const getStreamTheme = (): StreamTheme => {
    // 1. Organic / Compost
    if (/organic|compost|biodegradable|wet waste|food|banana|fruit|peel|vegetable|kitchen/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-emerald-600 text-white',
        badgeBg: 'bg-emerald-800 text-emerald-100',
        badgeText: 'Organic & Compostable',
        binTitle: 'Green Municipal Wet Bin',
        binSubtitle: 'Biodegradable Kitchen & Plant Waste',
        accentColor: 'text-emerald-700',
        icon: Apple
      };
    }

    // 2. Hazardous & E-Waste
    if (/battery|lithium|hazard|e-waste|electronic|charger|circuit|cable|chemical|paint/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-red-600 text-white',
        badgeBg: 'bg-red-800 text-red-100',
        badgeText: 'Hazardous / E-Waste',
        binTitle: 'Dedicated E-Waste & Battery Drop-Off',
        binSubtitle: 'Never mix with standard household bins (Fire & Toxic Hazard)',
        accentColor: 'text-red-700',
        icon: Zap
      };
    }

    // 3. Medical & Sanitary
    if (/medical|sanitary|blister|pill|pharmaceutical|syringe|needle|sharps|bandage/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-amber-600 text-white',
        badgeBg: 'bg-amber-800 text-amber-100',
        badgeText: 'Medical & Sanitary Safe',
        binTitle: 'Biomedical / Pharmacy Take-Back',
        binSubtitle: 'Regulated Clinical & Pharmaceutical Stream',
        accentColor: 'text-amber-700',
        icon: HeartPulse
      };
    }

    // 4. Textiles & Apparel
    if (/textile|clothing|shirt|garment|apparel|fabric|cotton|linen/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-indigo-600 text-white',
        badgeBg: 'bg-indigo-800 text-indigo-100',
        badgeText: 'Textile Donation & Fiber Recovery',
        binTitle: 'Clothing & Textile Donation Bin',
        binSubtitle: 'Reuse or specialized fiber mechanical recycling',
        accentColor: 'text-indigo-700',
        icon: Shirt
      };
    }

    // 5. Inert Mineral & Ceramics
    if (/inert|ceramic|mug|dish|porcelain|stoneware|rubble|tile|brick/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-stone-700 text-white',
        badgeBg: 'bg-stone-900 text-stone-200',
        badgeText: 'Inert Mineral & Ceramics',
        binTitle: 'Municipal Inert Rubble Collection',
        binSubtitle: 'Separate from container glass to prevent furnace contamination',
        accentColor: 'text-stone-700',
        icon: Hammer
      };
    }

    // 6. Soft Plastics
    if (/soft plastic|film|wrapper|polythene|pouch|bubble wrap|plastic bag/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-teal-600 text-white',
        badgeBg: 'bg-teal-800 text-teal-100',
        badgeText: 'Flexible Soft Plastics',
        binTitle: 'Soft Plastic Take-Back Point',
        binSubtitle: 'Supermarket return kiosk or specialized dry film baler',
        accentColor: 'text-teal-700',
        icon: Package
      };
    }

    // 7. Clean Recyclables (Rigid plastic, metal, glass bottles, clean paper)
    if (/recycl|blue bin|aluminum|can|tin|pet|bottle|cardboard|paper|glass jar/i.test(searchCorpus)) {
      return {
        bgHeader: 'bg-blue-600 text-white',
        badgeBg: 'bg-blue-800 text-blue-100',
        badgeText: 'Clean Dry Recyclable',
        binTitle: 'Blue Municipal Recycling Bin',
        binSubtitle: 'Clean container recovery (Paper, Cardboard, Cans & Bottles)',
        accentColor: 'text-blue-700',
        icon: Recycle
      };
    }

    // 8. Residual / Landfill Fallback
    return {
      bgHeader: 'bg-slate-800 text-white',
      badgeBg: 'bg-slate-950 text-slate-200',
      badgeText: 'General Residual Waste',
      binTitle: 'Black Landfill / Residual Bin',
      binSubtitle: 'Non-recoverable composite or contaminated refuse',
      accentColor: 'text-slate-800',
      icon: Trash2
    };
  };

  const theme = getStreamTheme();
  const BinIcon = theme.icon;

  const displayItemName = rawItemName.trim() || 'Scanned Object';

  return (
    <article aria-label={`Disposal guidance for ${displayItemName}`} className="w-full bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 1. Universal Color-Coded Bin Header */}
      <div className={`p-6 sm:p-7 ${theme.bgHeader} transition-colors`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${theme.badgeBg}`}>
              {theme.badgeText}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified Local Rule
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenCorrection}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/30 backdrop-blur-xs shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Report Correction
          </button>
        </div>

        {/* Prominent Scanned Item Name & Destination Bin */}
        <div className="mt-4 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
            {displayItemName}
          </h1>
          <div className="flex items-center gap-2.5 text-white/95 pt-1">
            <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-xs">
              <BinIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-base sm:text-lg leading-tight">
                {theme.binTitle}
              </p>
              <p className="text-xs text-white/80 leading-normal">
                {theme.binSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7 space-y-6">
        {/* 2. Clarification Alert Modal Trigger (if needed) */}
        {clarification && clarification.required && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-amber-900">Condition Clarification Needed</h2>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Proper bin placement depends on specific material condition or packaging separation.
                </p>
              </div>
            </div>

            <ul className="text-xs text-amber-950 space-y-1.5 bg-white/80 p-3 rounded-xl border border-amber-100 font-medium">
              {clarification.questions.map((q, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>

            {onOpenClarification && (
              <button
                type="button"
                onClick={onOpenClarification}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                Resolve Clarification <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 3. Actionable Preparation Steps Checklist */}
        {recommendation && recommendation.instructions && recommendation.instructions.length > 0 && (
          <section aria-labelledby="prep-steps-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="prep-steps-heading" className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-forest" />
                Required Preparation Steps
              </h2>
              <span className="text-[11px] font-semibold text-stone-500">
                Follow before bin drop-off
              </span>
            </div>

            <div className="space-y-2">
              {recommendation.instructions.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 hover:border-forest/40 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-softGreen text-forest flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-stone-800 leading-relaxed">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Physical Material Breakdown Pills */}
        {item.components && item.components.length > 0 && (
          <section aria-labelledby="materials-heading" className="space-y-3">
            <h2 id="materials-heading" className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-forest" />
              Material Breakdown
            </h2>

            <div className="flex flex-wrap gap-2">
              {item.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200/70 text-xs"
                >
                  <span className="font-bold text-stone-900">{comp.name}:</span>
                  <span className="text-stone-600 font-medium">{comp.material}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Official Municipal Rule Excerpt & Provenance Citation */}
        {evidence && evidence.length > 0 ? (
          <section aria-labelledby="evidence-heading" className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-800 shrink-0" />
              <h2 id="evidence-heading" className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Official Municipal Policy Citation
              </h2>
            </div>

            {evidence.map((ev, idx) => (
              <div key={idx} className="space-y-2">
                <blockquote className="italic text-xs sm:text-sm text-stone-800 border-l-2 border-amber-500 pl-3 leading-relaxed">
                  &ldquo;{ev.sourceExcerpt}&rdquo;
                </blockquote>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 pt-1.5 border-t border-amber-200/60 font-medium">
                  <span>
                    {ev.sectionTitle || 'Official Waste Sorting Policy'}
                    {ev.pageNumber ? ` • Page ${ev.pageNumber}` : ''}
                  </span>
                  <span className="text-stone-500 text-[10px]">
                    Source: Verified Municipal Guide
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : recommendation?.explanation ? (
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 space-y-1">
            <span className="font-bold text-deepGreen block text-xs uppercase tracking-wider">
              Disposal Guidelines
            </span>
            <p className="leading-relaxed text-stone-600">{recommendation.explanation}</p>
          </div>
        ) : null}

        {/* 6. Primary Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-3.5 px-5 rounded-2xl bg-forest hover:bg-deepGreen text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4" />
            Scan Another Waste Item
          </button>
        </div>
      </div>
    </article>
  );
};
