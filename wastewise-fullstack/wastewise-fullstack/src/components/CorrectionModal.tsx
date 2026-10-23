'use client';

import React, { useState } from 'react';
import { Edit3, X, Plus, Trash2, Send, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AnalysisResponse, ComponentItem } from '../types/api';

interface CorrectionModalProps {
  analysisId: string;
  initialItemName: string;
  initialComponents: ComponentItem[];
  onSuccess: (updated: AnalysisResponse) => void;
  onClose: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  analysisId,
  initialItemName,
  initialComponents,
  onSuccess,
  onClose
}) => {
  const [correctedName, setCorrectedName] = useState<string>(initialItemName);
  const [components, setComponents] = useState<Array<{ name: string; material: string }>>(
    initialComponents.map((c) => ({ name: c.name, material: c.material }))
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddComponent = () => {
    setComponents((prev) => [...prev, { name: '', material: '' }]);
  };

  const handleRemoveComponent = (idx: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleComponentChange = (idx: number, field: 'name' | 'material', val: string) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validComponents = components.filter((c) => c.name.trim() && c.material.trim());

    if (!correctedName.trim() && validComponents.length === 0) {
      setError('Please provide either a corrected item name or at least one complete component (name & material).');
      return;
    }

    try {
      setSubmitting(true);
      const updated = await apiClient.submitCorrection(analysisId, {
        correctedItemName: correctedName.trim() || undefined,
        correctedComponents: validComponents.length > 0 ? validComponents : undefined
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit correction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-forest to-deepGreen text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Suggest Item Correction</h3>
              <p className="text-xs text-stone-300">Re-evaluate against verified local guide</p>
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
            If the AI misidentified this item or its materials, update the details below. The backend will re-evaluate
            candidate rules deterministically against the active municipal guide.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Corrected Item Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-800">
              Item Name / Product Name
            </label>
            <input
              type="text"
              value={correctedName}
              onChange={(e) => setCorrectedName(e.target.value)}
              placeholder="e.g., Takeaway Coffee Cup, Lithium Battery, Greasy Pizza Box"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest"
            />
          </div>

          {/* Components / Materials */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-800">
                Packaging Components & Materials
              </label>
              <button
                type="button"
                onClick={handleAddComponent}
                className="text-xs font-semibold text-forest hover:text-deepGreen flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Part
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {components.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Component (e.g. Lid, Cup Body)"
                    value={c.name}
                    onChange={(e) => handleComponentChange(idx, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                  <input
                    type="text"
                    placeholder="Material (e.g. Polypropylene, Aluminum)"
                    value={c.material}
                    onChange={(e) => handleComponentChange(idx, 'material', e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(idx)}
                    className="p-2 text-stone-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Remove component"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {components.length === 0 && (
                <p className="text-xs text-stone-400 italic p-3 bg-stone-50 rounded-xl text-center">
                  No components listed. Click &ldquo;Add Part&rdquo; to specify packaging layers.
                </p>
              )}
            </div>
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
              className="px-5 py-2.5 rounded-xl bg-forest hover:bg-deepGreen text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Re-evaluating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Apply & Re-evaluate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
