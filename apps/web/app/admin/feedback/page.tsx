"use client";
import { useState, useEffect } from "react";
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
  Hackathon: { bg: "bg-amber-400/10", text: "text-amber-400" },
  Workshop: { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk: { bg: "bg-cyan-400/10", text: "text-cyan-400" },
  Others: { bg: "bg-green-400/10", text: "text-green-400" },
  Seminar: { bg: "bg-pink-400/10", text: "text-pink-400" },
  Bootcamp: { bg: "bg-orange-400/10", text: "text-orange-400" },
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
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
        checked ? "bg-amber-400" : "bg-white/10"
      }`}
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
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedId);

  return (
    <main className="min-h-screen bg-[#0F0E17] flex flex-col">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3,.font-black,.font-bold { font-family: 'Outfit', sans-serif; }`}</style>

      {/* Nav */}
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
            href="/admin/events"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition"
          >
            Events
          </a>
          <a
            href="/admin/students"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition"
          >
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a
            href="/admin/feedback"
            className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold"
            aria-current="page"
          >
            <ClipboardList size={14} aria-hidden="true" /> Feedback Forms
          </a>
          {isSuperAdmin && (
            <a
              href="/admin/requests"
              className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition"
            >
              <Users size={14} aria-hidden="true" /> Requests
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="text-white/40 hover:text-red-400 transition"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </nav>

      {/* Two-panel body */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* ── Left panel: Event list ── */}
        <aside className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-white/8 md:sticky md:top-14 md:h-[calc(100vh-57px)] flex flex-col">
          <div className="p-4 border-b border-white/8">
            <h1 className="text-base font-black text-white mb-3">Feedback Forms</h1>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search events"
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {filtered.length === 0 && (
              <p className="text-white/30 text-sm text-center py-8">No events found</p>
            )}
            {filtered.map((evt) => {
              const typeStyle = TYPE_STYLES[evt.type] ?? TYPE_STYLES.Others;
              const isSelected = evt.id === selectedId;
              const hasForm = !!evt.feedbackForm?.tasks?.length;
              const startDate = evt.startAt?.toDate?.() ?? null;
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => setSelectedId(evt.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${
                    isSelected
                      ? "border-amber-400/40 bg-amber-400/5"
                      : "border-white/8 bg-white/2 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl shrink-0 mt-0.5">{evt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {evt.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeStyle.bg} ${typeStyle.text}`}
                        >
                          {evt.type}
                        </span>
                        {startDate && (
                          <span className="text-xs text-white/30">
                            {startDate.toLocaleDateString("en-MY", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      {hasForm && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
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
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-20 px-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                <ClipboardList size={28} className="text-white/20" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white font-bold">Select an event</p>
                <p className="text-white/30 text-sm mt-1">
                  Choose an event from the left to build its feedback form
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
              {/* Event header */}
              {selectedEvent && (
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedEvent.emoji}</span>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">
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
                <label
                  htmlFor="form-instructions"
                  className="text-xs font-semibold text-white/50 uppercase tracking-wider"
                >
                  Form Instructions{" "}
                  <span className="normal-case font-normal text-white/30">(optional)</span>
                </label>
                <textarea
                  id="form-instructions"
                  rows={2}
                  placeholder="e.g. Please complete all sections before submitting."
                  value={builderState.instructions}
                  onChange={(e) =>
                    setBuilderState((prev) =>
                      prev ? { ...prev, instructions: e.target.value } : prev
                    )
                  }
                  className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition resize-none"
                />
              </div>

              {/* Built-in sections */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Submission Sections
                </p>

                {(["photo", "activity", "reflection"] as const).map((key) => {
                  const s = builderState[key];
                  const isExpanded = expandedSections.has(key);
                  return (
                    <div
                      key={key}
                      className={`border rounded-2xl overflow-hidden transition-all ${
                        s.enabled
                          ? "border-amber-400/20 bg-amber-400/[0.03]"
                          : "border-white/8 bg-white/[0.02] opacity-60"
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={s.enabled ? "text-amber-400" : "text-white/30"}
                          >
                            <SectionIcon id={key} />
                          </span>
                          <span className="text-sm font-semibold text-white truncate">
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
                              className="text-white/30 hover:text-white/60 transition"
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
                        <div className="border-t border-white/8 px-4 py-4 flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-white/40">Section title</label>
                            <input
                              type="text"
                              value={s.title}
                              onChange={(e) =>
                                updateSection(key, { title: e.target.value })
                              }
                              placeholder={SECTION_DEFAULTS[key].title}
                              className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-white/40">
                              Prompt / description for students
                            </label>
                            <textarea
                              rows={2}
                              value={s.description}
                              onChange={(e) =>
                                updateSection(key, { description: e.target.value })
                              }
                              placeholder={SECTION_DEFAULTS[key].description}
                              className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition resize-none"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/40">Required</span>
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
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Custom Questions
                  </p>
                  {!showAddTask && (
                    <button
                      type="button"
                      onClick={() => setShowAddTask(true)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition font-semibold"
                    >
                      <Plus size={12} aria-hidden="true" /> Add question
                    </button>
                  )}
                </div>

                {/* Existing custom tasks */}
                {builderState.customTasks.length === 0 && !showAddTask && (
                  <p className="text-white/20 text-sm text-center py-4 border border-dashed border-white/8 rounded-2xl">
                    No custom questions yet
                  </p>
                )}

                {builderState.customTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-white/10 text-white/40 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/30 capitalize">
                          {task.type === "textarea" ? "Long text" : "Short text"}
                        </span>
                        {task.required && (
                          <span className="text-xs text-amber-400/70">Required</span>
                        )}
                        {task.minLength && (
                          <span className="text-xs text-white/30">
                            Min {task.minLength} chars
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomTask(task.id)}
                      aria-label={`Remove ${task.title}`}
                      className="text-white/20 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {/* Add question form */}
                {showAddTask && (
                  <div className="bg-white/5 border border-amber-400/20 rounded-2xl p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      New Question
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-white/40">Question label</label>
                      <input
                        type="text"
                        value={newTask.label}
                        onChange={(e) =>
                          setNewTask((p) => ({ ...p, label: e.target.value }))
                        }
                        placeholder="e.g. What was your biggest challenge?"
                        className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition"
                        autoFocus
                      />
                    </div>

                    {/* Type selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-white/40">Answer type</label>
                      <div
                        className="flex bg-white/5 border border-white/8 rounded-xl p-1"
                        role="group"
                        aria-label="Answer type"
                      >
                        {(["textarea", "text"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewTask((p) => ({ ...p, type: t }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                              newTask.type === t
                                ? "bg-amber-400 text-[#0F0E17]"
                                : "text-white/40 hover:text-white"
                            }`}
                          >
                            {t === "textarea" ? "Long text" : "Short text"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newTask.type === "textarea" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-white/40">
                          Minimum characters{" "}
                          <span className="text-white/20">(optional)</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={newTask.minLength}
                          onChange={(e) =>
                            setNewTask((p) => ({ ...p, minLength: e.target.value }))
                          }
                          placeholder="e.g. 50"
                          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/40 transition w-32"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">Required</span>
                        <Toggle
                          checked={newTask.required}
                          onChange={() =>
                            setNewTask((p) => ({ ...p, required: !p.required }))
                          }
                          label="Question required"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddTask(false);
                            setNewTask({
                              label: "",
                              type: "textarea",
                              required: true,
                              minLength: "",
                            });
                          }}
                          className="text-xs text-white/40 hover:text-white transition px-3 py-1.5"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={addCustomTask}
                          disabled={!newTask.label.trim()}
                          className="text-xs font-semibold bg-amber-400 text-[#0F0E17] rounded-xl px-4 py-1.5 disabled:opacity-40 transition hover:bg-amber-300"
                        >
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
                  <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-2xl px-4 py-3">
                    <Check size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-emerald-400 font-semibold">
                      Feedback form saved successfully.
                    </p>
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-2xl px-4 py-3">
                    <AlertCircle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-red-400">{saveError}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-2xl bg-amber-400 text-[#0F0E17] font-black text-sm hover:bg-amber-300 disabled:opacity-50 transition shadow-lg shadow-amber-400/20"
                >
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
