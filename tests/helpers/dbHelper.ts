import fs from 'fs';
import path from 'path';
import { dbService, inMemoryDb } from '../../src/services/firestore.js';
import type { GuideRecord, RuleChunkRecord } from '../../src/types/domain.js';

export async function seedSampleGuide(): Promise<GuideRecord> {
  const guideFilePath = path.resolve(process.cwd(), 'fixtures/sample-guide.json');
  const rawData = fs.readFileSync(guideFilePath, 'utf-8');
  const parsed = JSON.parse(rawData);

  const guideRecord: GuideRecord = {
    guideId: parsed.guideId,
    localityId: parsed.localityId,
    version: parsed.version,
    title: parsed.title,
    isActive: parsed.isActive,
    uploadedAt: parsed.uploadedAt,
    processedChunks: parsed.rules.length,
    validCategories: parsed.validCategories
  };

  const ruleChunks: RuleChunkRecord[] = parsed.rules.map((r: any) => ({
    chunkId: r.chunkId,
    guideId: parsed.guideId,
    localityId: parsed.localityId,
    categoryName: r.categoryName,
    applicableMaterials: r.applicableMaterials,
    itemAliases: r.itemAliases,
    allowedConditions: r.allowedConditions,
    preparationSteps: r.preparationSteps,
    sourceExcerpt: r.sourceExcerpt,
    pageNumber: r.pageNumber,
    sectionTitle: r.sectionTitle
  }));

  await dbService.saveGuide(guideRecord);
  await dbService.saveRuleChunks(ruleChunks);

  return guideRecord;
}

export function resetTestDatabase() {
  inMemoryDb.reset();
}
