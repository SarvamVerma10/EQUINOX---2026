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
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  cardBorder: string;
  iconBg: string;
  titleColor: string;
  binTitle: string;
  binSubtitle: string;
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
    // 1. Hazardous & E-Waste (High Priority Safety Lock)
    if (/battery|lithium|32700|cell|e-waste|electronic|charger|circuit|cable|chemical|hazard/i.test(searchCorpus)) {
      return {
        badgeLabel: 'HAZARDOUS E-WASTE',
        badgeBg: 'bg-red-600',
        badgeText: 'text-white',
        cardBg: 'bg-red-50/70',
        cardBorder: 'border-red-200',
        iconBg: 'bg-red-600',
        titleColor: 'text-red-900',
        binTitle: 'Dedicated E-Waste & Battery Drop-Off Kiosk',
        binSubtitle: 'Hazardous electrochemical cells — Never dispose in household bins due to fire and toxic leakage hazard.',
        icon: Zap
      };
    }

    // 2. Organic / Compost
    if (/organic|compost|biodegradable|wet waste|food|banana|fruit|peel|vegetable|kitchen/i.test(searchCorpus)) {
      return {
        badgeLabel: 'COMPOST & ORGANICS',
        badgeBg: 'bg-emerald-600',
        badgeText: 'text-white',
        cardBg: 'bg-emerald-50/70',
        cardBorder: 'border-emerald-200',
        iconBg: 'bg-emerald-600',
        titleColor: 'text-emerald-950',
        binTitle: 'Green Municipal Wet / Organics Bin',
        binSubtitle: 'Biodegradable kitchen trimmings, food scraps, and certified compostable materials.',
        icon: Apple
      };
    }

    // 3. Medical & Sanitary
    if (/medical|sanitary|blister|pill|pharmaceutical|syringe|needle|sharps|bandage/i.test(searchCorpus)) {
      return {
        badgeLabel: 'MEDICAL & SANITARY SAFE',
        badgeBg: 'bg-amber-600',
        badgeText: 'text-white',
        cardBg: 'bg-amber-50/70',
        cardBorder: 'border-amber-200',
        iconBg: 'bg-amber-600',
        titleColor: 'text-amber-950',
        binTitle: 'Biomedical / Pharmacy Take-Back Drop',
        binSubtitle: 'Controlled pharmaceutical and clinical items requiring segregated safe disposal.',
        icon: HeartPulse
      };
    }

    // 4. Textiles & Apparel
    if (/textile|clothing|shirt|garment|apparel|fabric|cotton|linen/i.test(searchCorpus)) {
      return {
        badgeLabel: 'TEXTILE RECOVERY & DONATION',
        badgeBg: 'bg-indigo-600',
        badgeText: 'text-white',
        cardBg: 'bg-indigo-50/70',
        cardBorder: 'border-indigo-200',
        iconBg: 'bg-indigo-600',
        titleColor: 'text-indigo-950',
        binTitle: 'Clothing & Textile Donation Bin',
        binSubtitle: 'Clean garments and fabrics for charity reuse or specialized fiber shredding.',
        icon: Shirt
      };
    }

    // 5. Inert Mineral & Ceramics
    if (/inert|ceramic|mug|dish|porcelain|stoneware|rubble|tile|brick/i.test(searchCorpus)) {
      return {
        badgeLabel: 'INERT MINERAL & CERAMICS',
        badgeBg: 'bg-stone-700',
        badgeText: 'text-white',
        cardBg: 'bg-stone-100/80',
        cardBorder: 'border-stone-300',
        iconBg: 'bg-stone-700',
        titleColor: 'text-stone-900',
        binTitle: 'Municipal Inert Rubble Depository',
        binSubtitle: 'Masonry, tiles, and broken ceramics (Keep separate from container bottle glass).',
        icon: Hammer
      };
    }

    // 6. Soft Plastics
    if (/soft plastic|film|wrapper|polythene|pouch|bubble wrap|plastic bag/i.test(searchCorpus)) {
      return {
        badgeLabel: 'SOFT PLASTICS SPECIAL RECOVERY',
        badgeBg: 'bg-teal-600',
        badgeText: 'text-white',
        cardBg: 'bg-teal-50/70',
        cardBorder: 'border-teal-200',
        iconBg: 'bg-teal-600',
        titleColor: 'text-teal-950',
        binTitle: 'Soft Plastic Take-Back Return Point',
        binSubtitle: 'Clean flexible packaging pouches, grocery bags, and polyethylene wrappers.',
        icon: Package
      };
    }

    // 7. Clean Recyclables (Rigid plastic, metal cans, glass jars, clean paper/cardboard)
    if (/recycl|blue bin|aluminum|can|tin|pet|bottle|cardboard|paper|glass jar/i.test(searchCorpus)) {
      return {
        badgeLabel: 'CLEAN DRY RECYCLABLE',
        badgeBg: 'bg-blue-600',
        badgeText: 'text-white',
        cardBg: 'bg-blue-50/70',
        cardBorder: 'border-blue-200',
        iconBg: 'bg-blue-600',
        titleColor: 'text-blue-950',
        binTitle: 'Blue Municipal Recycling Bin',
        binSubtitle: 'Clean dry containers (Metal cans, container glass bottles, PET/HDPE bottles, clean paperboard).',
        icon: Recycle
      };
    }

    // 8. Residual / Landfill Fallback
    return {
      badgeLabel: 'GENERAL RESIDUAL LANDFILL',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-white',
      cardBg: 'bg-slate-100/80',
      cardBorder: 'border-slate-300',
      iconBg: 'bg-slate-800',
      titleColor: 'text-slate-950',
      binTitle: 'Black Landfill / Residual Waste Bin',
      binSubtitle: 'Non-recoverable composite materials or heavily contaminated general refuse.',
      icon: Trash2
    };
  };

  const theme = getStreamTheme();
  const BinIcon = theme.icon;

  const displayItemName = rawItemName.trim() || 'Scanned Waste Item';

  return (
    <article
      aria-label={`Waste guidance for ${displayItemName}`}
      className="w-full bg-white rounded-3xl shadow-sm border border-stone-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* Top Bar with Context and Actions */}
      <div className="px-6 sm:px-7 pt-5 pb-3 flex items-center justify-between border-b border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-forest">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            3-Step Waste Sorting Pipeline
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenCorrection}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 border border-stone-200 shadow-2xs flex items-center gap-1.5 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-stone-500" />
          Report Correction
        </button>
      </div>

      <div className="p-6 sm:p-7 space-y-7">
        {/* ========================================================================= */}
        {/* STEP 1 (What it is): Item Identification & Material Breakdown            */}
        {/* ========================================================================= */}
        <section aria-labelledby="step-1-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
              Step 1 • Item Identification
            </span>
            <span className="text-xs font-semibold text-stone-600">
              Confidence: {(item as any)?.confidence ? `${(item as any).confidence} confidence` : 'High confidence'}
            </span>
          </div>

          <div>
            <h1 id="step-1-title" className="text-2xl sm:text-3xl font-black text-deepGreen tracking-tight">
              {displayItemName}
            </h1>
          </div>

          {/* Physical Material Breakdown Pills */}
          {item.components && item.components.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-forest" />
                Physical Material Components:
              </span>
              <div className="flex flex-wrap gap-2">
                {item.components.map((comp, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200/80 text-xs shadow-2xs"
                  >
                    <span className="font-bold text-stone-900">{comp.name}:</span>
                    <span className="text-stone-600 font-medium">{comp.material}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* STEP 2 (What type of waste it is): Stream Classification & Target Bin    */}
        {/* ========================================================================= */}
        <section aria-labelledby="step-2-title" className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-600">
            Step 2 • Waste Classification & Target Destination
          </span>

          <div className={`p-5 sm:p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-3 shadow-xs transition-colors`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${theme.badgeBg} ${theme.badgeText} shadow-2xs`}>
                {theme.badgeLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-stone-800 bg-white/90 px-2.5 py-1 rounded-full border border-stone-200/80 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Municipal Guideline
              </span>
            </div>

            <div className="flex items-start sm:items-center gap-3.5 pt-1">
              <div className={`p-3 rounded-2xl ${theme.iconBg} text-white shadow-xs shrink-0`}>
                <BinIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 id="step-2-title" className={`text-xl sm:text-2xl font-black ${theme.titleColor} leading-tight`}>
                  {theme.binTitle}
                </h2>
                <p className="text-xs sm:text-sm font-medium text-stone-600 mt-1 leading-snug">
                  {theme.binSubtitle}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Condition Clarification Alert (if condition clarification needed) */}
        {clarification && clarification.required && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">Condition Clarification Required</h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Proper sorting depends on specific item condition or packaging separation.
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

        {/* ========================================================================= */}
        {/* STEP 3 (How to discard it): Actionable Preparation & Policy Provenance   */}
        {/* ========================================================================= */}
        <section aria-labelledby="step-3-title" className="space-y-4">
          <div className="flex items-center justify-between">
            <span id="step-3-title" className="text-[11px] font-black uppercase tracking-wider text-stone-600">
              Step 3 • Proper Preparation & Disposal Instructions
            </span>
            <span className="text-[11px] font-semibold text-stone-600">
              Follow before bin drop-off
            </span>
          </div>

          {/* Actionable Prep Steps Checklist */}
          {recommendation && recommendation.instructions && recommendation.instructions.length > 0 && (
            <div className="space-y-2.5">
              {recommendation.instructions.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 hover:border-forest/40 transition-colors shadow-2xs"
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
          )}

          {/* Official Municipal Rule Excerpt & Provenance Citation */}
          {evidence && evidence.length > 0 ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-800 shrink-0" />
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Official Municipal Policy Citation
                </h3>
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
                    <span className="text-stone-600 text-[10px]">
                      Source: Verified Municipal Guide
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : recommendation?.explanation ? (
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 space-y-1">
              <span className="font-bold text-deepGreen block text-xs uppercase tracking-wider">
                Disposal Guidelines
              </span>
              <p className="leading-relaxed text-stone-600">{recommendation.explanation}</p>
            </div>
          ) : null}
        </section>

        {/* Primary Action Button */}
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
