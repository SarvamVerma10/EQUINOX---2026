'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient, getOrCreateSessionId } from '../services/apiClient';
import { DEMO_CAMPUS_GUIDE, evaluateDisposalWithGuide } from '../lib/core-engine.mjs';

// =========================================================================
// 1. DYNAMIC CATEGORY THEMES
// =========================================================================
interface CategoryTheme {
  key: string;
  label: string;
  shortLabel: string;
  gradient: [string, string];
  glow: string;
  border: string;
  surface: string;
  accent: string;
  bannerText: string;
  badgeBg: string;
  badgeText: string;
  emoji: string;
  gradClass: string;
  subtitle: string;
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  biodegradable: {
    key: 'biodegradable',
    label: 'Biodegradable / Wet Waste',
    shortLabel: 'Biodegradable / Wet',
    gradient: ['#1F8A4C', '#69B578'],
    glow: 'rgba(31, 138, 76, 0.36)',
    border: '#1F8A4C',
    surface: '#EAF6EE',
    accent: '#1F8A4C',
    bannerText: '#FFFFFF',
    badgeBg: 'rgba(0, 0, 0, 0.24)',
    badgeText: '#FFFFFF',
    emoji: '🌱',
    gradClass: 'grad-biodegradable',
    subtitle: 'Verified Organic / Wet Waste'
  },
  dry_recyclable: {
    key: 'dry_recyclable',
    label: 'Dry Waste / Potentially Recyclable',
    shortLabel: 'Dry / Recyclable',
    gradient: ['#1769AA', '#5BA7E8'],
    glow: 'rgba(23, 105, 170, 0.36)',
    border: '#1769AA',
    surface: '#EBF5FC',
    accent: '#1769AA',
    bannerText: '#FFFFFF',
    badgeBg: 'rgba(0, 0, 0, 0.24)',
    badgeText: '#FFFFFF',
    emoji: '♻️',
    gradClass: 'grad-dry_recyclable',
    subtitle: 'Verified Dry Recyclable'
  },
  special_handling: {
    key: 'special_handling',
    label: 'Hazardous / Special Handling Alert',
    shortLabel: 'Hazardous / Special',
    gradient: ['#B4232F', '#F26B73'],
    glow: 'rgba(180, 35, 47, 0.40)',
    border: '#B4232F',
    surface: '#FDF0F1',
    accent: '#B4232F',
    bannerText: '#FFFFFF',
    badgeBg: 'rgba(0, 0, 0, 0.28)',
    badgeText: '#FFFFFF',
    emoji: '🛡️',
    gradClass: 'grad-special_handling',
    subtitle: 'Dedicated Specialist Route Required'
  },
  sanitary_medical: {
    key: 'sanitary_medical',
    label: 'Sanitary / Medical Waste',
    shortLabel: 'Sanitary / Medical',
    gradient: ['#E3A008', '#FFD666'],
    glow: 'rgba(227, 160, 8, 0.40)',
    border: '#D99B07',
    surface: '#FEF9E7',
    accent: '#B47B00',
    bannerText: '#1F2937',
    badgeBg: 'rgba(31, 41, 55, 0.16)',
    badgeText: '#1F2937',
    emoji: '🧴',
    gradClass: 'grad-sanitary_medical',
    subtitle: 'Verified Sanitary / Hygiene Route'
  },
  general_waste: {
    key: 'general_waste',
    label: 'General Non-Recyclable Waste',
    shortLabel: 'General Waste',
    gradient: ['#667085', '#B8BEC7'],
    glow: 'rgba(102, 112, 133, 0.32)',
    border: '#667085',
    surface: '#F2F4F7',
    accent: '#475467',
    bannerText: '#FFFFFF',
    badgeBg: 'rgba(0, 0, 0, 0.24)',
    badgeText: '#FFFFFF',
    emoji: '🗑️',
    gradClass: 'grad-general_waste',
    subtitle: 'Verified Non-Recyclable Residual Waste'
  }
};

const BRAND_DEFAULT_THEME: CategoryTheme = {
  key: 'brand',
  label: 'Spectrum Brand Default',
  shortLabel: 'Brand',
  gradient: ['#4285F4', '#6D5DF6'],
  glow: 'rgba(66, 133, 244, 0.32)',
  border: '#4285F4',
  surface: 'rgba(66, 133, 244, 0.12)',
  accent: '#4285F4',
  bannerText: '#FFFFFF',
  badgeBg: 'rgba(0, 0, 0, 0.28)',
  badgeText: '#FFFFFF',
  emoji: '✨',
  gradClass: 'grad-brand',
  subtitle: 'Know it. Sort it. Save it.'
};

const UNRESOLVED_STATE_THEME: CategoryTheme = {
  key: 'unresolved',
  label: 'Unable to verify the correct waste category.',
  shortLabel: 'Unresolved / Clarify',
  gradient: ['#475467', '#98A2B3'],
  glow: 'rgba(71, 84, 103, 0.24)',
  border: '#64748B',
  surface: '#F8FAFC',
  accent: '#475467',
  bannerText: '#FFFFFF',
  badgeBg: 'rgba(0, 0, 0, 0.28)',
  badgeText: '#FFFFFF',
  emoji: '❓',
  gradClass: 'grad-unresolved',
  subtitle: 'Verification or clarification needed'
};

function normalizeCategoryKey(rawCategory: string = ''): string {
  const norm = rawCategory.toLowerCase();
  if (norm.includes('bio') || norm.includes('compost') || norm.includes('organic') || norm.includes('wet')) return 'biodegradable';
  if (norm.includes('dry') || norm.includes('recycl')) return 'dry_recyclable';
  if (norm.includes('hazard') || norm.includes('special') || norm.includes('ewaste') || norm.includes('battery')) return 'special_handling';
  if (norm.includes('sanitary') || norm.includes('medical') || norm.includes('hygiene')) return 'sanitary_medical';
  if (norm.includes('general') || norm.includes('landfill') || norm.includes('residual')) return 'general_waste';
  return 'unresolved';
}

