import { NextRequest, NextResponse } from "next/server";
import { analyzeWasteImageWithGemini, fallbackUniversalExtraction } from "@/lib/gemini-service";

const MAX_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 8 * 1024 * 1024);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawImage = body.imageBase64 || body.image || body.file;
    const mimeType = body.mimeType || "image/jpeg";
    const textQuery = body.textDescription || body.query || body.itemName || body.productNameHint || body.regionHint;

    // If no image is provided, but a text query was submitted, analyze via universal extractor
    if (!rawImage || typeof rawImage !== "string" || rawImage.trim().length === 0) {
      if (textQuery && typeof textQuery === "string" && textQuery.trim().length > 0) {
        const textResult = fallbackUniversalExtraction(textQuery.trim());
        return NextResponse.json({
          status: textResult.needsClarification ? "clarification_needed" : "identified",
          item: {
            name: textResult.itemName || textResult.name,
            material: textResult.material,
            components: textResult.components,
            confidence: textResult.confidence,
            universalStream: textResult.universalStream,
            customPrepSteps: textResult.customPrepSteps
          },
          clarificationQuestion: textResult.clarificationQuestion,
          reason: null
        });
      }

      return NextResponse.json(
        { status: "error", reason: "Missing image or text payload. Please capture a photo or enter an item description." },
        { status: 400 }
      );
    }

    // Approx size check
    const approxBytes = Math.ceil((rawImage.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json(
        { status: "error", reason: "Uploaded image exceeds safety limit. Please retake or compress." },
        { status: 413 }
      );
    }

    const identification = await analyzeWasteImageWithGemini(rawImage, mimeType, textQuery);

    return NextResponse.json({
      status: identification.needsClarification ? "clarification_needed" : "identified",
      item: {
        name: identification.itemName || identification.name,
        material: identification.material,
        components: identification.components,
        confidence: identification.confidence,
        universalStream: identification.universalStream,
        customPrepSteps: identification.customPrepSteps
      },
      clarificationQuestion: identification.clarificationQuestion,
      reason: null
    });
  } catch (err: any) {
    console.error("Identify route error:", err);
    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "VISION_ERROR",
          message: err?.message || "AI identification service timed out or unavailable."
        },
        item: { name: "Unidentified Item", material: "Unknown", components: [], confidence: "low" },
        category: "unresolved",
        clarificationQuestion: null,
        instructions: [],
        evidence: null,
        reason: err?.message || "AI identification service unavailable."
      },
      { status: 500 }
    );
  }
}
