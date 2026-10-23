import { NextRequest, NextResponse } from "next/server";

const memoryHistoryStore: any[] = [];

export async function GET() {
  return NextResponse.json({ history: memoryHistoryStore });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body || !body.item?.name) {
    return NextResponse.json({ error: "Invalid scan result payload" }, { status: 400 });
  }
  const entry = {
    id: `scan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: body.status,
    item: body.item,
    category: body.category,
    instructions: body.instructions || [],
    evidence: body.evidence || null,
    userCorrection: null
  };
  memoryHistoryStore.unshift(entry);
  return NextResponse.json({ saved: entry }, { status: 201 });
}

export async function DELETE() {
  memoryHistoryStore.length = 0;
  return NextResponse.json({ cleared: true });
}
