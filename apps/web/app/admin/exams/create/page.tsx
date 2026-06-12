"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { createCertExam, updateCertExam } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Timestamp } from "firebase/firestore";
import {
  LogOut, Plus, Trash2, Info, Calendar, ImageIcon,
  ClipboardList, GraduationCap, Link, Users, Award,
} from "lucide-react";
import Toast from "@/components/Toast";

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "basic",    label: "Basic Info",           icon: Info,          desc: "Exam title and description"       },
  { id: "details",  label: "Cert Details",          icon: Award,         desc: "Difficulty, duration, issuer"     },
  { id: "datetime", label: "Date & Online",         icon: Calendar,      desc: "Exam date and online link"        },
  { id: "media",    label: "Exam Banner",           icon: ImageIcon,     desc: "Cover image for the exam"         },
  { id: "slots",    label: "Slots & XP",            icon: GraduationCap, desc: "Capacity and XP requirement"     },
  { id: "checklist",label: "Preparation Checklist", icon: ClipboardList, desc: "Step-by-step guide for students" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="w-9 h-9 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-amber-400" aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-bold text-white text-base leading-tight">{title}</h2>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `bg-white/5 border ${err ? "border-red-400/50" : "border-white/10"} rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-white/30 w-full transition`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateExamPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    examDate: "",
    examUrl: "",
    maxSlots: 30,
    requiredXP: 500,
  });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<string[]>(["", "", ""]);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
  const [durationHours, setDurationHours] = useState('');
  const [issuer, setIssuer] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "delete"; message: string } | null>(null);
  const [activeSection, setActiveSection] = useState("basic");

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-30% 0px -60% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const handleLogout = async () => { await signOut(auth); router.push("/"); };

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const updateStep = (i: number, val: string) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  const addStep    = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  function isSectionFilled(id: string): boolean {
    switch (id) {
      case "basic":     return !!form.title.trim();
      case "details":   return !!difficulty || !!durationHours || !!issuer || !!tagsInput;
      case "datetime":  return !!form.examDate && !!form.examUrl.trim();
      case "media":     return !!bannerFile;
      case "slots":     return Number(form.maxSlots) > 0;
      case "checklist": return steps.some((s) => s.trim() !== "");
      default:          return false;
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim())    errs.title    = "Exam title is required";
    if (!form.examDate)        errs.examDate = "Exam date is required";
    if (!form.examUrl.trim())  errs.examUrl  = "Exam link is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstId = errs.title ? "basic" : "datetime";
      document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return Object.keys(errs).length === 0;
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const docRef = await createCertExam({
        title:       form.title.trim(),
        description: form.description.trim(),
        examDate:    Timestamp.fromDate(new Date(form.examDate)),
        examUrl:     form.examUrl.trim(),
        maxSlots:    Number(form.maxSlots),
        requiredXP:  Number(form.requiredXP),
        steps:       steps.filter((s) => s.trim() !== ""),
        ...(difficulty    && { difficulty }),
        ...(durationHours && { durationHours: parseFloat(durationHours) }),
        ...(issuer.trim() && { issuer: issuer.trim() }),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      });

      if (bannerFile) {
        const ext  = bannerFile.name.split(".").pop() ?? "jpg";
        const sRef = ref(storage, `exams/${docRef.id}/banner.${ext}`);
        await uploadBytes(sRef, bannerFile);
        await updateCertExam(docRef.id, { bannerImageUrl: await getDownloadURL(sRef) });
      }

      setToast({ type: "success", message: "Exam created successfully! 🎓" });
      setTimeout(() => router.push("/admin/exams"), 1500);
    } catch {
      setToast({ type: "delete", message: "Failed to create exam. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3,.font-black,.font-bold { font-family: 'Outfit', sans-serif; }`}</style>

      {/* ── Nav ── */}
      <nav className="bg-[#0F0E17]/90 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-amber-400 text-[#0F0E17] rounded-xl px-2.5 py-1 font-black text-xs shadow-lg shadow-amber-400/30">TB</div>
          <span className="text-white/30">/</span>
          <a href="/admin/exams" className="text-white/50 hover:text-white transition font-medium">Exams</a>
          <span className="text-white/30">/</span>
          <span className="text-white font-bold">Create Exam</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/admin/events"   className="text-white/40 hover:text-white text-sm transition hidden sm:block">Events</a>
          <a href="/admin/students" className="text-white/40 hover:text-white text-sm transition hidden sm:block">Attendance</a>
          <a href="/admin/feedback" className="text-white/40 hover:text-white text-sm transition hidden sm:block">Feedback Forms</a>
          <a href="/admin/exams"    className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold hidden sm:flex">
            <GraduationCap size={14} /> Exams
          </a>
          {isSuperAdmin && <a href="/admin/requests" className="text-white/40 hover:text-white text-sm transition hidden sm:block">Requests</a>}
          <button type="button" onClick={handleLogout} title="Sign out" className="text-white/40 hover:text-red-400 transition">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* ── Mobile step pills ── */}
      <div className="lg:hidden sticky top-[61px] z-30 bg-[#0F0E17]/95 backdrop-blur-xl border-b border-white/8 px-4 py-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const filled = isSectionFilled(id);
            const active = activeSection === id;
            return (
              <button key={id} type="button"
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap
                  ${active ? "bg-amber-400 text-[#0F0E17]" : filled ? "bg-amber-400/15 text-amber-400" : "bg-white/5 text-white/40"}`}
              >
                <Icon size={11} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex max-w-6xl mx-auto">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0">
          <div className="sticky top-[69px] h-[calc(100vh-69px)] flex flex-col p-6 gap-1 overflow-y-auto">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Sections</p>

            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const filled = isSectionFilled(id);
              const active = activeSection === id;
              return (
                <button key={id} type="button"
                  onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left group
                    ${active ? "bg-amber-400/10 text-amber-400" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                    ${filled ? "bg-amber-400 border-amber-400" : active ? "border-amber-400" : "border-white/20 group-hover:border-white/40"}`}>
                    {filled && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#0F0E17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}

            <div className="mt-auto pt-6 flex flex-col gap-2">
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="w-full bg-amber-400 text-[#0F0E17] py-3 rounded-xl font-black text-sm hover:bg-amber-300 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-[#0F0E17]/30 border-t-[#0F0E17] rounded-full animate-spin" /> Creating…</>
                  : <><Plus size={15} /> Create Exam</>}
              </button>
              <a href="/admin/exams"
                className="w-full text-center text-sm text-white/40 hover:text-white transition py-2 rounded-xl hover:bg-white/5"
              >Cancel</a>
            </div>
          </div>
        </aside>

        {/* ── Form sections ── */}
        <div className="flex-1 px-4 lg:px-8 py-8 space-y-6 min-w-0">

          {/* 1 — Basic Info */}
          <div id="basic" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={Info} title="Basic Info" desc="Exam title and description" />

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Exam Title <span className="text-red-400">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Blockchain Fundamentals Certificate"
                title="Exam title"
                className={inputCls(errors.title)}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1" role="alert">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Description <span className="text-white/20 font-normal normal-case">— optional</span>
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What this exam covers, who it's for..."
                title="Exam description"
                className={inputCls()}
              />
            </div>
          </div>

          {/* 2 — Certificate Details */}
          <div id="details" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={Award} title="Cert Details" desc="Difficulty, duration, issuer, and topic tags" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  title="Certificate difficulty level"
                  className={inputCls()}
                >
                  <option value="">— optional —</option>
                  <option value="beginner">⭐ Beginner</option>
                  <option value="intermediate">⭐⭐ Intermediate</option>
                  <option value="advanced">⭐⭐⭐ Advanced</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Duration (hours)</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="e.g. 2"
                  title="Estimated duration in hours"
                  className={inputCls()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Issuer</label>
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. Sui Foundation"
                title="Certificate issuing organization"
                className={inputCls()}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Tags <span className="text-white/20 font-normal normal-case">— comma-separated</span>
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Blockchain, Web3, Smart Contracts"
                title="Topic tags (comma-separated)"
                className={inputCls()}
              />
            </div>
          </div>

          {/* 3 — Date & Online */}
          <div id="datetime" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={Calendar} title="Date & Online" desc="Exam date and online link" />

            <div className="inline-flex items-center gap-2 bg-sky-400/10 border border-sky-400/20 rounded-xl px-3 py-1.5">
              <span className="text-sky-400 text-xs font-semibold">🔗 Online Only</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Exam Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.examDate}
                onChange={(e) => update("examDate", e.target.value)}
                title="Exam date and time"
                className={inputCls(errors.examDate)}
              />
              {errors.examDate && <p className="text-red-400 text-xs mt-1" role="alert">{errors.examDate}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Exam Link <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Link size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="url"
                  value={form.examUrl}
                  onChange={(e) => update("examUrl", e.target.value)}
                  placeholder="https://meet.google.com/..."
                  title="Exam meeting or website URL"
                  className={`${inputCls(errors.examUrl)} pl-9`}
                />
              </div>
              {errors.examUrl && <p className="text-red-400 text-xs mt-1" role="alert">{errors.examUrl}</p>}
            </div>
          </div>

          {/* 3 — Exam Banner */}
          <div id="media" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={ImageIcon} title="Exam Banner" desc="Cover image for the exam" />

            {bannerFile ? (
              <div className="space-y-3">
                <img
                  src={URL.createObjectURL(bannerFile)}
                  alt="Banner preview"
                  className="w-full rounded-xl object-cover max-h-48"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 truncate max-w-xs">{bannerFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setBannerFile(null)}
                    className="text-xs text-red-400/70 hover:text-red-400 transition font-semibold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 cursor-pointer border border-dashed border-white/15 hover:border-amber-400/40 rounded-2xl p-10 transition group">
                <ImageIcon size={28} className="text-white/20 group-hover:text-amber-400/50 transition" />
                <div className="text-center">
                  <p className="text-sm text-white/50 group-hover:text-white/70 transition font-medium">Click to upload banner image</p>
                  <p className="text-xs text-white/25 mt-1">PNG, JPG, WEBP</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  title="Upload banner image"
                  className="hidden"
                  onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* 4 — Slots & XP */}
          <div id="slots" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={GraduationCap} title="Slots & XP" desc="Capacity and XP requirement" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Max Slots</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxSlots}
                  onChange={(e) => update("maxSlots", e.target.value)}
                  title="Maximum number of slots"
                  placeholder="30"
                  className={inputCls()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Required XP</label>
                <input
                  type="number"
                  min={0}
                  value={form.requiredXP}
                  onChange={(e) => update("requiredXP", e.target.value)}
                  title="XP required to unlock this exam"
                  placeholder="500"
                  className={inputCls()}
                />
              </div>
            </div>
          </div>

          {/* 5 — Preparation Checklist */}
          <div id="checklist" className="rounded-2xl bg-[#1A1825] border border-white/8 p-6 space-y-5">
            <SectionHeader icon={ClipboardList} title="Preparation Checklist" desc="Step-by-step guide shown to students before they register" />

            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <input
                    value={step}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder={`Step ${i + 1} — e.g. "Download the exam software"`}
                    title={`Step ${i + 1}`}
                    className={inputCls()}
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    disabled={steps.length === 1}
                    aria-label={`Remove step ${i + 1}`}
                    className="text-white/20 hover:text-red-400 transition disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-amber-400 transition font-semibold"
            >
              <Plus size={14} /> Add Step
            </button>
          </div>

          {/* Mobile submit */}
          <div className="lg:hidden flex flex-col gap-2 pb-8">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="w-full bg-amber-400 text-[#0F0E17] py-3.5 rounded-xl font-black text-sm hover:bg-amber-300 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
            >
              {saving ? "Creating…" : <><Plus size={15} /> Create Exam</>}
            </button>
            <a href="/admin/exams" className="w-full text-center text-sm text-white/40 hover:text-white transition py-2">Cancel</a>
          </div>

        </div>
      </div>
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </main>
  );
}
