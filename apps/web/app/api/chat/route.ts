import { NextRequest, NextResponse } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const { message, context, userName, userInterests } = await req.json();

  // Try RAG service first — falls back to direct Azure if unavailable
  try {
    const ragRes = await fetch(`${AI_SERVICE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        user_name: userName ?? "Student",
        user_interests: userInterests ?? [],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (ragRes.ok) {
      const data = await ragRes.json();
      const reply = (data.reply as string)
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1");
      return NextResponse.json({ reply, source: "rag" });
    }
  } catch {
    // Python service unreachable — fall through to direct Azure
  }

  // Azure direct fallback
  const response = await fetch(
    `${process.env.AZURE_FOUNDRY_ENDPOINT}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_FOUNDRY_API_KEY!,
      },
      body: JSON.stringify({
        model: process.env.AZURE_FOUNDRY_DEPLOYMENT,
        messages: [{ role: "user", content: `${context}\n\nUser: ${message}` }],
        temperature: 0.7,
      }),
    },
  );

  const data = await response.json();
  const raw =
    data.choices?.[0]?.message?.content ?? "Sorry, I couldn't respond!";
  const reply = raw.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
  return NextResponse.json({ reply, source: "direct" });
}
