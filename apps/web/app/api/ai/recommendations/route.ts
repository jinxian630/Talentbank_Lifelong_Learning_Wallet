import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const { uid } = await req.json();

  if (!uid) {
    return NextResponse.json({ recommendations: [] });
  }

  try {
    const res = await fetch(`${AI_SERVICE}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return NextResponse.json({ recommendations: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ recommendations: [] });
  }
}
