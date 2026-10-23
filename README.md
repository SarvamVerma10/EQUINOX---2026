# WasteWise Backend Engine

> Evidence-Grounded AI Waste-Sorting Engine built for the **EQUINOX Hackathon 2026**.

The WasteWise Backend Engine is an API-first, deterministic waste-sorting decision backend. It pairs Google's `@google/genai` multimodal reasoning with strict local municipal waste regulations stored in Firebase Cloud Firestore.

---

## Key Invariants & Anti-Hallucination Architecture

1. **Zero Frontend Drift**: Pure API backend serving strict `/api/v1` contracts.
2. **Anti-Hallucination Guardrail**:
   - Gemini decomposes packaging (body, lid, lining, materials) and determines item characteristics.
   - Candidate rules are retrieved deterministically via lexical and alias matching from the active municipal guide.
   - The final disposal category, preparation steps, and source excerpts **strictly originate from verified rule chunks** of the active local guide.
   - If no local rule chunk explicitly covers the item or condition, the engine deterministically outputs `status: "no_supported_rule"`. It **never invents policies, bins, or quotes**.
3. **5-Stage Deterministic Pipeline**:
   - `Stage 1`: Multimodal Item & Packaging Decomposition (Body, Lid, Liner, Confidence, Resin Codes).
   - `Stage 2`: Ambiguity & Completeness Check (If confidence < 0.7 or ambiguous material: returns `status: "clarification_required"`).
   - `Stage 3`: Deterministic Candidate Rule Retrieval from Firestore by aliases and materials.
   - `Stage 4`: Grounded Evaluation & Validation with strict negative constraints + category verification.
   - `Stage 5`: Snapshot Auditing & History Persistence.

---

## Tech Stack & Runtime

- **Runtime**: Node.js (>= 20.x), TypeScript (strict mode enabled).
- **AI SDK**: `@google/genai` (Gemini 3.8 Flash multimodal model by default).
- **Database**: Firebase Cloud Firestore (Admin SDK) with deterministic in-memory adapter for offline testing.
- **Validation**: Zod (Schema validation for all requests, responses, and LLM structured outputs).
- **File Ingestion**: Multer for PDF/TXT documents and image inputs.
- **Testing**: Vitest + Supertest with deterministic mocks.

---

## Project Structure

```text
├── fixtures/
│   └── sample-guide.json              # Deterministic active guide fixture
├── src/
│   ├── config/
│   │   └── env.ts                     # Zod-validated environment config
│   ├── controllers/
│   │   ├── analyzeController.ts       # /analyze, /clarify, /correction
│   │   ├── guidesController.ts        # /guides, /guides/active
│   │   ├── healthController.ts        # /health
│   │   └── historyController.ts       # /history (session-isolated)
│   ├── middleware/
│   │   ├── errorHandler.ts            # Standard error responses
│   │   ├── session.ts                 # x-session-id enforcement & isolation
│   │   └── upload.ts                  # Multer document & image limits
│   ├── routes/
│   │   └── index.ts                   # /api/v1 routing table
│   ├── services/
│   │   ├── docParser.ts               # Page-aware PDF & TXT extractor
│   │   ├── firestore.ts               # Firestore DB service & in-memory store
│   │   ├── gemini.ts                  # @google/genai multimodal extraction & evaluation
│   │   └── ruleEngine.ts              # Candidate retrieval & grounded verification
│   ├── types/
│   │   ├── domain.ts                  # TypeScript domain models
│   │   └── schemas.ts                 # Zod validation & LLM structured output schemas
│   ├── app.ts                         # Express application setup
│   └── server.ts                      # Server entry point
├── tests/
│   ├── fixtures/
│   │   └── benchmark-items.json       # 18 benchmark test cases
│   ├── helpers/
│   │   └── dbHelper.ts                # Test seeding utilities
│   ├── api.test.ts                    # 12 core test cases & integration tests
│   └── benchmark.test.ts              # Benchmark fixture verification
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

---

## Environment Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the values:
```ini
PORT=8080
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
FIREBASE_PROJECT_ID=wastewise-hackathon
# Optional: path or inline JSON of your Firebase serviceAccountKey.json
FIREBASE_SERVICE_ACCOUNT_KEY=
```

### 3. Build & Run
```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Run local development server with hot reload
npm run dev
```

---

## Running the Automated Test Suite

Run the full Vitest suite (all 18 test cases across all 12 core requirements):
```bash
npm test
```
