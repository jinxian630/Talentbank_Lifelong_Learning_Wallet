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
const VALID_TYPES = ["Hackathon", "Workshop", "Talk", "Others"];

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  const prompt = `You are an event creation assistant for a student learning platform called TalentBank.

An admin wrote this rough description:
"${description}"

Generate a complete event listing. Respond ONLY with valid JSON, no markdown:
{
  "title": "concise event title",
  "description": "polished 1-2 sentence description",
  "type": "one of: Hackathon, Workshop, Talk, Others",
  "emoji": "one emoji that represents the event",
  "badgeShape": "one of: hexagon, star, diamond, circle, square, pentagon",
  "badgeColor": "#hexcolor semantically relevant to event theme",
  "badgeEmoji": "one of: 🏆 🎯 🚀 🔬 💡 🌟 ⚡ 🎨 🔥 💎 🌱 🤝 🏅 🎓 👑 🔮 🌊 ⭐ 🦁 🎪",
  "suggestedCapacity": number or null
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
        temperature: 0.7,
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
      title: result.title ?? "",
      description: result.description ?? "",
      type: VALID_TYPES.includes(result.type) ? result.type : "Others",
      emoji: result.emoji ?? "🎯",
      badgeShape: VALID_SHAPES.includes(result.badgeShape)
        ? result.badgeShape
        : "hexagon",
      badgeColor: /^#[0-9A-Fa-f]{6}$/.test(result.badgeColor)
        ? result.badgeColor
        : "#FBBF24",
      badgeEmoji: VALID_EMOJIS.includes(result.badgeEmoji)
        ? result.badgeEmoji
        : "🏆",
      suggestedCapacity:
        typeof result.suggestedCapacity === "number"
          ? result.suggestedCapacity
          : null,
    });
  } catch {
    return NextResponse.json({
      title: "",
      description: "",
      type: "Others",
      emoji: "🎯",
      badgeShape: "hexagon",
      badgeColor: "#FBBF24",
      badgeEmoji: "🏆",
      suggestedCapacity: null,
    });
  }
}
