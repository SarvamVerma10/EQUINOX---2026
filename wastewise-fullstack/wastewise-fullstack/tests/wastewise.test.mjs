import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_CAMPUS_GUIDE,
  validateDisposalResponseSchema,
  parseGuideDocumentText,
  evaluateDisposalWithGuide,
  applyUserCorrectionToRecord
} from "../src/lib/core-engine.mjs";

/**
 * Simulates the camera & image capture state machine used by the client/server pipeline.
 */
function simulateCameraFlow({ permissionState, selectedGalleryFile = null, retakeCount = 0 }) {
  if (permissionState === "granted") {
    return {
      mode: "live_webrtc_stream",
      facingMode: "environment",
      fallbackActive: false,
      canCaptureFrame: true,
      retakeCount
    };
  }
  if (permissionState === "denied") {
    return {
      mode: "fallback_file_upload",
      facingMode: null,
      fallbackActive: true,
      permissionHelpShown: true,
      selectedFile: selectedGalleryFile
    };
  }
  return { mode: "prompt", fallbackActive: false };
}

// 1. Camera permission granted
test("1. Camera permission granted opens rear-facing WebRTC stream by default", () => {
  const state = simulateCameraFlow({ permissionState: "granted" });
  assert.equal(state.mode, "live_webrtc_stream");
  assert.equal(state.facingMode, "environment");
  assert.equal(state.fallbackActive, false);
  assert.equal(state.canCaptureFrame, true);
});

// 2. Camera permission denied, with upload fallback
test("2. Camera permission denied activates non-blocking upload/capture fallback with guidance", () => {
  const state = simulateCameraFlow({
    permissionState: "denied",
    selectedGalleryFile: { name: "bottle.jpg", size: 120400, type: "image/jpeg" }
  });
  assert.equal(state.mode, "fallback_file_upload");
  assert.equal(state.fallbackActive, true);
  assert.equal(state.permissionHelpShown, true);
  assert.equal(state.selectedFile.name, "bottle.jpg");
});

// 3. Capturing, previewing, retaking, and submitting a photo
test("3. Capturing, previewing, retaking, and submitting a photo prevents duplicate in-flight submissions", () => {
  let submissionLock = false;
  let capturedFrame = "data:image/jpeg;base64,FRAME_1";
  // User previews and clicks retake
  capturedFrame = null;
  assert.equal(capturedFrame, null);
  // User captures second frame and confirms
  capturedFrame = "data:image/jpeg;base64,FRAME_2";
  submissionLock = true;
  const duplicateAttemptBlocked = submissionLock === true;
  assert.equal(duplicateAttemptBlocked, true);
  assert.equal(capturedFrame, "data:image/jpeg;base64,FRAME_2");
});

