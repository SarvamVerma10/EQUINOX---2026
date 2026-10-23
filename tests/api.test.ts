import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { geminiService } from '../src/services/gemini.js';
import { seedSampleGuide, resetTestDatabase } from './helpers/dbHelper.js';

describe('WasteWise Backend API Test Suite', () => {
  beforeEach(async () => {
    resetTestDatabase();
    await seedSampleGuide();
    vi.restoreAllMocks();
  });

  // Health Check Test
  it('GET /api/v1/health returns ok status and service flags', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.services.firestore).toBe(true);
    expect(res.body.services.gemini).toBe(true);
  });

  // Active Guide Test
  it('GET /api/v1/guides/active retrieves current active guide and valid categories', async () => {
    const res = await request(app).get('/api/v1/guides/active?localityId=metro-central');
    expect(res.status).toBe(200);
    expect(res.body.guideId).toBe('guide-metro-2026-v1');
    expect(res.body.localityId).toBe('metro-central');
    expect(res.body.isActive).toBe(true);
    expect(Array.isArray(res.body.validCategories)).toBe(true);
    expect(res.body.validCategories).toContain('Recycling / Blue Bin');
  });

  // Core Case 1: Clear photograph -> supported recommendation
  it('Case 1: Clear photograph -> supported recommendation', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Aluminum Can',
      alternatives: ['Soda Can'],
      components: [{ name: 'Can Body', material: 'Aluminum', confidence: 'high' }],
      overallConfidence: 0.95,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Recycling / Blue Bin',
      instructions: ['Empty all liquids completely', 'Rinse interior'],
      explanation: 'Aluminum beverage cans are 100% recyclable in the Blue Bin.',
      matchingRuleId: 'rule-104',
      exactQuote: 'Aluminum beverage and food cans are 100% recyclable in the Blue Bin.',
      pageNumber: 8,
      sectionTitle: 'Metal & Cans',
      requiresHumanReview: false
    });

    const fakeImageBuffer = Buffer.from('fake-image-bytes-jpeg');

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-1')
      .field('localityId', 'metro-central')
      .attach('file', fakeImageBuffer, { filename: 'can.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('recommendation_ready');
    expect(res.body.item.name).toBe('Aluminum Can');
    expect(res.body.recommendation.category).toBe('Recycling / Blue Bin');
    expect(res.body.evidence.length).toBeGreaterThan(0);
    expect(res.body.evidence[0].ruleId).toBe('rule-104');
    expect(res.body.evidence[0].pageNumber).toBe(8);
  });

  // Core Case 2: Text description -> supported recommendation
  it('Case 2: Text description -> supported recommendation', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Pizza Box',
      alternatives: ['Takeout Box'],
      components: [{ name: 'Box', material: 'Greasy Cardboard', confidence: 'high' }],
      overallConfidence: 0.9,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Organics / Green Bin',
      instructions: ['Remove plastic condiment containers', 'Place in Green Bin'],
      explanation: 'Cardboard soiled with pizza grease belongs in the Green Bin.',
      matchingRuleId: 'rule-105',
      exactQuote: 'Cardboard boxes contaminated with pizza grease or melted cheese cannot be recycled as clean paper; tear and deposit in the Green Bin (Organics).',
      pageNumber: 19,
      sectionTitle: 'Food-Soiled Paper & Organics',
      requiresHumanReview: false
    });

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-2')
      .send({
        localityId: 'metro-central',
        textDescription: 'Cardboard pizza box with lots of grease and melted cheese on the bottom'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('recommendation_ready');
    expect(res.body.recommendation.category).toBe('Organics / Green Bin');
    expect(res.body.evidence[0].pageNumber).toBe(19);
  });

  // Core Case 3: Mixed packaging decomposition
  it('Case 3: Mixed packaging decomposition (Coffee cup body vs lid)', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Coffee Cup',
      alternatives: ['Takeaway Cup'],
      components: [
        { name: 'Cup Body', material: 'Poly-coated Paperboard', confidence: 'high' },
        { name: 'Lid', material: 'Polypropylene Plastic (#5)', confidence: 'high' }
      ],
      overallConfidence: 0.92,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Landfill / Residual Waste',
      instructions: [
        'Remove plastic lid and place lid in Recycling / Blue Bin',
        'Empty residual liquids',
        'Do not place coated cup body in paper recycling; dispose in Landfill'
      ],
      explanation: 'Locality rules specify poly-coated paper cups cannot be processed in curbside paper recycling.',
      matchingRuleId: 'rule-101',
      exactQuote: 'Single-use hot beverage cups with poly-coat linings are not accepted in blue bins; place in black bin.',
      pageNumber: 14,
      sectionTitle: 'Beverage Containers',
      requiresHumanReview: false
    });

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-3')
      .send({
        localityId: 'metro-central',
        textDescription: 'Disposable takeaway paper coffee cup with a plastic lid'
      });

    expect(res.status).toBe(200);
    expect(res.body.item.components).toHaveLength(2);
    expect(res.body.item.components[0].material).toBe('Poly-coated Paperboard');
    expect(res.body.item.components[1].material).toBe('Polypropylene Plastic (#5)');
    expect(res.body.recommendation.category).toBe('Landfill / Residual Waste');
    expect(res.body.recommendation.instructions).toContain(
      'Remove plastic lid and place lid in Recycling / Blue Bin'
    );
  });

  // Core Case 4: Ambiguous image -> clarification request
  it('Case 4: Ambiguous image -> clarification request', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Unidentified Pouch',
      alternatives: ['Bag'],
      components: [{ name: 'Pouch', material: 'Unclear Foil or Plastic Film', confidence: 'low' }],
      overallConfidence: 0.45,
      isAmbiguous: true,
      clarifyingQuestions: [
        'Does the pouch have a shiny metallic interior or is it plain paper?',
        'Is there a recycling triangle with a resin code #1-#7 on the packaging?'
      ],
      uncertaintyNotes: ['Visual reflection prevents distinguishing metallized film from pure aluminum foil.']
    });

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-4')
      .send({
        localityId: 'metro-central',
        textDescription: 'Blurry shiny pouch packaging'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('clarification_required');
    expect(res.body.clarification.required).toBe(true);
    expect(res.body.clarification.questions.length).toBeGreaterThan(0);
    expect(res.body.recommendation).toBeNull();
    expect(res.body.evidence).toEqual([]);
  });

  // Core Case 5: Missing rule -> no_supported_rule
  it('Case 5: Missing rule -> no_supported_rule', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Radioactive Medical Isotope Container',
      alternatives: [],
      components: [{ name: 'Cylinder', material: 'Lead', confidence: 'high' }],
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

    // In local guide, lead/radioactive items have no matching candidate rules
    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-5')
      .send({
        localityId: 'metro-central',
        textDescription: 'Radioactive isotope cylinder container'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_supported_rule');
    expect(res.body.recommendation).toBeNull();
    expect(res.body.evidence).toEqual([]);
  });

  // Core Case 6: Exact excerpt and page provenance verification
  it('Case 6: Exact excerpt and page provenance verification', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'AA Battery',
      alternatives: ['Alkaline Battery'],
      components: [{ name: 'Cell', material: 'Alkaline', confidence: 'high' }],
      overallConfidence: 0.98,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Hazardous Waste',
      instructions: ['Tape exposed terminals', 'Deliver to HHW depot'],
      explanation: 'Batteries pose fire hazards in collection vehicles and cannot go in curbside bins.',
      matchingRuleId: 'rule-109',
      exactQuote: 'Household and rechargeable batteries pose serious fire hazards in garbage trucks and are strictly prohibited in curbside bins. Deliver to HHW depots.',
      pageNumber: 33,
      sectionTitle: 'Hazardous Materials',
      requiresHumanReview: false
    });

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-6')
      .send({
        localityId: 'metro-central',
        textDescription: 'Used AA alkaline battery'
      });

    expect(res.status).toBe(200);
    expect(res.body.recommendation.category).toBe('Hazardous Waste');
    expect(res.body.evidence).toHaveLength(1);
    expect(res.body.evidence[0].ruleId).toBe('rule-109');
    expect(res.body.evidence[0].pageNumber).toBe(33);
    expect(res.body.evidence[0].sectionTitle).toBe('Hazardous Materials');
    expect(res.body.evidence[0].sourceExcerpt).toContain('strictly prohibited in curbside bins');
  });

  // Core Case 7: Material correction -> re-evaluated recommendation
  it('Case 7: Material correction -> re-evaluated recommendation', async () => {
    // Initial analysis identifies as generic paper
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Box',
      alternatives: [],
      components: [{ name: 'Box', material: 'Clean Corrugated Cardboard', confidence: 'medium' }],
      overallConfidence: 0.75,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Recycling / Blue Bin',
      instructions: ['Flatten box completely'],
      explanation: 'Clean cardboard is recyclable in Blue Bin.',
      matchingRuleId: 'rule-106',
      exactQuote: 'Clean corrugated shipping cartons and unsoiled cardboard must be flattened and placed in the Blue Bin.',
      pageNumber: 18,
      sectionTitle: 'Cardboard & Paper',
      requiresHumanReview: false
    });

    const initRes = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-7')
      .send({
        localityId: 'metro-central',
        textDescription: 'A cardboard box'
      });

    expect(initRes.status).toBe(200);
    const analysisId = initRes.body.analysisId;
    expect(initRes.body.recommendation.category).toBe('Recycling / Blue Bin');

    // User submits correction: It is actually heavily soiled greasy pizza cardboard
    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Organics / Green Bin',
      instructions: ['Remove plastic condiment containers', 'Place in Green Bin'],
      explanation: 'Greasy cardboard belongs in organics.',
      matchingRuleId: 'rule-105',
      exactQuote: 'Cardboard boxes contaminated with pizza grease or melted cheese cannot be recycled as clean paper; tear and deposit in the Green Bin (Organics).',
      pageNumber: 19,
      sectionTitle: 'Food-Soiled Paper & Organics',
      requiresHumanReview: false
    });

    const correctionRes = await request(app)
      .post(`/api/v1/analyze/${analysisId}/correction`)
      .set('x-session-id', 'session-case-7')
      .send({
        correctedItemName: 'Greasy Pizza Box',
        correctedComponents: [{ name: 'Box Body', material: 'Greasy Cardboard' }]
      });

    expect(correctionRes.status).toBe(200);
    expect(correctionRes.body.item.name).toBe('Greasy Pizza Box');
    expect(correctionRes.body.recommendation.category).toBe('Organics / Green Bin');
    expect(correctionRes.body.evidence[0].ruleId).toBe('rule-105');
  });

  // Core Case 8: Session-isolated history access
  it('Case 8: Session-isolated history access', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Soda Can',
      alternatives: ['Aluminum Can'],
      components: [{ name: 'Body', material: 'Aluminum', confidence: 'high' }],
      overallConfidence: 0.95,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Recycling / Blue Bin',
      instructions: ['Rinse'],
      explanation: 'Aluminum can is recyclable.',
      matchingRuleId: 'rule-104',
      exactQuote: 'Aluminum beverage and food cans are 100% recyclable in the Blue Bin.',
      pageNumber: 8,
      sectionTitle: 'Metal & Cans',
      requiresHumanReview: false
    });

    const sessionId = 'session-user-alice';
    await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', sessionId)
      .send({ localityId: 'metro-central', textDescription: 'Soda Can' });

    const historyRes = await request(app)
      .get('/api/v1/history')
      .set('x-session-id', sessionId);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.sessionId).toBe(sessionId);
    expect(historyRes.body.count).toBe(1);
    expect(historyRes.body.history[0].sessionId).toBe(sessionId);
  });

  // Core Case 9: Unauthorized session history access blocked
  it('Case 9: Unauthorized session history access blocked', async () => {
    // 1. Create analysis with Session A
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Glass Jar',
      alternatives: [],
      components: [{ name: 'Jar', material: 'Glass', confidence: 'high' }],
      overallConfidence: 0.95,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Recycling / Blue Bin',
      instructions: ['Rinse'],
      explanation: 'Glass is recyclable.',
      matchingRuleId: 'rule-111',
      exactQuote: 'Clear, green, and brown container glass jars and bottles are fully accepted.',
      pageNumber: 9,
      sectionTitle: 'Glass Containers',
      requiresHumanReview: false
    });

    const createRes = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-owner-123')
      .send({ localityId: 'metro-central', textDescription: 'Glass jar' });

    const analysisId = createRes.body.analysisId;

    // 2. Attacker session tries to clarify or submit correction for Session A's analysis
    const clarifyAttempt = await request(app)
      .post(`/api/v1/analyze/${analysisId}/clarify`)
      .set('x-session-id', 'attacker-session-456')
      .send({ answers: [{ question: 'Material?', answer: 'Glass' }] });

    expect(clarifyAttempt.status).toBe(403);
    expect(clarifyAttempt.body.error.code).toBe('FORBIDDEN_SESSION_ACCESS');

    // 3. Attacker tries to post history entry for Session A's analysis
    const historyAttempt = await request(app)
      .post('/api/v1/history')
      .set('x-session-id', 'attacker-session-456')
      .send({ analysisId });

    expect(historyAttempt.status).toBe(403);
    expect(historyAttempt.body.error.code).toBe('FORBIDDEN_SESSION_ACCESS');
  });

  // Core Case 10: Invalid payloads / oversized upload rejection
  it('Case 10: Invalid payloads / oversized upload rejection', async () => {
    // Malformed JSON payload
    const malformedRes = await request(app)
      .post('/api/v1/analyze')
      .set('Content-Type', 'application/json')
      .send('{"localityId": "metro-central", invalid_json}');

    expect(malformedRes.status).toBe(400);
    expect(malformedRes.body.error.code).toBe('INVALID_JSON_PAYLOAD');

    // Missing input altogether
    const emptyRes = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-10')
      .send({ localityId: 'metro-central' });

    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error.code).toBe('MISSING_INPUT');

    // Oversized image upload (> 10MB)
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const uploadRes = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-10')
      .field('localityId', 'metro-central')
      .attach('file', largeBuffer, { filename: 'huge.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(413);
    expect(uploadRes.body.error.code).toBe('FILE_TOO_LARGE');
  });

  // Core Case 11: Gemini quota/network failure safety
  it('Case 11: Gemini quota/network failure safety', async () => {
    vi.spyOn(geminiService, 'extractItem').mockRejectedValueOnce(
      new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric GenerateContentRequestsPerMinute')
    );

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-11')
      .send({
        localityId: 'metro-central',
        textDescription: 'Aluminum soda can'
      });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(res.body.error.message).toContain('experiencing high load');
  });

  // Core Case 12: Conflicting rules handling
  it('Case 12: Conflicting rules handling -> review_required', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Composite Coffee Pod',
      alternatives: ['Single-serve Pod'],
      components: [
        { name: 'Cup', material: 'Plastic #7', confidence: 'medium' },
        { name: 'Filter', material: 'Paper', confidence: 'medium' },
        { name: 'Grounds', material: 'Organic', confidence: 'high' }
      ],
      overallConfidence: 0.85,
      isAmbiguous: false,
      clarifyingQuestions: [],
      uncertaintyNotes: []
    });

    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Landfill / Residual Waste',
      instructions: ['Rules conflict between organics and landfill'],
      explanation: 'Conflicting municipal guidelines regarding composite multi-material pods.',
      matchingRuleId: 'rule-101',
      exactQuote: null,
      pageNumber: 14,
      sectionTitle: null,
      requiresHumanReview: true
    });

    const res = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-case-12')
      .send({
        localityId: 'metro-central',
        textDescription: 'Single-serve coffee pod with organic grounds inside plastic cup'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('review_required');
    expect(res.body.requiresHumanReview).toBe(true);
  });

  // Clarify Route Test: user answers questions from clarification_required
  it('POST /api/v1/analyze/:analysisId/clarify completes workflow after clarification', async () => {
    vi.spyOn(geminiService, 'extractItem').mockResolvedValueOnce({
      name: 'Flexible Pouch',
      alternatives: [],
      components: [{ name: 'Pouch', material: 'Unclear', confidence: 'low' }],
      overallConfidence: 0.5,
      isAmbiguous: true,
      clarifyingQuestions: ['Is the pouch made of crinkly foil or stretch film?'],
      uncertaintyNotes: ['Uncertain material']
    });

    const initRes = await request(app)
      .post('/api/v1/analyze')
      .set('x-session-id', 'session-clarify-user')
      .send({
        localityId: 'metro-central',
        textDescription: 'Flexible pouch'
      });

    expect(initRes.body.status).toBe('clarification_required');
    const analysisId = initRes.body.analysisId;

    // User clarifies that it is crinkly metallized potato chip bag
    vi.spyOn(geminiService, 'evaluateGroundedRule').mockResolvedValueOnce({
      category: 'Landfill / Residual Waste',
      instructions: ['Dispose in Landfill / Black Bin'],
      explanation: 'Chip bags with metallized film belong in Landfill.',
      matchingRuleId: 'rule-112',
      exactQuote: 'Chip bags and candy wrappers composed of plastic laminated with metallic foil cannot be separated and belong in the Landfill bin.',
      pageNumber: 16,
      sectionTitle: 'Non-Recyclable Packaging',
      requiresHumanReview: false
    });

    const clarifyRes = await request(app)
      .post(`/api/v1/analyze/${analysisId}/clarify`)
      .set('x-session-id', 'session-clarify-user')
      .send({
        answers: [{ question: 'Is the pouch made of crinkly foil or stretch film?', answer: 'It is a crinkly metallized chip bag' }]
      });

    expect(clarifyRes.status).toBe(200);
    expect(clarifyRes.body.status).toBe('recommendation_ready');
    expect(clarifyRes.body.recommendation.category).toBe('Landfill / Residual Waste');
    expect(clarifyRes.body.evidence[0].ruleId).toBe('rule-112');
  });

  // Guide Ingestion POST /api/v1/guides test
  it('POST /api/v1/guides parses text document and registers active guide', async () => {
    vi.spyOn(geminiService, 'parseGuideDocument').mockResolvedValueOnce({
      title: 'City of Greenfield Waste Guide',
      categories: ['Blue Bin', 'Green Bin', 'Black Bin'],
      rules: [
        {
          categoryName: 'Blue Bin',
          applicableMaterials: ['Aluminum'],
          itemAliases: ['Soda Can'],
          allowedConditions: ['Rinsed'],
          preparationSteps: ['Rinse can'],
          sourceExcerpt: 'All aluminum cans go into the Blue Bin.',
          pageNumber: 1,
          sectionTitle: 'Metals'
        }
      ]
    });

    const textGuideBuffer = Buffer.from('City of Greenfield Waste Guide\nAll aluminum cans go into the Blue Bin.');

    const res = await request(app)
      .post('/api/v1/guides')
      .field('localityId', 'greenfield')
      .field('version', '2026.2')
      .field('title', 'City of Greenfield Waste Guide')
      .attach('file', textGuideBuffer, { filename: 'guide.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.localityId).toBe('greenfield');
    expect(res.body.version).toBe('2026.2');
    expect(res.body.processedChunks).toBe(1);
    expect(res.body.categories).toContain('Blue Bin');

    // Verify it is now active
    const activeRes = await request(app).get('/api/v1/guides/active?localityId=greenfield');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.localityId).toBe('greenfield');
    expect(activeRes.body.isActive).toBe(true);
  });
});
