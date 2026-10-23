(function () {
  const parentOrigin = window.location.origin;

  function sendToApp(type, details) {
    window.parent.postMessage({ source: 'wastewise-reference', type, ...details }, parentOrigin);
  }

  function setGuide(guide, activated) {
    if (!guide) return;
    activeGuide = guide;
    guideVersions = [guide, ...guideVersions.filter((version) => version.id !== guide.id)];
    if (activated) {
      pendingParsedGuide = null;
      diagnosticMode = 'normal';
    }
    refreshGuideUI();
    showToast(activated ? `Activated v${guide.version}` : 'Active guide loaded.', '✓');
  }

  function showGuidePreview(guide, warnings) {
    pendingParsedGuide = guide;
    const box = document.getElementById('guide-preview-box');
    if (!box) return;
    box.replaceChildren();
    box.classList.remove('hidden');

    const heading = document.createElement('div');
    heading.className = 'text-xs font-extrabold text-emerald-800';
    heading.textContent = `✓ Extracted ${guide.rules?.length || 0} rules (v${guide.version})`;
    box.appendChild(heading);

    (guide.rules || []).forEach((rule) => {
      const line = document.createElement('div');
      line.className = 'text-[11px] p-1.5 rounded bg-ivory border border-stone-200';
      const category = document.createElement('strong');
      category.textContent = `[${rule.category}]`;
      line.append(category, document.createTextNode(` p.${rule.page || '—'} — ${(rule.itemKeywords || []).join(', ')}`));
      box.appendChild(line);
    });

    (warnings || []).forEach((warning) => {
      const line = document.createElement('p');
      line.className = 'text-xs text-amber-800';
      line.textContent = warning;
      box.appendChild(line);
    });
  }

  function categoryKey(value) {
    const key = String(value || '').toLowerCase().replace(/[\s/-]+/g, '_');
    if (key.includes('biodegrad') || key.includes('organic') || key.includes('compost')) return 'biodegradable';
    if (key.includes('dry') || key.includes('recycl')) return 'dry_recyclable';
    if (key.includes('special') || key.includes('hazard') || key.includes('e_waste') || key.includes('biomedical')) return 'special_handling';
    if (key.includes('sanitary') || key.includes('medical')) return 'sanitary_medical';
    if (key.includes('general') || key.includes('residual') || key.includes('landfill')) return 'general_waste';
    return 'unresolved';
  }

  function showAnalysis(analysis) {
    const item = analysis.item || {};
    const recommendation = analysis.recommendation;
    const category = categoryKey(recommendation?.universalStream || item.universalStream || recommendation?.category);
    const isResolved = analysis.status === 'recommendation_ready' && Boolean(recommendation);
    const questions = analysis.clarification?.questions || [];
    const components = item.components || [];
    currentIdentification = {
      name: item.name || 'Unidentified item',
      material: item.material || 'Material not confirmed',
      confidence: item.confidence || 'low',
      components
    };
    currentEvaluationResult = {
      status: isResolved ? 'recommended' : 'unresolved',
      category: isResolved ? category : 'unresolved',
      item: currentIdentification,
      instructions: recommendation?.instructions || [],
      reason: recommendation?.explanation || analysis.uncertaintyNotes?.join(' ') || 'The item could not be matched to a verified disposal rule.',
      physicalBinNote: recommendation?.category || null,
      evidence: analysis.evidence?.[0] ? {
        page: analysis.evidence[0].pageNumber,
        section: analysis.evidence[0].sectionTitle || analysis.evidence[0].ruleId,
        excerpt: analysis.evidence[0].sourceExcerpt,
        guideName: activeGuide?.guideName || 'Active local guide',
        version: activeGuide?.version || '—'
      } : null,
      clarificationQuestion: questions[0] || null,
      clarificationOptions: components.map((component, index) => ({
        id: String(index),
        label: component.name,
        material: component.material
      })),
      analysisId: analysis.analysisId
    };
    renderResultCard();
  }

  window.wastewiseReceiveAnalysis = showAnalysis;
  window.wastewiseSetGuide = setGuide;
  window.wastewiseShowGuidePreview = showGuidePreview;

  window.quickAnalyzeSample = function (sampleKey) {
    const sample = KNOWN_ITEMS_DB[sampleKey];
    if (!sample) {
      showToast('That sample is unavailable.', '⚠️');
      return;
    }
    currentCapturedImageDataUrl = null;
    const query = [sample.name, sample.material, ...(sample.components || []).map((part) => `${part.name} ${part.material}`)].join('. ');
    sendToApp('analyze-text', { query, label: sample.name });
  };

  window.handleManualSearch = function () {
    const input = document.getElementById('manual-search-input');
    const query = (input?.value || '').trim();
    if (!query) {
      showToast('Enter a waste item name.', 'ℹ️');
      return;
    }
    currentCapturedImageDataUrl = null;
    sendToApp('analyze-text', { query, label: query });
  };

  window.confirmAndAnalyzePhoto = function () {
    if (!currentCapturedImageDataUrl) {
      showToast('Capture or choose a photo first.', 'ℹ️');
      return;
    }
    sendToApp('analyze-image', { dataUrl: currentCapturedImageDataUrl, filename: 'wastewise-capture.jpg' });
  };

  window.selectClarificationPart = function (componentId) {
    const option = currentEvaluationResult?.clarificationOptions?.find((entry) => entry.id === String(componentId));
    if (!option || !currentEvaluationResult?.analysisId) return;
    sendToApp('clarify-analysis', {
      analysisId: currentEvaluationResult.analysisId,
      question: currentEvaluationResult.clarificationQuestion || 'Which part are you disposing of?',
      answer: `${option.label} (${option.material})`
    });
  };

  window.previewGuideExtraction = function () {
    const rawText = document.getElementById('guide-raw-textarea')?.value || '';
    if (!rawText.trim()) {
      showToast('Add guide text before previewing.', '⚠️');
      return;
    }
    sendToApp('guide-action', {
      action: 'preview',
      rawText,
      localityName: document.getElementById('guide-locality-input')?.value.trim() || 'Custom Locality',
      guideName: document.getElementById('guide-name-input')?.value.trim() || 'Uploaded Guide',
      issuingAuthority: document.getElementById('guide-authority-input')?.value.trim() || 'Local Authority',
      version: document.getElementById('guide-version-input')?.value.trim() || '1.0',
      effectiveDate: document.getElementById('guide-date-input')?.value || new Date().toISOString().slice(0, 10),
      isDemo: Boolean(document.getElementById('guide-is-demo-checkbox')?.checked)
    });
  };

  window.activateParsedGuide = function () {
    const rawText = document.getElementById('guide-raw-textarea')?.value || '';
    if (!rawText.trim()) {
      showToast('Add guide text before activating.', '⚠️');
      return;
    }
    sendToApp('guide-action', {
      action: 'activate',
      rawText,
      localityName: document.getElementById('guide-locality-input')?.value.trim() || 'Custom Locality',
      guideName: document.getElementById('guide-name-input')?.value.trim() || 'Uploaded Guide',
      issuingAuthority: document.getElementById('guide-authority-input')?.value.trim() || 'Local Authority',
      version: document.getElementById('guide-version-input')?.value.trim() || '1.0',
      effectiveDate: document.getElementById('guide-date-input')?.value || new Date().toISOString().slice(0, 10),
      isDemo: Boolean(document.getElementById('guide-is-demo-checkbox')?.checked)
    });
  };

  window.submitCorrectionForm = function () {
    const current = currentEvaluationResult;
    if (!current?.analysisId) return;
    const correctedItemName = (document.getElementById('corr-item-name')?.value || '').trim();
    const correctedMaterial = (document.getElementById('corr-item-material')?.value || '').trim();
    const comment = (document.getElementById('corr-comment')?.value || '').trim();
    if (!correctedItemName) {
      showToast('Enter the corrected item name.', '⚠️');
      return;
    }
    sendToApp('correct-analysis', {
      analysisId: current.analysisId,
      correction: {
        correctedItemName,
        correctedComponents: correctedMaterial ? [{ name: correctedItemName, material: correctedMaterial }] : undefined,
        comment
      }
    });
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const message = event.data;
    if (!message || message.source !== 'wastewise-app') return;

    if (message.type === 'app-ready') {
      sendToApp('reference-ready', {});
    } else if (message.type === 'analysis-start') {
      isAnalyzing = true;
      const progress = document.getElementById('analysis-progress-box');
      const bar = document.getElementById('analysis-progress-bar');
      const stage = document.getElementById('analysis-stage-text');
      const laser = document.getElementById('active-analysis-laser');
      progress?.classList.remove('hidden');
      laser?.classList.remove('hidden');
      if (bar) bar.style.width = '55%';
      if (stage) stage.textContent = 'Checking the item and local disposal guide…';
    } else if (message.type === 'analysis-result') {
      isAnalyzing = false;
      document.getElementById('analysis-progress-box')?.classList.add('hidden');
      document.getElementById('active-analysis-laser')?.classList.add('hidden');
      showAnalysis(message.analysis);
    } else if (message.type === 'analysis-error') {
      isAnalyzing = false;
      document.getElementById('analysis-progress-box')?.classList.add('hidden');
      document.getElementById('active-analysis-laser')?.classList.add('hidden');
      showToast(message.error || 'Analysis failed. Please try again.', '⚠️');
    } else if (message.type === 'guide-state') {
      setGuide(message.activeGuide, false);
    } else if (message.type === 'guide-result') {
      if (message.error) {
        showToast(message.error, '⚠️');
      } else if (message.action === 'preview') {
        showGuidePreview(message.guide, message.warnings || []);
        showToast(`Preview ready: ${message.guide?.rules?.length || 0} rules.`, '✓');
      } else {
        setGuide(message.guide, true);
      }
    } else if (message.type === 'correction-result') {
      if (message.error) {
        showToast(message.error, '⚠️');
      } else {
        currentEvaluationResult.userCorrection = message.correction;
        renderResultCard();
        closeCorrectionModal();
        showToast('Correction submitted.', '✓');
      }
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    sendToApp('reference-ready', {});
  });
})();