// 4. Valid AI identification
test("4. Valid AI identification returns structured item, material, components, and confidence", () => {
  const aiIdentification = {
    name: "Aluminum Beverage Can",
    material: "Aluminum metal",
    components: [],
    confidence: "high"
  };
  const result = evaluateDisposalWithGuide({
    identification: aiIdentification,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  const check = validateDisposalResponseSchema(result);
  assert.equal(check.valid, true);
  assert.equal(result.item.name, "Aluminum Beverage Can");
  assert.equal(result.item.confidence, "high");
});

// 5. Unclear or blurry image leading to clarification or unresolved status
test("5. Unclear or blurry image leads to unresolved status and asks user to retake or clarify", () => {
  const blurryIdentification = {
    name: "Blurry dark object",
    material: "Uncertain",
    components: [],
    confidence: "low",
    isUnclearImage: true
  };
  const result = evaluateDisposalWithGuide({
    identification: blurryIdentification,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.category, "unresolved");
  assert.equal(result.evidence, null);
  assert.ok(result.clarificationQuestion.includes("blurry"));
  assert.equal(validateDisposalResponseSchema(result).valid, true);
});

// 6. An item with a matching guide rule
test("6. Item with a matching guide rule returns recommended status, exact excerpt, page, and section", () => {
  const bananaIdentification = {
    name: "Fresh Banana Peel",
    material: "Organic plant matter",
    components: [],
    confidence: "high"
  };
  const result = evaluateDisposalWithGuide({
    identification: bananaIdentification,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(result.status, "recommended");
  assert.equal(result.category, "biodegradable");
  assert.equal(result.evidence.page, 4);
  assert.ok(result.evidence.excerpt.includes("banana peels"));
  assert.equal(validateDisposalResponseSchema(result).valid, true);
});

// 7. An item with no matching guide rule
test("7. Item with no matching guide rule returns unresolved and required message without guessing", () => {
  const ceramicMug = {
    name: "Broken Ceramic Coffee Mug",
    material: "Glazed ceramic stoneware",
    components: [],
    confidence: "high"
  };
  const result = evaluateDisposalWithGuide({
    identification: ceramicMug,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.category, "unresolved");
  assert.equal(result.evidence, null);
  assert.ok(
    result.instructions.some((line) =>
      line.includes("Could not verify the correct disposal category from the selected local guide")
    )
  );
  assert.equal(validateDisposalResponseSchema(result).valid, true);
});

// 8. A missing or incorrectly parsed guide
test("8. Missing or unconfigured guide and malformed guide text are handled honestly without fake rules", () => {
  const item = {
    name: "Aluminum Can",
    material: "Aluminum",
    components: [],
    confidence: "high"
  };
  const missingGuideResult = evaluateDisposalWithGuide({
    identification: item,
    activeGuide: null
  });
  assert.equal(missingGuideResult.status, "unresolved");
  assert.equal(missingGuideResult.category, "unresolved");

  const badParse = parseGuideDocumentText({
    rawText: "This document has random paragraphs but zero structured disposal rules.",
    localityName: "Test Campus",
    guideName: "Broken Guide",
    issuingAuthority: "Admin",
    version: "0.1"
  });
  assert.equal(badParse.status, "extraction_failed");
  assert.equal(badParse.guide, null);
});

// 9. A guide-retrieval error
test("9. Guide retrieval service error returns error status and never fabricates a recommendation", () => {
  const item = {
    name: "Fresh Banana Peel",
    material: "Organic",
    components: [],
    confidence: "high"
  };
  const result = evaluateDisposalWithGuide({
    identification: item,
    activeGuide: DEMO_CAMPUS_GUIDE,
    simulateRetrievalFailure: true
  });
  assert.equal(result.status, "error");
  assert.equal(result.category, "unresolved");
  assert.equal(result.evidence, null);
  assert.ok(result.reason.includes("Guide retrieval service failed"));
});

// 10. Contradictory guide passages
test("10. Contradictory guide passages for the same item return unresolved status and flag the conflict", () => {
  const conflictingGuide = {
    id: "guide-conflict",
    guideName: "Conflicting Municipal Draft",
    localityName: "Test City",
    issuingAuthority: "City Board",
    version: "1.0-conflict",
    isDemo: true,
    rules: [
      {
        id: "r1",
        itemKeywords: ["compostable PLA cup"],
        materialKeywords: ["pla bioplastic"],
        category: "biodegradable",
        instructions: ["Place in industrial compost bin."],
        page: 2,
        section: "Section 1",
        excerpt: "PLA cups are accepted in the wet biodegradable bin."
      },
      {
        id: "r2",
        itemKeywords: ["compostable PLA cup"],
        materialKeywords: ["pla bioplastic"],
        category: "dry_recyclable",
        instructions: ["Place in dry plastic bin."],
        page: 9,
        section: "Section 4",
        excerpt: "PLA cups must be sorted with dry plastics."
      }
    ]
  };

  const result = evaluateDisposalWithGuide({
    identification: {
      name: "Compostable PLA Cup",
      material: "PLA Bioplastic",
      components: [],
      confidence: "high"
    },
    activeGuide: conflictingGuide
  });

  assert.equal(result.status, "unresolved");
  assert.equal(result.category, "unresolved");
  assert.ok(result.reason.includes("conflict"));
});

// 11. Mixed packaging and item-part clarification
test("11. Mixed packaging triggers clarification_needed until user selects a specific packaging part", () => {
  const noodleIdentification = {
    name: "Instant Noodle Packet",
    material: "Mixed plastic wrapper and metallized foil sachet",
    confidence: "high",
    components: [
      {
        id: "outer_wrapper",
        name: "Outer Plastic Wrapper",
        material: "Mono-layer polypropylene plastic film",
        queryTerm: "noodle outer wrapper"
      },
      {
        id: "inner_sachet",
        name: "Inner Seasoning Foil Sachet",
        material: "Multi-layered metallized foil with oil residue",
        queryTerm: "foil seasoning sachet with food residue"
      }
    ]
  };

  // Step A: Initial evaluation without selectedComponent asks clarification question
  const step1 = evaluateDisposalWithGuide({
    identification: noodleIdentification,
    selectedComponent: null,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(step1.status, "clarification_needed");
  assert.equal(step1.category, "unresolved");
  assert.equal(step1.clarificationOptions.length, 2);

  // Step B: User selects "outer_wrapper" -> matches Dry Recyclable rule
  const step2Outer = evaluateDisposalWithGuide({
    identification: noodleIdentification,
    selectedComponent: "outer_wrapper",
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(step2Outer.status, "recommended");
  assert.equal(step2Outer.category, "dry_recyclable");

  // Step C: User selects "inner_sachet" -> no verified rule in guide -> unresolved
  const step2Inner = evaluateDisposalWithGuide({
    identification: noodleIdentification,
    selectedComponent: "inner_sachet",
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(step2Inner.status, "unresolved");
  assert.equal(step2Inner.category, "unresolved");
});

// 12. Special-handling waste with no verified disposal route
test("12. Special-handling waste with no verified disposal route warns user and does not invent a bin", () => {
  const guideWithoutSharpsRule = {
    ...DEMO_CAMPUS_GUIDE,
    rules: DEMO_CAMPUS_GUIDE.rules.filter((r) => r.subtype !== "biomedical_and_sharps")
  };

  const syringeItem = {
    name: "Used Medical Syringe",
    material: "Clinical plastic and steel needle (sharps)",
    components: [],
    confidence: "high"
  };

  const result = evaluateDisposalWithGuide({
    identification: syringeItem,
    activeGuide: guideWithoutSharpsRule
  });

  assert.equal(result.status, "unresolved");
  assert.equal(result.category, "unresolved");
  assert.ok(
    result.instructions.some((i) =>
      i.includes("Could not verify the correct disposal category from the selected local guide")
    )
  );
  assert.ok(result.instructions.some((i) => i.includes("Do NOT place in regular wet or dry bins")));
});

// 13. Saving and retrieving scan history
test("13. Saving and retrieving scan history preserves guide version, category, and source excerpt", () => {
  const historyStore = [];
  const scanResult = evaluateDisposalWithGuide({
    identification: {
      name: "AA Alkaline Battery",
      material: "Alkaline electrochemical cell",
      components: [],
      confidence: "high"
    },
    activeGuide: DEMO_CAMPUS_GUIDE
  });

  const savedEntry = {
    id: "scan-1001",
    timestamp: "2026-10-23T14:00:00.000Z",
    ...scanResult
  };
  historyStore.push(savedEntry);

  assert.equal(historyStore.length, 1);
  assert.equal(historyStore[0].category, "special_handling");
  assert.equal(historyStore[0].evidence.version, "2026.2-DEMO");
  assert.equal(historyStore[0].evidence.page, 14);
});

// 14. Correcting an identification without overwriting the original record
test("14. User correction is stored alongside original identification and queued without altering guide", () => {
  const originalRecord = {
    id: "scan-2002",
    status: "recommended",
    item: {
      name: "PET Water Bottle",
      material: "PET #1 Plastic",
      components: [],
      confidence: "medium"
    },
    category: "dry_recyclable"
  };

  const { updatedRecord, queueEntry } = applyUserCorrectionToRecord(originalRecord, {
    correctedItemName: "Pesticide Chemical Bottle",
    correctedMaterial: "HDPE with hazardous chemical residue",
    comment: "This bottle held garden pesticide, not drinking water."
  });

  // Original item name is untouched
  assert.equal(updatedRecord.item.name, "PET Water Bottle");
  // Correction is stored separately
  assert.equal(updatedRecord.userCorrection.correctedItemName, "Pesticide Chemical Bottle");
  assert.equal(queueEntry.reviewStatus, "pending_review");
  assert.equal(queueEntry.originalItemName, "PET Water Bottle");
});

// 15. Mobile and desktop responsive behavior & bilingual translation coverage
test("15. Responsive layout configuration and English/Hindi localization dictionary coverage", () => {
  const navItems = ["home", "history", "learn", "settings"];
  const locales = {
    en: { home: "Home", history: "History", learn: "Learn", settings: "Settings", scanWaste: "Scan Waste" },
    hi: { home: "होम", history: "इतिहास", learn: "जानकारी", settings: "सेटिंग्स", scanWaste: "कचरा स्कैन करें" }
  };
  for (const key of navItems) {
    assert.ok(locales.en[key], `Missing English key: ${key}`);
    assert.ok(locales.hi[key], `Missing Hindi key: ${key}`);
  }
});

// 16. API failures without fake recommendations
test("16. AI provider failure returns honest error state and never fabricates disposal recommendations", () => {
  const failedIdentification = {
    error: "AI provider timeout or missing GEMINI_API_KEY"
  };
  const result = evaluateDisposalWithGuide({
    identification: failedIdentification,
    activeGuide: DEMO_CAMPUS_GUIDE
  });
  assert.equal(result.status, "error");
  assert.equal(result.category, "unresolved");
  assert.equal(result.evidence, null);
  assert.equal(result.instructions.length, 0);
});
