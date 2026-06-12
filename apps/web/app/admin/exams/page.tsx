"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getCertExams, deleteCertExam } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import {
  LogOut, Plus, Trash2, Pencil, Users,
  GraduationCap, ClipboardList, Calendar,
} from "lucide-react";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function AdminExamsPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);
  const [toast, setToast]             = useState<{ type: "success" | "delete"; message: string } | null>(null);
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    if (user) fetchExams();
  }, [user]);

  const fetchExams = async () => {
    const data = await getCertExams();
    const sorted = [...data].sort((a: any, b: any) => {
      const da = a.examDate?.toDate?.() ?? new Date(0);
      const db2 = b.examDate?.toDate?.() ?? new Date(0);
      return da.getTime() - db2.getTime();
    });
    setExams(sorted);
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteCertExam(confirmId);
      setConfirmId(null);
      fetchExams();
      setToast({ type: "delete", message: "Exam deleted successfully." });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const formatDate = (ts: any) => {
    try {
      const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
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

      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">TB</div>
            <span className="font-bold text-white">TalentBank <span className="text-amber-400">Admin</span></span>
          </div>
          <a href="/admin/events" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <Calendar size={14} aria-hidden="true" /> Events
          </a>
          <a href="/admin/students" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <ClipboardList size={14} aria-hidden="true" /> Feedback Forms
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold transition">
            <GraduationCap size={14} aria-hidden="true" /> Exams
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Certificate Exams</h1>
          <button
            type="button"
            onClick={() => router.push("/admin/exams/create")}
            className="flex items-center gap-2 bg-amber-400 text-[#0F0E17] px-4 py-2.5 rounded-xl text-sm font-black hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
          >
            <Plus size={16} aria-hidden="true" /> New Exam
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
            <GraduationCap size={40} className="text-white/20 mx-auto mb-3" aria-hidden="true" />
            <p className="text-white/40 text-sm">No certificate exams yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {exams.map((exam) => (
              <div key={exam.id} className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex items-start justify-between gap-4 hover:border-amber-400/20 transition-all">
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                      {exam.requiredXP} XP required
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/5 text-white/40">
                      {exam.registeredCount}/{exam.maxSlots} registered
                    </span>
                  </div>
                  <h3 className="font-bold text-white">{exam.title}</h3>
                  <p className="text-xs text-white/40 line-clamp-1">{exam.description}</p>
                  <div className="flex gap-3 text-xs text-white/30 flex-wrap">
                    <span>📅 {formatDate(exam.examDate)}</span>
                    <a href={exam.examUrl ?? exam.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-amber-400 transition">🔗 Online</a>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/exams/${exam.id}/registrations`)}
                    className="flex items-center gap-1 text-xs bg-cyan-400/10 text-cyan-400 px-3 py-2 rounded-xl hover:bg-cyan-400/20 transition font-semibold"
                  >
                    <Users size={13} aria-hidden="true" /> Registrations
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/exams/${exam.id}/edit`)}
                    className="flex items-center gap-1 text-xs bg-amber-400/10 text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-400/20 transition font-semibold"
                  >
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(exam.id)}
                    className="flex items-center gap-1 text-xs bg-red-400/10 text-red-400 px-3 py-2 rounded-xl hover:bg-red-400/20 transition font-semibold"
                  >
                    <Trash2 size={13} aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmId && (
        <ConfirmDialog
          title="Delete Exam?"
          message="This exam and all its data will be permanently removed. This cannot be undone."
          confirmLabel="Delete Exam"
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleting}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
