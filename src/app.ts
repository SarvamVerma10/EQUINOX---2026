import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { initFirestore } from './services/firestore.js';

export function createApp() {
  const app = express();

  // Initialize DB
  initFirestore();

  // CORS configuration
  const allowedOrigins = env.ALLOWED_ORIGINS === '*'
    ? '*'
    : env.ALLOWED_ORIGINS.split(',').map(s => s.trim());

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-request-id']
  }));

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root welcome / discovery route
  app.get('/', (_req, res) => {
    res.json({
      service: 'WasteWise Backend API',
      status: 'online',
      version: '1.0.0',
      frontendUrl: 'http://localhost:3000',
      healthCheck: '/api/v1/health',
      endpoints: [
        'GET /api/v1/health',
        'GET /api/v1/guides/active',
        'POST /api/v1/analyze',
        'POST /api/v1/analyze/:analysisId/clarify',
        'POST /api/v1/analyze/:analysisId/correction',
        'GET /api/v1/history'
      ]
    });
  });

  // API v1 routes
  app.use('/api/v1', apiRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found.`,
        requestId: req.requestId || 'unknown'
      }
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
