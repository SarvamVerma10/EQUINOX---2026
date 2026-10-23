import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { createGuide, getActiveGuide } from '../controllers/guidesController.js';
import { analyzeItem, clarifyAnalysis, submitCorrection } from '../controllers/analyzeController.js';
import { getHistory, createHistoryEntry } from '../controllers/historyController.js';
import { handleDocumentUpload, handleImageUpload } from '../middleware/upload.js';
import { requireSessionMiddleware, optionalSessionMiddleware } from '../middleware/session.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', getHealth);

// Guides management
apiRouter.post('/guides', handleDocumentUpload, createGuide);
apiRouter.get('/guides/active', getActiveGuide);

// Analyze pipeline
// Note: handleImageUpload runs first; if content-type is json, multer passes through
apiRouter.post('/analyze', handleImageUpload, optionalSessionMiddleware, analyzeItem);
apiRouter.post('/analyze/:analysisId/clarify', requireSessionMiddleware, clarifyAnalysis);
apiRouter.post('/analyze/:analysisId/correction', requireSessionMiddleware, submitCorrection);

// History
apiRouter.get('/history', requireSessionMiddleware, getHistory);
apiRouter.post('/history', requireSessionMiddleware, createHistoryEntry);
