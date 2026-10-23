import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
}

export function requireSessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionIdHeader = req.headers['x-session-id'];
  const authHeader = req.headers['authorization'];

  let sessionId: string | null = null;

  if (typeof sessionIdHeader === 'string' && sessionIdHeader.trim().length > 0) {
    sessionId = sessionIdHeader.trim();
  } else if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    sessionId = authHeader.substring(7).trim();
  }

  if (!sessionId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED_SESSION',
        message: "Missing or invalid session identifier. Provide 'x-session-id' header or Bearer token.",
        requestId: req.requestId || uuidv4()
      }
    });
    return;
  }

  // Sanitize session ID to prevent path traversal or injection
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) {
    res.status(400).json({
      error: {
        code: 'INVALID_SESSION_FORMAT',
        message: 'Invalid session ID format. Must be alphanumeric and 1-128 characters.',
        requestId: req.requestId || uuidv4()
      }
    });
    return;
  }

  req.sessionId = sessionId;
  next();
}

export function optionalSessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const sessionIdHeader = req.headers['x-session-id'];
  const authHeader = req.headers['authorization'];

  if (typeof sessionIdHeader === 'string' && sessionIdHeader.trim().length > 0) {
    req.sessionId = sessionIdHeader.trim();
  } else if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    req.sessionId = authHeader.substring(7).trim();
  } else {
    // Generate a default session ID for anonymous unauthenticated calls if permitted
    req.sessionId = uuidv4();
  }

  next();
}
