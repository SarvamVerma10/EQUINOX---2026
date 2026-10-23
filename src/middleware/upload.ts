import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Max file sizes
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;    // 10MB

const storage = multer.memoryStorage();

export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE
  },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['application/pdf', 'text/plain'];
    const lowerName = file.originalname.toLowerCase();
    if (allowedMime.includes(file.mimetype) || lowerName.endsWith('.pdf') || lowerName.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE: Only PDF and TXT documents are supported.'));
    }
  }
}).single('file');

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE
  },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_IMAGE_TYPE: Only JPEG, PNG, WEBP, and GIF images are supported.'));
    }
  }
}).single('file');

// Middleware wrappers to capture multer errors into standard error schema
export function handleDocumentUpload(req: Request, res: Response, next: NextFunction) {
  uploadDocument(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Uploaded document exceeds the maximum limit of ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB.`,
            requestId: req.requestId || uuidv4()
          }
        });
        return;
      }
      res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message || 'File upload failed.',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }
    next();
  });
}

export function handleImageUpload(req: Request, res: Response, next: NextFunction) {
  uploadImage(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Uploaded image exceeds the maximum limit of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`,
            requestId: req.requestId || uuidv4()
          }
        });
        return;
      }
      res.status(400).json({
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message || 'Image upload failed.',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }
    next();
  });
}
