"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  createEvent,
  getEvents,
  deleteEvent,
  updateEvent,
  getUsersMatchingEventType,
} from "@talentbank/firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  Pencil,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Timestamp,
  getDocs,
  collection,
  updateDoc,
  doc,
} from "firebase/firestore";
import EventCalendar from "@/components/EventCalendar";

const EVENT_TYPES = ["Hackathon", "Workshop", "Talk", "Others"];
const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-amber-400/10", text: "text-amber-400" },
  Workshop: { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk: { bg: "bg-cyan-400/10", text: "text-cyan-400" },
  Others: { bg: "bg-green-400/10", text: "text-green-400" },
};

const BADGE_SHAPES = [
  "hexagon",
  "star",
  "diamond",
  "circle",
  "square",
  "pentagon",
];
const BADGE_SHAPE_CLIPS: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  circle: "none",
  square: "none",
};
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
  "🌱",
  "🤝",
  "🏅",
  "🎓",
  "👑",
  "🔮",
  "🌊",
  "⭐",
  "🦁",
  "🎪",
];

const emptyForm = {
  title: "",
  description: "",
  type: "Hackathon",
  customType: "",
  emoji: "🏆",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  regDeadline: "",
  regDeadlineTime: "",
  cap: "",
  imageFile: null as File | null,
  badgeShape: "hexagon",
  badgeColor: "#FBBF24",
  badgeEmoji: "🏆",
};