function build3DCategorySVG(categoryKey: string): string {
  if (categoryKey === 'biodegradable') {
    return `
      <svg viewBox="0 0 100 100" class="w-full h-full anim-float-3d overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="bioGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#A7F3D0" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#1F8A4C" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="leaf3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#BBF7D0"/>
            <stop offset="55%" stop-color="#34D399"/>
            <stop offset="100%" stop-color="#065F46"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#bioGlow)" />
        <circle cx="22" cy="26" r="3.5" fill="#D1FAE5" class="anim-particle-1" />
        <circle cx="78" cy="22" r="2.8" fill="#A7F3D0" class="anim-particle-2" />
        <circle cx="80" cy="70" r="3.2" fill="#6EE7B7" class="anim-particle-3" />
        <path d="M50 82 C50 58 24 48 24 26 C46 26 56 44 50 82 Z" fill="url(#leaf3d)" stroke="#ECFDF5" stroke-width="2"/>
        <path d="M50 82 C50 54 78 44 76 20 C54 22 48 44 50 82 Z" fill="url(#leaf3d)" stroke="#ECFDF5" stroke-width="2" opacity="0.92"/>
        <path d="M50 86 L50 38" stroke="#ECFDF5" stroke-width="3.2" stroke-linecap="round"/>
      </svg>
    `;
  }
  if (categoryKey === 'dry_recyclable') {
    return `
      <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="blue3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#E0F2FE"/>
            <stop offset="50%" stop-color="#38BDF8"/>
            <stop offset="100%" stop-color="#0369A1"/>
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="50" rx="42" ry="18" fill="none" stroke="#BAE6FD" stroke-width="2" stroke-dasharray="6 4" class="anim-spin-slow" />
        <g class="anim-float-3d">
          <polygon points="50,14 82,34 82,66 50,86 18,66 18,34" fill="url(#blue3d)" fill-opacity="0.28" stroke="#E0F2FE" stroke-width="2.2"/>
          <path d="M50 24 L65 44 L55 44 L55 62 L45 62 L45 44 L35 44 Z" fill="#F0F9FF" opacity="0.92"/>
          <circle cx="50" cy="50" r="28" fill="none" stroke="#7DD3FC" stroke-width="2.5" stroke-dasharray="18 10" class="anim-spin-slow"/>
        </g>
      </svg>
    `;
  }
  if (categoryKey === 'special_handling') {
    return `
      <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="red3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FECDD3"/>
            <stop offset="50%" stop-color="#F43F5E"/>
            <stop offset="100%" stop-color="#881337"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#FDA4AF" stroke-width="3" class="anim-hazard-pulse" />
        <g class="anim-float-3d">
          <path d="M50 12 L82 24 L82 48 C82 68 68 82 50 90 C32 82 18 68 18 48 L18 24 Z" fill="url(#red3d)" stroke="#FFE4E6" stroke-width="2.5"/>
          <polygon points="50,28 70,64 30,64" fill="#FFF1F2" stroke="#9F1239" stroke-width="2" stroke-linejoin="round"/>
          <line x1="50" y1="39" x2="50" y2="52" stroke="#9F1239" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="50" cy="58" r="2.3" fill="#9F1239"/>
        </g>
      </svg>
    `;
  }
  if (categoryKey === 'sanitary_medical') {
    return `
      <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FEF08A" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#CA8A04" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="gold3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FEF9C3"/>
            <stop offset="50%" stop-color="#FACC15"/>
            <stop offset="100%" stop-color="#A16207"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#goldGlow)" />
        <g class="anim-float-3d">
          <path d="M50 14 L80 26 L80 50 C80 69 66 82 50 89 C34 82 20 69 20 50 L20 26 Z" fill="url(#gold3d)" stroke="#422006" stroke-width="2.5"/>
          <path d="M44 31 H56 V43 H68 V55 H56 V67 H44 V55 H32 V43 H44 Z" fill="#1F2937" stroke="#FEF9C3" stroke-width="2" stroke-linejoin="round"/>
        </g>
      </svg>
    `;
  }
  if (categoryKey === 'general_waste') {
    return `
      <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="slate3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F1F5F9"/>
            <stop offset="50%" stop-color="#94A3B8"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
        </defs>
        <g class="anim-float-3d">
          <ellipse cx="50" cy="84" rx="24" ry="5" fill="rgba(15,23,42,0.28)"/>
          <rect x="26" y="24" width="48" height="8" rx="4" fill="#E2E8F0" stroke="#334155" stroke-width="2"/>
          <rect x="41" y="18" width="18" height="6" rx="2.5" fill="none" stroke="#E2E8F0" stroke-width="2.2"/>
          <path d="M30 34 L70 34 L65 78 L35 78 Z" fill="url(#slate3d)" stroke="#F8FAFC" stroke-width="2.2" stroke-linejoin="round"/>
          <line x1="42" y1="43" x2="44" y2="70" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="50" y1="43" x2="50" y2="70" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="58" y1="43" x2="56" y2="70" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round"/>
        </g>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" aria-hidden="true">
      <g class="anim-float-3d">
        <polygon points="50,14 84,32 84,68 50,86 16,68 16,32" fill="rgba(255,255,255,0.12)" stroke="#E2E8F0" stroke-width="2.5" stroke-dasharray="5 3"/>
        <text x="50" y="62" text-anchor="middle" fill="#FFFFFF" font-size="38" font-weight="900" font-family="sans-serif">?</text>
      </g>
    </svg>
  `;
}

// =========================================================================
// 2. LOCALIZATION DICTIONARY
// =========================================================================
const I18N = {
  en: {
    tagline: 'Know it. Sort it. Save it.',
    navHome: 'Home',
    navHistory: 'History',
    navLearn: 'Learn',
    navSettings: 'Guide',
    manageGuideBtn: 'Your local guide',
    activeLocalityLabel: 'Selected locality',
    changeOrUploadGuide: 'Switch guide',
    heroHeadline: 'Know it',
    heroHeadline2: 'Sort it',
    heroSubhead: "Point the camera at whatever’s in your hand. We’ll say which bin it belongs in — for this ward, not a generic chart.",
    heroNote: 'the bit judges remember: local rules, not a lecture',
    scanWasteCta: 'Open camera',
    uploadPhotoCta: 'Use a photo',
    cameraReadyTitle: 'Camera’s ready',
    cameraReadyDesc: 'Open it, or try one of the sample shots.',
    openLiveCameraBtn: 'Open camera',
    nativeCaptureFallbackBtn: 'Phone camera',
    instantPhotoPresetsTitle: 'Try a sample',
    flipCameraBtn: 'Flip camera',
    capturePhotoBtn: 'Take photo',
    closeCameraBtn: 'Close',
    confirmAnalyzeBtn: 'That’s the one',
    retakeBtn: 'Retake',
    checkGuideBtn: 'Check the guide',
    sampleItemsLabel: 'Quick tests:',
    nextStepsHeading: 'What to do next',
    confirmItemBtn: 'Yep, that’s it',
    saveResultBtn: 'Save this',
    correctIdentificationBtn: 'That’s not right',
    scanAnotherBtn: 'Scan another',
    reportIncorrectBtn: 'Flag this result',
    recentScansHeading: 'Recent scans',
    viewAllHistoryBtn: 'Full history →',
    categoryLegendHeading: 'The bins',
    categoryLegendSub: '',
    learnMoreLink: 'Read the guide →',
    catBioShort: 'Wet / compost',
    catDryShort: 'Dry / recycle',
    catHazShort: 'Hazard — pause',
    catSanitaryShort: 'Sanitary / medical',
    catGenShort: 'General waste',
    catGreyShort: 'Not sure yet',
    historyTitle: 'What you scanned',
    clearHistoryBtn: 'Clear history',
    learnHeading: 'What goes where'
  },
  hi: {
    tagline: 'जानें। छाँटें। बचाएँ।',
    navHome: 'होम',
    navHistory: 'इतिहास',
    navLearn: 'जानकारी',
    navSettings: 'गाइड',
    manageGuideBtn: 'गाइड बदलें',
    activeLocalityLabel: 'चयनित गाइड',
    changeOrUploadGuide: 'गाइड बदलें',
    heroHeadline: 'जानो',
    heroHeadline2: 'छाँटो',
    heroSubhead: 'हाथ में जो है, कैमरा उस पर लगाओ। हम बताएँगे कि इस वार्ड में वो किस डिब्बे में जाता है।',
    heroNote: 'जज यही याद रखते हैं: स्थानीय नियम, लेक्चर नहीं',
    scanWasteCta: 'कैमरा खोलो',
    uploadPhotoCta: 'फोटो लगाओ',
    cameraReadyTitle: 'कैमरा तैयार है',
    cameraReadyDesc: 'कैमरा खोलो, या कोई सैंपल आज़माओ।',
    openLiveCameraBtn: 'कैमरा खोलो',
    nativeCaptureFallbackBtn: 'फ़ोन कैमरा',
    instantPhotoPresetsTitle: 'सैंपल फोटो',
    flipCameraBtn: 'कैमरा बदलें',
    capturePhotoBtn: 'फोटो लें',
    closeCameraBtn: 'बंद करें',
    confirmAnalyzeBtn: 'पुष्टि करें और जांचें',
    retakeBtn: 'दोबारा लें',
    checkGuideBtn: 'गाइड जांचें',
    sampleItemsLabel: 'त्वरित परीक्षण:',
    nextStepsHeading: 'निपटान निर्देश',
    confirmItemBtn: 'पुष्टि करें',
    saveResultBtn: 'सहेजें',
    correctIdentificationBtn: 'सुधारें',
    scanAnotherBtn: 'दूसरा स्कैन',
    reportIncorrectBtn: 'रिपोर्ट करें',
    recentScansHeading: 'हाल के स्कैन',
    viewAllHistoryBtn: 'पूरा इतिहास →',
    categoryLegendHeading: 'डिब्बे',
    categoryLegendSub: '',
    learnMoreLink: 'पूरी जानकारी →',
    catBioShort: 'गीला / बायोडिग्रेडेबल',
    catDryShort: 'सूखा / रीसायकल',
    catHazShort: 'खतरनाक / विशेष',
    catSanitaryShort: 'सैनिटरी / मेडिकल',
    catGenShort: 'सामान्य कचरा',
    catGreyShort: 'अनिर्णीत',
    historyTitle: 'स्कैन इतिहास',
    clearHistoryBtn: 'इतिहास मिटाएं',
    learnHeading: 'क्या कहाँ जाता है'
  }
};

const STORY_ICONS = ['📸', '🧩', '📖', '✨'];

export default function WasteWiseMainPage() {
  // Navigation & Localization
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'learn' | 'settings'>('home');
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  // Camera & Image State
  const [cameraState, setCameraState] = useState<'idle' | 'live' | 'permission' | 'preview'>('idle');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<{ title: string; desc: string }>({ title: '', desc: '' });
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('Photo Preview');
  const [qualityMetrics, setQualityMetrics] = useState<{ avgLum: number; isTooDark: boolean }>({ avgLum: 140, isTooDark: false });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [textSearchQuery, setTextSearchQuery] = useState<string>('');

  // Result & Active Identification
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState<CategoryTheme>(BRAND_DEFAULT_THEME);
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [isReportIssue, setIsReportIssue] = useState<boolean>(false);

  // History & Guide
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [guideVersions, setGuideVersions] = useState<any[]>([DEMO_CAMPUS_GUIDE]);
  const [activeGuide, setActiveGuide] = useState<any>(DEMO_CAMPUS_GUIDE);
  const [diagnosticMode, setDiagnosticMode] = useState<string>('normal');
  const [storyBeat, setStoryBeat] = useState<number>(0);
  const [storyProgress, setStoryProgress] = useState<number>(0.25);
  const [toast, setToast] = useState<{ message: string; icon: string; visible: boolean }>({ message: '', icon: '✓', visible: false });

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const storyTrackRef = useRef<HTMLDivElement | null>(null);

  const t = I18N[lang];

  // =========================================================================
  // INITIALIZATION & SESSION
  // =========================================================================
  useEffect(() => {
    getOrCreateSessionId();
    // Load local history if available
    try {
      const saved = localStorage.getItem('wastewise_history_v2');
      if (saved) {
        setScanHistory(JSON.parse(saved));
      } else {
        // Seed initial history item
        const seed = evaluateDisposalWithGuide({
          identification: { name: 'Fresh Banana Peel', material: 'Organic fruit peel', confidence: 'high', components: [] },
          activeGuide: DEMO_CAMPUS_GUIDE
        });
        setScanHistory([
          {
            id: 'scan-seed-1',
            timestamp: new Date().toISOString(),
            ...seed,
            thumbnail: null,
            userCorrection: null
          }
        ]);
      }
    } catch {}
  }, []);

  // Update theme CSS variables when theme changes
  useEffect(() => {
    const root = document.getElementById('app-theme-root') || document.documentElement;
    root.style.setProperty('--theme-grad-start', currentTheme.gradient[0]);
    root.style.setProperty('--theme-grad-end', currentTheme.gradient[1]);
    root.style.setProperty('--theme-glow', currentTheme.glow);
    root.style.setProperty('--theme-border', currentTheme.border);
    root.style.setProperty('--theme-surface', currentTheme.surface);
    root.style.setProperty('--theme-accent', currentTheme.accent);
    root.style.setProperty('--theme-banner-text', currentTheme.bannerText);
    root.style.setProperty('--theme-badge-bg', currentTheme.badgeBg);
    root.style.setProperty('--theme-badge-text', currentTheme.badgeText);
  }, [currentTheme]);

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // =========================================================================
  // TOAST HELPER
  // =========================================================================
  const showToast = useCallback((message: string, icon = '✓') => {
    setToast({ message, icon, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }, []);

  // =========================================================================
  // SCROLL-STORY SCRIBBLER
  // =========================================================================
  useEffect(() => {
    const onScroll = () => {
      if (!storyTrackRef.current) return;
      if (window.innerWidth < 768) return;
      const rect = storyTrackRef.current.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      const rawProgress = -rect.top / scrollable;
      if (rawProgress >= -0.1 && rawProgress <= 1.1) {
        const clamped = Math.max(0, Math.min(0.999, rawProgress));
        const beat = Math.min(3, Math.floor(clamped * 4));
        setStoryBeat(beat);
        setStoryProgress(clamped);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // =========================================================================
  // 3D RESULT CARD TILT HANDLER
  // =========================================================================
  const handleResultCardTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!resultCardRef.current) return;
    const rect = resultCardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    resultCardRef.current.style.setProperty('--rx', `${(-y * 4.5).toFixed(2)}deg`);
    resultCardRef.current.style.setProperty('--ry', `${(x * 5.5).toFixed(2)}deg`);
  };

  const resetResultCardTilt = () => {
    if (!resultCardRef.current) return;
    resultCardRef.current.style.setProperty('--rx', '0deg');
    resultCardRef.current.style.setProperty('--ry', '0deg');
  };

  // =========================================================================
  // CAMERA STREAM & CAPTURE LOGIC
  // =========================================================================
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraFacing(facing);
      setCameraState('live');

      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities && track.getCapabilities()) as any;
      setHasTorch(Boolean(capabilities && 'torch' in capabilities));
    } catch (err: any) {
      setCameraError({
        title: 'Camera Access Needed',
        desc: err?.name === 'NotAllowedError' ? 'Please grant camera permission or use the photo upload below.' : 'Camera unavailable on this device.'
      });
      setCameraState('permission');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchActive(false);
    setCameraState('idle');
  };

  const switchFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchActive;
      await (track as any).applyConstraints({ advanced: [{ torch: nextTorch }] });
      setTorchActive(nextTorch);
    } catch {
      showToast('Flashlight not supported on this lens.', 'ℹ️');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      showToast('Camera stream is not ready.', '⚠️');
      return;
    }

    const canvas = captureCanvasRef.current || document.createElement('canvas');
    let width = video.videoWidth;
    let height = video.videoHeight;
    const maxDim = 800;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

    // Compute luminance
    let avgLum = 140;
    try {
      const data = ctx.getImageData(0, 0, width, height).data;
      let sumLum = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 16) {
        sumLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      avgLum = Math.round(sumLum / (count / 4));
    } catch {}

    stopCamera();
    setCapturedImageDataUrl(dataUrl);
    setPreviewTitle('Camera Snapshot');
    setQualityMetrics({ avgLum, isTooDark: avgLum < 45 });
    setCameraState('preview');
  };

  const handleFileUpload = (file: File) => {
    stopCamera();
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = captureCanvasRef.current || document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

        let avgLum = 140;
        try {
          const data = ctx.getImageData(0, 0, width, height).data;
          let sumLum = 0;
          const count = data.length / 4;
          for (let i = 0; i < data.length; i += 16) {
            sumLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          avgLum = Math.round(sumLum / (count / 4));
        } catch {}

        setCapturedImageDataUrl(compressedDataUrl);
        setPreviewTitle(file.name);
        setQualityMetrics({ avgLum, isTooDark: avgLum < 45 });
        setCameraState('preview');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // =========================================================================
  // EXECUTE ANALYSIS & DISPOSAL EVALUATION (CONNECTED TO BACKEND)
  // =========================================================================
  const runAnalysis = async (inputData: string, isText = false) => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(30);

      let response: any;
      if (isText) {
        response = await apiClient.analyzeText(inputData, { localityId: activeGuide.localityName });
      } else {
        response = await apiClient.analyzeImage(inputData, { localityId: activeGuide.localityName });
      }

      setAnalysisProgress(85);

      // Map response to result card structure
      const item = response.item || { name: 'Scanned Item', components: [] };
      const rec = response.recommendation || {};
      const categoryKey = normalizeCategoryKey(rec.category || (item as any).universalStream || '');
      const theme = CATEGORY_THEMES[categoryKey] || UNRESOLVED_STATE_THEME;

      const resultObj = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        item: {
          name: item.name || 'Identified Item',
          material: (item as any).material || (item.components && item.components[0]?.material) || 'Mixed Packaging',
          confidence: (item as any).confidence || 'high',
          components: item.components || [],
          universalStream: (item as any).universalStream
        },
        category: categoryKey,
        status: response.status === 'clarification_required' ? 'clarification_needed' : 'recommended',
        clarificationQuestion: response.clarification?.required ? response.clarification.questions[0] : null,
        instructions: rec.instructions || ['Ensure item is completely empty of contents before disposal.'],
        physicalBinNote: rec.category || theme.label,
        evidence: response.evidence && response.evidence[0] ? {
          guideName: activeGuide.guideName || 'Metro Central Sorting Guide',
          version: activeGuide.version || '2026.1',
          page: response.evidence[0].pageNumber || 1,
          section: response.evidence[0].sectionTitle || 'Municipal Sorting Rule',
          excerpt: response.evidence[0].sourceExcerpt || 'Official Municipal Waste Sorting Guideline.'
        } : {
          guideName: activeGuide.guideName,
          version: activeGuide.version,
          page: 1,
          section: 'Municipal Sorting Rule',
          excerpt: rec.explanation || 'Verified municipal waste stream classification.'
        },
        thumbnail: isText ? null : inputData,
        userCorrection: null
      };

      setCurrentResult(resultObj);
      setCurrentTheme(theme);
      setAnalysisProgress(100);
      setIsAnalyzing(false);

      // Auto-save to scan history
      setScanHistory((prev) => [resultObj, ...prev]);
      try {
        localStorage.setItem('wastewise_history_v2', JSON.stringify([resultObj, ...scanHistory]));
      } catch {}

      // Scroll to result
      setTimeout(() => {
        if (resultCardRef.current) {
          resultCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (err: any) {
      setIsAnalyzing(false);
      showToast(err?.message || 'Identification failed. Please try again.', '⚠️');
    }
  };

  // Quick Sample Presets
  const handleQuickPreset = (presetKey: string) => {
    if (presetKey === 'banana_peel') {
      runAnalysis('Fresh Banana Peel', true);
    } else if (presetKey === 'aluminum_can') {
      runAnalysis('Aluminum Beverage Can', true);
    } else if (presetKey === 'aa_battery') {
      runAnalysis('AA Alkaline Battery Cells', true);
    } else if (presetKey === 'sanitary_pad') {
      runAnalysis('Sanitary Hygiene Pad', true);
    } else if (presetKey === 'residual_wrapper') {
      runAnalysis('Multi-Layer Metallized Foil Wrapper', true);
    } else if (presetKey === 'instant_noodle_packet') {
      runAnalysis('Instant Noodle Multi-Layer Packet', true);
    } else if (presetKey === 'used_syringe') {
      runAnalysis('Used Medical Syringe', true);
    } else if (presetKey === 'ceramic_mug') {
      runAnalysis('Broken Ceramic Coffee Mug', true);
    }
  };

  // Component clarification selection
  const handleSelectClarification = (componentName: string) => {
    if (!currentResult) return;
    runAnalysis(`${componentName} of ${currentResult.item.name}`, true);
  };

  // Submit User Correction
  const handleSaveCorrection = (newName: string, newMat: string, note: string) => {
    if (!currentResult) return;
    const updated = {
      ...currentResult,
      userCorrection: {
        correctedItemName: newName,
        correctedMaterial: newMat,
        comment: note
      }
    };
    setCurrentResult(updated);
    setScanHistory((prev) => prev.map((s) => (s.id === currentResult.id ? updated : s)));
    setShowCorrectionModal(false);
    showToast('Correction saved.', '✓');
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-500 selection:text-white">
      {/* ATMOSPHERE CANVAS */}
      <canvas id="pointer-atmosphere-canvas" ref={pointerCanvasRef} aria-hidden="true" />

      {/* TOP STATUS BAR */}
      <div id="top-guide-banner" className="bg-slate-950/90 border-b border-white/10 px-4 py-1 text-[11px] text-slate-400 relative z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
              {activeGuide.isDemo ? 'Demo Guide' : 'Verified Municipal'}
            </span>
            <span className="font-mono text-[11px] text-slate-300 truncate">
              {activeGuide.localityName} (v{activeGuide.version})
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.gradient[0] }} />
              <span>Theme: {currentTheme.shortLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="text-blue-400 hover:text-white font-medium transition-colors focus-ring rounded px-1"
            >
              {t.manageGuideBtn}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING GLASS NAVIGATION */}
      <header className="sticky top-3 z-30 px-4 mt-2">
        <div className="max-w-6xl mx-auto glass-pill rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left group focus-ring rounded-full"
          >
            <div className="w-9 h-9 rounded-full theme-dynamic-banner flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 21l2.31-.31C18.16 19.67 21 16.17 21 12c0-4.97-4.03-9-9-9zm-1 14v-4H8l4-6v4h3l-4 6z" />
              </svg>
            </div>
            <div>
              <span className="font-display text-[1.35rem] font-semibold tracking-tight text-white block leading-none">WasteWise</span>
              <p className="sr-only">{t.tagline}</p>
            </div>
          </button>

          {/* Desktop Nav Pills */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
            {(['home', 'history', 'learn', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab ? 'bg-blue-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab === 'home' && t.navHome}
                {tab === 'history' && (
                  <>
                    {t.navHistory}
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-blue-300 font-mono">
                      {scanHistory.length}
                    </span>
                  </>
                )}
                {tab === 'learn' && t.navLearn}
                {tab === 'settings' && t.navSettings}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition-colors focus-ring"
            >
              🌐 <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-16 relative z-10">
        {/* =================================================================== */}
        {/* VIEW 1: HOME (HERO + SCANNER + 3D RESULT + SCROLL STORY)           */}
        {/* =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-16">
            {/* HERO STAGE */}
            <div className="hero-stage p-6 sm:p-10 lg:p-12">
              <div className="hero-webgl-wrap" aria-hidden="true">
                <div className="hero-static-fallback" />
                <canvas id="hero-webgl-canvas" ref={webglCanvasRef} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
                {/* Left Column: Headlines & Actions */}
                <div className="lg:col-span-6 space-y-6">
                  <h1 className="hero-poster-stack font-poster text-[3.15rem] sm:text-6xl lg:text-[4.65rem] text-white">
                    <span className="line-mask"><span className="line-mask__inner" style={{ ['--line-idx' as any]: 0 }}>{t.heroHeadline}</span></span>
                    <span className="line-mask"><span className="line-mask__inner" style={{ ['--line-idx' as any]: 1 }}>{t.heroHeadline2}</span></span>
                  </h1>

                  <p className="text-[0.98rem] sm:text-[1.05rem] text-slate-200/90 max-w-md leading-[1.55] italic">
                    {t.heroSubhead}
                  </p>
                  <p className="hand-note">{t.heroNote}</p>

                  {/* Primary CTA Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera('environment')}
                      className="px-7 py-3.5 rounded-full theme-dynamic-btn font-bold text-sm sm:text-base flex items-center gap-2.5 focus-ring"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <circle cx="12" cy="13" r="3" />
                      </svg>
                      <span>{t.scanWasteCta}</span>
                    </button>

                    <label htmlFor="gallery-file-input" className="cursor-pointer px-5 py-3.5 rounded-full glass-pill text-white font-semibold text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{t.uploadPhotoCta}</span>
                    </label>
                    <input
                      id="gallery-file-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    <input
                      id="mobile-capture-input"
                      ref={mobileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                  </div>

                  {/* Manual Search Input */}
                  <div className="pt-2 space-y-3 max-w-lg">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (textSearchQuery.trim()) runAnalysis(textSearchQuery.trim(), true);
                      }}
                      className="flex gap-2"
                    >
                      <div className="flex-1 relative">
                        <input
                          id="manual-search-input"
                          type="text"
                          value={textSearchQuery}
                          onChange={(e) => setTextSearchQuery(e.target.value)}
                          placeholder="Type item (banana peel, aluminum can, battery)..."
                          className="w-full pl-9 pr-3 py-2.5 rounded-full bg-white/5 border border-white/15 text-xs sm:text-sm text-white placeholder-slate-400 focus:bg-white/10 focus-ring"
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <button type="submit" className="px-4 py-2.5 rounded-full glass-pill text-white font-semibold text-xs sm:text-sm shrink-0 focus-ring">
                        {t.checkGuideBtn}
                      </button>
                    </form>

                    {/* Quick Test Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => handleQuickPreset('banana_peel')} className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all">
                        🍌 Banana Peel
                      </button>
                      <button type="button" onClick={() => handleQuickPreset('aluminum_can')} className="text-xs font-medium px-3 py-1 rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all">
                        🥫 Aluminum Soda Can
                      </button>
                      <button type="button" onClick={() => handleQuickPreset('aa_battery')} className="text-xs font-medium px-3 py-1 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-all">
                        🔋 AA Battery
                      </button>
                      <button type="button" onClick={() => handleQuickPreset('sanitary_pad')} className="text-xs font-medium px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all">
                        🩹 Sanitary Pad
                      </button>
                      <button type="button" onClick={() => handleQuickPreset('residual_wrapper')} className="text-xs font-medium px-3 py-1 rounded-full bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-500/30 transition-all">
                        🗑️ Laminated Wrapper
                      </button>
                      <button type="button" onClick={() => handleQuickPreset('instant_noodle_packet')} className="text-xs font-medium px-3 py-1 rounded-full bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all">
                        🍜 Noodle Packet
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Camera Scanner Viewport */}
                <div className="lg:col-span-6">
                  <div id="scanner-hero-card" className="rounded-3xl border theme-dynamic-card overflow-hidden p-3 sm:p-4">
                    <div className="bg-slate-950/90 rounded-2xl overflow-hidden text-white relative border border-white/10">
                      {/* Corners */}
                      <div className="pointer-events-none absolute top-3 left-3 scanner-corner border-t-2 border-l-2 rounded-tl-lg z-20" />
                      <div className="pointer-events-none absolute top-3 right-3 scanner-corner border-t-2 border-r-2 rounded-tr-lg z-20" />
                      <div className="pointer-events-none absolute bottom-3 left-3 scanner-corner border-b-2 border-l-2 rounded-bl-lg z-20" />
                      <div className="pointer-events-none absolute bottom-3 right-3 scanner-corner border-b-2 border-r-2 rounded-br-lg z-20" />

                      {/* STATE A: IDLE */}
                      {cameraState === 'idle' && (
                        <div className="p-6 text-center space-y-5 relative z-10">
                          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-400/30 mx-auto flex items-center justify-center text-blue-300 anim-float-3d">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <circle cx="12" cy="13" r="3" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-display text-base font-bold text-white">{t.cameraReadyTitle}</h3>
                            <p className="text-xs text-slate-400 mt-1">{t.cameraReadyDesc}</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => startCamera('environment')}
                              className="px-5 py-2.5 rounded-full theme-dynamic-btn font-bold text-xs sm:text-sm flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>{t.openLiveCameraBtn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => mobileInputRef.current?.click()}
                              className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-medium text-xs flex items-center gap-1.5"
                            >
                              <span>📱</span>
                              <span>{t.nativeCaptureFallbackBtn}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STATE B: LIVE WEBRTC */}
                      {cameraState === 'live' && (
                        <div className="relative z-10">
                          <div className="relative bg-black aspect-[4/3] max-h-[360px] w-full flex items-center justify-center overflow-hidden">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <div className="pointer-events-none absolute inset-6 border border-blue-400/60 rounded-2xl">
                              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#4285F4] scan-laser" />
                            </div>
                            <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs">
                              <span className="px-2.5 py-1 rounded-full bg-black/70 text-blue-300 font-mono text-[11px]">
                                {cameraFacing === 'environment' ? 'Rear Camera' : 'Front Camera'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-slate-900/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={switchFacing} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold">
                                🔄 {t.flipCameraBtn}
                              </button>
                              {hasTorch && (
                                <button type="button" onClick={toggleTorch} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold">
                                  🔦 {torchActive ? 'Flashlight: ON' : 'Flashlight: OFF'}
                                </button>
                              )}
                            </div>

                            <button type="button" onClick={capturePhoto} className="px-5 py-2 rounded-full theme-dynamic-btn font-bold text-xs sm:text-sm">
                              📸 {t.capturePhotoBtn}
                            </button>

                            <button type="button" onClick={stopCamera} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/30 text-slate-300 text-xs">
                              ✕ {t.closeCameraBtn}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STATE C: PERMISSION FALLBACK */}
                      {cameraState === 'permission' && (
                        <div className="p-5 bg-slate-900 space-y-3 relative z-10">
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-amber-100 space-y-1">
                            <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                              <span>⚠️</span>
                              <span>{cameraError.title}</span>
                            </div>
                            <p className="text-xs text-amber-100/80">{cameraError.desc}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => mobileInputRef.current?.click()}
                              className="px-3.5 py-2 rounded-full theme-dynamic-btn font-bold text-xs"
                            >
                              📱 Use Native File / Photo
                            </button>
                            <button
                              type="button"
                              onClick={() => setCameraState('idle')}
                              className="px-3 py-2 rounded-full text-slate-400 hover:text-white text-xs"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STATE D: CAPTURED PREVIEW */}
                      {cameraState === 'preview' && capturedImageDataUrl && (
                        <div className="p-4 bg-slate-900/95 space-y-3 relative z-10">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 truncate">{previewTitle}</h3>
                            <div className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 shrink-0">
                              ~{Math.max(8, Math.round((capturedImageDataUrl.length * 0.75) / 1024))} KB
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
                            <div className="sm:col-span-7 relative rounded-xl overflow-hidden bg-black border border-white/10 max-h-56 flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={capturedImageDataUrl} alt="Captured waste preview" className="max-h-56 w-auto object-contain mx-auto" />
                              {isAnalyzing && (
                                <div className="pointer-events-none absolute inset-0 bg-blue-950/25">
                                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent scan-laser" />
                                </div>
                              )}
                            </div>

                            <div className="sm:col-span-5 space-y-2.5">
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-between">
                                <span className={qualityMetrics.isTooDark ? 'font-bold text-amber-400' : 'font-bold text-emerald-400'}>
                                  {qualityMetrics.isTooDark ? '⚠️ Low Light' : '✓ Clarity: Good'}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">{qualityMetrics.avgLum}/255</span>
                              </div>

                              {isAnalyzing && (
                                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                                    <span>Auditing Pixels...</span>
                                    <span>{analysisProgress}%</span>
                                  </div>
                                  <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${analysisProgress}%` }} />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isAnalyzing}
                                  onClick={() => runAnalysis(capturedImageDataUrl, false)}
                                  className="flex-1 py-2.5 px-3 rounded-full theme-dynamic-btn font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  <span>✨</span>
                                  <span>{t.confirmAnalyzeBtn}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isAnalyzing}
                                  onClick={() => setCameraState('idle')}
                                  className="py-2.5 px-3 rounded-full bg-white/10 hover:bg-white/15 text-slate-200 font-semibold text-xs"
                                >
                                  ↺ {t.retakeBtn}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <canvas ref={captureCanvasRef} className="hidden" />
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 3D RESULT CARD                                                    */}
            {/* ========================================================================= */}
            {currentResult && (
              <div id="result-section" className="scroll-mt-24 space-y-4 scene-3d">
                <div
                  ref={resultCardRef}
                  onMouseMove={handleResultCardTilt}
                  onMouseLeave={resetResultCardTilt}
                  className="rounded-3xl border-2 theme-dynamic-card card-3d-tilt overflow-hidden"
                >
                  {/* Category Banner */}
                  <div className={`p-6 text-white relative overflow-hidden ${currentTheme.gradClass}`}>
                    <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/15 blur-2xl" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/20 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-xl depth-layer-front relative"
                          dangerouslySetInnerHTML={{ __html: build3DCategorySVG(currentResult.category) }}
                        />
                        <div className="depth-layer-mid">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/30 text-white">
                              {activeGuide.isDemo ? 'Demo Guide' : 'Verified Municipal'}
                            </span>
                          </div>
                          <h2 className="font-display text-xl sm:text-2xl font-bold mt-1 tracking-tight">
                            {currentTheme.label}
                          </h2>
                          <p className="text-xs opacity-90">{currentTheme.subtitle}</p>
                        </div>
                      </div>

                      <div className="bg-black/25 backdrop-blur-md rounded-full px-3.5 py-1.5 text-left sm:text-right shrink-0 border border-white/15">
                        <span className="text-xs font-mono font-semibold">
                          {currentResult.item.confidence?.toUpperCase() || 'HIGH'} CONFIDENCE
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-5 bg-slate-900/90 text-slate-100">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                      {currentResult.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentResult.thumbnail} alt="Item thumbnail" className="w-16 h-16 rounded-2xl object-cover border border-white/15 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {currentResult.userCorrection && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✓ Corrected
                          </span>
                        )}
                        <h3 className="font-display text-lg font-bold text-white truncate">
                          {currentResult.userCorrection ? currentResult.userCorrection.correctedItemName : currentResult.item.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          <span>{currentResult.userCorrection?.correctedMaterial || currentResult.item.material}</span>
                        </p>
                      </div>
                    </div>

                    {/* Clarification Box */}
                    {currentResult.clarificationQuestion && currentResult.item.components?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-2.5">
                        <h4 className="text-sm font-bold text-amber-300">{currentResult.clarificationQuestion}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {currentResult.item.components.map((c: any) => (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => handleSelectClarification(c.name)}
                              className="p-3 rounded-xl bg-white/10 hover:bg-blue-500 text-white border border-amber-400/50 font-bold text-xs text-left transition-all flex flex-col gap-0.5"
                            >
                              <span>{c.name}</span>
                              <span className="text-[10px] opacity-75 font-normal">{c.material}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instructions & Evidence Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          {t.nextStepsHeading}
                        </h4>
                        <ul className="space-y-1.5 text-sm text-slate-200 list-disc pl-5">
                          {currentResult.instructions.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                        {currentResult.physicalBinNote && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white font-semibold text-xs">
                            🗑️ {currentResult.physicalBinNote}
                          </div>
                        )}
                      </div>

                      {/* Verified Evidence Citation */}
                      {currentResult.evidence && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-blue-400">📖 Local Guide Source</span>
                              <span className="font-mono text-slate-400">
                                p.{currentResult.evidence.page} • {currentResult.evidence.section}
                              </span>
                            </div>
                            <blockquote className="text-xs italic text-slate-300 bg-black/30 p-3 rounded-xl border-l-2 border-blue-400">
                              &ldquo;{currentResult.evidence.excerpt}&rdquo;
                            </blockquote>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                            <span className="truncate">Guide: {currentResult.evidence.guideName}</span>
                            <span className="shrink-0">v{currentResult.evidence.version}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => showToast(`Confirmed: ${currentResult.item.name}`, '✓')}
                          className="px-4 py-2 rounded-full theme-dynamic-btn font-bold text-xs focus-ring"
                        >
                          ✓ {t.confirmItemBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCorrectionModal(true);
                            setIsReportIssue(false);
                          }}
                          className="px-4 py-2 rounded-full glass-pill text-slate-200 font-semibold text-xs focus-ring"
                        >
                          ✏️ {t.correctIdentificationBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentResult(null);
                            setCurrentTheme(BRAND_DEFAULT_THEME);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-2 rounded-full glass-pill text-slate-200 font-semibold text-xs focus-ring"
                        >
                          📸 {t.scanAnotherBtn}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCorrectionModal(true);
                          setIsReportIssue(true);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                      >
                        🚩 {t.reportIncorrectBtn}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* 4-BEAT SCROLL STORY SECTION (PINNED APPLE-STYLE)                 */}
            {/* ========================================================================= */}
            <div id="scroll-story-section" ref={storyTrackRef} className="scroll-story-track" aria-label="How WasteWise Works">
              <div className="scroll-story-sticky" style={{ ['--story-progress' as any]: storyProgress }}>
                <div className="story-atmosphere" aria-hidden="true">
                  <div className="story-atmosphere-base" />
                  <div className="story-atmosphere-aurora" />
                  <div className="story-atmosphere-bloom story-atmosphere-bloom-a" />
                  <div className="story-atmosphere-bloom story-atmosphere-bloom-b" />
                  <div className="story-atmosphere-bloom story-atmosphere-bloom-c" />
                  <div className="story-atmosphere-mist" />
                  <span className="story-atmosphere-leaf" />
                  <span className="story-atmosphere-leaf" />
                  <span className="story-atmosphere-leaf" />
                </div>
                <div className="flex items-center justify-between text-xs section-kicker text-slate-200 relative z-20">
                  <span>How it works</span>
                  <div className="flex items-center gap-2">
                    <span>0{storyBeat + 1} / 04</span>
                    <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-blue-400 transition-all duration-150" style={{ width: `${Math.round(storyProgress * 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Central Orb */}
                <div className="story-stage">
                  <div className="story-orb-rig" aria-hidden="true" style={{ transform: `scale(${(0.94 + Math.sin(storyProgress * Math.PI) * 0.12).toFixed(3)})` }}>
                    <span className="story-orb-glow" />
                    <span className="story-orb-core" />
                    <span className="story-orb-ring" />
                    <span className="story-orb-icon select-none">{STORY_ICONS[storyBeat]}</span>
                  </div>

                  <div className={`story-beat ${storyBeat === 0 ? 'is-active' : ''}`}>
                    <span className="section-kicker text-[11px] text-blue-300 mb-3">01 · Hold it up</span>
                    <h2 className="font-poster text-4xl sm:text-5xl text-white">Point. Snap.</h2>
                    <p className="text-sm text-slate-300 mt-3 max-w-sm leading-relaxed">Just the thing in your hand. No perfect lighting required.</p>
                  </div>

                  <div className={`story-beat ${storyBeat === 1 ? 'is-active' : ''}`}>
                    <span className="section-kicker text-[11px] text-violet-300 mb-3">02 · Peel it apart</span>
                    <h2 className="font-poster text-4xl sm:text-5xl text-white">Two bins, maybe.</h2>
                    <p className="text-sm text-slate-300 mt-3 max-w-sm leading-relaxed">The wrapper and the sachet inside almost never share a bucket.</p>
                  </div>

                  <div className={`story-beat ${storyBeat === 2 ? 'is-active' : ''}`}>
                    <span className="section-kicker text-[11px] text-amber-300 mb-3">03 · Ask the ward</span>
                    <h2 className="font-poster text-4xl sm:text-5xl text-white">Your street’s rules.</h2>
                    <p className="text-sm text-slate-300 mt-3 max-w-sm leading-relaxed">We check the guide you loaded — GreenValley, Sohna, or wherever you are.</p>
                  </div>

                  <div className={`story-beat ${storyBeat === 3 ? 'is-active' : ''}`}>
                    <span className="section-kicker text-[11px] text-emerald-300 mb-3">04 · Drop it right</span>
                    <h2 className="font-poster text-4xl sm:text-5xl text-white">That’s the bin.</h2>
                    <p className="text-sm text-slate-300 mt-3 max-w-sm leading-relaxed">Color, name, and the line from the rulebook. Then you’re done.</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 relative z-20">
                  {[0, 1, 2, 3].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setStoryBeat(b);
                        setStoryProgress((b + 1) * 0.25);
                      }}
                      className={`story-beat-dot ${storyBeat === b ? 'is-active' : ''}`}
                      aria-label={`Beat ${b + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* CATEGORY SHOWCASE                                                 */}
            {/* ========================================================================= */}
            <div className="reveal-item is-visible space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <span className="section-kicker text-[11px] text-blue-300 block mb-2">The bins</span>
                  <h2 className="font-poster text-3xl sm:text-4xl text-white">{t.categoryLegendHeading}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('learn')}
                  className="text-xs font-semibold text-blue-400 hover:text-white transition-colors"
                >
                  {t.learnMoreLink}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div onClick={() => handleQuickPreset('banana_peel')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl grad-biodegradable flex items-center justify-center text-lg shadow-md">🌱</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catBioShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Peels &amp; scraps</p>
                  </div>
                </div>

                <div onClick={() => handleQuickPreset('aluminum_can')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl grad-dry_recyclable flex items-center justify-center text-lg shadow-md">♻️</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catDryShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Paper, cans, PET</p>
                  </div>
                </div>

                <div onClick={() => handleQuickPreset('aa_battery')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl grad-special_handling flex items-center justify-center text-lg shadow-md">🛡️</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catHazShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Batteries &amp; sharps</p>
                  </div>
                </div>

                <div onClick={() => handleQuickPreset('sanitary_pad')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl grad-sanitary_medical flex items-center justify-center text-lg shadow-md">🧴</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catSanitaryShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Wrapped hygiene</p>
                  </div>
                </div>

                <div onClick={() => handleQuickPreset('residual_wrapper')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl grad-general_waste flex items-center justify-center text-lg shadow-md">🗑️</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catGenShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Laminates</p>
                  </div>
                </div>

                <div onClick={() => handleQuickPreset('ceramic_mug')} className="cursor-pointer group category-card rounded-2xl p-4 glass-pill border-dashed flex flex-col justify-between gap-4 hover:-translate-y-1 transition-all">
                  <div className="category-card-icon w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center text-lg shadow-md">❓</div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{t.catGreyShort}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Needs check</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RECENT SCANS LIST */}
            <div className="reveal-item is-visible rounded-3xl p-5 sm:p-6 glass-pill space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-white">{t.recentScansHeading}</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-blue-400 hover:text-white transition-colors"
                >
                  {t.viewAllHistoryBtn}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {scanHistory.slice(0, 3).map((scan) => (
                  <button
                    key={scan.id}
                    type="button"
                    onClick={() => {
                      setCurrentResult(scan);
                      setCurrentTheme(CATEGORY_THEMES[scan.category] || UNRESOLVED_STATE_THEME);
                      setTimeout(() => {
                        resultCardRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    className="text-left p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                        {scan.category?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-white truncate">
                      {scan.userCorrection ? scan.userCorrection.correctedItemName : scan.item.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: HISTORY                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <section className="space-y-4">
            <div className="rounded-3xl p-6 glass-pill space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-display text-xl font-bold text-white">{t.historyTitle}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setScanHistory([]);
                    try {
                      localStorage.removeItem('wastewise_history_v2');
                    } catch {}
                    showToast('History cleared.', '🗑️');
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold"
                >
                  🗑️ {t.clearHistoryBtn}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search history..."
                  className="flex-1 px-4 py-2 rounded-full bg-white/5 border border-white/15 text-sm text-white placeholder-slate-400 focus-ring"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'biodegradable', 'dry_recyclable', 'special_handling', 'sanitary_medical', 'general_waste'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setHistoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        historyFilter === cat ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {scanHistory
                  .filter((item) => {
                    const matchesCat = historyFilter === 'all' || item.category === historyFilter;
                    const textBlob = `${item.item.name} ${item.item.material} ${item.userCorrection?.correctedItemName || ''}`.toLowerCase();
                    return matchesCat && (!historySearch || textBlob.includes(historySearch.toLowerCase()));
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                            {entry.category.replace('_', ' ').toUpperCase()}
                          </span>
                          {entry.userCorrection && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              Corrected: {entry.userCorrection.correctedItemName}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-extrabold text-white truncate">{entry.item.name}</h3>
                        <p className="text-xs text-slate-400 truncate">{entry.item.material}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentResult(entry);
                            setCurrentTheme(CATEGORY_THEMES[entry.category] || UNRESOLVED_STATE_THEME);
                            setActiveTab('home');
                            setTimeout(() => {
                              resultCardRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }, 50);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScanHistory((prev) => prev.filter((x) => x.id !== entry.id));
                            showToast('Removed from history.', '🗑️');
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/30 text-red-300 text-xs font-bold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: LEARN                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'learn' && (
          <section className="space-y-4">
            <div className="rounded-3xl p-6 glass-pill space-y-5">
              <h1 className="font-poster text-3xl sm:text-4xl text-white">{t.learnHeading}</h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                  <div className="grad-biodegradable p-3.5 text-white flex items-center gap-2.5">
                    <span className="text-xl">🌱</span>
                    <h3 className="font-display font-bold text-sm">Biodegradable / Wet Waste</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Fruit peels, vegetable trimmings, cooked food, tea leaves, coffee grounds, and compostable organic food scraps. Drain liquids and never bag in regular plastics.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                  <div className="grad-dry_recyclable p-3.5 text-white flex items-center gap-2.5">
                    <span className="text-xl">♻️</span>
                    <h3 className="font-display font-bold text-sm">Dry Waste / Potentially Recyclable</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Clean dry paperboard, corrugated cardboard, rinsed aluminum soda cans, container glass, and PET #1 / HDPE #2 bottles.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                  <div className="grad-special_handling p-3.5 text-white flex items-center gap-2.5">
                    <span className="text-xl">🛡️</span>
                    <h3 className="font-display font-bold text-sm">Hazardous / Special Handling Alert</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Alkaline AA/AAA cells, lithium-ion battery packs, e-waste, chargers, power banks, CFL/LED bulbs, paint, chemicals, and medical sharps. Never place in household bins.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-500/30 overflow-hidden bg-white/5">
                  <div className="grad-sanitary_medical p-3.5 text-slate-900 flex items-center gap-2.5">
                    <span className="text-xl">🧴</span>
                    <h3 className="font-display font-bold text-sm text-slate-950">Sanitary / Medical Waste</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Used sanitary napkins, baby diapers, adult diapers, cotton swabs, and domestic dressings. Wrap securely before disposal.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                  <div className="grad-general_waste p-3.5 text-white flex items-center gap-2.5">
                    <span className="text-xl">🗑️</span>
                    <h3 className="font-display font-bold text-sm">General Non-Recyclable Waste</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Multi-layer metallized chip packaging, poly-coated takeaway coffee cups, thermocol, worn kitchen sponges, and composite household residual trash.
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-500 overflow-hidden bg-white/5">
                  <div className="bg-slate-800 p-3.5 text-white flex items-center gap-2.5">
                    <span className="text-xl">❓</span>
                    <h3 className="font-display font-bold text-sm">Unresolved / Clarify</h3>
                  </div>
                  <p className="p-3.5 text-xs text-slate-300 leading-relaxed">
                    Triggered when an item consists of multiple separable layers (like noodle packets) or is absent from local municipal guidelines.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: LOCAL GUIDE & SETTINGS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <section className="space-y-5">
            <div className="rounded-3xl p-6 glass-pill space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                <h1 className="font-display text-lg font-bold text-white">Local Guide Manager</h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-blue-500/20 text-blue-300">
                  Active: v{activeGuide.version}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={activeGuide.id}
                  onChange={(e) => {
                    const found = guideVersions.find((g) => g.id === e.target.value);
                    if (found) {
                      setActiveGuide(found);
                      showToast(`Switched to ${found.localityName}`, '📖');
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs font-semibold text-white focus-ring"
                >
                  {guideVersions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.localityName} — v{g.version} ({g.rules?.length || 0} rules)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Active Guide Rules ({activeGuide.rules?.length || 0})
                </h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {activeGuide.rules?.map((r: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-between gap-2">
                      <span className="font-bold text-white">
                        [{r.category}] {r.section} (p.{r.page})
                      </span>
                      <span className="text-slate-400 truncate max-w-xs">
                        {r.itemKeywords?.slice(0, 3).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulator Modes */}
            <div className="rounded-3xl p-6 glass-pill space-y-3">
              <h2 className="font-display text-base font-bold text-white">Edge-Case Simulator</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'normal', label: '✓ Normal' },
                  { key: 'missing_guide', label: '⚠️ Missing Guide' },
                  { key: 'retrieval_error', label: '🔌 Retrieval Error' },
                  { key: 'contradictory_rules', label: '⚖️ Rule Conflict' },
                  { key: 'ai_provider_error', label: '🤖 AI Error' },
                  { key: 'offline', label: '📡 Offline' }
                ].map((diag) => (
                  <button
                    key={diag.key}
                    type="button"
                    onClick={() => {
                      setDiagnosticMode(diag.key);
                      showToast(`Diagnostic mode: ${diag.key}`, 'ℹ️');
                    }}
                    className={`p-2.5 rounded-xl text-left border ${
                      diagnosticMode === diag.key
                        ? 'border-2 border-blue-500 bg-blue-500/15 text-white font-bold'
                        : 'border-white/10 hover:border-blue-400 bg-white/5 text-slate-200'
                    }`}
                  >
                    <div className="text-xs">{diag.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav aria-label="Mobile Bottom Navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-white/10 z-40 px-2 py-1.5 flex items-center justify-around">
        {(['home', 'history', 'learn', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-xs font-semibold ${
              activeTab === tab ? 'text-blue-400 font-bold' : 'text-slate-400'
            }`}
          >
            {tab === 'home' && <span>🏠 {t.navHome}</span>}
            {tab === 'history' && <span>📜 {t.navHistory}</span>}
            {tab === 'learn' && <span>📖 {t.navLearn}</span>}
            {tab === 'settings' && <span>⚙️ {t.navSettings}</span>}
          </button>
        ))}
      </nav>

      {/* CORRECTION MODAL */}
      {showCorrectionModal && currentResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-white/15 shadow-2xl space-y-3 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                {isReportIssue ? 'Report Issue with Result' : 'Correct Identification'}
              </h3>
              <button type="button" onClick={() => setShowCorrectionModal(false)} className="text-slate-400 hover:text-white font-bold text-lg px-2">
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const newName = (form.elements.namedItem('corrItem') as HTMLInputElement).value;
                const newMat = (form.elements.namedItem('corrMat') as HTMLInputElement).value;
                const note = (form.elements.namedItem('corrNote') as HTMLTextAreaElement).value;
                handleSaveCorrection(newName, newMat, note);
              }}
              className="space-y-2.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Item Name *</label>
                <input
                  name="corrItem"
                  type="text"
                  defaultValue={currentResult.item.name}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Material</label>
                <input
                  name="corrMat"
                  type="text"
                  defaultValue={currentResult.item.material}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Notes</label>
                <textarea
                  name="corrNote"
                  rows={2}
                  placeholder="Additional context..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-full theme-dynamic-btn font-bold text-xs">
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST CONTAINER */}
      {toast.visible && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50">
          <div className="bg-slate-900/92 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-2xl border border-emerald-400/20 flex items-center gap-2 text-xs font-semibold max-w-sm">
            <span>{toast.icon}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
