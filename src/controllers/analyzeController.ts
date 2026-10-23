import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { geminiService } from '../services/gemini.js';
import { ruleEngine } from '../services/ruleEngine.js';
import { dbService } from '../services/firestore.js';
import { clarifyRequestSchema, correctionRequestSchema } from '../types/schemas.js';
import type {
  AnalysisRecord,
  DisposalHistoryRecord,
  CorrectionRecord
} from '../types/domain.js';

export async function analyzeItem(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.sessionId || uuidv4();
    const requestId = req.requestId || uuidv4();

    const localityId = (req.body.localityId as string) || (req.query.localityId as string) || 'default';
    const textDescription = (req.body.textDescription as string) || undefined;
    const barcode = (req.body.barcode as string) || undefined;
    const ocrText = (req.body.ocrText as string) || undefined;
    const productNameHint = (req.body.productNameHint as string) || undefined;

    const hasFile = !!req.file;
    const hasText = !!textDescription && textDescription.trim().length > 0;

    if (!hasFile && !hasText && !barcode && !ocrText && !productNameHint) {
      res.status(400).json({
        error: {
          code: 'MISSING_INPUT',
          message: 'Either an image file or textDescription/product hint must be provided for analysis.',
          requestId
        }
      });
      return;
    }

    // 1. Check active guide for this locality
    const activeGuide = await dbService.getActiveGuide(localityId);
    if (!activeGuide) {
      res.status(404).json({
        error: {
          code: 'NO_ACTIVE_GUIDE',
          message: `No active waste sorting guide configured for locality '${localityId}'. Please upload a guide first.`,
          requestId
        }
      });
      return;
    }

    // 2. Stage 1: Gemini Visual / Text Extraction & Packaging Decomposition
    const extraction = await geminiService.extractItem({
      imageBuffer: req.file?.buffer,
      imageMimeType: req.file?.mimetype,
      textDescription,
      barcode,
      ocrText,
      productNameHint
    });

    const analysisId = uuidv4();

    // 3. Stage 2: Ambiguity & Completeness Check
    const isAmbiguous = extraction.isAmbiguous || extraction.overallConfidence < 0.7;

    if (isAmbiguous) {
      const clarifyingQuestions = extraction.clarifyingQuestions.length > 0
        ? extraction.clarifyingQuestions
        : [
            `Could you clarify what material the ${extraction.name} is made of?`,
            'Does it contain any plastic lining, metal foil, or special coating?'
          ];

      const analysisRecord: AnalysisRecord = {
        analysisId,
        sessionId,
        localityId,
        status: 'clarification_required',
        item: {
          name: extraction.name,
          alternatives: extraction.alternatives,
          components: extraction.components
        },
        clarification: {
          required: true,
          questions: clarifyingQuestions
        },
        recommendation: null,
        evidence: [],
        uncertaintyNotes: extraction.uncertaintyNotes || ['Low confidence or ambiguous material structure.'],
        requiresHumanReview: false,
        createdAt: new Date().toISOString()
      };

      dbService.saveAnalysis(analysisRecord).catch((err) => console.warn('Non-blocking log skipped:', err?.message));

      res.status(200).json({
        analysisId: analysisRecord.analysisId,
        status: analysisRecord.status,
        item: analysisRecord.item,
        clarification: analysisRecord.clarification,
        recommendation: null,
        evidence: [],
        uncertaintyNotes: analysisRecord.uncertaintyNotes,
        requiresHumanReview: false
      });
      return;
    }

    // 4. Stage 3 & 4: Deterministic Retrieval & Grounded Evaluation
    const evalResult = await ruleEngine.evaluateItem({
      item: {
        name: extraction.name,
        alternatives: extraction.alternatives,
        components: extraction.components
      },
      activeGuide
    });

    // 5. Stage 5: Response & Snapshot Audit
    const analysisRecord: AnalysisRecord = {
      analysisId,
      sessionId,
      localityId,
      status: evalResult.status,
      item: {
        name: extraction.name,
        alternatives: extraction.alternatives,
        components: extraction.components
      },
      clarification: {
        required: false,
        questions: []
      },
      recommendation: evalResult.recommendation,
      evidence: evalResult.evidence,
      uncertaintyNotes: evalResult.uncertaintyNotes,
      requiresHumanReview: evalResult.requiresHumanReview,
      createdAt: new Date().toISOString()
    };

    dbService.saveAnalysis(analysisRecord).catch((err) => console.warn('Non-blocking log skipped:', err?.message));

    // Auto-cache snapshot in disposalHistory
    const historyRecord: DisposalHistoryRecord = {
      historyId: uuidv4(),
      sessionId,
      analysisId,
      itemSnapshot: analysisRecord.item,
      recommendationSnapshot: (analysisRecord.recommendation as unknown as Record<string, unknown>) || {},
      evidenceSnapshot: analysisRecord.evidence,
      timestamp: new Date().toISOString()
    };
    dbService.saveHistory(historyRecord).catch((err) => console.warn('Non-blocking log skipped:', err?.message));

    res.status(200).json({
      analysisId: analysisRecord.analysisId,
      status: analysisRecord.status,
      item: analysisRecord.item,
      clarification: analysisRecord.clarification,
      recommendation: analysisRecord.recommendation,
      evidence: analysisRecord.evidence,
      uncertaintyNotes: analysisRecord.uncertaintyNotes,
      requiresHumanReview: analysisRecord.requiresHumanReview
    });
  } catch (err) {
    next(err);
  }
}

