"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getCertExams, deleteCertExam } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import Image from "next/image";
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
  const [toast, setToast]         = useState<{ type: "success" | "delete"; message: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  useEffect(() => { if (user) fetchExams(); }, [user]);

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
    } finally { setDeleting(false); }
  };

  const handleLogout = async () => { await signOut(auth); router.push("/"); };

  const formatDate = (ts: any) => {
    try {
      const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return "—"; }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <nav className="backdrop-blur-xl sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: "rgba(247,244,238,0.92)", borderBottom: "1px solid var(--color-shadow-grey)" }}>
        <div className="flex items-center gap-5">
          <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet" width={80} height={80} className="rounded-xl -my-2" onError={() => {}} />
          <a href="/admin/events" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <Calendar size={14} /> Events
          </a>
          <a href="/admin/students" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <Users size={14} /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <ClipboardList size={14} /> Feedback
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-primary-orange)" }}>
            <GraduationCap size={14} /> Exams
          </a>
          {isSuperAdmin && (
            <a href="/admin/requests" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
              <Users size={14} /> Requests
            </a>
          )}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out"
          className="transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
          <LogOut size={16} />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Certificate Exams</h1>
          <button type="button" onClick={() => router.push("/admin/exams/create")}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-md"
            style={{ backgroundColor: "var(--color-primary-orange)" }}>
            <Plus size={16} /> New Exam
          </button>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center" style={{ border: "1px solid var(--color-shadow-grey)" }}>
            <GraduationCap size={40} className="mx-auto mb-3" style={{ color: "rgba(58,51,44,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(58,51,44,0.4)" }}>No certificate exams yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {exams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-3xl p-5 flex items-start justify-between gap-4 hover:shadow-md transition-all"
                style={{ border: "1px solid var(--color-shadow-grey)" }}>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(232,146,60,0.12)", color: "var(--color-primary-orange)" }}>
                      {exam.requiredXP} XP required
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.5)" }}>
                      {exam.registeredCount}/{exam.maxSlots} registered
                    </span>
                  </div>
                  <h3 className="font-bold" style={{ color: "var(--color-text-dark)" }}>{exam.title}</h3>
                  <p className="text-xs line-clamp-1" style={{ color: "rgba(58,51,44,0.5)" }}>{exam.description}</p>
                  <div className="flex gap-3 text-xs flex-wrap" style={{ color: "rgba(58,51,44,0.4)" }}>
                    <span>📅 {formatDate(exam.examDate)}</span>
                    <a href={exam.examUrl ?? exam.location} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:opacity-70 transition">🔗 Online</a>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button type="button" onClick={() => router.push(`/admin/exams/${exam.id}/registrations`)}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl hover:opacity-80 transition font-semibold bg-[#6E89B8]/10 text-[#6E89B8]">
                    <Users size={13} /> Registrations
                  </button>
                  <button type="button" onClick={() => router.push(`/admin/exams/${exam.id}/edit`)}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl hover:opacity-80 transition font-semibold"
                    style={{ backgroundColor: "rgba(232,146,60,0.1)", color: "var(--color-primary-orange)" }}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" onClick={() => setConfirmId(exam.id)}
                    className="flex items-center gap-1 text-xs bg-red-50 text-red-500 px-3 py-2 rounded-xl hover:bg-red-100 transition font-semibold">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmId && (
        <ConfirmDialog title="Delete Exam?" message="This exam and all its data will be permanently removed. This cannot be undone."
          confirmLabel="Delete Exam" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} loading={deleting} />
      )}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </main>
  );
}
