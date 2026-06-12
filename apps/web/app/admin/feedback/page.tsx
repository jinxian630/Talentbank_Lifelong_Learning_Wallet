"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { db } from "@talentbank/firebase-config";
import { updateEventFeedbackForm } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { auth } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import {
  LogOut,
  Users,
  ClipboardList,
  GraduationCap,
  Search,
  Camera,
  PenLine,
  BookOpen,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
} from "lucide-react";
import type { FeedbackFormTask, FeedbackFormConfig, TalentEvent } from "@talentbank/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventListItem {
  id: string;
  title: string;
  type: string;
  emoji: string;
  startAt: any;
  feedbackForm?: FeedbackFormConfig;
}

interface BuiltinSection {
  id: "photo" | "activity" | "reflection";
  enabled: boolean;
  title: string;
  description: string;
  required: boolean;
}

interface BuilderState {
  instructions: string;
  photo: BuiltinSection;
  activity: BuiltinSection;
  reflection: BuiltinSection;
  customTasks: FeedbackFormTask[];
}

interface NewCustomTask {
  label: string;
  type: "text" | "textarea";
  required: boolean;
  minLength: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const SECTION_DEFAULTS: Record<"photo" | "activity" | "reflection", Omit<BuiltinSection, "enabled">> = {
  photo: {
    id: "photo",
    title: "Event Photo",
    description: "Upload a photo from the event.",
    required: true,
  },
  activity: {
    id: "activity",
    title: "Activity Task",
    description: "Describe what you accomplished at this event.",
    required: true,
  },
  reflection: {
    id: "reflection",
    title: "Learning Reflection",
    description: "What did you learn from this experience?",
    required: true,
  },
};

function makeBuilderState(existing?: FeedbackFormConfig): BuilderState {
  if (!existing) {
    return {
      instructions: "",
      photo: { ...SECTION_DEFAULTS.photo, enabled: true },
      activity: { ...SECTION_DEFAULTS.activity, enabled: true },
      reflection: { ...SECTION_DEFAULTS.reflection, enabled: true },
      customTasks: [],
    };
  }
  const find = (id: string) => existing.tasks.find((t) => t.id === id);
  const toSection = (id: "photo" | "activity" | "reflection"): BuiltinSection => {
    const saved = find(id);
    if (!saved) return { ...SECTION_DEFAULTS[id], enabled: false };
    return {
      id,
      enabled: true,
      title: saved.title,
      description: saved.description ?? "",
      required: saved.required,
    };
  };
  return {
    instructions: existing.instructions ?? "",
    photo: toSection("photo"),
    activity: toSection("activity"),
    reflection: toSection("reflection"),
    customTasks: existing.tasks.filter(
      (t) => !["photo", "activity", "reflection"].includes(t.id)
    ),
  };
}

function buildPayload(state: BuilderState): FeedbackFormConfig {
  const tasks: FeedbackFormTask[] = [];
  for (const key of ["photo", "activity", "reflection"] as const) {
    const s = state[key];
    if (!s.enabled) continue;
    tasks.push({
      id: s.id,
      type: s.id === "photo" ? "photo" : "textarea",
      title: s.title.trim() || SECTION_DEFAULTS[s.id].title,
      ...(s.description.trim() ? { description: s.description.trim() } : {}),
      required: s.required,
    });
  }
  tasks.push(...state.customTasks);
  return {
    ...(state.instructions.trim() ? { instructions: state.instructions.trim() } : {}),
    tasks,
  };
}

// ─── Type styles ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]" },
  Workshop:  { bg: "bg-[#C9A876]/15", text: "text-[#9a7a4a]" },
  Talk:      { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]" },
  Others:    { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]" },
  Seminar:   { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]" },
  Bootcamp:  { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]" },
};

// ─── Section icon ─────────────────────────────────────────────────────────────

