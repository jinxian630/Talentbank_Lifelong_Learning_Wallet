"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getCertExam, updateCertExam } from "@talentbank/firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import {
  LogOut, Save, Info, Calendar, ImageIcon,
  ClipboardList, GraduationCap, Link, Upload, X, Plus, Trash2, Award,
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

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#E8923C]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={16} className="text-[#E8923C]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-[#3A332C]/50 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `bg-[#F7F4EE] border ${err ? "border-red-400/50" : "border-[#E2DED6]"} rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400/50 placeholder:text-[#3A332C]/40 w-full transition`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditExamPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const { examId } = useParams<{ examId: string }>();

  const [examLoaded, setExamLoaded]           = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [toast, setToast]                     = useState<{ type: "success" | "delete"; message: string } | null>(null);
  const [activeSection, setActiveSection]     = useState("basic");
  const [errors, setErrors]                   = useState<Record<string, string>>({});

  const [bannerFile, setBannerFile]           = useState<File | null>(null);
  const [bannerPreview, setBannerPreview]     = useState("");
  const [existingBannerUrl, setExistingBannerUrl] = useState<string | null>(null);

  const [steps, setSteps] = useState<string[]>([""]);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
  const [durationHours, setDurationHours] = useState('');
  const [issuer, setIssuer] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const [form, setForm] = useState({
    title: "", description: "",
    examDate: "", examUrl: "",
    maxSlots: 30, requiredXP: 500,
  });

  // Load exam data
  useEffect(() => {
    if (!user || !examId) return;
    getCertExam(examId).then((exam: any) => {
      if (!exam) { router.replace("/admin/exams"); return; }
      const d   = exam.examDate?.toDate?.() ?? new Date(exam.examDate);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localDT = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm({
        title:       exam.title       ?? "",
        description: exam.description ?? "",
        examDate:    localDT,
        examUrl:     exam.examUrl     ?? exam.location ?? "",
        maxSlots:    exam.maxSlots    ?? 30,
        requiredXP:  exam.requiredXP  ?? 500,
      });
      setExistingBannerUrl(exam.bannerImageUrl ?? exam.badgeImageUrl ?? null);
      setSteps(exam.steps?.length ? exam.steps : [""]);
      setDifficulty(exam.difficulty ?? '');
      setDurationHours(exam.durationHours?.toString() ?? '');
      setIssuer(exam.issuer ?? '');
      setTagsInput((exam.tags ?? []).join(', '));
      setExamLoaded(true);
    });
  }, [user, examId]);

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (!examLoaded) return;
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
  }, [examLoaded]);

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

  function isSectionFilled(sId: string): boolean {
    switch (sId) {
      case "basic":    return !!form.title.trim();
      case "details":  return !!difficulty || !!durationHours || !!issuer || !!tagsInput;
      case "datetime": return !!form.examDate && !!form.examUrl.trim();
      case "media":    return !!bannerFile || !!existingBannerUrl;
      case "slots":    return Number(form.maxSlots) > 0;
      case "checklist":return steps.some((s) => s.trim() !== "");
      default:         return false;
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim())   errs.title   = "Exam title is required";
    if (!form.examDate)       errs.examDate = "Exam date is required";
    if (!form.examUrl.trim()) errs.examUrl  = "Exam link is required";
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
      const updates: any = {
        title:       form.title.trim(),
        description: form.description.trim(),
        examDate:    Timestamp.fromDate(new Date(form.examDate)),
        examUrl:     form.examUrl.trim(),
        maxSlots:    Number(form.maxSlots),
        requiredXP:  Number(form.requiredXP),
        steps:       steps.filter((s) => s.trim() !== ""),
        ...(difficulty      && { difficulty }),
        ...(durationHours   && { durationHours: parseFloat(durationHours) }),
        ...(issuer.trim()   && { issuer: issuer.trim() }),
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (bannerFile) {
        const ext  = bannerFile.name.split(".").pop() ?? "jpg";
        const sRef = ref(storage, `exams/${examId}/banner.${ext}`);
        await uploadBytes(sRef, bannerFile);
        updates.bannerImageUrl = await getDownloadURL(sRef);
      }

      await updateCertExam(examId, updates);
      setToast({ type: "success", message: "Changes saved successfully!" });
      setTimeout(() => router.push("/admin/exams"), 1500);
    } catch {
      setToast({ type: "delete", message: "Failed to save changes. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !examLoaded)
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#F7F4EE]">

      {/* ── Sticky nav ── */}
      <nav className="bg-[#F7F4EE]/90 border-b border-[#E2DED6] backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-[#E8923C] text-white rounded-xl px-2.5 py-1 font-black text-xs shadow-lg shadow-amber-400/30">TB</div>
          <span className="text-[#3A332C]/40">/</span>
          <a href="/admin/exams" className="text-white/50 hover:opacity-70 transition font-medium">Exams</a>
          <span className="text-[#3A332C]/40">/</span>
          <span className="text-[#3A332C] font-bold truncate max-w-[200px]">{form.title || "Edit Exam"}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/admin/events"   className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Events</a>
          <a href="/admin/students" className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Attendance</a>
          <a href="/admin/feedback" className="text-[#3A332C]/50 hover:opacity-70 text-sm transition hidden sm:block">Feedback Forms</a>
          <a href="/admin/exams"    className="flex items-center gap-1.5 text-[#E8923C] text-sm font-semibold hidden sm:flex">
            <GraduationCap size={14} /> Exams
          </a>
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
                <Icon size={11} />{label}
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
            <p className="text-xs font-semibold text-[#3A332C]/40 uppercase tracking-widest mb-3">Sections</p>

            {SECTIONS.map(({ id: sId, label, icon: Icon }) => {
              const filled = isSectionFilled(sId);
              const active = activeSection === sId;
              return (
                <button key={sId} type="button"
                  onClick={() => document.getElementById(sId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left group
                    ${active ? "bg-[#E8923C]/10 text-[#E8923C]" : "text-white/50 hover:opacity-70 hover:bg-[#F7F4EE]"}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                    ${filled ? "bg-[#E8923C] border-amber-400" : active ? "border-amber-400" : "border-white/20 group-hover:border-white/40"}`}>
                    {filled && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}

            <div className="mt-auto pt-6 flex flex-col gap-2">
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="w-full bg-[#E8923C] text-white py-3 rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-[#0F0E17]/30 border-t-[#0F0E17] rounded-full animate-spin" /> Saving…</>
                  : <><Save size={15} /> Save Changes</>}
              </button>
              <a href="/admin/exams"
                className="w-full text-center text-sm text-[#3A332C]/50 hover:opacity-70 transition py-2 rounded-xl hover:bg-[#F7F4EE]"
              >Cancel</a>
            </div>
          </div>
        </aside>

        {/* ── Form sections ── */}
        <div className="flex-1 px-4 lg:px-8 py-8 space-y-6 min-w-0">

          {/* 1 — Basic Info */}
          <div id="basic" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Info} title="Basic Info" desc="Exam title and description" />

            <div className="space-y-2">
              <label htmlFor="title" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Exam Title <span className="text-red-400">*</span>
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Blockchain Fundamentals Certificate"
                className={inputCls(errors.title)}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1" role="alert">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="desc" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Description <span className="text-white/20 font-normal normal-case">— optional</span>
              </label>
              <textarea
                id="desc"
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What this exam covers, who it's for..."
                className={inputCls() + " resize-none"}
              />
            </div>
          </div>

          {/* 2 — Certificate Details */}
          <div id="details" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Award} title="Cert Details" desc="Difficulty, duration, issuer, and topic tags" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="difficulty" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Difficulty</label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className={inputCls()}
                >
                  <option value="">— optional —</option>
                  <option value="beginner">⭐ Beginner</option>
                  <option value="intermediate">⭐⭐ Intermediate</option>
                  <option value="advanced">⭐⭐⭐ Advanced</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="durationHours" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Duration (hours)</label>
                <input
                  id="durationHours"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="e.g. 2"
                  className={inputCls()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="issuer" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Issuer</label>
              <input
                id="issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. Sui Foundation"
                className={inputCls()}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tagsInput" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Tags <span className="text-white/20 font-normal normal-case">— comma-separated</span>
              </label>
              <input
                id="tagsInput"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Blockchain, Web3, Smart Contracts"
                className={inputCls()}
              />
            </div>
          </div>

          {/* 3 — Date & Online */}
          <div id="datetime" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={Calendar} title="Date & Online" desc="Exam date and online link" />

            <div className="inline-flex items-center gap-2 bg-sky-400/10 border border-sky-400/20 rounded-xl px-3 py-1.5">
              <span className="text-sky-400 text-xs font-semibold">🔗 Online Only</span>
            </div>

            <div className="space-y-2">
              <label htmlFor="examDate" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Exam Date <span className="text-red-400">*</span>
              </label>
              <input
                id="examDate"
                type="datetime-local"
                value={form.examDate}
                onChange={(e) => update("examDate", e.target.value)}
                className={inputCls(errors.examDate)}
              />
              {errors.examDate && <p className="text-red-400 text-xs mt-1" role="alert">{errors.examDate}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="examUrl" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">
                Exam Link <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Link size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3A332C]/40 pointer-events-none" />
                <input
                  id="examUrl"
                  type="url"
                  value={form.examUrl}
                  onChange={(e) => update("examUrl", e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className={`${inputCls(errors.examUrl)} pl-9`}
                />
              </div>
              {errors.examUrl && <p className="text-red-400 text-xs mt-1" role="alert">{errors.examUrl}</p>}
            </div>
          </div>

          {/* 3 — Exam Banner */}
          <div id="media" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={ImageIcon} title="Exam Banner" desc="Cover image for the exam" />

            <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-white/15 rounded-2xl cursor-pointer hover:border-amber-400/40 hover:bg-[#E8923C]/5 transition group relative overflow-hidden">
              {bannerPreview || existingBannerUrl ? (
                <>
                  <img
                    src={bannerPreview || existingBannerUrl!}
                    alt="Exam banner"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 text-white">
                    <Upload size={18} />
                    <span className="text-sm font-semibold">Replace banner</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#3A332C]/40 group-hover:text-[#E8923C]/70 transition">
                  <ImageIcon size={28} />
                  <span className="text-sm font-semibold">Click to upload banner image</span>
                  <span className="text-xs">PNG, JPG, WEBP</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                title="Upload banner image"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    setBannerFile(file);
                    setBannerPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>

            {(bannerFile || existingBannerUrl) && (
              <button
                type="button"
                onClick={() => { setBannerFile(null); setBannerPreview(""); setExistingBannerUrl(null); }}
                className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition"
              >
                <X size={12} /> Remove banner
              </button>
            )}
          </div>

          {/* 4 — Slots & XP */}
          <div id="slots" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={GraduationCap} title="Slots & XP" desc="Capacity and XP requirement" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="maxSlots" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Max Slots</label>
                <input
                  id="maxSlots"
                  type="number"
                  min={1}
                  value={form.maxSlots}
                  onChange={(e) => update("maxSlots", e.target.value)}
                  placeholder="30"
                  className={inputCls()}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="requiredXP" className="text-xs font-semibold text-[#3A332C]/50 uppercase tracking-wider">Required XP</label>
                <input
                  id="requiredXP"
                  type="number"
                  min={0}
                  value={form.requiredXP}
                  onChange={(e) => update("requiredXP", e.target.value)}
                  placeholder="500"
                  className={inputCls()}
                />
              </div>
            </div>
          </div>

          {/* 5 — Preparation Checklist */}
          <div id="checklist" className="rounded-2xl bg-white border border-[#E2DED6] p-6 space-y-5">
            <SectionHeader icon={ClipboardList} title="Preparation Checklist" desc="Step-by-step guide shown to students before they register" />

            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#E8923C]/10 text-[#E8923C] text-xs font-bold flex items-center justify-center shrink-0">
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
              className="flex items-center gap-2 text-sm text-[#3A332C]/50 hover:text-[#E8923C] transition font-semibold"
            >
              <Plus size={14} /> Add Step
            </button>
          </div>

          {/* ── Mobile submit bar ── */}
          <div className="lg:hidden sticky bottom-0 bg-[#F7F4EE]/95 backdrop-blur-xl border-t border-[#E2DED6] px-4 py-4 -mx-4">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="w-full bg-[#E8923C] text-white py-3.5 rounded-xl font-black text-sm hover:opacity-90 disabled:opacity-60 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-[#0F0E17]/30 border-t-[#0F0E17] rounded-full animate-spin" /> Saving…</>
                : <><Save size={15} /> Save Changes</>}
            </button>
          </div>

          <div className="h-8" />
        </div>
      </div>

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </main>
  );
}
