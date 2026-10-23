import { NextRequest, NextResponse } from "next/server";
import { analyzeWasteImageWithGemini } from "@/lib/gemini-service";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic"
]);
const MAX_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 5 * 1024 * 1024);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", regionHint } = body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { status: "error", reason: "Missing image payload. Please capture or select a valid photo." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { status: "error", reason: `Unsupported image type '${mimeType}'. Allowed: JPEG, PNG, WebP.` },
        { status: 415 }
      );
    }

    const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json(
        { status: "error", reason: "Uploaded image exceeds the 5 MB safety limit. Please compress or retake." },
        { status: 413 }
      );
    }

    const identification = await analyzeWasteImageWithGemini(imageBase64, mimeType, regionHint);

    return NextResponse.json({
      status: identification.components.length > 1 ? "clarification_needed" : "identified",
      item: {
        name: identification.name,
        material: identification.material,
        components: identification.components,
        confidence: identification.confidence
      },
      detectedItems: identification.detectedItems || [],
      clarificationQuestion: identification.clarificationQuestion,
      reason: null
    });
  } catch (err: any) {
    // Never pretend the AI call succeeded when it failed
    return NextResponse.json(
      {
        status: "error",
        item: { name: "Unidentified item", material: "Unknown", components: [], confidence: "low" },
        category: "unresolved",
        clarificationQuestion: null,
        instructions: [],
        evidence: null,
        reason: err?.message || "AI identification service unavailable. You can retry, retake the photo, or search manually."
      },
      { status: 503 }
    );
  }
}
