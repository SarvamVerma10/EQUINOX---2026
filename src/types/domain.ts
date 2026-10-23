export interface GuideRecord {
  guideId: string;
  localityId: string;
  version: string;
  isActive: boolean;
  title: string;
  uploadedAt: string; // ISO string representation for persistence/JSON
  processedChunks: number;
  validCategories?: string[];
}

export interface RuleChunkRecord {
  chunkId: string;
  guideId: string;
  localityId: string;
  categoryName: string;
  applicableMaterials: string[];
  itemAliases: string[];
  allowedConditions: string[];
  preparationSteps: string[];
  sourceExcerpt: string;
  pageNumber: number | null;
  sectionTitle: string | null;
}

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

export interface ItemExtraction {
  name: string;
  alternatives: string[];
  components: ComponentItem[];
  clarityScore?: number; // 0.0 - 1.0
  ambiguities?: string[];
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

export interface AnalysisRecord {
  analysisId: string;
  sessionId: string;
  localityId: string;
  status: AnalysisStatus;
  item: {
    name: string;
    alternatives: string[];
    components: ComponentItem[];
  };
  clarification: ClarificationBlock;
  recommendation: RecommendationBlock | null;
  evidence: EvidenceItem[];
  uncertaintyNotes?: string[];
  requiresHumanReview?: boolean;
  createdAt: string;
}

export interface DisposalHistoryRecord {
  historyId: string;
  sessionId: string;
  analysisId: string;
  itemSnapshot: Record<string, unknown>;
  recommendationSnapshot: Record<string, unknown>;
  evidenceSnapshot: EvidenceItem[];
  timestamp: string;
}

export interface CorrectionRecord {
  correctionId: string;
  analysisId: string;
  sessionId: string;
  originalData: Record<string, unknown>;
  correctedData: Record<string, unknown>;
  reEvaluatedRecommendation: Record<string, unknown>;
  timestamp: string;
}

export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
