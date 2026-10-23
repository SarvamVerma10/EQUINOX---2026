import { dbService } from './firestore.js';
import { geminiService } from './gemini.js';
import type {
  RuleChunkRecord,
  GuideRecord,
  RecommendationBlock,
  EvidenceItem,
  AnalysisStatus,
  ComponentItem
} from '../types/domain.js';

export interface EvaluationResult {
  status: AnalysisStatus;
  recommendation: RecommendationBlock | null;
  evidence: EvidenceItem[];
  requiresHumanReview: boolean;
  uncertaintyNotes: string[];
}

export const ruleEngine = {
  /**
   * Performs deterministic retrieval of candidate rule chunks based on item name,
   * alternative names, and component materials.
   */
  async retrieveCandidates(
    guideId: string,
    itemName: string,
    alternatives: string[],
    components: ComponentItem[],
    userClarifications?: Array<{ question: string; answer: string }>
  ): Promise<RuleChunkRecord[]> {
    const searchTerms: string[] = [
      itemName,
      ...alternatives,
      ...components.map(c => c.material),
      ...components.map(c => c.name)
    ];

    if (userClarifications && userClarifications.length > 0) {
      for (const uc of userClarifications) {
        searchTerms.push(uc.answer);
      }
    }

    // Split compound terms (e.g., "Poly-coated Paperboard" -> "Poly-coated", "Paperboard")
    const expandedTerms: string[] = [];
    for (const term of searchTerms) {
      expandedTerms.push(term);
      const parts = term.split(/[\s,/-]+/).filter(p => p.length > 2);
      expandedTerms.push(...parts);
    }

    const uniqueTerms = Array.from(new Set(expandedTerms));
    return await dbService.searchRuleChunks(guideId, uniqueTerms);
  },

  /**
   * Executes Stage 4: Grounded Decision & Validation
   */
  async evaluateItem(params: {
    item: {
      name: string;
      alternatives: string[];
      components: ComponentItem[];
    };
    activeGuide: GuideRecord;
    userClarifications?: Array<{ question: string; answer: string }>;
  }): Promise<EvaluationResult> {
    const { item, activeGuide, userClarifications } = params;

    // 1. Retrieve candidates
    const candidateRules = await this.retrieveCandidates(
      activeGuide.guideId,
      item.name,
      item.alternatives,
      item.components,
      userClarifications
    );

    // If no candidate rules at all in the active guide for these keywords
    if (candidateRules.length === 0) {
      return {
        status: 'no_supported_rule',
        recommendation: null,
        evidence: [],
        requiresHumanReview: false,
        uncertaintyNotes: ['No candidate rules matched the item or materials in the active local guide.']
      };
    }

    // 2. Derive valid categories from the guide or its candidate chunks
    let validCategories = activeGuide.validCategories;
    if (!validCategories || validCategories.length === 0) {
      const allChunks = await dbService.getRuleChunksByGuide(activeGuide.guideId);
      validCategories = Array.from(new Set(allChunks.map(c => c.categoryName)));
    }

    // 3. Grounded evaluation with Gemini
    const evaluation = await geminiService.evaluateGroundedRule({
      item,
      candidateRules,
      validCategories,
      userClarifications
    });

    // 4. Strict anti-hallucination validation
    if (!evaluation.category) {
      return {
        status: 'no_supported_rule',
        recommendation: null,
        evidence: [],
        requiresHumanReview: evaluation.requiresHumanReview,
        uncertaintyNotes: ['The active local guide contains no disposal rule for this specific item condition.']
      };
    }

    // Category MUST match one of the active guide's valid categories
    const isCategoryValid = validCategories.some(
      vc => vc.toLowerCase() === evaluation.category!.toLowerCase()
    );

    if (!isCategoryValid) {
      return {
        status: 'no_supported_rule',
        recommendation: null,
        evidence: [],
        requiresHumanReview: true,
        uncertaintyNotes: [`Category '${evaluation.category}' is not recognized in the active guide.`]
      };
    }

    // Find the matched rule chunk
    const matchedChunk = candidateRules.find(c => c.chunkId === evaluation.matchingRuleId);

    const evidenceList: EvidenceItem[] = [];
    if (matchedChunk) {
      evidenceList.push({
        ruleId: matchedChunk.chunkId,
        sourceExcerpt: evaluation.exactQuote || matchedChunk.sourceExcerpt,
        pageNumber: evaluation.pageNumber ?? matchedChunk.pageNumber,
        sectionTitle: evaluation.sectionTitle ?? matchedChunk.sectionTitle
      });
    } else if (candidateRules.length > 0) {
      // If matchingRuleId wasn't exact, take the top candidate that shares the category
      const fallbackChunk = candidateRules.find(
        c => c.categoryName.toLowerCase() === evaluation.category!.toLowerCase()
      );

      if (fallbackChunk) {
        evidenceList.push({
          ruleId: fallbackChunk.chunkId,
          sourceExcerpt: fallbackChunk.sourceExcerpt,
          pageNumber: fallbackChunk.pageNumber,
          sectionTitle: fallbackChunk.sectionTitle
        });
      } else if (evaluation.exactQuote) {
        evidenceList.push({
          ruleId: evaluation.matchingRuleId || 'verified-rule',
          sourceExcerpt: evaluation.exactQuote,
          pageNumber: evaluation.pageNumber,
          sectionTitle: evaluation.sectionTitle
        });
      }
    }

    const finalStatus: AnalysisStatus = evaluation.requiresHumanReview
      ? 'review_required'
      : 'recommendation_ready';

    return {
      status: finalStatus,
      recommendation: {
        category: evaluation.category,
        instructions: evaluation.instructions,
        explanation: evaluation.explanation
      },
      evidence: evidenceList,
      requiresHumanReview: evaluation.requiresHumanReview,
      uncertaintyNotes: []
    };
  }
};
