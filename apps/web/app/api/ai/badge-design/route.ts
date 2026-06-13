import { NextRequest, NextResponse } from "next/server";

const VALID_SHAPES = [
  "hexagon",
  "star",
  "diamond",
  "circle",
  "square",
  "pentagon",
];
const VALID_EMOJIS = [
  "🏆","🎯","🚀","🔬","💡","🌟","⚡","🎨","🔥","💎",
  "🌱","🤝","🏅","🎓","👑","🔮","🌊","⭐","🦁","🎪",
];

export async function POST(req: NextRequest) {
  const { title, description, type } = await req.json();

  const prompt = `You are a badge designer for a student learning platform called TalentBank. Design a badge for the following event.

Event Title: ${title}
Event Type: ${type}
Event Description: ${description}

Choose from these exact options:
- Shape: one of ${VALID_SHAPES.join(", ")}
- Color: a hex color string (e.g. #FBBF24) that is semantically appropriate for the event theme
- Emoji: one of ${VALID_EMOJIS.join(" ")}

Respond ONLY with a valid JSON object, no markdown, no explanation:
{"badgeShape":"...","badgeColor":"...","badgeEmoji":"...","reasoning":"one sentence why"}`;

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
        temperature: 0.8,
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
      badgeShape: VALID_SHAPES.includes(result.badgeShape)
        ? result.badgeShape
        : "hexagon",
      badgeColor: /^#[0-9A-Fa-f]{6}$/.test(result.badgeColor)
        ? result.badgeColor
        : "#FBBF24",
      badgeEmoji: VALID_EMOJIS.includes(result.badgeEmoji)
        ? result.badgeEmoji
        : "🏆",
      reasoning: result.reasoning ?? "",
    });
  } catch {
    return NextResponse.json({
      badgeShape: "hexagon",
      badgeColor: "#FBBF24",
      badgeEmoji: "🏆",
      reasoning: "",
    });
  }
}