export default function AdminEvents() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(
    new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" })
      .slice(0, 7),
  );
  const [showPast, setShowPast] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [aiFilling, setAiFilling] = useState(false);
  const [aiDesigning, setAiDesigning] = useState(false);
  const [aiDesignReason, setAiDesignReason] = useState("");

  // Auth guard handled by useAdminGuard — no additional redirect needed here

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    const data = await getEvents();
    const now = new Date();
    const sorted = [...data].sort((a: any, b: any) => {
      const dateA = a.startAt?.toDate?.() ?? new Date(0);
      const dateB = b.startAt?.toDate?.() ?? new Date(0);
      if (dateA.getTime() !== dateB.getTime())
        return dateA.getTime() - dateB.getTime();
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    const upcoming = sorted
      .filter((e: any) => {
        const start = e.startAt?.toDate?.() ?? new Date(0);
        const end = e.endAt?.toDate?.() ?? new Date(0);
        return end >= now;
      })
      .map((e: any) => ({
        ...e,
        isOngoing: e.startAt?.toDate?.() <= now && e.endAt?.toDate?.() >= now,
      }));
    setEvents(upcoming);
    setPastEvents(
      sorted
        .filter((e: any) => (e.endAt?.toDate?.() ?? new Date(0)) < now)
        .reverse(),
    );
  };

  const handleSubmit = async () => {
    if (!form.title || !form.startDate || !form.endDate) return;
    setSubmitting(true);
    let imageUrl = "";
    if (form.imageFile) {
      const storageRef = ref(
        storage,
        `events/${Date.now()}_${form.imageFile.name}`,
      );
      await uploadBytes(storageRef, form.imageFile);
      imageUrl = await getDownloadURL(storageRef);
    }
    const payload = {
      title: form.title,
      description: form.description,
      type: form.type === "Others" ? form.customType || "Others" : form.type,
      emoji: form.emoji,
      startAt: Timestamp.fromDate(
        new Date(`${form.startDate}T${form.startTime || "00:00"}`),
      ),
      endAt: Timestamp.fromDate(
        new Date(`${form.endDate}T${form.endTime || "23:59"}`),
      ),
      regDeadline: Timestamp.fromDate(
        new Date(`${form.regDeadline}T${form.regDeadlineTime || "23:59"}`),
      ),
      cap: form.cap ? parseInt(form.cap) : null,
      imageUrl: imageUrl || null,
      status: "upcoming",
      badgeShape: form.badgeShape,
      badgeColor: form.badgeColor,
      badgeEmoji: form.badgeEmoji,
    };
    if (editId) {
      await updateEvent(editId, payload);
      const allBadges = await getDocs(collection(db, "badges"));
      for (const badge of allBadges.docs.filter(
        (d) => d.data().eventId === editId,
      )) {
        await updateDoc(doc(db, "badges", badge.id), {
          shape: form.badgeShape,
          color: form.badgeColor,
          emoji: form.badgeEmoji,
        });
      }
    } else {
      await createEvent(payload);
      // Fire-and-forget push notification to matching students
      getUsersMatchingEventType(payload.type).then((tokens) => {
        if (tokens.length > 0) {
          fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokens,
              title: `New ${payload.type}: ${payload.title}`,
              body: (payload.description ?? "").slice(0, 100),
            }),
          }).catch(() => {});
        }
      });
    }
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
    setSubmitting(false);
    fetchEvents();
  };

  const handleEdit = (event: any) => {
    setForm({
      title: event.title,
      description: event.description,
      type: EVENT_TYPES.includes(event.type) ? event.type : "Others",
      customType: EVENT_TYPES.includes(event.type) ? "" : event.type,
      emoji: event.emoji,
      startDate: event.startAt?.toDate().toISOString().split("T")[0] ?? "",
      startTime: event.startAt?.toDate().toTimeString().slice(0, 5) ?? "",
      endDate: event.endAt?.toDate().toISOString().split("T")[0] ?? "",
      endTime: event.endAt?.toDate().toTimeString().slice(0, 5) ?? "",
      regDeadline:
        event.regDeadline?.toDate().toISOString().split("T")[0] ?? "",
      regDeadlineTime:
        event.regDeadline?.toDate().toTimeString().slice(0, 5) ?? "",
      cap: event.cap?.toString() ?? "",
      imageFile: null,
      badgeShape: event.badgeShape ?? "hexagon",
      badgeColor: event.badgeColor ?? "#FBBF24",
      badgeEmoji: event.badgeEmoji ?? "🏆",
    });
    setEditId(event.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this event?")) {
      await deleteEvent(id);
      fetchEvents();
    }
  };

  const handleAIFill = async () => {
    if (!form.description.trim()) return;
    setAiFilling(true);
    try {
      const res = await fetch("/api/ai/event-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        type: data.type || prev.type,
        emoji: data.emoji || prev.emoji,
        badgeShape: data.badgeShape || prev.badgeShape,
        badgeColor: data.badgeColor || prev.badgeColor,
        badgeEmoji: data.badgeEmoji || prev.badgeEmoji,
        cap: data.suggestedCapacity ? String(data.suggestedCapacity) : prev.cap,
      }));
    } finally {
      setAiFilling(false);
    }
  };

  const handleAIBadgeDesign = async () => {
    if (!form.title && !form.description) return;
    setAiDesigning(true);
    setAiDesignReason("");
    try {
      const res = await fetch("/api/ai/badge-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          type: form.type,
        }),
      });
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        badgeShape: data.badgeShape,
        badgeColor: data.badgeColor,
        badgeEmoji: data.badgeEmoji,
      }));
      setAiDesignReason(data.reasoning ?? "");
    } finally {
      setAiDesigning(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const filterEvents = (list: any[]) =>
    list.filter((e) => {
      const matchSearch =
        e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.type?.toLowerCase().includes(search.toLowerCase());
      const matchMonth =
        !monthFilter ||
        e.startAt?.toDate().toISOString().slice(0, 7) === monthFilter;
      return matchSearch && matchMonth;
    });

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const EventCard = ({ event, isPast }: { event: any; isPast?: boolean }) => {
    const typeStyle = TYPE_STYLES[event.type] ?? TYPE_STYLES.Others;
    return (
      <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex items-start justify-between gap-4 hover:border-amber-400/20 transition-all">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-2xl shrink-0`}
          >
            {event.emoji}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}
              >
                {event.type}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPast ? "bg-white/5 text-white/30" : "bg-green-400/10 text-green-400"}`}
              >
                {isPast ? "Past" : "Upcoming"}
              </span>
            </div>
            <h3 className="font-bold text-white">{event.title}</h3>
            <p className="text-xs text-white/40 line-clamp-1">
              {event.description}
            </p>
            <div className="flex gap-3 text-xs text-white/30 flex-wrap">
              <span>
                📅 {event.startAt?.toDate().toLocaleDateString()} –{" "}
                {event.endAt?.toDate().toLocaleDateString()}
              </span>
              <span>
                ⏰ Reg: {event.regDeadline?.toDate().toLocaleDateString()}
              </span>
              {event.cap && <span>👥 Cap: {event.cap}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => router.push(`/admin/events/${event.id}`)}
            className="flex items-center gap-1 text-xs bg-cyan-400/10 text-cyan-400 px-3 py-2 rounded-xl hover:bg-cyan-400/20 transition font-semibold"
          >
            <Users size={13} /> Attendance
          </button>
          {!isPast && (
            <button
              onClick={() => handleEdit(event)}
              className="flex items-center gap-1 text-xs bg-amber-400/10 text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-400/20 transition font-semibold"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
          <button
            onClick={() => handleDelete(event.id)}
            className="flex items-center gap-1 text-xs bg-red-400/10 text-red-400 px-3 py-2 rounded-xl hover:bg-red-400/20 transition font-semibold"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3,.font-black,.font-bold { font-family: 'Outfit', sans-serif; }`}</style>

      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">
              TB
            </div>
            <span className="font-bold text-white">
              TalentBank <span className="text-amber-400">Admin</span>
            </span>
          </div>
          <a
            href="/admin/students"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition"
          >
            <Users size={14} />
            Students
          </a>
          {isSuperAdmin && (
            <a
              href="/admin/requests"
              className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition"
            >
              <Users size={14} />
              Requests
            </a>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-white/40 hover:text-red-400 transition"
        >
          <LogOut size={16} />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Events</h1>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "list" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "calendar" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                Calendar
              </button>
            </div>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditId(null);
                setForm(emptyForm);
              }}
              className="flex items-center gap-2 bg-amber-400 text-[#0F0E17] px-4 py-2.5 rounded-xl text-sm font-black hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              <Plus size={16} /> New Event
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
            <Search size={15} className="text-white/30" />
            <input
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="month"
            className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/60 outline-none focus:border-amber-400/40"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-[#1A1825] border border-white/10 rounded-3xl p-6 flex flex-col gap-5 w-full max-w-2xl">
              <h2 className="font-black text-white text-lg">
                {editId ? "Edit Event" : "Create New Event"}
              </h2>

              {/* AI Fill */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAIFill}
                  disabled={aiFilling || !form.description.trim()}
                  className="flex items-center gap-1.5 text-xs bg-purple-400/10 text-purple-400 px-3 py-2 rounded-xl hover:bg-purple-400/20 transition font-semibold disabled:opacity-40"
                >
                  {aiFilling ? "Filling..." : "🤖 AI Fill"}
                </button>
                <span className="text-xs text-white/30">
                  Type a description below first, then click to auto-fill all fields
                </span>
              </div>

              {/* Emoji */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Event Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_LIST.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={`text-xl p-2 rounded-xl border-2 transition ${form.emoji === e ? "border-amber-400 bg-amber-400/10" : "border-transparent bg-white/5 hover:border-white/20"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Event Type
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition ${form.type === t ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {form.type === "Others" && (
                  <input
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30"
                    placeholder="Enter custom type (e.g. Ideathon)"
                    value={form.customType}
                    onChange={(e) =>
                      setForm({ ...form, customType: e.target.value })
                    }
                  />
                )}
              </div>

              {/* Title + Desc */}
              <input
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30"
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 resize-none placeholder:text-white/30"
                placeholder="Event description (include registration link if any)"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Start
                  </label>
                  <input
                    type="date"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    End
                  </label>
                  <input
                    type="date"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Reg deadline + Cap */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Registration Deadline
                  </label>
                  <input
                    type="date"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.regDeadline}
                    onChange={(e) =>
                      setForm({ ...form, regDeadline: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50"
                    value={form.regDeadlineTime}
                    onChange={(e) =>
                      setForm({ ...form, regDeadlineTime: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Participant Cap (optional)
                  </label>
                  <input
                    type="number"
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30"
                    placeholder="Unlimited"
                    value={form.cap}
                    onChange={(e) => setForm({ ...form, cap: e.target.value })}
                  />
                </div>
              </div>

              {/* Image */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Event Image (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-white/10 file:text-white/70 file:text-sm file:font-semibold hover:file:bg-white/20"
                  onChange={(e) =>
                    setForm({ ...form, imageFile: e.target.files?.[0] ?? null })
                  }
                />
              </div>

              {/* Badge Design */}
              <div className="flex flex-col gap-4 border-t border-white/8 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Badge Design
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAIBadgeDesign}
                      disabled={aiDesigning || (!form.title && !form.description)}
                      className="flex items-center gap-1.5 text-xs bg-cyan-400/10 text-cyan-400 px-3 py-2 rounded-xl hover:bg-cyan-400/20 transition font-semibold disabled:opacity-40"
                    >
                      {aiDesigning ? "Designing..." : "✨ AI Design"}
                    </button>
                    {aiDesignReason && (
                      <span className="text-xs text-white/30 italic max-w-xs truncate">
                        {aiDesignReason}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-white/30">Shape</label>
                  <div className="flex gap-2 flex-wrap">
                    {BADGE_SHAPES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, badgeShape: s })}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition capitalize ${form.badgeShape === s ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-white/30">Color</label>
                    <input
                      type="color"
                      value={form.badgeColor}
                      onChange={(e) =>
                        setForm({ ...form, badgeColor: e.target.value })
                      }
                      className="w-12 h-10 rounded-xl border border-white/10 cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs text-white/30">Badge Emoji</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EMOJI_LIST.map((e) => (
                        <button
                          key={e}
                          onClick={() => setForm({ ...form, badgeEmoji: e })}
                          className={`text-lg p-1.5 rounded-lg border-2 transition ${form.badgeEmoji === e ? "border-amber-400 bg-amber-400/10" : "border-transparent bg-white/5 hover:border-white/20"}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Preview */}
                <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      background: form.badgeColor,
                      clipPath: BADGE_SHAPE_CLIPS[form.badgeShape] ?? "none",
                      borderRadius:
                        form.badgeShape === "circle"
                          ? "50%"
                          : form.badgeShape === "square"
                            ? "10px"
                            : "0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      boxShadow: `0 4px 20px ${form.badgeColor}50`,
                      flexShrink: 0,
                    }}
                  >
                    {form.badgeEmoji}
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Badge Preview</p>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {form.title || "Event Title"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-amber-400 text-[#0F0E17] py-3 rounded-2xl font-black hover:bg-amber-300 transition disabled:opacity-50 shadow-lg shadow-amber-400/20"
                >
                  {submitting
                    ? "Saving..."
                    : editId
                      ? "Save Changes"
                      : "Create Event"}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditId(null);
                    setForm(emptyForm);
                  }}
                  className="px-5 bg-white/5 border border-white/10 text-white/50 rounded-2xl font-semibold hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <>
            {/* Search + filter active — show sectioned results */}
            {search || monthFilter ? (
              <div className="flex flex-col gap-4">
                {filterEvents([...events, ...pastEvents]).length === 0 ? (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="font-bold text-white">No events found</p>
                    <p className="text-sm text-white/30 mt-1">
                      Try a different search or month
                    </p>
                  </div>
                ) : (
                  <>
                    {filterEvents(events).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-green-400">
                            Upcoming
                          </h2>
                          <div className="flex-1 h-px bg-white/8" />
                        </div>
                        {filterEvents(events).map((event) => (
                          <EventCard key={event.id} event={event} />
                        ))}
                      </div>
                    )}
                    {filterEvents(pastEvents).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">
                            Past
                          </h2>
                          <div className="flex-1 h-px bg-white/8" />
                        </div>
                        {filterEvents(pastEvents).map((event) => (
                          <EventCard key={event.id} event={event} isPast />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Both exist — show smart tabs */}
                {events.length > 0 && pastEvents.length > 0 && (
                  <>
                    <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 w-fit">
                      <button
                        onClick={() => setShowPast(false)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${!showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Upcoming ({events.length})
                      </button>
                      <button
                        onClick={() => setShowPast(true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Past ({pastEvents.length})
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {!showPast
                        ? events.map((event) => (
                            <EventCard key={event.id} event={event} />
                          ))
                        : pastEvents.map((event) => (
                            <EventCard key={event.id} event={event} isPast />
                          ))}
                    </div>
                  </>
                )}

                {/* Only upcoming */}
                {events.length > 0 && pastEvents.length === 0 && (
                  <div className="flex flex-col gap-3">
                    {events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}

                {/* Only past */}
                {events.length === 0 && pastEvents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">
                        Past Events
                      </h2>
                      <div className="flex-1 h-px bg-white/8" />
                    </div>
                    {pastEvents.map((event) => (
                      <EventCard key={event.id} event={event} isPast />
                    ))}
                  </div>
                )}

                {/* Nothing at all */}
                {events.length === 0 && pastEvents.length === 0 && (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="font-bold text-white">No events yet</p>
                    <p className="text-sm text-white/30 mt-1">
                      Create your first event!
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-6">
            <EventCalendar
              events={[...events, ...pastEvents]}
              onEventClick={(event) => router.push(`/admin/events/${event.id}`)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