export async function clarifyAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const analysisId = Array.isArray(req.params.analysisId) ? req.params.analysisId[0] : req.params.analysisId;
    const sessionId = req.sessionId;
    const requestId = req.requestId || uuidv4();

    const parseResult = clarifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues.map(e => e.message).join('; '),
          requestId
        }
      });
      return;
    }

    const analysis = await dbService.getAnalysis(analysisId);
    if (!analysis) {
      res.status(404).json({
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: `Analysis '${analysisId}' was not found.`,
          requestId
        }
      });
      return;
    }

    // Session Isolation Enforcement
    if (analysis.sessionId !== sessionId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_SESSION_ACCESS',
          message: 'Access to this analysis is restricted to the owning session.',
          requestId
        }
      });
      return;
    }

    const activeGuide = await dbService.getActiveGuide(analysis.localityId);
    if (!activeGuide) {
      res.status(404).json({
        error: {
          code: 'NO_ACTIVE_GUIDE',
          message: `Active guide for locality '${analysis.localityId}' is missing.`,
          requestId
        }
      });
      return;
    }

    // Re-evaluate grounded rules with user clarification answers
    const evalResult = await ruleEngine.evaluateItem({
      item: analysis.item,
      activeGuide,
      userClarifications: parseResult.data.answers
    });

    analysis.status = evalResult.status;
    analysis.clarification = { required: false, questions: [] };
    analysis.recommendation = evalResult.recommendation;
    analysis.evidence = evalResult.evidence;
    analysis.uncertaintyNotes = evalResult.uncertaintyNotes;
    analysis.requiresHumanReview = evalResult.requiresHumanReview;

    await dbService.saveAnalysis(analysis);

    // Save updated snapshot in history
    await dbService.saveHistory({
      historyId: uuidv4(),
      sessionId: sessionId!,
      analysisId: analysis.analysisId,
      itemSnapshot: analysis.item,
      recommendationSnapshot: (analysis.recommendation as unknown as Record<string, unknown>) || {},
      evidenceSnapshot: analysis.evidence,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      analysisId: analysis.analysisId,
      status: analysis.status,
      item: analysis.item,
      clarification: analysis.clarification,
      recommendation: analysis.recommendation,
      evidence: analysis.evidence,
      uncertaintyNotes: analysis.uncertaintyNotes,
      requiresHumanReview: analysis.requiresHumanReview
    });
  } catch (err) {
    next(err);
  }
}

export async function submitCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const analysisId = Array.isArray(req.params.analysisId) ? req.params.analysisId[0] : req.params.analysisId;
    const sessionId = req.sessionId!;
    const requestId = req.requestId || uuidv4();

    const parseResult = correctionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues.map(e => e.message).join('; '),
          requestId
        }
      });
      return;
    }

    const analysis = await dbService.getAnalysis(analysisId);
    if (!analysis) {
      res.status(404).json({
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: `Analysis '${analysisId}' was not found.`,
          requestId
        }
      });
      return;
    }

    // Session Isolation Enforcement
    if (analysis.sessionId !== sessionId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_SESSION_ACCESS',
          message: 'Access to this analysis is restricted to the owning session.',
          requestId
        }
      });
      return;
    }

    const activeGuide = await dbService.getActiveGuide(analysis.localityId);
    if (!activeGuide) {
      res.status(404).json({
        error: {
          code: 'NO_ACTIVE_GUIDE',
          message: `Active guide for locality '${analysis.localityId}' is missing.`,
          requestId
        }
      });
      return;
    }

    const originalData = {
      item: { ...analysis.item },
      recommendation: analysis.recommendation ? { ...analysis.recommendation } : null
    };

    // Apply correction to item
    if (parseResult.data.correctedItemName) {
      analysis.item.name = parseResult.data.correctedItemName;
    }
    if (parseResult.data.correctedComponents && parseResult.data.correctedComponents.length > 0) {
      analysis.item.components = parseResult.data.correctedComponents.map(c => ({
        name: c.name,
        material: c.material,
        confidence: 'high' as const
      }));
    }

    // Re-evaluate rules against active guide
    const evalResult = await ruleEngine.evaluateItem({
      item: analysis.item,
      activeGuide
    });

    analysis.status = evalResult.status;
    analysis.recommendation = evalResult.recommendation;
    analysis.evidence = evalResult.evidence;
    analysis.uncertaintyNotes = evalResult.uncertaintyNotes;
    analysis.requiresHumanReview = evalResult.requiresHumanReview;

    await dbService.saveAnalysis(analysis);

    // Save correction audit trail
    const correctionRecord: CorrectionRecord = {
      correctionId: uuidv4(),
      analysisId: analysis.analysisId,
      sessionId,
      originalData,
      correctedData: req.body,
      reEvaluatedRecommendation: (evalResult.recommendation as unknown as Record<string, unknown>) || {},
      timestamp: new Date().toISOString()
    };
    await dbService.saveCorrection(correctionRecord);

    // Save updated history record
    await dbService.saveHistory({
      historyId: uuidv4(),
      sessionId,
      analysisId: analysis.analysisId,
      itemSnapshot: analysis.item,
      recommendationSnapshot: (analysis.recommendation as unknown as Record<string, unknown>) || {},
      evidenceSnapshot: analysis.evidence,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      analysisId: analysis.analysisId,
      status: analysis.status,
      item: analysis.item,
      clarification: analysis.clarification,
      recommendation: analysis.recommendation,
      evidence: analysis.evidence,
      uncertaintyNotes: analysis.uncertaintyNotes,
      requiresHumanReview: analysis.requiresHumanReview
    });
  } catch (err) {
    next(err);
  }
}
