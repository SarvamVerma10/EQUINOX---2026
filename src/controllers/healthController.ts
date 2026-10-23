import type { Request, Response } from 'express';
import { isUsingInMemory } from '../services/firestore.js';

export function getHealth(_req: Request, res: Response) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      firestore: true,
      gemini: true,
      inMemoryStore: isUsingInMemory()
    }
  });
}
