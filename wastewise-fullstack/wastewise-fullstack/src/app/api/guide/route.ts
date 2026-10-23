import { NextRequest, NextResponse } from "next/server";
import { DEMO_CAMPUS_GUIDE, parseGuideDocumentText } from "@/lib/core-engine.mjs";

let currentActiveGuide: any = DEMO_CAMPUS_GUIDE;
const guideVersionHistory: any[] = [DEMO_CAMPUS_GUIDE];

export async function GET() {
  return NextResponse.json({
    activeGuide: currentActiveGuide,
    versions: guideVersionHistory.map((g) => ({
      id: g.id,
      guideName: g.guideName,
      localityName: g.localityName,
      issuingAuthority: g.issuingAuthority,
      version: g.version,
      effectiveDate: g.effectiveDate,
      isDemo: g.isDemo,
      ruleCount: g.rules?.length || 0
    }))
  });
}

export async function POST(req: NextRequest) {
  const adminToken = req.headers.get("x-admin-token");
  const expectedToken = process.env.WASTEWISE_ADMIN_TOKEN || "CHANGE_ME_ADMIN_PASSCODE";
  if (adminToken !== expectedToken) {
    return NextResponse.json(
      { status: "error", reason: "Unauthorized: Valid x-admin-token header required for guide management." },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { action, rawText, localityName, guideName, issuingAuthority, version, effectiveDate, isDemo } = body || {};

  const parsed = parseGuideDocumentText({
    rawText,
    localityName,
    guideName,
    issuingAuthority,
    version,
    effectiveDate,
    isDemo
  });

  if (parsed.status === "extraction_failed" || !parsed.guide) {
    return NextResponse.json(parsed, { status: 422 });
  }

  if (action === "activate") {
    parsed.guide.isActive = true;
    currentActiveGuide = parsed.guide;
    guideVersionHistory.unshift(parsed.guide);
  }

  return NextResponse.json({
    status: action === "activate" ? "activated" : "preview_ready",
    warnings: parsed.warnings,
    guide: parsed.guide
  });
}
