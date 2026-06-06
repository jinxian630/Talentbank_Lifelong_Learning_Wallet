"use client";
import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

export default function AIChatbot({
  userProfile,
  events,
}: {
  userProfile: any;
  events: any[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const buildContext = () => {
    const interests = userProfile?.interests?.join(", ") || "not specified";
    const skills = userProfile?.skills?.join(", ") || "not specified";
    const upcomingEvents =
      events
        .filter((e) => e.endAt?.toDate() > new Date())
        .map(
          (e) =>
            `- ${e.title} (${e.type}) on ${e.startAt?.toDate().toLocaleDateString()} — ${e.description}`,
        )
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
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Something went wrong, try again!" },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-400/30 hover:bg-amber-300 transition-all hover:scale-110 ${open ? "hidden" : ""}`}
      >
        <MessageCircle size={24} className="text-[#0F0E17]" />
      </button>

      {/* Chat window */}
      {open && (
        // Change the chat window div — was w-80 h-[480px]
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[580px] bg-[#1A1825] border border-white/10 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between bg-[#0F0E17]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center text-sm font-black text-[#0F0E17]">
                AI
              </div>
              <div>
                <p className="text-sm font-bold text-white">TalentBot</p>
                <p className="text-xs text-white/30">Ask me about events!</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/30 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs text-white/30 text-center">
                  Hi! I can recommend events based on your interests 🎯
                </p>
                {[
                  "What events should I join?",
                  "Any AI events coming up?",
                  "What's good for beginners?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/50 hover:text-white px-3 py-2 rounded-xl text-left transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-400 text-[#0F0E17] font-medium rounded-br-sm"
                      : "bg-white/8 text-white/80 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/8">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-base text-white outline-none focus:border-amber-400/50 placeholder:text-white/20"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center hover:bg-amber-300 transition disabled:opacity-30"
              >
                <Send size={15} className="text-[#0F0E17]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
