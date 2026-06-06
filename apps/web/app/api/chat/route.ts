import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, context } = await req.json();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${context}\n\nUser: ${message}` }] }],
        generationConfig: { temperature: 0.7 },
      }),
    },
  );

  const data = await response.json();
  const raw =
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    "Sorry, I couldn't respond!";
  const reply = raw.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
  return NextResponse.json({ reply });
}
