import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_CAMPUS_GUIDE,
  evaluateDisposalWithGuide,
  validateDisposalResponseSchema
} from "@/lib/core-engine.mjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identification, selectedComponent, customGuide } = body || {};

    if (identification) {
      identification.material = identification.material || 'General Material';
      identification.confidence = ['high', 'medium', 'low'].includes(identification.confidence)
        ? identification.confidence
        : 'high';
      identification.components = Array.isArray(identification.components)
        ? identification.components
        : [];
    }

    if (!identification || typeof identification.name !== "string") {
      return NextResponse.json(
        { status: "error", reason: "Valid item identification is required before checking the local guide." },
        { status: 400 }
      );
    }

    const activeGuide = customGuide !== undefined ? customGuide : DEMO_CAMPUS_GUIDE;
    const result = evaluateDisposalWithGuide({
      identification,
      selectedComponent: selectedComponent || null,
      activeGuide
    });

    const validation = validateDisposalResponseSchema(result);
    if (!validation.valid) {
      return NextResponse.json(
        {
          status: "error",
          reason: `Schema validation failed: ${validation.errors.join("; ")}`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        item: { name: "Unknown", material: "Unknown", components: [], confidence: "low" },
        category: "unresolved",
        clarificationQuestion: null,
        instructions: [],
        evidence: null,
        reason: err?.message || "Failed to evaluate local disposal guide."
      },
      { status: 500 }
    );
  }
}
