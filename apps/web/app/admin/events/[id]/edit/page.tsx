"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getEvent, updateEvent } from "@talentbank/firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import {
  LogOut, Trash2, Info, Calendar, ImageIcon,
  ClipboardList, Award, ChevronDown, ChevronUp, MapPin, Video, Upload, X, Save, Plus, GraduationCap,
} from "lucide-react";
import { Timestamp, getDocs, collection, updateDoc, doc } from "firebase/firestore";
import type { RegistrationFormField } from "@talentbank/shared";

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = ["Hackathon", "Workshop", "Talk", "Others"];
const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-[#E8923C]/12",  text: "text-[#E8923C]"  },
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
  { value: "text",     label: "Short Text" },
  { value: "textarea", label: "Long Text"  },
  { value: "number",   label: "Number"     },
  { value: "email",    label: "Email"      },
  { value: "select",   label: "Dropdown"   },
  { value: "checkbox", label: "Checkbox"   },
];

type OnlinePlatform = "google-meet" | "teams" | "zoom";
const ONLINE_PLATFORMS: {
  id: OnlinePlatform; label: string; emoji: string;
  activeBg: string; activeBorder: string; activeText: string; placeholder: string;
}[] = [
  { id: "google-meet", label: "Google Meet", emoji: "📹",
    activeBg: "bg-emerald-500/10", activeBorder: "border-emerald-500/50", activeText: "text-emerald-400",
    placeholder: "https://meet.google.com/abc-defg-hij" },
  { id: "teams", label: "Teams", emoji: "🟣",
    activeBg: "bg-indigo-500/10", activeBorder: "border-indigo-500/50", activeText: "text-indigo-400",
    placeholder: "https://teams.microsoft.com/l/meetup-join/..." },
  { id: "zoom", label: "Zoom", emoji: "🔵",
    activeBg: "bg-blue-500/10", activeBorder: "border-blue-500/50", activeText: "text-blue-400",
    placeholder: "https://zoom.us/j/123456789" },
];

const SECTIONS = [
  { id: "basic",        label: "Basic Info",        icon: Info,          desc: "Event type, title & description"   },
  { id: "datetime",     label: "Date & Location",   icon: Calendar,      desc: "Schedule and venue details"        },
  { id: "image",        label: "Event Image",       icon: ImageIcon,     desc: "Cover image for your event"        },
  { id: "registration", label: "Registration Form", icon: ClipboardList, desc: "Custom fields for sign-up"         },
  { id: "badge",        label: "Badge Design",      icon: Award,         desc: "Digital badge awarded to attendees" },
] as const;

const emptyNewField = {
  label: "", type: "text" as RegistrationFormField["type"],
  required: true, options: "", placeholder: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-400 text-xs mt-1.5" role="alert">{msg}</p>;
}

function checkImageRatio(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) <= 0.05 * (16 / 9)); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

