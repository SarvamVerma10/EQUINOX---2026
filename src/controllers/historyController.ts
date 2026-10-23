import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from '../services/firestore.js';
import { historyPostSchema } from '../types/schemas.js';
import type { DisposalHistoryRecord } from '../types/domain.js';

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.sessionId!;

    const historyItems = await dbService.getHistoryBySession(sessionId);

    res.status(200).json({
      sessionId,
      count: historyItems.length,
      history: historyItems
    });
  } catch (err) {
    next(err);
  }
}

export async function createHistoryEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.sessionId!;
    const requestId = req.requestId || uuidv4();

    const parseResult = historyPostSchema.safeParse(req.body);
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

    const { analysisId } = parseResult.data;

    const analysis = await dbService.getAnalysis(analysisId);
    if (!analysis) {
      res.status(404).json({
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: `Analysis with id '${analysisId}' was not found.`,
          requestId
        }
      });
      return;
    }

    // Caller session isolation: never allow client-spoofed access
    if (analysis.sessionId !== sessionId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_SESSION_ACCESS',
          message: 'Cannot record history for an analysis belonging to a different session.',
          requestId
        }
      });
      return;
    }

    const historyRecord: DisposalHistoryRecord = {
      historyId: uuidv4(),
      sessionId,
      analysisId,
      itemSnapshot: analysis.item,
      recommendationSnapshot: (analysis.recommendation as unknown as Record<string, unknown>) || {},
      evidenceSnapshot: analysis.evidence,
      timestamp: new Date().toISOString()
    };

    await dbService.saveHistory(historyRecord);

    res.status(201).json(historyRecord);
  } catch (err) {
    next(err);
  }
}
