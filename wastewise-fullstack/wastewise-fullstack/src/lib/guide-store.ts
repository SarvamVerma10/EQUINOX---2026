import { DEMO_CAMPUS_GUIDE } from "@/lib/core-engine.mjs";

export interface ManagedGuide {
  id: string;
  localityName: string;
  guideName: string;
  issuingAuthority: string;
  version: string;
  effectiveDate: string;
  isActive: boolean;
  isDemo: boolean;
  extractionWarnings: string[];
  rules: Array<{
    id: string;
    universalStreams?: string[];
    itemKeywords?: string[];
    materialKeywords?: string[];
    subtype?: string;
    category: string;
    instructions?: string[];
    page?: number | null;
    section?: string | null;
    excerpt?: string;
    physicalBinNote?: string;
  }>;
}

interface GuideStoreState {
  activeGuide: ManagedGuide;
  versions: ManagedGuide[];
}

const processState = globalThis as typeof globalThis & {
  __wastewiseGuideStore?: GuideStoreState;
};
const state = processState.__wastewiseGuideStore || {
  activeGuide: DEMO_CAMPUS_GUIDE,
  versions: [DEMO_CAMPUS_GUIDE]
};
processState.__wastewiseGuideStore = state;

export function getActiveGuide(): ManagedGuide {
  return state.activeGuide;
}

export function getGuideVersions(): ManagedGuide[] {
  return [...state.versions];
}

export function activateGuide(guide: ManagedGuide): void {
  state.activeGuide = guide;
  state.versions.unshift(guide);
}