function SectionIcon({ id }: { id: "photo" | "activity" | "reflection" }) {
  const cls = "shrink-0";
  if (id === "photo") return <Camera size={16} className={cls} aria-hidden="true" />;
  if (id === "activity") return <PenLine size={16} className={cls} aria-hidden="true" />;
  return <BookOpen size={16} className={cls} aria-hidden="true" />;
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0`}
      style={{ backgroundColor: checked ? "var(--color-primary-orange)" : "var(--color-shadow-grey)" }}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { loading: authLoading, isSuperAdmin } = useAdminGuard();

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builderState, setBuilderState] = useState<BuilderState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // custom question form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<NewCustomTask>({
    label: "",
    type: "textarea",
    required: true,
    minLength: "",
  });

  // expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["photo", "activity", "reflection"])
  );

  // load events
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      const items: EventListItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title ?? "",
          type: data.type ?? "Others",
          emoji: data.emoji ?? "🎉",
          startAt: data.startAt,
          feedbackForm: data.feedbackForm,
        };
      });
      items.sort((a, b) => {
        const aTime = a.startAt?.toDate?.()?.getTime?.() ?? 0;
        const bTime = b.startAt?.toDate?.()?.getTime?.() ?? 0;
        return bTime - aTime;
      });
      setEvents(items);
    });
    return unsub;
  }, []);

  // reset builder when event selection changes
  useEffect(() => {
    if (!selectedId) {
      setBuilderState(null);
      return;
    }
    const evt = events.find((e) => e.id === selectedId);
    setBuilderState(makeBuilderState(evt?.feedbackForm));
    setSaveSuccess(false);
    setSaveError(null);
    setShowAddTask(false);
    setExpandedSections(new Set(["photo", "activity", "reflection"]));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await signOut(auth);
  };

  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const updateSection = (
    key: "photo" | "activity" | "reflection",
    patch: Partial<BuiltinSection>
  ) => {
    setBuilderState((prev) =>
      prev ? { ...prev, [key]: { ...prev[key], ...patch } } : prev
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeCustomTask = (id: string) => {
    setBuilderState((prev) =>
      prev
        ? { ...prev, customTasks: prev.customTasks.filter((t) => t.id !== id) }
        : prev
    );
  };

  const addCustomTask = () => {
    if (!newTask.label.trim()) return;
    const task: FeedbackFormTask = {
      id: crypto.randomUUID(),
      type: newTask.type,
      title: newTask.label.trim(),
      required: newTask.required,
      ...(newTask.type === "textarea" && newTask.minLength
        ? { minLength: Number(newTask.minLength) }
        : {}),
    };
    setBuilderState((prev) =>
      prev ? { ...prev, customTasks: [...prev.customTasks, task] } : prev
    );
    setNewTask({ label: "", type: "textarea", required: true, minLength: "" });
    setShowAddTask(false);
  };

  const handleSave = async () => {
    if (!selectedId || !builderState) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateEventFeedbackForm(selectedId, buildPayload(builderState));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedId);

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      {/* Nav */}
      <nav className="backdrop-blur-xl sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: "rgba(247,244,238,0.92)", borderBottom: "1px solid var(--color-shadow-grey)" }}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet" width={80} height={80} className="rounded-xl -my-2" onError={() => {}} />
          </div>
          <a href="/admin/events" className="text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>Events</a>
          <a href="/admin/students" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-primary-orange)" }} aria-current="page">
            <ClipboardList size={14} aria-hidden="true" /> Feedback Forms
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <GraduationCap size={14} aria-hidden="true" /> Exams
          </a>
          {isSuperAdmin && (
            <a href="/admin/requests" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
              <Users size={14} aria-hidden="true" /> Requests
            </a>
          )}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out"
          className="transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
          <LogOut size={16} aria-hidden="true" />
        </button>
      </nav>

      {/* Two-panel body */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* ── Left panel: Event list ── */}
        <aside className="w-full md:w-80 lg:w-96 md:sticky md:top-14 md:h-[calc(100vh-57px)] flex flex-col bg-white"
          style={{ borderRight: "1px solid var(--color-shadow-grey)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
            <h1 className="text-base font-extrabold mb-3" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Feedback Forms</h1>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(58,51,44,0.3)" }} aria-hidden="true" />
              <input type="search" placeholder="Search events…" value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Search events"
                className="w-full rounded-xl pl-8 pr-3 py-2 text-sm outline-none transition"
                style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {filtered.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "rgba(58,51,44,0.35)" }}>No events found</p>
            )}
            {filtered.map((evt) => {
              const typeStyle = TYPE_STYLES[evt.type] ?? TYPE_STYLES.Others;
              const isSelected = evt.id === selectedId;
              const hasForm = !!evt.feedbackForm?.tasks?.length;
              const startDate = evt.startAt?.toDate?.() ?? null;
              return (
                <button key={evt.id} type="button" onClick={() => setSelectedId(evt.id)}
                  className="w-full text-left rounded-2xl p-3 transition-all"
                  style={{
                    border: isSelected ? "1.5px solid rgba(232,146,60,0.4)" : "1px solid var(--color-shadow-grey)",
                    backgroundColor: isSelected ? "rgba(232,146,60,0.06)" : "#fff",
                  }}>
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">{evt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--color-text-dark)" }}>{evt.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeStyle.bg} ${typeStyle.text}`}>{evt.type}</span>
                        {startDate && (
                          <span className="text-xs" style={{ color: "rgba(58,51,44,0.4)" }}>
                            {startDate.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      {hasForm && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: "rgba(232,146,60,0.1)", color: "var(--color-primary-orange)" }}>
                          <Check size={10} aria-hidden="true" /> Form set
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right panel: Builder ── */}
        <section className="flex-1 overflow-y-auto">
          {!selectedId || !builderState ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-20 px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--color-shadow-grey)" }}>
                <ClipboardList size={28} style={{ color: "rgba(58,51,44,0.25)" }} aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>Select an event</p>
                <p className="text-sm mt-1" style={{ color: "rgba(58,51,44,0.4)" }}>Choose an event from the left to build its feedback form</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
              {/* Event header */}
              {selectedEvent && (
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedEvent.emoji}</span>
                  <div>
                    <h2 className="text-xl font-extrabold leading-tight" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>
                      {selectedEvent.title}
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        (TYPE_STYLES[selectedEvent.type] ?? TYPE_STYLES.Others).bg
                      } ${(TYPE_STYLES[selectedEvent.type] ?? TYPE_STYLES.Others).text}`}
                    >
                      {selectedEvent.type}
                    </span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="flex flex-col gap-2">
                <label htmlFor="form-instructions"
                  className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.5)" }}>
                  Form Instructions{" "}
                  <span className="normal-case font-normal" style={{ color: "rgba(58,51,44,0.35)" }}>(optional)</span>
                </label>
                <textarea id="form-instructions" rows={2}
                  placeholder="e.g. Please complete all sections before submitting."
                  value={builderState.instructions}
                  onChange={(e) => setBuilderState((prev) => prev ? { ...prev, instructions: e.target.value } : prev)}
                  className="rounded-2xl px-4 py-3 text-sm outline-none transition resize-none"
                  style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                />
              </div>

              {/* Built-in sections */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.5)" }}>
                  Submission Sections
                </p>

                {(["photo", "activity", "reflection"] as const).map((key) => {
                  const s = builderState[key];
                  const isExpanded = expandedSections.has(key);
                  return (
                    <div key={key} className="rounded-2xl overflow-hidden transition-all"
                      style={{
                        border: s.enabled ? "1.5px solid rgba(232,146,60,0.25)" : "1px solid var(--color-shadow-grey)",
                        backgroundColor: s.enabled ? "rgba(232,146,60,0.03)" : "#fff",
                        opacity: s.enabled ? 1 : 0.7,
                      }}>
                      {/* Header row */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span style={{ color: s.enabled ? "var(--color-primary-orange)" : "rgba(58,51,44,0.3)" }}>
                            <SectionIcon id={key} />
                          </span>
                          <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text-dark)" }}>
                            {s.title || SECTION_DEFAULTS[key].title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Toggle
                            checked={s.enabled}
                            onChange={() => updateSection(key, { enabled: !s.enabled })}
                            label={`Enable ${s.title || SECTION_DEFAULTS[key].title}`}
                          />
                          {s.enabled && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(key)}
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                              className="transition-opacity hover:opacity-60"
                            style={{ color: "rgba(58,51,44,0.4)" }}
                            >
                              {isExpanded ? (
                                <ChevronUp size={14} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={14} aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Editable fields */}
                      {s.enabled && isExpanded && (
                        <div className="px-4 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--color-shadow-grey)" }}>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Section title</label>
                            <input type="text" value={s.title}
                              onChange={(e) => updateSection(key, { title: e.target.value })}
                              placeholder={SECTION_DEFAULTS[key].title}
                              className="rounded-xl px-3 py-2 text-sm outline-none transition"
                              style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
                              Prompt / description for students
                            </label>
                            <textarea rows={2} value={s.description}
                              onChange={(e) => updateSection(key, { description: e.target.value })}
                              placeholder={SECTION_DEFAULTS[key].description}
                              className="rounded-xl px-3 py-2 text-sm outline-none transition resize-none"
                              style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Required</span>
                            <Toggle
                              checked={s.required}
                              onChange={() =>
                                updateSection(key, { required: !s.required })
                              }
                              label={`${s.title} required`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom questions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.5)" }}>
                    Custom Questions
                  </p>
                  {!showAddTask && (
                    <button type="button" onClick={() => setShowAddTask(true)}
                      className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                      style={{ color: "var(--color-primary-orange)" }}>
                      <Plus size={12} aria-hidden="true" /> Add question
                    </button>
                  )}
                </div>

                {/* Existing custom tasks */}
                {builderState.customTasks.length === 0 && !showAddTask && (
                  <p className="text-sm text-center py-4 rounded-2xl border border-dashed"
                    style={{ color: "rgba(58,51,44,0.3)", borderColor: "var(--color-shadow-grey)" }}>
                    No custom questions yet
                  </p>
                )}

                {builderState.customTasks.map((task, idx) => (
                  <div key={task.id} className="flex items-start gap-3 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}>
                    <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold"
                      style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.5)" }}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-dark)" }}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs capitalize" style={{ color: "rgba(58,51,44,0.4)" }}>
                          {task.type === "textarea" ? "Long text" : "Short text"}
                        </span>
                        {task.required && (
                          <span className="text-xs" style={{ color: "var(--color-primary-orange)" }}>Required</span>
                        )}
                        {task.minLength && (
                          <span className="text-xs" style={{ color: "rgba(58,51,44,0.35)" }}>Min {task.minLength} chars</span>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => removeCustomTask(task.id)}
                      aria-label={`Remove ${task.title}`}
                      className="transition-colors hover:text-red-400 shrink-0"
                      style={{ color: "rgba(58,51,44,0.25)" }}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {/* Add question form */}
                {showAddTask && (
                  <div className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ backgroundColor: "#fff", border: "1.5px solid rgba(232,146,60,0.3)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary-orange)" }}>
                      New Question
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Question label</label>
                      <input type="text" value={newTask.label} autoFocus
                        onChange={(e) => setNewTask((p) => ({ ...p, label: e.target.value }))}
                        placeholder="e.g. What was your biggest challenge?"
                        className="rounded-xl px-3 py-2 text-sm outline-none transition"
                        style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Answer type</label>
                      <div className="flex rounded-xl p-1" role="group" aria-label="Answer type"
                        style={{ backgroundColor: "var(--color-shadow-grey)" }}>
                        {(["textarea", "text"] as const).map((t) => (
                          <button key={t} type="button"
                            onClick={() => setNewTask((p) => ({ ...p, type: t }))}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                            style={newTask.type === t
                              ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                              : { color: "rgba(58,51,44,0.5)" }}>
                            {t === "textarea" ? "Long text" : "Short text"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newTask.type === "textarea" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
                          Minimum characters <span style={{ color: "rgba(58,51,44,0.3)" }}>(optional)</span>
                        </label>
                        <input type="number" min={1} value={newTask.minLength}
                          onChange={(e) => setNewTask((p) => ({ ...p, minLength: e.target.value }))}
                          placeholder="e.g. 50"
                          className="rounded-xl px-3 py-2 text-sm outline-none transition w-32"
                          style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Required</span>
                        <Toggle checked={newTask.required}
                          onChange={() => setNewTask((p) => ({ ...p, required: !p.required }))}
                          label="Question required" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => { setShowAddTask(false); setNewTask({ label: "", type: "textarea", required: true, minLength: "" }); }}
                          className="text-xs px-3 py-1.5 transition-opacity hover:opacity-60"
                          style={{ color: "rgba(58,51,44,0.5)" }}>
                          Cancel
                        </button>
                        <button type="button" onClick={addCustomTask} disabled={!newTask.label.trim()}
                          className="text-xs font-semibold rounded-xl px-4 py-1.5 disabled:opacity-40 transition text-white"
                          style={{ backgroundColor: "var(--color-primary-orange)" }}>
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save button + toast */}
              <div className="flex flex-col gap-3 pb-8">
                {saveSuccess && (
                  <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: "rgba(143,191,140,0.15)", border: "1px solid rgba(143,191,140,0.3)" }}>
                    <Check size={16} className="shrink-0" style={{ color: "#4a8a47" }} aria-hidden="true" />
                    <p className="text-sm font-semibold" style={{ color: "#4a8a47" }}>Feedback form saved successfully.</p>
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-2 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <AlertCircle size={16} className="shrink-0 text-red-500" aria-hidden="true" />
                    <p className="text-sm text-red-500">{saveError}</p>
                  </div>
                )}
                <button type="button" onClick={handleSave} disabled={saving}
                  className="w-full py-3 rounded-2xl text-white font-bold text-sm disabled:opacity-50 transition shadow-md"
                  style={{ backgroundColor: "var(--color-primary-orange)" }}>
                  {saving ? "Saving…" : "Save Feedback Form"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
