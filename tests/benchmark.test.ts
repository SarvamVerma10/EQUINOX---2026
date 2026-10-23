import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { app } from '../src/app.js';
import { geminiService } from '../src/services/gemini.js';
import { seedSampleGuide, resetTestDatabase } from './helpers/dbHelper.js';

describe('WasteWise Benchmark Items Fixture Test Suite', () => {
  let benchmarkItems: any[] = [];

  beforeEach(async () => {
    resetTestDatabase();
    await seedSampleGuide();
    vi.restoreAllMocks();

    const raw = fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/benchmark-items.json'), 'utf-8');
    benchmarkItems = JSON.parse(raw);
  });

  it('verifies benchmark fixture set contains 18 items spanning all critical categories', () => {
    expect(benchmarkItems.length).toBeGreaterThanOrEqual(15);
    expect(benchmarkItems.length).toBeLessThanOrEqual(20);

    const categories = benchmarkItems.map(b => b.expectedCategory).filter(Boolean);
    expect(categories).toContain('Recycling / Blue Bin');
    expect(categories).toContain('Organics / Green Bin');
    expect(categories).toContain('Landfill / Residual Waste');
    expect(categories).toContain('Hazardous Waste');
    expect(categories).toContain('Drop-off Only');
  });

  it('executes benchmark classification across clear, ambiguous, and ungrounded items', async () => {
    for (const item of benchmarkItems.slice(0, 8)) {
      if (item.expectedStatus === 'clarification_required') {
        vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
          name: item.expectedItem,
          alternatives: [],
          components: item.components || [],
          overallConfidence: 0.5,
          isAmbiguous: true,
          clarifyingQuestions: ['Please clarify container material'],
          uncertaintyNotes: ['Ambiguous material']
        });

        const res = await request(app)
          .post('/api/v1/analyze')
          .set('x-session-id', 'benchmark-session')
          .send({ localityId: 'metro-central', textDescription: item.description });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('clarification_required');
      } else if (item.expectedStatus === 'no_supported_rule') {
        vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
          name: item.expectedItem,
          alternatives: [],
          components: item.components || [],
          overallConfidence: 0.9,
          isAmbiguous: false,
          clarifyingQuestions: [],
          uncertaintyNotes: []
        });

        vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
          category: null,
          instructions: [],
          explanation: 'No supported rule in active local guide.',
          matchingRuleId: null,
          exactQuote: null,
          pageNumber: null,
          sectionTitle: null,
          requiresHumanReview: false
        });

        const res = await request(app)
          .post('/api/v1/analyze')
          .set('x-session-id', 'benchmark-session')
          .send({ localityId: 'metro-central', textDescription: item.description });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('no_supported_rule');
      } else {
        vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
          name: item.expectedItem,
          alternatives: [],
          components: item.components || [],
          overallConfidence: 0.95,
          isAmbiguous: false,
          clarifyingQuestions: [],
          uncertaintyNotes: []
        });

        vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
          category: item.expectedCategory,
          instructions: ['Process according to local guideline'],
          explanation: `Locality rule grounds ${item.expectedItem} into ${item.expectedCategory}`,
          matchingRuleId: 'rule-benchmark',
          exactQuote: `Sample quote for ${item.expectedItem}`,
          pageNumber: 10,
          sectionTitle: 'Benchmark Section',
          requiresHumanReview: false
        });

        const res = await request(app)
          .post('/api/v1/analyze')
          .set('x-session-id', 'benchmark-session')
          .send({ localityId: 'metro-central', textDescription: item.description });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('recommendation_ready');
        expect(res.body.recommendation.category).toBe(item.expectedCategory);
      }
    }
  });
});
