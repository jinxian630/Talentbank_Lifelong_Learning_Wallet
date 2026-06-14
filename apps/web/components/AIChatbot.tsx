"use client";
import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

export default function AIChatbot({ userProfile, events }: { userProfile: any; events: any[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const buildContext = () => {
    const interests = userProfile?.interests?.join(", ") || "not specified";
    const skills = userProfile?.skills?.join(", ") || "not specified";
    const upcomingEvents =
      events.filter((e) => e.endAt?.toDate() > new Date())
        .map((e) => `- ${e.title} (${e.type}) on ${e.startAt?.toDate().toLocaleDateString()} — ${e.description}`)
        .join("\n") || "No upcoming events";
    return `You are a helpful career and learning assistant for TalentBank Badges, a platform that helps students earn verified badges from events.

Student profile:
- Interests: ${interests}
- Skills: ${skills}

Upcoming events available:
${upcomingEvents}

Your job is to:
1. Recommend relevant events based on the student's interests and skills
2. Answer questions about events
3. Give friendly career/learning advice
4. Be friendly, warm and encouraging — like a helpful senior student, not a robot
5. Keep responses conversational and natural — 3-4 sentences max
6. CRITICAL: Always finish what you start. Never begin a sentence you can't complete. If you have a lot to say, summarise instead of listing everything out.
7. You can recommend multiple events but keep it brief — mention 2-3 max and why they'd suit the student
8. Don't be pushy, be genuinely helpful`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, context: buildContext() }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Something went wrong, try again!" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label="Open XP Career Wallet chat"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-110 ${open ? "hidden" : ""}`}
        style={{ backgroundColor: "var(--color-primary-orange)", boxShadow: "0 8px 24px rgba(232,146,60,0.35)" }}
      >
        <MessageCircle size={24} className="text-white" />
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[580px] rounded-3xl flex flex-col shadow-2xl overflow-hidden"
          style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}>
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "var(--color-bg-cream)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-extrabold text-white"
                style={{ backgroundColor: "var(--color-primary-orange)" }}>🤖</div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-text-dark)" }}>XP Career Wallet</p>
                <p className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>AI Event Advisor</p>
              </div>
            </div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.4)" }}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--color-bg-cream)" }}>
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs text-center" style={{ color: "rgba(58,51,44,0.4)" }}>
                  Hi! I can recommend events based on your interests 🎯
                </p>
                {["What events should I join?", "Any AI events coming up?", "What's good for beginners?"].map((q) => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-xs px-3 py-2 rounded-xl text-left transition"
                    style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)", color: "rgba(58,51,44,0.6)" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={msg.role === "user"
                    ? { backgroundColor: "var(--color-primary-orange)", color: "#fff", borderBottomRightRadius: 4 }
                    : { backgroundColor: "#fff", color: "var(--color-text-dark)", border: "1px solid var(--color-shadow-grey)", borderBottomLeftRadius: 4 }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ backgroundColor: "var(--color-primary-orange)", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3" style={{ borderTop: "1px solid var(--color-shadow-grey)" }}>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: "var(--color-bg-cream)",
                  border: "1px solid var(--color-shadow-grey)",
                  color: "var(--color-text-dark)",
                }}
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button type="button" aria-label="Send message" onClick={handleSend} disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-30 text-white"
                style={{ backgroundColor: "var(--color-primary-orange)" }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
