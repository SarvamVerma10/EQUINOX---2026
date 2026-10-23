import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.requestId || uuidv4();

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON_PAYLOAD',
        message: 'Request payload contains malformed JSON syntax.',
        requestId
      }
    });
    return;
  }

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const errorDetails = (err as ZodError).issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${errorDetails}`,
        requestId
      }
    });
    return;
  }

  // Handle custom known application errors
  if (err.statusCode || err.status) {
    const status = err.statusCode || err.status;
    res.status(status).json({
      error: {
        code: err.code || 'REQUEST_ERROR',
        message: err.message || 'An error occurred processing your request.',
        requestId
      }
    });
    return;
  }

  // Handle Gemini API errors (rate limit, quota, network)
  if (err.message && (err.message.includes('quota') || err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'))) {
    res.status(503).json({
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The AI reasoning service is currently experiencing high load or quota exhaustion. Please retry shortly.',
        requestId
      }
    });
    return;
  }

  console.error('Unhandled internal server error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred.',
      requestId
    }
  });
}
