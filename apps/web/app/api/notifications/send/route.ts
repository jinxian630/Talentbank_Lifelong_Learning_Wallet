import { NextRequest, NextResponse } from "next/server";

interface SendNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const { tokens, title, body, data }: SendNotificationPayload =
    await req.json();

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const messages = tokens
    .filter((t) => t.startsWith("ExponentPushToken["))
    .map((to) => ({ to, title, body, data: data ?? {}, sound: "default" }));

  if (messages.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  return NextResponse.json({ sent: messages.length, result });
}
