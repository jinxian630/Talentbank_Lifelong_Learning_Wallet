"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter, useParams } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { getEvent, joinEvent, leaveEvent } from "@talentbank/firebase-config";
import { ArrowLeft } from "lucide-react";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-amber-400/10", text: "text-amber-400" },
  Workshop: { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk: { bg: "bg-cyan-400/10", text: "text-cyan-400" },
};

const BADGE_CLIPS: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  circle: "none",
  square: "none",
};

export default function EventDetail() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading]);

  useEffect(() => {
    if (user) fetchEvent();
  }, [user]);

  const fetchEvent = async () => {
    const data = await getEvent(id as string);
    setEvent(data);
  };

  const isJoined = () =>
    event?.pendingParticipants?.some((p: any) => p.uid === user?.uid);
  const isCapReached = () =>
    event?.cap && event?.pendingParticipants?.length >= event?.cap;
  const isRegClosed = () => event?.regDeadline?.toDate() < new Date();

  const handleJoin = async () => {
    await joinEvent(event.id, user);
    fetchEvent();
  };
  const handleLeave = async () => {
    await leaveEvent(event.id, user);
    fetchEvent();
  };

  if (loading || !event)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const typeStyle = TYPE_STYLES[event.type] ?? {
    bg: "bg-green-400/10",
    text: "text-green-400",
  };
  const joined = isJoined();

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3 { font-family: 'Outfit', sans-serif; }`}</style>

      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">
          TB
        </div>
        <span className="font-bold text-white">Event Details</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-5">
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            className="w-full rounded-3xl object-cover max-h-64"
          />
        )}

        <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-6 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-3xl shrink-0`}
            >
              {event.emoji}
            </div>
            <div className="flex flex-col gap-1.5">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit ${typeStyle.bg} ${typeStyle.text}`}
              >
                {event.type}
              </span>
              <h1 className="text-xl font-black text-white">{event.title}</h1>
            </div>
          </div>

          <p className="text-white/60 text-sm leading-relaxed">
            {event.description}
          </p>

          <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-3">
            {[
              {
                label: "📅 Starts",
                value: event.startAt?.toDate().toLocaleString(),
              },
              {
                label: "🏁 Ends",
                value: event.endAt?.toDate().toLocaleString(),
              },
              {
                label: "⏰ Registration closes",
                value: event.regDeadline?.toDate().toLocaleString(),
              },
              ...(event.cap
                ? [
                    {
                      label: "👥 Spots",
                      value: `${event.pendingParticipants?.length ?? 0} / ${event.cap}`,
                    },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-white/40">{label}</span>
                <span className="text-white font-semibold">{value}</span>
              </div>
            ))}
          </div>

          {/* Badge teaser */}
          {joined && event.status !== "completed" && event.badgeShape && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-2xl p-4 flex items-center gap-4">
              <div
                style={{
                  width: 56,
                  height: 56,
                  background: event.badgeColor ?? "#FBBF24",
                  clipPath: BADGE_CLIPS[event.badgeShape] ?? "none",
                  borderRadius:
                    event.badgeShape === "circle"
                      ? "50%"
                      : event.badgeShape === "square"
                        ? "10px"
                        : "0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  boxShadow: `0 4px 20px ${event.badgeColor ?? "#FBBF24"}40`,
                  flexShrink: 0,
                }}
              >
                {event.badgeEmoji ?? "🏆"}
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400">
                  🎖 Complete to earn
                </p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {event.title} Badge
                </p>
                <p className="text-xs text-white/40">
                  Awarded upon admin approval
                </p>
              </div>
            </div>
          )}

          {joined ? (
            <button
              onClick={handleLeave}
              className="w-full bg-red-400/10 text-red-400 py-3.5 rounded-2xl font-bold hover:bg-red-400/20 transition"
            >
              Cancel Registration
            </button>
          ) : isRegClosed() ? (
            <div className="w-full bg-white/5 text-white/20 py-3.5 rounded-2xl font-bold text-center">
              Registration Closed
            </div>
          ) : isCapReached() ? (
            <div className="w-full bg-white/5 text-white/20 py-3.5 rounded-2xl font-bold text-center">
              Event Full
            </div>
          ) : (
            <button
              onClick={handleJoin}
              className="w-full bg-amber-400 text-[#0F0E17] py-3.5 rounded-2xl font-bold hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              Register for Event
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
