import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import type { ExtractedPage } from './docParser.js';
import type {
  GeminiItemExtraction,
  GeminiParsedGuide,
  GeminiGroundedEvaluation
} from '../types/schemas.js';
import {
  geminiItemExtractionSchema,
  geminiParsedGuideSchema,
  geminiGroundedEvaluationSchema
} from '../types/schemas.js';
import type { RuleChunkRecord } from '../types/domain.js';

let genAIClient: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY || 'dummy-key'
    });
  }
  return genAIClient;
}

export interface MultimodalInput {
  imageBuffer?: Buffer;
  imageMimeType?: string;
  textDescription?: string;
  barcode?: string;
  ocrText?: string;
  productNameHint?: string;
}

// Clean markdown code blocks from JSON string if model wrapped in ```json ... ```
export function extractJsonFromText(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

export const geminiService = {
  /**
   * Stage 1 & 2: Multimodal Item Extraction & Packaging Decomposition + Ambiguity Check
   */
  async extractItem(input: MultimodalInput): Promise<GeminiItemExtraction> {
    const ai = getGenAIClient();

    const systemPrompt = `You are an expert waste classification analyst.
Your task is to analyze the user's item (from text description, photo, OCR text, barcode, or hint) and decompose its packaging.
Rules:
1. Identify the primary item name and common alternative names.
2. Decompose the packaging into distinct physical components (e.g., Body, Lid, Pump, Label, Foil Seal, Liner).
3. For each component, identify the exact material (e.g., "Poly-coated Paperboard", "Polypropylene Plastic (#5)", "Clear PET (#1)", "Aluminum", "Corrugated Cardboard") and assign confidence ("high", "medium", "low").
4. Compute an overall confidence score from 0.0 to 1.0.
5. AMBIGUITY CHECK: If overall confidence < 0.7, or if the material cannot be determined with certainty from the visual/textual evidence (e.g., shiny pouch that could be foil or metallized plastic, dark glass vs plastic, multi-material blends without resin codes), you MUST set "isAmbiguous": true, and formulate 1-3 concise, specific clarifying questions for the user (e.g. "Does the item have a resin identification code with a number inside a triangle?", "Is the lining paper or plastic?").
6. If the item is clearly identifiable, set "isAmbiguous": false and "clarifyingQuestions": [].

Respond ONLY with a valid JSON object matching this schema:
{
  "name": "string",
  "alternatives": ["string"],
  "components": [
    { "name": "string", "material": "string", "confidence": "high" | "medium" | "low" }
  ],
  "overallConfidence": number,
  "isAmbiguous": boolean,
  "clarifyingQuestions": ["string"],
  "uncertaintyNotes": ["string"]
}`;

    const contents: any[] = [];
    const textParts: string[] = [systemPrompt, '\n--- Input Data ---'];

    if (input.textDescription) {
      textParts.push(`User Description: ${input.textDescription}`);
    }
    if (input.productNameHint) {
      textParts.push(`Product Name Hint: ${input.productNameHint}`);
    }
    if (input.barcode) {
      textParts.push(`Barcode / UPC: ${input.barcode}`);
    }
    if (input.ocrText) {
      textParts.push(`Extracted OCR Text on Package: ${input.ocrText}`);
    }

    if (input.imageBuffer && input.imageMimeType) {
      contents.push({
        inlineData: {
          data: input.imageBuffer.toString('base64'),
          mimeType: input.imageMimeType
        }
      });
    }

    contents.push({ text: textParts.join('\n') });

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '{}';
    const parsedJson = JSON.parse(extractJsonFromText(rawText));
    return geminiItemExtractionSchema.parse(parsedJson);
  },

  /**
   * Stage 2 Ingestion: Parses guide document pages into structured rule chunks
   */
  async parseGuideDocument(pages: ExtractedPage[], localityId: string, version: string): Promise<GeminiParsedGuide> {
    const ai = getGenAIClient();

    const formattedPages = pages
      .map(p => `=== Page ${p.pageNumber} ===\n${p.text}`)
      .join('\n\n');

    const prompt = `You are a municipal waste management policy parser.
Parse the following municipal waste sorting guide into structured rule chunks.
Locality: ${localityId}, Guide Version: ${version}.

For every distinct waste rule:
- Determine the disposal category (e.g. "Recycling / Blue Bin", "Organics / Green Bin", "Landfill / Residual Waste", "Hazardous Waste", "Electronics", "Drop-off Only").
- Extract applicable materials (e.g. ["Poly-coated paperboard", "Rigid plastics #1-#7"]).
- Extract common item aliases (e.g. ["Coffee Cup", "Takeaway Cup", "Paper Cup"]).
- Extract allowed or required conditions (e.g. ["Empty", "Rinsed", "Lid removed"]).
- Extract preparation steps (e.g. ["Rinse thoroughly", "Separate lid"]).
- Extract the EXACT sourceExcerpt directly from the text as proof.
- Note the pageNumber where this rule appears.
- Note the sectionTitle if present.

Return a JSON object matching this schema:
{
  "title": "Document Title",
  "categories": ["List of all unique disposal categories defined in this guide"],
  "rules": [
    {
      "categoryName": "string",
      "applicableMaterials": ["string"],
      "itemAliases": ["string"],
      "allowedConditions": ["string"],
      "preparationSteps": ["string"],
      "sourceExcerpt": "string (exact quote from text)",
      "pageNumber": number or null,
      "sectionTitle": "string or null"
    }
  ]
}

Document Content:
${formattedPages}`;

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '{}';
    const parsedJson = JSON.parse(extractJsonFromText(rawText));
    return geminiParsedGuideSchema.parse(parsedJson);
  },

  /**
   * Stage 4: Grounded Decision & Validation with Strict Anti-Hallucination Guardrail
   */
  async evaluateGroundedRule(params: {
    item: {
      name: string;
      alternatives: string[];
      components: Array<{ name: string; material: string; confidence: string }>;
    };
    candidateRules: RuleChunkRecord[];
    validCategories: string[];
    userClarifications?: Array<{ question: string; answer: string }>;
  }): Promise<GeminiGroundedEvaluation> {
    const ai = getGenAIClient();

    const { item, candidateRules, validCategories, userClarifications } = params;

    const candidateSummary = candidateRules.map((rule, idx) => `
[Candidate Rule ${idx + 1}] (RuleId: ${rule.chunkId})
Category: ${rule.categoryName}
Page Number: ${rule.pageNumber}
Section: ${rule.sectionTitle || 'N/A'}
Item Aliases: ${rule.itemAliases.join(', ')}
Applicable Materials: ${rule.applicableMaterials.join(', ')}
Allowed Conditions: ${rule.allowedConditions.join(', ')}
Preparation Steps: ${rule.preparationSteps.join(', ')}
Source Excerpt: "${rule.sourceExcerpt}"
`).join('\n');

    const prompt = `CRITICAL ANTI-HALLUCINATION GUARDRAIL:
You are a deterministic waste classification validator.
Evaluate the given item and its decomposed components against the provided Candidate Rules ONLY.

STRICT INVARIANTS:
1. You MUST NOT use external recycling knowledge, personal beliefs, or policies from other jurisdictions.
2. If NO candidate rule explicitly applies to this item and its materials, you MUST output:
   - "category": null
   - "instructions": []
   - "explanation": "No supported rule in active local guide."
   - "matchingRuleId": null
   - "exactQuote": null
   - "pageNumber": null
   - "sectionTitle": null
   - "requiresHumanReview": false
3. If a candidate rule DOES apply:
   - "category" MUST be one of these valid guide categories: ${JSON.stringify(validCategories)}. If it is not in this list, return category: null.
   - "matchingRuleId" MUST be the exact RuleId from the matching candidate rule.
   - "exactQuote" MUST be an exact verbatim substring from the matching rule's Source Excerpt.
   - "pageNumber" MUST match the candidate rule's Page Number.
   - "sectionTitle" MUST match the candidate rule's Section.
   - "instructions" MUST include the specific preparation steps mentioned in the rule chunks.
   - "explanation" MUST cite why the rule applies.
4. If candidate rules conflict with each other or provide contradictory guidance for this item, set "requiresHumanReview": true.

--- ITEM TO EVALUATE ---
Item Name: ${item.name}
Alternative Names: ${item.alternatives.join(', ')}
Components:
${item.components.map(c => `- ${c.name} (${c.material}, confidence: ${c.confidence})`).join('\n')}

${userClarifications && userClarifications.length > 0 ? `User Clarification Answers:\n${userClarifications.map(uc => `Q: ${uc.question}\nA: ${uc.answer}`).join('\n')}` : ''}

--- RETRIEVED CANDIDATE RULES FROM ACTIVE GUIDE ---
${candidateSummary || 'No matching candidate rules were retrieved from the guide.'}

Respond ONLY with valid JSON matching:
{
  "category": string or null,
  "instructions": ["string"],
  "explanation": "string",
  "matchingRuleId": string or null,
  "exactQuote": string or null,
  "pageNumber": number or null,
  "sectionTitle": string or null,
  "requiresHumanReview": boolean
}`;

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ text: prompt }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text || '{}';
    const parsedJson = JSON.parse(extractJsonFromText(rawText));
    return geminiGroundedEvaluationSchema.parse(parsedJson);
  }
};
