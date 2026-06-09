"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  createEvent,
  getEvents,
  deleteEvent,
  updateEvent,
} from "@talentbank/firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  LogOut,
  Plus,
  Trash2,
  Pencil,
  Users,
  Search,
  MapPin,
  Video,
  ChevronDown,
  ChevronUp,
  X,
  ClipboardList,
} from "lucide-react";
import {
  Timestamp,
  getDocs,
  collection,
  updateDoc,
  doc,
} from "firebase/firestore";
import EventCalendar from "@/components/EventCalendar";
import type { RegistrationFormField } from "@talentbank/shared";

const EVENT_TYPES = ["Hackathon", "Workshop", "Talk", "Others"];
const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-amber-400/10", text: "text-amber-400" },
  Workshop:  { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk:      { bg: "bg-cyan-400/10",   text: "text-cyan-400"   },
  Others:    { bg: "bg-green-400/10",  text: "text-green-400"  },
};

const BADGE_SHAPES = ["hexagon", "star", "diamond", "circle", "square", "pentagon"];
const BADGE_SHAPE_CLIPS: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  star:    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  circle:  "none",
  square:  "none",
};
const EMOJI_LIST = [
  "🏆","🎯","🚀","🔬","💡","🌟","⚡","🎨","🔥","💎",
  "🌱","🤝","🏅","🎓","👑","🔮","🌊","⭐","🦁","🎪",
];

const FIELD_TYPES: { value: RegistrationFormField["type"]; label: string }[] = [
  { value: "text",     label: "Short Text"  },
  { value: "textarea", label: "Long Text"   },
  { value: "number",   label: "Number"      },
  { value: "email",    label: "Email"       },
  { value: "select",   label: "Dropdown"    },
  { value: "checkbox", label: "Checkbox"    },
];

type OnlinePlatform = "google-meet" | "teams" | "zoom";
const ONLINE_PLATFORMS: { id: OnlinePlatform; label: string; emoji: string; activeBg: string; activeBorder: string; activeText: string; placeholder: string }[] = [
  {
    id: "google-meet", label: "Google Meet", emoji: "📹",
    activeBg: "bg-emerald-500/10", activeBorder: "border-emerald-500/50", activeText: "text-emerald-400",
    placeholder: "https://meet.google.com/abc-defg-hij",
  },
  {
    id: "teams", label: "Teams", emoji: "🟣",
    activeBg: "bg-indigo-500/10", activeBorder: "border-indigo-500/50", activeText: "text-indigo-400",
    placeholder: "https://teams.microsoft.com/l/meetup-join/...",
  },
  {
    id: "zoom", label: "Zoom", emoji: "🔵",
    activeBg: "bg-blue-500/10", activeBorder: "border-blue-500/50", activeText: "text-blue-400",
    placeholder: "https://zoom.us/j/123456789",
  },
];

const emptyForm = {
  title:           "",
  description:     "",
  type:            "Hackathon",
  customType:      "",
  emoji:           "🏆",
  startDate:       "",
  startTime:       "",
  endDate:         "",
  endTime:         "",
  regDeadline:     "",
  regDeadlineTime: "",
  cap:             "",
  imageFile:       null as File | null,
  locationType:    "physical" as "physical" | "online",
  venueAddress:    "",
  meetingUrl:      "",
  onlinePlatform:  "google-meet" as OnlinePlatform,
  badgeShape:      "hexagon",
  badgeColor:      "#FBBF24",
  badgeEmoji:      "🏆",
  registrationForm: [] as RegistrationFormField[],
  organizer:        "",
};

const emptyNewField = {
  label:       "",
  type:        "text" as RegistrationFormField["type"],
  required:    true,
  options:     "",
  placeholder: "",
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-400 text-xs mt-1" role="alert">{msg}</p>;
}

// Resolves true only if the image file is within ±5% of 16:9
function checkImageRatio(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) <= 0.05 * (16 / 9)); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

