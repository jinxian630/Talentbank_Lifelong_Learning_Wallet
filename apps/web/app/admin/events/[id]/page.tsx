"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@talentbank/firebase-config";
import { isAdmin } from "@talentbank/firebase-config";
import {
  getEvent,
  updateParticipantStatus,
  approveAll,
  awardBadge,
  revokeBadge,
} from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import {
  LogOut,
  CheckCircle,
  XCircle,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

const BADGE_SHAPES = ["hexagon", "star", "diamond", "circle", "square"];
const EMOJI_LIST = [
  "🏆",
  "🎯",
  "🚀",
  "🔬",
  "💡",
  "🌟",
  "⚡",
  "🎨",
  "🔥",
  "💎",
  "🛡️",
  "🌱",
  "🤝",
  "🏅",
  "🎓",
  "👑",
  "🔮",
  "🌊",
  "⭐",
  "🦁",
];

export default function AttendancePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [badgeDesign, setBadgeDesign] = useState({
    shape: "hexagon",
    color: "#FBBF24",
    emoji: "🏆",
  });

  useEffect(() => {
    if (!loading && !user) router.push("/");
    if (!loading && user && !isAdmin(user.email!)) router.push("/dashboard");
  }, [user, loading]);

  useEffect(() => {
    if (user) fetchEvent();
  }, [user]);

  const fetchEvent = async () => {
    const data = await getEvent(id as string);
    setEvent(data);
  };

  const handleStatus = async (uid: string, status: "approved" | "rejected") => {
    const participant = event.pendingParticipants.find(
      (p: any) => p.uid === uid,
    );
    const wasApproved = participant.status === "approved";
    await updateParticipantStatus(id as string, uid, status);
    if (status === "approved" && !wasApproved) {
      await awardBadge(id as string, event.title, participant, {
        shape: event.badgeShape ?? "hexagon",
        color: event.badgeColor ?? "#FBBF24",
        emoji: event.badgeEmoji ?? "🏆",
      });
    } else if (status === "rejected" && wasApproved) {
      await revokeBadge(id as string, uid);
    }
    fetchEvent();
  };

  const handleApproveAll = async () => {
    if (!confirm("Approve all pending participants?")) return;
    await approveAll(id as string);
    const pending = event.pendingParticipants.filter(
      (p: any) => p.status !== "rejected",
    );
    for (const p of pending) {
      await awardBadge(id as string, event.title, p, {
        shape: event.badgeShape ?? "hexagon",
        color: event.badgeColor ?? "#FBBF24",
        emoji: event.badgeEmoji ?? "🏆",
      });
    }
    fetchEvent();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading || !event)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );

  const participants = event.pendingParticipants ?? [];

  return (
    <main className="min-h-screen bg-[#FFFBF5]">
      <nav className="bg-white border-b border-amber-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/events")}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-bold text-sm">
            TB
          </div>
          <span className="font-semibold text-gray-800">
            Attendance — {event.title}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition text-sm"
        >
          <LogOut size={16} /> Logout
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Participants */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">
              Participants ({participants.length}
              {event.cap ? `/${event.cap}` : ""})
            </h2>
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-1 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-green-600 transition"
            >
              <CheckCheck size={14} /> Approve All
            </button>
          </div>

          {participants.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No participants yet.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {participants.map((p: any) => (
              <div
                key={p.uid}
                className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : p.status === "rejected"
                          ? "bg-red-100 text-red-500"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.status}
                  </span>
                  <button
                    onClick={() => handleStatus(p.uid, "approved")}
                    className="text-green-500 hover:text-green-600 transition"
                  >
                    <CheckCircle size={20} />
                  </button>
                  <button
                    onClick={() => handleStatus(p.uid, "rejected")}
                    className="text-red-400 hover:text-red-500 transition"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
