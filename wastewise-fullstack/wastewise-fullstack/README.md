# WasteWise — Know it. Sort it. Save it.

**WasteWise** is a mobile-first, full-stack web application that helps students, residents, and working professionals identify waste items using their phone camera or uploaded photos, clarify multi-part packaging, and verify disposal instructions strictly against an approved local waste-management guide.

---

## 1. What Works Out of the Box vs. What Requires Credentials

### Works Immediately (Zero External Keys Required)
- **Live Camera Scanning & Capture Flow**: Uses browser `navigator.mediaDevices.getUserMedia` (rear camera `environment` by default on mobile), front/rear camera switching, hardware torch/flashlight detection, live photo preview, retake, client-side image compression, and real-time brightness/blur quality diagnostics.
- **Mobile & Desktop Image Fallback**: `<input type="file" accept="image/*" capture="environment">` and gallery upload when camera permissions are denied or unavailable.
- **Multi-Item Region Selector & Multi-Part Clarification**: Interactive item region picker when a photo contains multiple items, and targeted part clarification (e.g., *"Which part are you disposing of?"* for an Instant Noodle Packet's outer plastic wrapper vs. inner foil seasoning sachet).
- **Local Guide Upload, Parser, Rule Retriever & Contradiction Engine**: Upload custom `.txt` / `.md` / `.json` local waste guides, preview extracted rules with page numbers and section headings, inspect extraction warnings, and activate or switch guide versions.
- **Conspicuously Labeled Demo Guide**: Ships with a pre-configured development guide clearly labeled **`Demo — Not verified local guidance`** so every flow can be tested immediately.
- **Four Mandatory Color-Coded Categories**:
  - **Green (`#1F8A4C` → `#69B578`)**: Biodegradable / Wet Waste
  - **Blue (`#1769AA` → `#5BA7E8`)**: Dry Waste / Potentially Recyclable
  - **Red (`#B4232F` → `#F26B73`)**: Hazardous / Special Handling Alert (explicitly distinguishes e-waste, batteries, sharps/biomedical, and chemical routes rather than instructing users to use a generic physical red bin)
  - **Grey (`#667085` → `#D0D5DD`)**: Unresolved / Needs Clarification (displays *"Could not verify the correct disposal category from the selected local guide"* when evidence is missing or conflicting)
- **Guest Scan History & Non-Destructive Corrections**: Saved in browser `localStorage` (with explicit privacy controls) plus an administrator Correction Review Queue that preserves original AI records alongside user corrections.
- **Bilingual UI**: Instant toggle between **English** and **हिन्दी (Hindi)**.
- **Automated Test Suite**: 16 unit and integration tests covering camera permissions, AI identification, blurry images, guide matching, missing guides, conflicting rules, multi-part packaging, special-handling warnings, history, corrections, and API failures.

### Requires External Credentials for Production Deployment
1. **Live Google Gemini Multimodal API (`GEMINI_API_KEY`)**: Required on the server (`POST /api/identify`) to run live cloud vision inference on arbitrary new camera photos via `@google/genai`. You can also enter a Gemini API key in the app's **Settings → Live Gemini API** panel for direct testing.
2. **Supabase PostgreSQL (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)**: Required if you want cross-device account-based history and cloud persistence beyond browser `localStorage` and server memory. SQL migrations with Row-Level Security (RLS) are provided in `supabase/migrations/001_initial_schema.sql`.
3. **Official Campus / Municipal Guide Document**: Replace the built-in `Demo — Not verified local guidance` seed fixture by uploading your institution's official waste-management guide in the **Guide Admin** panel.

---

## 2. Quick Start & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY (and optional Supabase credentials)

# 3. Run the automated 16-scenario test suite
npm test

# 4. Start the Next.js development server
npm run dev
```

Open `http://localhost:3000` on your phone or desktop browser.

---

## 3. Local Guide Setup Walkthrough (Administrator)

1. Open WasteWise and navigate to **Settings / Guide Admin** (or click the active guide badge in the top header).
2. Enter your **Locality / Campus Name**, **Guide Title**, **Issuing Authority**, **Version**, and **Effective Date**.
3. Upload or paste your official guide text using `[Page N]` markers, `Section X.Y` headings, and `RULE:` definitions:
   ```text
   [Page 4]
   Section 2.1 — Wet & Biodegradable Kitchen Waste
   RULE: items: banana peel, fruit peel, food scraps | materials: organic, plant matter | category: biodegradable | subtype: food_organic | instructions: Drain liquid; Remove stickers; Place in Wet Bin | bin: Green Municipal Wet Bin | excerpt: All raw fruit peels and un-packaged food scraps must be segregated into the Biodegradable (Wet Waste) stream.
   ```
4. Click **Preview Extracted Rules** to inspect extracted rules and verify there are no extraction errors or conflicting rules.
5. Click **Activate Approved Guide** to make it the active rule source for all scans. Previous guide versions remain preserved for historical scan references.

---

## 4. Troubleshooting Camera Permissions & API Errors

- **Camera Permission Denied (`NotAllowedError`)**:
  - On iOS Safari / Android Chrome, tap the lock or camera icon in the address bar, set **Camera** to **Allow**, and reload.
  - Even if permission remains blocked, WasteWise automatically switches to the **Camera / Gallery File Input Fallback** so you are never blocked from scanning.
- **Camera Requires HTTPS (`InsecureContext`)**:
  - Mobile browsers block `navigator.mediaDevices.getUserMedia` on plain `http://` LAN IPs (except `http://localhost`). Use `https://` or a local tunnel when testing live WebRTC video on a physical phone.
- **Gemini API Error (`503 Service Unavailable` / Missing Key)**:
  - Verify `GEMINI_API_KEY` is set in `.env.local` on the server (or configured in **Settings**). WasteWise will never invent a fake AI identification when the provider fails; it displays a clear error with Retry, Retake, and Manual Search options.
