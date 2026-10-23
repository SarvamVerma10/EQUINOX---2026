export type AnalysisStatus =
  | 'identification_ready'
  | 'clarification_required'
  | 'recommendation_ready'
  | 'no_supported_rule'
  | 'review_required';

export interface ComponentItem {
  name: string;
  material: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ClarificationBlock {
  required: boolean;
  questions: string[];
}

export interface RecommendationBlock {
  category: string | null;
  instructions: string[];
  explanation: string;
}

export interface EvidenceItem {
  ruleId: string;
  sourceExcerpt: string;
  pageNumber: number | null;
  sectionTitle: string | null;
}

export interface AnalysisResponse {
  analysisId: string;
  status: AnalysisStatus;
  item: {
    name: string;
    alternatives: string[];
    components: ComponentItem[];
    material?: string;
    confidence?: 'high' | 'medium' | 'low';
    universalStream?: string;
  };
  clarification: ClarificationBlock;
  recommendation: RecommendationBlock | null;
  evidence: EvidenceItem[];
  uncertaintyNotes?: string[];
  requiresHumanReview?: boolean;
}

export interface DisposalHistoryRecord {
  historyId: string;
  sessionId: string;
  analysisId: string;
  itemSnapshot: {
    name?: string;
    alternatives?: string[];
    components?: ComponentItem[];
    [key: string]: unknown;
  };
  recommendationSnapshot: {
    category?: string | null;
    instructions?: string[];
    explanation?: string;
    [key: string]: unknown;
  };
  evidenceSnapshot: EvidenceItem[];
  timestamp: string;
}

export interface HistoryListResponse {
  sessionId: string;
  count: number;
  history: DisposalHistoryRecord[];
}

export interface GuideResponse {
  guideId: string;
  localityId: string;
  version: string;
  title: string;
  isActive: boolean;
  uploadedAt: string;
  processedChunks: number;
  validCategories?: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  services: {
    firestore: boolean;
    gemini: boolean;
  };
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}