export default function AdminEvents() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [search,       setSearch]       = useState("");
  const [monthFilter,  setMonthFilter]  = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).slice(0, 7),
  );
  const [showPast,   setShowPast]   = useState(false);
  const [viewMode,   setViewMode]   = useState<"list" | "calendar">("list");

  // Registration form builder state
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAddField,    setShowAddField]    = useState(false);
  const [newField,        setNewField]        = useState(emptyNewField);

  // Debounced venue map URL
  const [venueMapUrl, setVenueMapUrl] = useState("");
  const mapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  // Debounce venue address → map iframe URL
  useEffect(() => {
    if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
    if (form.venueAddress.trim().length > 3) {
      mapDebounceRef.current = setTimeout(() => {
        setVenueMapUrl(form.venueAddress.trim());
      }, 700);
    } else {
      setVenueMapUrl("");
    }
    return () => { if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current); };
  }, [form.venueAddress]);

  const fetchEvents = async () => {
    const data   = await getEvents();
    const now    = new Date();
    const sorted = [...data].sort((a: any, b: any) => {
      const dateA = a.startAt?.toDate?.() ?? new Date(0);
      const dateB = b.startAt?.toDate?.() ?? new Date(0);
      if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    setEvents(
      sorted
        .filter((e: any) => (e.endAt?.toDate?.() ?? new Date(0)) >= now)
        .map((e: any) => ({
          ...e,
          isOngoing: e.startAt?.toDate?.() <= now && e.endAt?.toDate?.() >= now,
        })),
    );
    setPastEvents(
      sorted.filter((e: any) => (e.endAt?.toDate?.() ?? new Date(0)) < now).reverse(),
    );
  };

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim())   errs.title = "Event title is required";
    if (!form.startDate)      errs.startDate = "Start date is required";
    if (!form.endDate)        errs.endDate = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "End date must be after start date";
    if (!form.regDeadline)   errs.regDeadline = "Registration deadline is required";
    if (form.type === "Others" && !form.customType.trim())
      errs.customType = "Please enter a custom event type";
    if (form.locationType === "online" && !form.meetingUrl.trim())
      errs.meetingUrl = "Meeting URL is required for online events";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function clearError(field: string) {
    setFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    let imageUrl = "";
    if (form.imageFile) {
      const storageRef = ref(storage, `events/${Date.now()}_${form.imageFile.name}`);
      await uploadBytes(storageRef, form.imageFile);
      imageUrl = await getDownloadURL(storageRef);
    }
    const payload: any = {
      title:       form.title,
      description: form.description,
      type:        form.type === "Others" ? form.customType || "Others" : form.type,
      emoji:       form.emoji,
      startAt:     Timestamp.fromDate(new Date(`${form.startDate}T${form.startTime || "00:00"}`)),
      endAt:       Timestamp.fromDate(new Date(`${form.endDate}T${form.endTime || "23:59"}`)),
      regDeadline: Timestamp.fromDate(new Date(`${form.regDeadline}T${form.regDeadlineTime || "23:59"}`)),
      cap:         form.cap ? parseInt(form.cap) : null,
      imageUrl:    imageUrl || null,
      status:      "upcoming",
      badgeShape:  form.badgeShape,
      badgeColor:  form.badgeColor,
      badgeEmoji:  form.badgeEmoji,
      locationType:  form.locationType,
      venueAddress:  form.locationType === "physical" ? form.venueAddress : null,
      meetingUrl:    form.locationType === "online"   ? form.meetingUrl   : null,
      onlinePlatform: form.locationType === "online"  ? form.onlinePlatform : null,
      registrationForm: form.registrationForm.length > 0 ? form.registrationForm : null,
      organizer:        form.organizer.trim() || null,
    };
    if (editId) {
      await updateEvent(editId, payload);
      const allBadges = await getDocs(collection(db, "badges"));
      for (const badge of allBadges.docs.filter((d) => d.data().eventId === editId)) {
        await updateDoc(doc(db, "badges", badge.id), {
          shape: form.badgeShape,
          color: form.badgeColor,
          emoji: form.badgeEmoji,
        });
      }
    } else {
      await createEvent(payload);
    }
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
    setFormErrors({});
    setShowFormBuilder(false);
    setShowAddField(false);
    setNewField(emptyNewField);
    setVenueMapUrl("");
    setSubmitting(false);
    fetchEvents();
  };

  const handleEdit = (event: any) => {
    setForm({
      title:           event.title,
      description:     event.description,
      type:            EVENT_TYPES.includes(event.type) ? event.type : "Others",
      customType:      EVENT_TYPES.includes(event.type) ? "" : event.type,
      emoji:           event.emoji,
      startDate:       event.startAt?.toDate().toISOString().split("T")[0] ?? "",
      startTime:       event.startAt?.toDate().toTimeString().slice(0, 5) ?? "",
      endDate:         event.endAt?.toDate().toISOString().split("T")[0] ?? "",
      endTime:         event.endAt?.toDate().toTimeString().slice(0, 5) ?? "",
      regDeadline:     event.regDeadline?.toDate().toISOString().split("T")[0] ?? "",
      regDeadlineTime: event.regDeadline?.toDate().toTimeString().slice(0, 5) ?? "",
      cap:             event.cap?.toString() ?? "",
      imageFile:       null,
      locationType:    event.locationType ?? "physical",
      venueAddress:    event.venueAddress ?? "",
      meetingUrl:      event.meetingUrl   ?? "",
      onlinePlatform:  event.onlinePlatform ?? "google-meet",
      badgeShape:      event.badgeShape ?? "hexagon",
      badgeColor:      event.badgeColor ?? "#FBBF24",
      badgeEmoji:      event.badgeEmoji ?? "🏆",
      registrationForm: event.registrationForm ?? [],
      organizer:       event.organizer ?? "",
    });
    setEditId(event.id);
    setShowForm(true);
    setFormErrors({});
    setShowFormBuilder((event.registrationForm ?? []).length > 0);
    setShowAddField(false);
    setNewField(emptyNewField);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this event?")) {
      await deleteEvent(id);
      fetchEvents();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const addField = () => {
    if (!newField.label.trim()) return;
    const field: RegistrationFormField = {
      id:       Date.now().toString(),
      label:    newField.label.trim(),
      type:     newField.type,
      required: newField.required,
      // Omit optional fields entirely when empty — Firestore rejects undefined values
      ...(newField.placeholder.trim() && { placeholder: newField.placeholder.trim() }),
      ...(newField.type === "select" && {
        options: newField.options.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    };
    setForm((f) => ({ ...f, registrationForm: [...f.registrationForm, field] }));
    setNewField(emptyNewField);
    setShowAddField(false);
  };

  const removeField = (id: string) => {
    setForm((f) => ({ ...f, registrationForm: f.registrationForm.filter((q) => q.id !== id) }));
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setFormErrors({});
    setShowFormBuilder(false);
    setShowAddField(false);
    setNewField(emptyNewField);
    setVenueMapUrl("");
  };

  const filterEvents = (list: any[]) =>
    list.filter((e) => {
      const matchSearch =
        e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.type?.toLowerCase().includes(search.toLowerCase());
      const matchMonth =
        !monthFilter || e.startAt?.toDate().toISOString().slice(0, 7) === monthFilter;
      return matchSearch && matchMonth;
    });

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const inputCls = (err?: string) =>
    `bg-white/5 border ${err ? "border-red-400/50" : "border-white/10"} rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30 w-full`;

  // Badge preview — inline style necessary for dynamic color/clip-path/shadow
  const badgePreviewStyle: React.CSSProperties = {
    width: 56, height: 56,
    background: form.badgeColor,
    clipPath: BADGE_SHAPE_CLIPS[form.badgeShape] ?? "none",
    borderRadius: form.badgeShape === "circle" ? "50%" : form.badgeShape === "square" ? "10px" : "0",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, boxShadow: `0 4px 20px ${form.badgeColor}50`, flexShrink: 0,
  };

  const activePlatform = ONLINE_PLATFORMS.find(p => p.id === form.onlinePlatform) ?? ONLINE_PLATFORMS[0];

  const EventCard = ({ event, isPast }: { event: any; isPast?: boolean }) => {
    const typeStyle = TYPE_STYLES[event.type] ?? TYPE_STYLES.Others;
    return (
      <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex items-start justify-between gap-4 hover:border-amber-400/20 transition-all">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-2xl shrink-0`} aria-hidden="true">
            {event.emoji}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>{event.type}</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPast ? "bg-white/5 text-white/30" : "bg-green-400/10 text-green-400"}`}>
                {isPast ? "Past" : "Upcoming"}
              </span>
              {event.locationType === "online" && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 flex items-center gap-1">
                  <Video size={10} aria-hidden="true" /> Online
                </span>
              )}
            </div>
            <h3 className="font-bold text-white">{event.title}</h3>
            <p className="text-xs text-white/40 line-clamp-1">{event.description}</p>
            <div className="flex gap-3 text-xs text-white/30 flex-wrap">
              <span>📅 {event.startAt?.toDate().toLocaleDateString()} – {event.endAt?.toDate().toLocaleDateString()}</span>
              <span>⏰ Reg: {event.regDeadline?.toDate().toLocaleDateString()}</span>
              {event.cap && <span>👥 Cap: {event.cap}</span>}
              {event.venueAddress && (
                <span className="flex items-center gap-1"><MapPin size={10} aria-hidden="true" /> {event.venueAddress}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button"
            onClick={() => router.push(`/admin/events/${event.id}`)}
            className="flex items-center gap-1 text-xs bg-cyan-400/10 text-cyan-400 px-3 py-2 rounded-xl hover:bg-cyan-400/20 transition font-semibold"
          >
            <Users size={13} aria-hidden="true" /> Attendance
          </button>
          {!isPast && (
            <button type="button"
              onClick={() => handleEdit(event)}
              className="flex items-center gap-1 text-xs bg-amber-400/10 text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-400/20 transition font-semibold"
            >
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
          )}
          <button type="button"
            onClick={() => handleDelete(event.id)}
            className="flex items-center gap-1 text-xs bg-red-400/10 text-red-400 px-3 py-2 rounded-xl hover:bg-red-400/20 transition font-semibold"
          >
            <Trash2 size={13} aria-hidden="true" /> Delete
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
            <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">TB</div>
            <span className="font-bold text-white">TalentBank <span className="text-amber-400">Admin</span></span>
          </div>
          <a href="/admin/students" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <ClipboardList size={14} aria-hidden="true" /> Feedback Forms
          </a>
          {isSuperAdmin && (
            <a href="/admin/requests" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
              <Users size={14} aria-hidden="true" /> Requests
            </a>
          )}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out" className="text-white/40 hover:text-red-400 transition">
          <LogOut size={16} aria-hidden="true" />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Events</h1>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1" role="group" aria-label="View mode">
              <button type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "list" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                List
              </button>
              <button type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "calendar" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                Calendar
              </button>
            </div>
            <button type="button"
              onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm); setFormErrors({}); setShowFormBuilder(false); setShowAddField(false); setNewField(emptyNewField); setVenueMapUrl(""); }}
              className="flex items-center gap-2 bg-amber-400 text-[#0F0E17] px-4 py-2.5 rounded-xl text-sm font-black hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              <Plus size={16} aria-hidden="true" /> New Event
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
            <Search size={15} className="text-white/30" aria-hidden="true" />
            <input
              aria-label="Search events"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="month"
            aria-label="Filter by month"
            title="Filter by month"
            className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/60 outline-none focus:border-amber-400/40"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>

        {/* ── Create / Edit Form Modal ── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4" role="dialog" aria-modal="true" aria-label={editId ? "Edit Event" : "Create New Event"}>
            <div className="bg-[#1A1825] border border-white/10 rounded-3xl p-6 flex flex-col gap-5 w-full max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-white text-lg">{editId ? "Edit Event" : "Create New Event"}</h2>
                <button type="button" onClick={closeForm} title="Close form" aria-label="Close form" className="text-white/30 hover:text-white transition">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              {/* Emoji */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Event Emoji</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select event emoji">
                  {EMOJI_LIST.map((e) => (
                    <button type="button" key={e}
                      onClick={() => setForm({ ...form, emoji: e })}
                      aria-label={`Select emoji ${e}`} aria-pressed={form.emoji === e}
                      className={`text-xl p-2 rounded-xl border-2 transition ${form.emoji === e ? "border-amber-400 bg-amber-400/10" : "border-transparent bg-white/5 hover:border-white/20"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Event Type</p>
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Select event type">
                  {EVENT_TYPES.map((t) => (
                    <button type="button" key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      aria-pressed={form.type === t}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition ${form.type === t ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {form.type === "Others" && (
                  <>
                    <input
                      id="customType" aria-label="Custom event type"
                      className={inputCls(formErrors.customType)}
                      placeholder="Enter custom type (e.g. Ideathon)"
                      value={form.customType}
                      onChange={(e) => { setForm({ ...form, customType: e.target.value }); clearError("customType"); }}
                    />
                    <FieldError msg={formErrors.customType} />
                  </>
                )}
              </div>

              {/* Title */}
              <div>
                <label htmlFor="eventTitle" className="sr-only">Event title</label>
                <input
                  id="eventTitle"
                  className={inputCls(formErrors.title)}
                  placeholder="Event title *"
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value }); clearError("title"); }}
                />
                <FieldError msg={formErrors.title} />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="eventDesc" className="sr-only">Event description</label>
                <textarea
                  id="eventDesc"
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 resize-none placeholder:text-white/30 w-full"
                  placeholder="Event description (include registration link if any)"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Organizer */}
              <div>
                <label htmlFor="organizer" className="sr-only">Organizer (club or society)</label>
                <input
                  id="organizer"
                  className={inputCls()}
                  placeholder="Organizer (e.g. Google Developer Student Club, IEEE UTAR)"
                  value={form.organizer}
                  onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <p id="startLabel" className="text-xs font-semibold text-white/40 uppercase tracking-wider">Start *</p>
                  <input type="date" aria-labelledby="startLabel" aria-label="Start date"
                    className={inputCls(formErrors.startDate)} value={form.startDate}
                    onChange={(e) => { setForm({ ...form, startDate: e.target.value }); clearError("startDate"); }}
                  />
                  <FieldError msg={formErrors.startDate} />
                  <input type="time" aria-label="Start time" className={inputCls()} value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <p id="endLabel" className="text-xs font-semibold text-white/40 uppercase tracking-wider">End *</p>
                  <input type="date" aria-labelledby="endLabel" aria-label="End date"
                    className={inputCls(formErrors.endDate)} value={form.endDate}
                    onChange={(e) => { setForm({ ...form, endDate: e.target.value }); clearError("endDate"); }}
                  />
                  <FieldError msg={formErrors.endDate} />
                  <input type="time" aria-label="End time" className={inputCls()} value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              {/* Reg deadline + Cap */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <p id="regDeadlineLabel" className="text-xs font-semibold text-white/40 uppercase tracking-wider">Registration Deadline *</p>
                  <input type="date" aria-labelledby="regDeadlineLabel" aria-label="Registration deadline date"
                    className={inputCls(formErrors.regDeadline)} value={form.regDeadline}
                    onChange={(e) => { setForm({ ...form, regDeadline: e.target.value }); clearError("regDeadline"); }}
                  />
                  <FieldError msg={formErrors.regDeadline} />
                  <input type="time" aria-label="Registration deadline time" className={inputCls()} value={form.regDeadlineTime}
                    onChange={(e) => setForm({ ...form, regDeadlineTime: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="cap" className="text-xs font-semibold text-white/40 uppercase tracking-wider">Participant Cap (optional)</label>
                  <input id="cap" type="number" className={inputCls()} placeholder="Unlimited" value={form.cap}
                    onChange={(e) => setForm({ ...form, cap: e.target.value })}
                  />
                </div>
              </div>

              {/* ── Venue / Meeting ── */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Event Location</p>
                <div className="flex gap-2" role="group" aria-label="Location type">
                  <button type="button"
                    onClick={() => { setForm({ ...form, locationType: "physical" }); clearError("meetingUrl"); }}
                    aria-pressed={form.locationType === "physical"}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.locationType === "physical" ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                  >
                    <MapPin size={14} aria-hidden="true" /> Physical Venue
                  </button>
                  <button type="button"
                    onClick={() => setForm({ ...form, locationType: "online" })}
                    aria-pressed={form.locationType === "online"}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${form.locationType === "online" ? "border-blue-400 bg-blue-400/10 text-blue-400" : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"}`}
                  >
                    <Video size={14} aria-hidden="true" /> Online Meeting
                  </button>
                </div>

                {/* Physical venue + live map preview */}
                {form.locationType === "physical" && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="venueAddress" className="sr-only">Venue address</label>
                    <input
                      id="venueAddress"
                      className={inputCls()}
                      placeholder="Venue name or full address (e.g. Dewan Besar, UTM)"
                      value={form.venueAddress}
                      onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
                    />
                    {/* Live map preview — shown after 700ms debounce */}
                    {venueMapUrl ? (
                      <div className="rounded-2xl overflow-hidden border border-white/10 mt-1 relative" style={{ height: 200 }}>
                        <iframe
                          key={venueMapUrl}
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(venueMapUrl)}&output=embed`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          title="Venue location preview"
                          aria-label={`Map preview for ${venueMapUrl}`}
                        />
                      </div>
                    ) : form.venueAddress.trim().length > 0 && form.venueAddress.trim().length <= 3 ? null : form.venueAddress.trim().length > 3 ? (
                      <div className="rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center mt-1" style={{ height: 200 }}>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                          <p className="text-white/30 text-xs">Loading map preview…</p>
                        </div>
                      </div>
                    ) : null}
                    {venueMapUrl && (
                      <p className="text-white/25 text-xs">Tap Maps / Waze on mobile to get directions</p>
                    )}
                  </div>
                )}

                {/* Online meeting — platform selector */}
                {form.locationType === "online" && (
                  <div className="flex flex-col gap-3">
                    {/* Platform icon buttons */}
                    <div className="flex gap-2" role="group" aria-label="Meeting platform">
                      {ONLINE_PLATFORMS.map((p) => (
                        <button type="button" key={p.id}
                          onClick={() => setForm({ ...form, onlinePlatform: p.id })}
                          aria-pressed={form.onlinePlatform === p.id}
                          className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition ${form.onlinePlatform === p.id ? `${p.activeBg} ${p.activeBorder} ${p.activeText}` : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}
                        >
                          <span className="text-xl" aria-hidden="true">{p.emoji}</span>
                          <span className="text-xs font-semibold">{p.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* URL input for selected platform */}
                    <div>
                      <label htmlFor="meetingUrl" className="sr-only">Meeting URL</label>
                      <input
                        id="meetingUrl"
                        type="url"
                        className={inputCls(formErrors.meetingUrl)}
                        placeholder={activePlatform.placeholder}
                        value={form.meetingUrl}
                        onChange={(e) => { setForm({ ...form, meetingUrl: e.target.value }); clearError("meetingUrl"); }}
                      />
                      <FieldError msg={formErrors.meetingUrl} />
                    </div>
                  </div>
                )}
              </div>

              {/* Image — 16:9 required */}
              <div className="flex flex-col gap-2">
                <label htmlFor="eventImage" className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Event Image (optional) <span className="text-white/25 normal-case font-normal">— 16:9 ratio, e.g. 1920×1080px</span>
                </label>
                <input
                  id="eventImage" type="file" accept="image/*"
                  className="text-sm text-white/50 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-white/10 file:text-white/70 file:text-sm file:font-semibold hover:file:bg-white/20"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) {
                      const valid = await checkImageRatio(file);
                      if (!valid) {
                        setFormErrors(prev => ({ ...prev, imageFile: "Image must be 16:9 ratio (e.g. 1920×1080, 1280×720). Please crop and re-upload." }));
                        e.target.value = "";
                        setForm(f => ({ ...f, imageFile: null }));
                        return;
                      }
                      setFormErrors(prev => { const n = { ...prev }; delete n.imageFile; return n; });
                    }
                    setForm(f => ({ ...f, imageFile: file }));
                  }}
                />
                <FieldError msg={formErrors.imageFile} />
              </div>

              {/* ── Registration Form Builder — violet theme ── */}
              <div className="border border-violet-500/30 rounded-2xl overflow-hidden">
                <button type="button"
                  onClick={() => setShowFormBuilder(!showFormBuilder)}
                  aria-expanded={showFormBuilder}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500/8 to-purple-500/8 hover:from-violet-500/12 hover:to-purple-500/12 transition"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-violet-400" aria-hidden="true" />
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Registration Form</span>
                    {form.registrationForm.length > 0 && (
                      <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">
                        {form.registrationForm.length} question{form.registrationForm.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {showFormBuilder
                    ? <ChevronUp size={16} className="text-violet-400/50" aria-hidden="true" />
                    : <ChevronDown size={16} className="text-violet-400/50" aria-hidden="true" />}
                </button>

                {showFormBuilder && (
                  <div className="p-4 flex flex-col gap-3 border-t border-violet-500/15">
                    <p className="text-xs text-violet-300/50">
                      Add custom questions that participants must answer when registering.
                    </p>

                    {/* Existing questions */}
                    {form.registrationForm.map((field) => (
                      <div key={field.id} className="flex items-start gap-3 bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{field.label}</p>
                          <p className="text-violet-300/50 text-xs mt-0.5">
                            {FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                            {field.required ? " · Required" : " · Optional"}
                            {field.options && ` · ${field.options.join(", ")}`}
                          </p>
                        </div>
                        <button type="button"
                          onClick={() => removeField(field.id)}
                          aria-label={`Remove question: ${field.label}`}
                          className="text-violet-400/30 hover:text-red-400 transition shrink-0 mt-0.5"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}

                    {/* Add question mini-form */}
                    {showAddField ? (
                      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 flex flex-col gap-3">
                        <div>
                          <label htmlFor="newFieldLabel" className="sr-only">Question label</label>
                          <input
                            id="newFieldLabel"
                            className="bg-white/5 border border-violet-500/20 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50 placeholder:text-white/30 w-full"
                            placeholder="Question label (e.g. Dietary requirements)"
                            value={newField.label}
                            onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                          />
                        </div>

                        <div className="flex gap-2 flex-wrap" role="group" aria-label="Field type">
                          {FIELD_TYPES.map((ft) => (
                            <button type="button" key={ft.value}
                              onClick={() => setNewField({ ...newField, type: ft.value })}
                              aria-pressed={newField.type === ft.value}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${newField.type === ft.value ? "border-violet-400 bg-violet-400/10 text-violet-400" : "border-white/10 bg-white/5 text-white/40 hover:border-violet-400/30"}`}
                            >
                              {ft.label}
                            </button>
                          ))}
                        </div>

                        {newField.type === "select" && (
                          <div>
                            <label htmlFor="newFieldOptions" className="sr-only">Dropdown options</label>
                            <input
                              id="newFieldOptions"
                              className="bg-white/5 border border-violet-500/20 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50 placeholder:text-white/30 w-full"
                              placeholder="Options separated by commas (e.g. Yes, No, Vegetarian)"
                              value={newField.options}
                              onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                            />
                          </div>
                        )}

                        {newField.type !== "checkbox" && (
                          <div>
                            <label htmlFor="newFieldPlaceholder" className="sr-only">Placeholder text</label>
                            <input
                              id="newFieldPlaceholder"
                              className="bg-white/5 border border-violet-500/20 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-violet-400/50 placeholder:text-white/30 w-full"
                              placeholder="Placeholder text (optional)"
                              value={newField.placeholder}
                              onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button type="button"
                            role="switch" aria-checked={newField.required} aria-label="Required field"
                            onClick={() => setNewField({ ...newField, required: !newField.required })}
                            className={`w-9 h-5 rounded-full transition-colors relative ${newField.required ? "bg-violet-400" : "bg-white/10"}`}
                          >
                            <span aria-hidden="true" className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${newField.required ? "left-4" : "left-0.5"}`} />
                          </button>
                          <span className="text-xs text-violet-300/60" aria-hidden="true">Required</span>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button type="button"
                            onClick={addField}
                            disabled={!newField.label.trim()}
                            className="flex-1 bg-violet-400/15 hover:bg-violet-400/25 disabled:opacity-30 text-violet-400 font-bold text-sm py-2 rounded-xl transition border border-violet-400/20"
                          >
                            Add Question
                          </button>
                          <button type="button"
                            onClick={() => { setShowAddField(false); setNewField(emptyNewField); }}
                            className="px-4 bg-white/5 border border-white/10 text-white/40 rounded-xl text-sm hover:bg-white/10 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => setShowAddField(true)}
                        className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition font-semibold py-2"
                      >
                        <Plus size={14} aria-hidden="true" /> Add Question
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Badge Design ── */}
              <div className="flex flex-col gap-4 border-t border-white/8 pt-4">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Badge Design</p>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-white/30">Shape</p>
                  <div className="flex gap-2 flex-wrap" role="group" aria-label="Badge shape">
                    {BADGE_SHAPES.map((s) => (
                      <button type="button" key={s}
                        onClick={() => setForm({ ...form, badgeShape: s })}
                        aria-pressed={form.badgeShape === s}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition capitalize ${form.badgeShape === s ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="badgeColor" className="text-xs text-white/30">Color</label>
                    <input
                      id="badgeColor" type="color" value={form.badgeColor}
                      onChange={(e) => setForm({ ...form, badgeColor: e.target.value })}
                      className="w-12 h-10 rounded-xl border border-white/10 cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <p className="text-xs text-white/30">Badge Emoji</p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Badge emoji">
                      {EMOJI_LIST.map((e) => (
                        <button type="button" key={e}
                          onClick={() => setForm({ ...form, badgeEmoji: e })}
                          aria-label={`Select badge emoji ${e}`} aria-pressed={form.badgeEmoji === e}
                          className={`text-lg p-1.5 rounded-lg border-2 transition ${form.badgeEmoji === e ? "border-amber-400 bg-amber-400/10" : "border-transparent bg-white/5 hover:border-white/20"}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Badge preview — inline style necessary for dynamic color/clip-path/shadow */}
                <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                  <div aria-hidden="true" style={badgePreviewStyle}>{form.badgeEmoji}</div>
                  <div>
                    <p className="text-xs text-white/40">Badge Preview</p>
                    <p className="text-sm font-bold text-white mt-0.5">{form.title || "Event Title"}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={handleSubmit} disabled={submitting}
                  className="flex-1 bg-amber-400 text-[#0F0E17] py-3 rounded-2xl font-black hover:bg-amber-300 transition disabled:opacity-50 shadow-lg shadow-amber-400/20"
                >
                  {submitting ? "Saving..." : editId ? "Save Changes" : "Create Event"}
                </button>
                <button type="button"
                  onClick={closeForm}
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
            {search || monthFilter ? (
              <div className="flex flex-col gap-4">
                {filterEvents([...events, ...pastEvents]).length === 0 ? (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
                    <p className="font-bold text-white">No events found</p>
                    <p className="text-sm text-white/30 mt-1">Try a different search or month</p>
                  </div>
                ) : (
                  <>
                    {filterEvents(events).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-green-400">Upcoming</h2>
                          <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                        </div>
                        {filterEvents(events).map((event) => <EventCard key={event.id} event={event} />)}
                      </div>
                    )}
                    {filterEvents(pastEvents).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Past</h2>
                          <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                        </div>
                        {filterEvents(pastEvents).map((event) => <EventCard key={event.id} event={event} isPast />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {events.length > 0 && pastEvents.length > 0 && (
                  <>
                    <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 w-fit" role="tablist">
                      <button type="button" role="tab" aria-selected={!showPast}
                        onClick={() => setShowPast(false)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${!showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Upcoming ({events.length})
                      </button>
                      <button type="button" role="tab" aria-selected={showPast}
                        onClick={() => setShowPast(true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Past ({pastEvents.length})
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {!showPast
                        ? events.map((event) => <EventCard key={event.id} event={event} />)
                        : pastEvents.map((event) => <EventCard key={event.id} event={event} isPast />)}
                    </div>
                  </>
                )}
                {events.length > 0 && pastEvents.length === 0 && (
                  <div className="flex flex-col gap-3">
                    {events.map((event) => <EventCard key={event.id} event={event} />)}
                  </div>
                )}
                {events.length === 0 && pastEvents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Past Events</h2>
                      <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                    </div>
                    {pastEvents.map((event) => <EventCard key={event.id} event={event} isPast />)}
                  </div>
                )}
                {events.length === 0 && pastEvents.length === 0 && (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3" aria-hidden="true">🎯</div>
                    <p className="font-bold text-white">No events yet</p>
                    <p className="text-sm text-white/30 mt-1">Create your first event!</p>
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
