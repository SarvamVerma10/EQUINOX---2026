import test from "node:test";
import assert from "node:assert/strict";
import {
  fallbackUniversalExtraction,
  isGeminiModelNotFound,
  isGeminiModelOverloaded,
  isGeminiModelTimedOut,
  selectAvailableFlashModels
} from "../src/lib/gemini-service.ts";

test("Gemini model fallback is limited to temporary overload errors", () => {
  assert.equal(isGeminiModelOverloaded({ status: 503 }), true);
  assert.equal(
    isGeminiModelOverloaded(new Error('{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}')),
    true
  );
  assert.equal(isGeminiModelOverloaded(new Error("This operation was aborted")), false);
  assert.equal(isGeminiModelOverloaded(new Error('{"error":{"code":401,"status":"UNAUTHENTICATED"}}')), false);
  assert.equal(isGeminiModelTimedOut(new Error('{"error":{"code":504,"status":"DEADLINE_EXCEEDED"}}')), true);
  assert.equal(isGeminiModelTimedOut(new Error("This operation was aborted")), true);
  assert.equal(isGeminiModelTimedOut(new Error('{"error":{"code":401,"status":"UNAUTHENTICATED"}}')), false);
});

test("Gemini fallbacks select available supported Flash models, never retired or primary models", () => {
  const models = [
    { name: "models/gemini-2.5-flash", supportedActions: ["generateContent"] },
    { name: "models/gemini-3.8-flash-tts", supportedActions: ["generateContent"] },
    { name: "models/gemini-3.8-flash-preview", supportedActions: ["generateContent"] },
    { name: "models/gemini-3.1-flash-lite", supportedActions: ["generateContent"] },
    { name: "models/gemini-3.7-flash", supportedActions: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedActions: ["generateContent"] },
    { name: "models/gemini-4.0-flash", supportedActions: ["embedContent"] }
  ];

  assert.deepEqual(
    selectAvailableFlashModels(models, "gemini-3.8-flash"),
    ["gemini-3.1-flash-lite", "gemini-3.7-flash"]
  );
  assert.deepEqual(
    selectAvailableFlashModels(models, "models/gemini-3.1-flash-lite"),
    ["gemini-3.8-flash", "gemini-3.7-flash"]
  );
  assert.equal(
    selectAvailableFlashModels([{ name: "gemini-2.5-flash", supportedActions: ["generateContent"] }], "gemini-3.8-flash").length,
    0
  );
});

test("retired Gemini model errors are recognized for clear handling", () => {
  assert.equal(isGeminiModelNotFound(new Error('{"error":{"code":404,"status":"NOT_FOUND"}}')), true);
  assert.equal(isGeminiModelNotFound(new Error("This operation was aborted")), false);
});

test("offline identification maps common materials to distinct broad waste streams", () => {
  const examples = [
    ["AA alkaline battery", "HAZARDOUS_EWASTE"],
    ["old smartphone", "HAZARDOUS_EWASTE"],
    ["pesticide container", "HAZARDOUS_EWASTE"],
    ["medicine blister pack", "MEDICAL_SANITARY"],
    ["used cotton shirt", "TEXTILE_DONATION"],
    ["broken ceramic plate", "CONSTRUCTION_INERT"],
    ["window glass", "CONSTRUCTION_INERT"],
    ["plastic grocery bag", "SOFT_PLASTIC_SPECIAL"],
    ["clean PET #1 water bottle", "RECYCLABLE_CLEAN"],
    ["aluminum can", "RECYCLABLE_CLEAN"],
    ["banana fruit peel", "COMPOST_ORGANIC"],
    ["greasy cardboard pizza box", "COMPOST_ORGANIC"]
  ];

  for (const [description, expectedStream] of examples) {
    const result = fallbackUniversalExtraction(description);
    assert.equal(result.universalStream, expectedStream, description);
    assert.notEqual(result.universalStream, "UNRESOLVED", description);
  }
});

test("unknown material remains unresolved instead of being guessed as landfill", () => {
  const result = fallbackUniversalExtraction("unmarked industrial composite fragment");

  assert.equal(result.universalStream, "UNRESOLVED");
  assert.equal(result.confidence, "low");
  assert.equal(result.isUnclearImage, true);
  assert.deepEqual(result.customPrepSteps, []);
});

test("battery descriptions do not invent a specific battery chemistry", () => {
  const result = fallbackUniversalExtraction("used battery");

  assert.equal(result.universalStream, "HAZARDOUS_EWASTE");
  assert.match(result.material, /not identified/i);
  assert.doesNotMatch(result.material, /LiFePO4|Lithium Iron Phosphate/i);
});
