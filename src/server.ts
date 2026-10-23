import fs from 'fs';
import path from 'path';
import { app } from './app.js';
import { env } from './config/env.js';
import { dbService } from './services/firestore.js';
import type { GuideRecord, RuleChunkRecord } from './types/domain.js';

const PORT = env.PORT || 8080;

async function autoSeedDefaultGuide() {
  try {
    const existing = await dbService.getActiveGuide('metro-central');
    if (!existing) {
      const guidePath = path.resolve(process.cwd(), 'fixtures/sample-guide.json');
      if (fs.existsSync(guidePath)) {
        const raw = fs.readFileSync(guidePath, 'utf-8');
        const parsed = JSON.parse(raw);

        // Seed for both 'metro-central' and 'default'
        for (const loc of ['metro-central', 'default']) {
          const guideId = `${parsed.guideId}-${loc}`;
          const guideRecord: GuideRecord = {
            guideId,
            localityId: loc,
            version: parsed.version,
            title: parsed.title,
            isActive: true,
            uploadedAt: new Date().toISOString(),
            processedChunks: parsed.rules.length,
            validCategories: parsed.validCategories
          };

          const ruleChunks: RuleChunkRecord[] = parsed.rules.map((r: any, idx: number) => ({
            chunkId: `${r.chunkId}-${loc}-${idx}`,
            guideId,
            localityId: loc,
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
        }
        console.log('📦 Auto-seeded default municipal waste sorting guide (metro-central & default).');
      }
    }
  } catch (seedErr) {
    console.warn('Auto-seed default guide notice:', seedErr);
  }
}

app.listen(PORT, async () => {
  await autoSeedDefaultGuide();
  console.log(`🚀 WasteWise Backend Engine listening on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/v1/health`);
});