function toDateStr(ts: any): string {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function toTimeStr(ts: any): string {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditEventPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router   = useRouter();
  const { id }   = useParams<{ id: string }>();

  const [eventLoaded, setEventLoaded] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", type: "Hackathon", customType: "", emoji: "🏆",
    startDate: "", startTime: "", endDate: "", endTime: "",
    regDeadline: "", regDeadlineTime: "", cap: "",
    imageFile: null as File | null,
    imagePreviewUrl: "",
    existingImageUrl: "",
    locationType: "physical" as "physical" | "online",
    venueAddress: "", meetingUrl: "", onlinePlatform: "google-meet" as OnlinePlatform,
    badgeShape: "hexagon", badgeColor: "#FBBF24", badgeEmoji: "🏆",
    badgeMode: "design" as "design" | "upload",
    badgeImageFile: null as File | null,
    badgeImagePreviewUrl: "",
    existingBadgeImageUrl: "",
    registrationForm: [] as RegistrationFormField[],
    organizer: "",
  });

  const [formErrors, setFormErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting]     = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAddField,    setShowAddField]    = useState(false);
  const [newField,        setNewField]        = useState(emptyNewField);
  const [activeSection,   setActiveSection]   = useState("basic");

  const [venueMapUrl, setVenueMapUrl] = useState("");
  const mapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load event data
  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const event: any = await getEvent(id);
      if (!event) { router.replace("/admin/events"); return; }

      const rawType  = event.type ?? "Hackathon";
      const knownType = EVENT_TYPES.includes(rawType) ? rawType : "Others";

      setForm({
        title:           event.title ?? "",
        description:     event.description ?? "",
        type:            knownType,
        customType:      knownType === "Others" ? rawType : "",
        emoji:           event.emoji ?? "🏆",
        startDate:       toDateStr(event.startAt),
        startTime:       toTimeStr(event.startAt),
        endDate:         toDateStr(event.endAt),
        endTime:         toTimeStr(event.endAt),
        regDeadline:     toDateStr(event.regDeadline),
        regDeadlineTime: toTimeStr(event.regDeadline),
        cap:             event.cap != null ? String(event.cap) : "",
        imageFile:       null,
        imagePreviewUrl: "",
        existingImageUrl: event.imageUrl ?? "",
        locationType:   event.locationType ?? "physical",
        venueAddress:   event.venueAddress ?? "",
        meetingUrl:     event.meetingUrl ?? "",
        onlinePlatform: event.onlinePlatform ?? "google-meet",
        badgeShape:     event.badgeShape ?? "hexagon",
        badgeColor:     event.badgeColor ?? "#FBBF24",
        badgeEmoji:     event.badgeEmoji ?? "🏆",
        badgeMode:      event.badgeImageUrl ? "upload" : "design",
        badgeImageFile: null,
        badgeImagePreviewUrl: "",
        existingBadgeImageUrl: event.badgeImageUrl ?? "",
        registrationForm: event.registrationForm ?? [],
        organizer:      event.organizer ?? "",
      });
      setVenueMapUrl(event.venueAddress ?? "");
      setEventLoaded(true);
    };
    load();
  }, [user, id]);

  useEffect(() => {
    if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
    if (form.venueAddress.trim().length > 3) {
      mapDebounceRef.current = setTimeout(() => setVenueMapUrl(form.venueAddress.trim()), 700);
    } else {
      setVenueMapUrl("");
    }
    return () => { if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current); };
  }, [form.venueAddress]);

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (!eventLoaded) return;
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id: sId }) => {
      const el = document.getElementById(sId);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(sId); },
        { rootMargin: "-30% 0px -60% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [eventLoaded]);

  const handleLogout = async () => { await signOut(auth); router.push("/"); };

  function isSectionFilled(sId: string): boolean {
    switch (sId) {
      case "basic":        return !!form.title.trim();
      case "datetime":     return !!form.startDate && !!form.endDate && !!form.regDeadline;
      case "image":        return !!form.imageFile || !!form.existingImageUrl;
      case "registration": return form.registrationForm.length > 0;
      case "badge":        return form.badgeMode === "upload"
        ? !!form.badgeImageFile || !!form.existingBadgeImageUrl
        : true;
      default: return false;
    }
  }

  function clearError(field: string) {
    setFormErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim())   errs.title = "Event title is required";
    if (!form.startDate)      errs.startDate = "Start date is required";
    if (!form.endDate)        errs.endDate = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "End date must be after start date";
    if (!form.regDeadline)    errs.regDeadline = "Registration deadline is required";
    if (form.type === "Others" && !form.customType.trim())
      errs.customType = "Please enter a custom event type";
    if (form.locationType === "online" && !form.meetingUrl.trim())
      errs.meetingUrl = "Meeting URL is required for online events";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstErrSection = errs.title || errs.customType ? "basic"
        : errs.startDate || errs.endDate || errs.regDeadline || errs.meetingUrl ? "datetime"
        : "basic";
      document.getElementById(firstErrSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Upload new event image if provided, else keep existing
      let imageUrl = form.existingImageUrl;
      if (form.imageFile) {
        const sRef = ref(storage, `events/${Date.now()}_${form.imageFile.name}`);
        await uploadBytes(sRef, form.imageFile);
        imageUrl = await getDownloadURL(sRef);
      }

      // Resolve badge image URL
      let badgeImageUrl: string | null = null;
      if (form.badgeMode === "upload") {
        if (form.badgeImageFile) {
          const ext  = form.badgeImageFile.name.split(".").pop() ?? "png";
          const bRef = ref(storage, `badges/${id}/custom_badge.${ext}`);
          await uploadBytes(bRef, form.badgeImageFile);
          badgeImageUrl = await getDownloadURL(bRef);
        } else {
          badgeImageUrl = form.existingBadgeImageUrl || null;
        }
      }

      const payload: any = {
        title:       form.title,
        description: form.description,
        type:        form.type === "Others" ? (form.customType || "Others") : form.type,
        emoji:       form.emoji,
        startAt:     Timestamp.fromDate(new Date(`${form.startDate}T${form.startTime || "00:00"}`)),
        endAt:       Timestamp.fromDate(new Date(`${form.endDate}T${form.endTime || "23:59"}`)),
        regDeadline: Timestamp.fromDate(new Date(`${form.regDeadline}T${form.regDeadlineTime || "23:59"}`)),
        cap:         form.cap ? parseInt(form.cap) : null,
        imageUrl:    imageUrl || null,
        badgeShape:  form.badgeShape,
        badgeColor:  form.badgeColor,
        badgeEmoji:  form.badgeEmoji,
        badgeImageUrl,
        locationType:  form.locationType,
        venueAddress:  form.locationType === "physical" ? form.venueAddress : null,
        meetingUrl:    form.locationType === "online"   ? form.meetingUrl   : null,
        onlinePlatform: form.locationType === "online"  ? form.onlinePlatform : null,
        registrationForm: form.registrationForm.length > 0 ? form.registrationForm : null,
        organizer:   form.organizer.trim() || null,
      };

      await updateEvent(id, payload);

      // Sync badge design to all already-awarded badges
      const allBadges = await getDocs(collection(db, "badges"));
      for (const badge of allBadges.docs.filter((d) => d.data().eventId === id)) {
        await updateDoc(doc(db, "badges", badge.id), {
          shape: form.badgeShape,
          color: form.badgeColor,
          emoji: form.badgeEmoji,
          badgeImageUrl,
        });
      }

      router.push("/admin/events");
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const addField = () => {
    if (!newField.label.trim()) return;
    const field: RegistrationFormField = {
      id:       Date.now().toString(),
      label:    newField.label.trim(),
      type:     newField.type,
      required: newField.required,
      ...(newField.placeholder.trim() && { placeholder: newField.placeholder.trim() }),
      ...(newField.type === "select" && {
        options: newField.options.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    };
    setForm((f) => ({ ...f, registrationForm: [...f.registrationForm, field] }));
    setNewField(emptyNewField);
    setShowAddField(false);
  };

  const removeField = (fId: string) =>
    setForm((f) => ({ ...f, registrationForm: f.registrationForm.filter((q) => q.id !== fId) }));

  const inputCls = (err?: string) =>
    `bg-[#F7F4EE] border ${err ? "border-red-400/50" : "border-[#E2DED6]"} rounded-2xl px-4 py-3 text-sm text-[#3A332C]outline-none focus:border-amber-400/50 placeholder:text-[#3A332C]/40 w-full transition`;

  const activePlatform = ONLINE_PLATFORMS.find((p) => p.id === form.onlinePlatform) ?? ONLINE_PLATFORMS[0];

  const badgePreviewStyle: React.CSSProperties = {
    width: 72, height: 72,
    background: form.badgeColor,
    clipPath: BADGE_SHAPE_CLIPS[form.badgeShape] ?? "none",
    borderRadius: form.badgeShape === "circle" ? "50%" : form.badgeShape === "square" ? "12px" : "0",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 30, boxShadow: `0 6px 30px ${form.badgeColor}60`, flexShrink: 0,
  };

  if (loading || !eventLoaded)
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#F7F4EE]">
      <style>{``}</style>

      {/* ── Sticky nav ── */}
      <nav className="bg-[#F7F4EE]/90 border-b border-[#E2DED6] backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <a href="/admin/events" className="text-[#3A332C]/60 hover:opacity-70 transition font-medium">Events</a>
          <span className="text-[#3A332C]/40">/</span>
          <span className="text-[#3A332C] font-bold truncate max-w-[200px]">{form.title || "Edit Event"}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/admin/students"  className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Attendance</a>
          <a href="/admin/feedback"  className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Feedback Forms</a>
          <a href="/admin/exams" className="items-center gap-1.5 text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:flex"><GraduationCap size={14} aria-hidden="true" /> Exams</a>
          {isSuperAdmin && <a href="/admin/requests" className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Requests</a>}
          <button type="button" onClick={handleLogout} title="Sign out" className="text-[#3A332C]/50 hover:text-red-400 transition">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* ── Mobile step pills ── */}
      <div className="lg:hidden sticky top-[61px] z-30 bg-[#F7F4EE]/95 backdrop-blur-xl border-b border-[#E2DED6] px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {SECTIONS.map(({ id: sId, label, icon: Icon }) => {
            const filled = isSectionFilled(sId);
            const active = activeSection === sId;
            return (
              <button key={sId} type="button"
                onClick={() => document.getElementById(sId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap
                  ${active ? "bg-[#E8923C] text-white" : filled ? "bg-[#E8923C]/15 text-[#E8923C]" : "bg-[#F7F4EE] text-[#3A332C]/50"}`}
              >
                <Icon size={11} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex max-w-6xl mx-auto">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0">
          <div className="sticky top-[69px] h-[calc(100vh-69px)] flex flex-col p-6 gap-1 overflow-y-auto">
            <p className="text-xs font-semibold text-[#3A332C]/40 uppercase tracking-widest mb-3">Sections</p>
            {SECTIONS.map(({ id: sId, label, icon: Icon }) => {
              const filled = isSectionFilled(sId);
              const active = activeSection === sId;
              return (
                <button key={sId} type="button"
                  onClick={() => document.getElementById(sId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left group
                    ${active ? "bg-[#E8923C]/12 text-[#E8923C]" : "text-[#3A332C]/60 hover:opacity-70 hover:bg-[#F7F4EE]"}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                    ${filled ? "bg-[#E8923C] border-amber-400" : active ? "border-amber-400" : "border-white/20 group-hover:border-white/40"}`}>
                    {filled && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}

            <div className="mt-auto pt-6 flex flex-col gap-2">
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="w-full bg-[#E8923C] text-white py-3 rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-[#0F0E17]/30 border-t-[#0F0E17] rounded-full animate-spin" /> Saving…</>
                  : <><Save size={15} /> Save Changes</>}
              </button>
              <a href="/admin/events"
                className="w-full text-center text-sm text-[#3A332C]/50 hover:opacity-70 transition py-2 rounded-xl hover:bg-[#F7F4EE]"
              >Cancel</a>
            </div>
          </div>
        </aside>

        {/* ── Form sections ── */}
        <div className="flex-1 px-4 lg:px-8 py-8 space-y-6 min-w-0">

          {/* ── Section 1: Basic Info ── */}
          <div id="basic" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Info} title="Basic Info" desc="Event type, title and description" />

            {/* Emoji */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Event Emoji</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_LIST.map((em) => (
                  <button key={em} type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: em }))}
                    aria-pressed={form.emoji === em}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition border-2
                      ${form.emoji === em ? "bg-[#E8923C]/20 border-amber-400" : "bg-[#F7F4EE] border-transparent hover:bg-[#E2DED6]"}`}
                  >{em}</button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Event Type</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => {
                  const s = TYPE_STYLES[t] ?? TYPE_STYLES.Others;
                  return (
                    <button key={t} type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      aria-pressed={form.type === t}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition border-2
                        ${form.type === t ? `${s.bg} ${s.text} border-current` : "bg-[#F7F4EE] text-[#3A332C]/60 border-transparent hover:bg-[#E2DED6]"}`}
                    >{t}</button>
                  );
                })}
              </div>
              {form.type === "Others" && (
                <div className="mt-2">
                  <input placeholder="e.g. Seminar, Bootcamp…" value={form.customType}
                    onChange={(e) => { setForm((f) => ({ ...f, customType: e.target.value })); clearError("customType"); }}
                    className={inputCls(formErrors.customType)} />
                  <FieldError msg={formErrors.customType} />
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label htmlFor="title" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Event Title <span className="text-red-400">*</span>
              </label>
              <input id="title" placeholder="e.g. Hackathon 2025" value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); clearError("title"); }}
                className={inputCls(formErrors.title)} />
              <FieldError msg={formErrors.title} />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="desc" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Description</label>
              <textarea id="desc" rows={3} placeholder="Brief description, registration link…" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputCls() + " resize-none"} />
            </div>

            {/* Organizer */}
            <div className="space-y-2">
              <label htmlFor="organizer" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Organizer <span className="text-white/25 normal-case font-normal">— optional</span></label>
              <input id="organizer" placeholder="e.g. Google Developer Student Club" value={form.organizer}
                onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>

          {/* ── Section 2: Date & Location ── */}
          <div id="datetime" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Calendar} title="Date & Location" desc="Schedule and venue details" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="startDate" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Start Date <span className="text-red-400">*</span></label>
                <input id="startDate" type="date" value={form.startDate}
                  onChange={(e) => { setForm((f) => ({ ...f, startDate: e.target.value })); clearError("startDate"); }}
                  className={inputCls(formErrors.startDate)} />
                <FieldError msg={formErrors.startDate} />
              </div>
              <div className="space-y-2">
                <label htmlFor="startTime" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Start Time</label>
                <input id="startTime" type="time" value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className={inputCls()} />
              </div>
              <div className="space-y-2">
                <label htmlFor="endDate" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">End Date <span className="text-red-400">*</span></label>
                <input id="endDate" type="date" value={form.endDate}
                  onChange={(e) => { setForm((f) => ({ ...f, endDate: e.target.value })); clearError("endDate"); }}
                  className={inputCls(formErrors.endDate)} />
                <FieldError msg={formErrors.endDate} />
              </div>
              <div className="space-y-2">
                <label htmlFor="endTime" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">End Time</label>
                <input id="endTime" type="time" value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className={inputCls()} />
              </div>
              <div className="space-y-2">
                <label htmlFor="regDeadline" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Registration Deadline <span className="text-red-400">*</span></label>
                <input id="regDeadline" type="date" value={form.regDeadline}
                  onChange={(e) => { setForm((f) => ({ ...f, regDeadline: e.target.value })); clearError("regDeadline"); }}
                  className={inputCls(formErrors.regDeadline)} />
                <FieldError msg={formErrors.regDeadline} />
              </div>
              <div className="space-y-2">
                <label htmlFor="regDeadlineTime" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Deadline Time</label>
                <input id="regDeadlineTime" type="time" value={form.regDeadlineTime}
                  onChange={(e) => setForm((f) => ({ ...f, regDeadlineTime: e.target.value }))}
                  className={inputCls()} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="cap" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Participant Cap <span className="text-white/25 normal-case font-normal">— optional</span></label>
              <input id="cap" type="number" min="1" placeholder="Leave blank for unlimited"
                value={form.cap} onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))}
                className={inputCls()} />
            </div>

            {/* Location type toggle */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Location</label>
              <div className="flex gap-2">
                {(["physical", "online"] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, locationType: t }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition border-2
                      ${form.locationType === t ? "bg-[#E8923C]/12 border-amber-400/50 text-[#E8923C]" : "bg-[#F7F4EE] border-transparent text-[#3A332C]/50 hover:bg-[#E2DED6]"}`}
                  >
                    {t === "physical" ? <><MapPin size={14} /> Physical Venue</> : <><Video size={14} /> Online Meeting</>}
                  </button>
                ))}
              </div>

              {form.locationType === "physical" ? (
                <div className="space-y-3">
                  <input placeholder="Venue address" value={form.venueAddress}
                    onChange={(e) => setForm((f) => ({ ...f, venueAddress: e.target.value }))}
                    className={inputCls()} />
                  {venueMapUrl && (
                    <div className="rounded-2xl overflow-hidden border border-[#E2DED6] h-40">
                      <iframe
                        title="Venue map"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(venueMapUrl)}&output=embed`}
                        className="w-full h-full" loading="lazy"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {ONLINE_PLATFORMS.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => setForm((f) => ({ ...f, onlinePlatform: p.id }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition
                          ${form.onlinePlatform === p.id ? `${p.activeBg} ${p.activeBorder} ${p.activeText}` : "bg-[#F7F4EE] border-transparent text-[#3A332C]/50 hover:bg-[#E2DED6]"}`}
                      >
                        <span>{p.emoji}</span> {p.label}
                      </button>
                    ))}
                  </div>
                  <input placeholder={activePlatform.placeholder} value={form.meetingUrl}
                    onChange={(e) => { setForm((f) => ({ ...f, meetingUrl: e.target.value })); clearError("meetingUrl"); }}
                    className={inputCls(formErrors.meetingUrl)} />
                  <FieldError msg={formErrors.meetingUrl} />
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Event Image ── */}
          <div id="image" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={ImageIcon} title="Event Image" desc="16:9 ratio recommended — e.g. 1920×1080px" />

            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[#E2DED6] rounded-2xl cursor-pointer hover:border-amber-400/40 hover:bg-[#E8923C]/5 transition group relative overflow-hidden">
                {form.imagePreviewUrl || form.existingImageUrl ? (
                  <>
                    <img
                      src={form.imagePreviewUrl || form.existingImageUrl}
                      alt="Event cover"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 text-white">
                      <Upload size={18} />
                      <span className="text-sm font-semibold">Replace image</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#3A332C]/40 group-hover:text-[#E8923C]/70 transition">
                    <ImageIcon size={28} />
                    <span className="text-sm font-semibold">Click to upload event image</span>
                    <span className="text-xs">PNG, JPG, WebP — 16:9 aspect ratio</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) {
                      const valid = await checkImageRatio(file);
                      if (!valid) {
                        setFormErrors((p) => ({ ...p, imageFile: "Image must be 16:9 ratio (e.g. 1920×1080, 1280×720). Please crop and re-upload." }));
                        e.target.value = "";
                        setForm((f) => ({ ...f, imageFile: null, imagePreviewUrl: "" }));
                        return;
                      }
                      clearError("imageFile");
                      const previewUrl = URL.createObjectURL(file);
                      setForm((f) => ({ ...f, imageFile: file, imagePreviewUrl: previewUrl }));
                    }
                  }}
                />
              </label>

              {(form.imageFile || form.existingImageUrl) && (
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, imageFile: null, imagePreviewUrl: "", existingImageUrl: "" }))}
                  className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition"
                >
                  <X size={12} /> Remove image
                </button>
              )}
              <FieldError msg={formErrors.imageFile} />
            </div>
          </div>

          {/* ── Section 4: Registration Form ── */}
          <div id="registration" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <SectionHeader icon={ClipboardList} title="Registration Form" desc="Custom fields participants fill when signing up" />
              <button type="button" onClick={() => setShowFormBuilder((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#3A332C]/50 hover:opacity-70 transition font-semibold">
                {showFormBuilder ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {form.registrationForm.length > 0 && (
                  <span className="bg-violet-400/20 text-violet-400 px-2 py-0.5 rounded-full font-semibold">{form.registrationForm.length} field{form.registrationForm.length !== 1 ? "s" : ""}</span>
                )}
              </button>
            </div>

            {showFormBuilder && (
              <div className="space-y-3">
                {form.registrationForm.length === 0 && (
                  <p className="text-sm text-[#3A332C]/40 text-center py-4">No fields yet. Add your first field below.</p>
                )}
                {form.registrationForm.map((field) => (
                  <div key={field.id} className="flex items-start justify-between gap-3 bg-[#F7F4EE] rounded-xl px-4 py-3 border border-[#E2DED6]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#3A332C]truncate">{field.label}</p>
                      <p className="text-xs text-[#3A332C]/50 mt-0.5">
                        {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                        {field.required && " · Required"}
                        {field.options && ` · Options: ${field.options.join(", ")}`}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeField(field.id)} className="text-red-400/60 hover:text-red-400 transition shrink-0 mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {showAddField ? (
                  <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">New Field</p>
                    <input placeholder="Field label *" value={newField.label}
                      onChange={(e) => setNewField((f) => ({ ...f, label: e.target.value }))}
                      className={inputCls()} />
                    <div className="flex gap-2 flex-wrap">
                      {FIELD_TYPES.map(({ value, label }) => (
                        <button key={value} type="button"
                          onClick={() => setNewField((f) => ({ ...f, type: value }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border
                            ${newField.type === value ? "bg-violet-400/20 border-violet-400/50 text-violet-400" : "bg-[#F7F4EE] border-[#E2DED6] text-[#3A332C]/60 hover:bg-[#E2DED6]"}`}
                        >{label}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
                        <input type="checkbox" checked={newField.required}
                          onChange={(e) => setNewField((f) => ({ ...f, required: e.target.checked }))}
                          className="accent-violet-400 w-4 h-4" />
                        Required
                      </label>
                    </div>
                    <input placeholder="Placeholder text (optional)" value={newField.placeholder}
                      onChange={(e) => setNewField((f) => ({ ...f, placeholder: e.target.value }))}
                      className={inputCls()} />
                    {newField.type === "select" && (
                      <input placeholder="Options (comma-separated): Option A, Option B" value={newField.options}
                        onChange={(e) => setNewField((f) => ({ ...f, options: e.target.value }))}
                        className={inputCls()} />
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={addField}
                        className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-xl text-sm font-semibold hover:bg-violet-500/30 transition">
                        Add Field
                      </button>
                      <button type="button" onClick={() => { setShowAddField(false); setNewField(emptyNewField); }}
                        className="px-4 py-2 bg-[#F7F4EE] text-[#3A332C]/60 rounded-xl text-sm font-semibold hover:bg-[#E2DED6] transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAddField(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-violet-500/30 text-violet-400/70 hover:text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/5 text-sm font-semibold transition">
                    <Plus size={14} /> Add Field
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Section 5: Badge Design ── */}
          <div id="badge" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Award} title="Badge Design" desc="Digital badge awarded to verified attendees" />

            {/* Mode tabs */}
            <div className="flex bg-[#F7F4EE] border border-[#E2DED6] rounded-xl p-1 w-fit">
              {(["design", "upload"] as const).map((mode) => (
                <button key={mode} type="button"
                  onClick={() => setForm((f) => ({ ...f, badgeMode: mode }))}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition
                    ${form.badgeMode === mode ? "bg-[#E8923C] text-white shadow-md" : "text-[#3A332C]/50 hover:opacity-70"}`}
                >
                  {mode === "design" ? "Design Badge" : "Upload Badge"}
                </button>
              ))}
            </div>

            {form.badgeMode === "design" ? (
              <div className="space-y-5">
                {/* Shape */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Shape</label>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_SHAPES.map((s) => (
                      <button key={s} type="button"
                        onClick={() => setForm((f) => ({ ...f, badgeShape: s }))}
                        aria-pressed={form.badgeShape === s}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition border-2
                          ${form.badgeShape === s ? "bg-[#E8923C]/15 border-amber-400/60 text-[#E8923C]" : "bg-[#F7F4EE] border-transparent text-[#3A332C]/60 hover:bg-[#E2DED6]"}`}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.badgeColor}
                      onChange={(e) => setForm((f) => ({ ...f, badgeColor: e.target.value }))}
                      className="w-12 h-12 rounded-xl border-0 cursor-pointer bg-transparent" />
                    <span className="text-sm font-mono text-white/60">{form.badgeColor}</span>
                  </div>
                </div>

                {/* Badge Emoji */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Badge Emoji</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_LIST.map((em) => (
                      <button key={em} type="button"
                        onClick={() => setForm((f) => ({ ...f, badgeEmoji: em }))}
                        aria-pressed={form.badgeEmoji === em}
                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition border-2
                          ${form.badgeEmoji === em ? "bg-[#E8923C]/20 border-amber-400" : "bg-[#F7F4EE] border-transparent hover:bg-[#E2DED6]"}`}
                      >{em}</button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-5 bg-[#F7F4EE] rounded-2xl p-5 border border-[#E2DED6]">
                  <div aria-hidden="true" style={badgePreviewStyle}>{form.badgeEmoji}</div>
                  <div>
                    <p className="text-xs text-[#3A332C]/40 uppercase tracking-wider mb-1">Preview</p>
                    <p className="text-base font-bold text-white">{form.title || "Event Title"}</p>
                    <p className="text-xs text-[#3A332C]/50 mt-0.5 capitalize">{form.badgeShape} · {form.badgeColor}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#3A332C]/60">Upload a custom badge image. Transparent PNG recommended — minimum 200×200px.</p>

                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#E2DED6] rounded-2xl cursor-pointer hover:border-amber-400/40 hover:bg-[#E8923C]/5 transition group relative overflow-hidden">
                  {form.badgeImagePreviewUrl || form.existingBadgeImageUrl ? (
                    <>
                      <img
                        src={form.badgeImagePreviewUrl || form.existingBadgeImageUrl}
                        alt="Badge preview"
                        className="absolute inset-0 w-full h-full object-contain p-6"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-[#3A332C]text-sm font-semibold">
                        <Upload size={16} /> Replace badge
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#3A332C]/40 group-hover:text-[#E8923C]/70 transition">
                      <Award size={32} />
                      <span className="text-sm font-semibold">Click to upload badge image</span>
                      <span className="text-xs">PNG, SVG, JPG — transparent PNG recommended</span>
                    </div>
                  )}
                  <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        const previewUrl = URL.createObjectURL(file);
                        setForm((f) => ({ ...f, badgeImageFile: file, badgeImagePreviewUrl: previewUrl }));
                      }
                    }}
                  />
                </label>

                {(form.badgeImageFile || form.existingBadgeImageUrl) && (
                  <button type="button"
                    onClick={() => setForm((f) => ({ ...f, badgeImageFile: null, badgeImagePreviewUrl: "", existingBadgeImageUrl: "" }))}
                    className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition"
                  >
                    <X size={12} /> Remove badge image
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Mobile submit bar ── */}
          <div className="lg:hidden sticky bottom-0 bg-[#F7F4EE]/95 backdrop-blur-xl border-t border-[#E2DED6] px-4 py-4 -mx-4">
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="w-full bg-[#E8923C] text-white py-3.5 rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><div className="w-4 h-4 border-2 border-[#0F0E17]/30 border-t-[#0F0E17] rounded-full animate-spin" /> Saving…</>
                : <><Save size={15} /> Save Changes</>}
            </button>
          </div>

          <div className="h-8" />
        </div>
      </div>
    </main>
  );
}

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#E8923C]/12 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={16} className="text-[#E8923C]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-[#3A332C]/50 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
