import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromBuffer } from '../services/docParser.js';
import { geminiService } from '../services/gemini.js';
import { dbService } from '../services/firestore.js';
import type { GuideRecord, RuleChunkRecord } from '../types/domain.js';

export async function createGuide(req: Request, res: Response, next: NextFunction) {
  try {
    const { localityId, version, title } = req.body;

    if (!localityId || typeof localityId !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_LOCALITY_ID',
          message: 'Field localityId is required.',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }

    if (!version || typeof version !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_VERSION',
          message: 'Field version is required.',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'MISSING_FILE',
          message: 'A PDF or TXT guide document file is required in multipart field "file".',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }

    // 1. Extract text and page numbers
    const pages = await extractTextFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (pages.length === 0 || pages.every(p => p.text.trim().length === 0)) {
      res.status(400).json({
        error: {
          code: 'EMPTY_DOCUMENT',
          message: 'The uploaded file does not contain extractable text content.',
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }

    // 2. Parse rules via Gemini structured document parser
    const parsedGuide = await geminiService.parseGuideDocument(pages, localityId, version);

    const guideId = `guide-${uuidv4()}`;

    // 3. Convert to RuleChunkRecords
    const ruleChunks: RuleChunkRecord[] = parsedGuide.rules.map(rule => ({
      chunkId: `chunk-${uuidv4()}`,
      guideId,
      localityId,
      categoryName: rule.categoryName,
      applicableMaterials: rule.applicableMaterials,
      itemAliases: rule.itemAliases,
      allowedConditions: rule.allowedConditions,
      preparationSteps: rule.preparationSteps,
      sourceExcerpt: rule.sourceExcerpt,
      pageNumber: rule.pageNumber,
      sectionTitle: rule.sectionTitle
    }));

    // 4. Save rule chunks
    await dbService.saveRuleChunks(ruleChunks);

    // 5. Save Guide Record
    const guideRecord: GuideRecord = {
      guideId,
      localityId,
      version,
      title: title || parsedGuide.title || `Waste Sorting Guide - ${localityId}`,
      isActive: true,
      uploadedAt: new Date().toISOString(),
      processedChunks: ruleChunks.length,
      validCategories: parsedGuide.categories
    };

    await dbService.saveGuide(guideRecord);

    res.status(201).json({
      guideId: guideRecord.guideId,
      localityId: guideRecord.localityId,
      version: guideRecord.version,
      title: guideRecord.title,
      isActive: guideRecord.isActive,
      uploadedAt: guideRecord.uploadedAt,
      processedChunks: guideRecord.processedChunks,
      categories: guideRecord.validCategories
    });
  } catch (err) {
    next(err);
  }
}

export async function getActiveGuide(req: Request, res: Response, next: NextFunction) {
  try {
    const localityId = (req.query.localityId as string) || 'default';

    const guide = await dbService.getActiveGuide(localityId);
    if (!guide) {
      res.status(404).json({
        error: {
          code: 'GUIDE_NOT_FOUND',
          message: `No active waste guide found for locality '${localityId}'.`,
          requestId: req.requestId || uuidv4()
        }
      });
      return;
    }

    let categories = guide.validCategories;
    if (!categories || categories.length === 0) {
      const chunks = await dbService.getRuleChunksByGuide(guide.guideId);
      categories = Array.from(new Set(chunks.map(c => c.categoryName)));
    }

    res.status(200).json({
      guideId: guide.guideId,
      localityId: guide.localityId,
      version: guide.version,
      title: guide.title,
      isActive: guide.isActive,
      uploadedAt: guide.uploadedAt,
      processedChunks: guide.processedChunks,
      validCategories: categories
    });
  } catch (err) {
    next(err);
  }
}
