import { NextRequest, NextResponse } from "next/server";

const VALID_SENTIMENTS = ["positive", "mixed", "negative"];

export async function POST(req: NextRequest) {
  const { feedbackList }: { feedbackList: Array<{ feedback: string }> } =
    await req.json();

  if (!feedbackList || feedbackList.length === 0) {
    return NextResponse.json({
      summary: "No feedback submitted yet.",
      themes: [],
      sentiment: "mixed",
      actionItems: [],
    });
  }

  const feedbackText = feedbackList
    .map((f, i) => `${i + 1}. "${f.feedback}"`)
    .join("\n");

  const prompt = `You are an event feedback analyst for a student learning platform called TalentBank.

Here is the feedback submitted for an event:
${feedbackText}

Analyse this feedback and respond ONLY with valid JSON, no markdown:
{
  "summary": "2-3 sentence overall summary",
  "themes": ["theme1", "theme2", "theme3"],
  "sentiment": "positive or mixed or negative",
  "actionItems": ["actionable improvement 1", "actionable improvement 2"]
}`;

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
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    },
  );

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const result = JSON.parse(cleaned);
    return NextResponse.json({
      summary: result.summary ?? "",
      themes: Array.isArray(result.themes) ? result.themes : [],
      sentiment: VALID_SENTIMENTS.includes(result.sentiment)
        ? result.sentiment
        : "mixed",
      actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
    });
  } catch {
    return NextResponse.json({
      summary: "",
      themes: [],
      sentiment: "mixed",
      actionItems: [],
    });
  }
}
