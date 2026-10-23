import { z } from 'zod';

export const createGuideSchema = z.object({
  localityId: z.string().min(1, 'localityId is required'),
  version: z.string().min(1, 'version is required'),
  title: z.string().optional()
});

export const analyzeRequestSchema = z.object({
  localityId: z.string().default('default'),
  textDescription: z.string().optional(),
  barcode: z.string().optional(),
  ocrText: z.string().optional(),
  productNameHint: z.string().optional()
});

export const clarifyRequestSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1)
    })
  ).min(1, 'At least one answer must be provided')
});

export const correctionRequestSchema = z.object({
  correctedItemName: z.string().optional(),
  correctedComponents: z.array(
    z.object({
      name: z.string().min(1),
      material: z.string().min(1)
    })
  ).optional()
}).refine(data => data.correctedItemName !== undefined || (data.correctedComponents !== undefined && data.correctedComponents.length > 0), {
  message: 'Either correctedItemName or correctedComponents must be provided'
});

export const historyPostSchema = z.object({
  analysisId: z.string().uuid('Valid analysisId UUID is required')
});

// Gemini LLM Structured Output Schemas

export const geminiParsedChunkSchema = z.object({
  categoryName: z.string(),
  applicableMaterials: z.array(z.string()),
  itemAliases: z.array(z.string()),
  allowedConditions: z.array(z.string()),
  preparationSteps: z.array(z.string()),
  sourceExcerpt: z.string(),
  pageNumber: z.number().nullable(),
  sectionTitle: z.string().nullable()
});

export const geminiParsedGuideSchema = z.object({
  title: z.string(),
  categories: z.array(z.string()),
  rules: z.array(geminiParsedChunkSchema)
});

export const geminiItemExtractionSchema = z.object({
  name: z.string(),
  alternatives: z.array(z.string()),
  components: z.array(
    z.object({
      name: z.string(),
      material: z.string(),
      confidence: z.enum(['high', 'medium', 'low'])
    })
  ),
  overallConfidence: z.number().min(0).max(1),
  isAmbiguous: z.boolean(),
  clarifyingQuestions: z.array(z.string()),
  uncertaintyNotes: z.array(z.string())
});

export const geminiGroundedEvaluationSchema = z.object({
  category: z.string().nullable(),
  instructions: z.array(z.string()),
  explanation: z.string(),
  matchingRuleId: z.string().nullable(),
  exactQuote: z.string().nullable(),
  pageNumber: z.number().nullable(),
  sectionTitle: z.string().nullable(),
  requiresHumanReview: z.boolean()
});

export type GeminiParsedChunk = z.infer<typeof geminiParsedChunkSchema>;
export type GeminiParsedGuide = z.infer<typeof geminiParsedGuideSchema>;
export type GeminiItemExtraction = z.infer<typeof geminiItemExtractionSchema>;
export type GeminiGroundedEvaluation = z.infer<typeof geminiGroundedEvaluationSchema>;
