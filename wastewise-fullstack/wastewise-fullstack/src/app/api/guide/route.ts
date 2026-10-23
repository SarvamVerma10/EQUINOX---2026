import { NextRequest, NextResponse } from "next/server";
import { parseGuideDocumentText } from "@/lib/core-engine.mjs";
import { activateGuide, getActiveGuide, getGuideVersions } from "@/lib/guide-store";

export async function GET() {
  const activeGuide = getActiveGuide();
  return NextResponse.json({
    activeGuide,
    versions: getGuideVersions().map((g) => ({
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
    activateGuide(parsed.guide);
  }

  return NextResponse.json({
    status: action === "activate" ? "activated" : "preview_ready",
    warnings: parsed.warnings,
    guide: parsed.guide
  });
}
