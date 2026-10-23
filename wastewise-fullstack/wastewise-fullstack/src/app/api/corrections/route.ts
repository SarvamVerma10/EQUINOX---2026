import { NextRequest, NextResponse } from "next/server";
import { applyUserCorrectionToRecord } from "@/lib/core-engine.mjs";

const correctionQueue: any[] = [];

export async function GET() {
  return NextResponse.json({ queue: correctionQueue });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { record, correctionInput } = body || {};
    const { updatedRecord, queueEntry } = applyUserCorrectionToRecord(record, correctionInput);
    correctionQueue.unshift(queueEntry);
    return NextResponse.json({
      status: "queued_for_review",
      message: "Thank you. Your correction was saved to your scan record and queued for administrator verification without altering the official local guide.",
      updatedRecord,
      queueEntry
    });
  } catch (err: any) {
    return NextResponse.json({ status: "error", reason: err?.message || "Invalid correction request" }, { status: 400 });
  }
}
