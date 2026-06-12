"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  getCertExam,
  getExamRegistrations,
  updateExamRegistrationStatus,
} from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as XLSX from "xlsx";
import {
  LogOut, ArrowLeft, GraduationCap, Users,
  ClipboardList, Calendar, FileSpreadsheet,
  Upload, FileText, ExternalLink, X,
} from "lucide-react";
import type { ExamRegistrationStatus } from "@talentbank/shared";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  registered: { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Registered" },
  attended:   { bg: "bg-sky-400/10",     text: "text-sky-400",     label: "Attended"   },
  passed:     { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Passed"     },
  failed:     { bg: "bg-red-400/10",     text: "text-red-400",     label: "Failed"     },
};

export default function ExamRegistrationsPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Pass-with-PDF state
  const [passingRegId, setPassingRegId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [examData, regs] = await Promise.all([
      getCertExam(examId),
      getExamRegistrations(examId),
    ]);
    setExam(examData);
    const sorted = [...(regs as any[])].sort((a, b) => {
      const da = a.registeredAt?.toDate?.() ?? new Date(0);
      const db2 = b.registeredAt?.toDate?.() ?? new Date(0);
      return da.getTime() - db2.getTime();
    });
    setRegistrations(sorted);
    setDataLoading(false);
  };

  useEffect(() => {
    if (user && examId) fetchData();
  }, [user, examId]);

  const handleStatusUpdate = async (regId: string, status: ExamRegistrationStatus) => {
    await updateExamRegistrationStatus(regId, status);
    fetchData();
  };

  const handlePassClick = (regId: string) => {
    setPassingRegId(regId);
    setPdfFile(null);
  };

  const cancelPass = () => {
    setPassingRegId(null);
    setPdfFile(null);
  };

  const confirmPass = async (regId: string, skipPdf = false) => {
    setUploading(true);
    try {
      let certPdfUrl: string | null = null;
      if (!skipPdf && pdfFile) {
        const sRef = ref(storage, `exams/${examId}/certs/${regId}.pdf`);
        await uploadBytes(sRef, pdfFile);
        certPdfUrl = await getDownloadURL(sRef);
      }
      await updateExamRegistrationStatus(regId, "passed", certPdfUrl);
      setPassingRegId(null);
      setPdfFile(null);
      fetchData();
    } catch {
      alert("Failed to update status. Please try again.");
    } finally {
      setUploading(false);
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

  const exportToExcel = () => {
    if (!exam) return;
    const headers = ["#", "Name", "Email", "Registered At", "Status", "Certificate"];
    const rows = registrations.map((r: any, i: number) => [
      i + 1,
      r.userName  ?? "",
      r.userEmail ?? "",
      formatDate(r.registeredAt),
      STATUS_STYLES[r.status]?.label ?? r.status,
      r.certPdfUrl ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.max(h.length, ...rows.map((r: any[]) => String(r[i] ?? "").length), 10),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, `${(exam.title ?? "exam").replace(/[^a-z0-9]/gi, "_")}-registrations.xlsx`);
  };

  if (loading || dataLoading)
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
            <Calendar size={14} /> Events
          </a>
          <a href="/admin/students" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <Users size={14} /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <ClipboardList size={14} /> Feedback Forms
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold transition">
            <GraduationCap size={14} /> Exams
          </a>
          {isSuperAdmin && (
            <a href="/admin/requests" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
              <Users size={14} /> Requests
            </a>
          )}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out" className="text-white/40 hover:text-red-400 transition">
          <LogOut size={16} />
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => router.push("/admin/exams")}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition w-fit"
        >
          <ArrowLeft size={14} /> Back to Exams
        </button>

        {/* Exam info header */}
        {exam && (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5">
            <h1 className="text-xl font-black text-white mb-2">{exam.title}</h1>
            <div className="flex gap-4 text-xs text-white/40 flex-wrap items-center">
              <span>📅 {formatDate(exam.examDate)}</span>
              {(exam.examUrl || exam.location) && (
                <a
                  href={exam.examUrl ?? exam.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sky-400 hover:underline"
                >
                  🔗 Online <ExternalLink size={10} />
                </a>
              )}
              <span>⚡ {exam.requiredXP} XP required</span>
              <span>👥 {exam.registeredCount}/{exam.maxSlots} registered</span>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">
            Registrations
            <span className="ml-2 text-sm text-white/40 font-normal">({registrations.length})</span>
          </h2>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={registrations.length === 0}
            className="flex items-center gap-2 bg-emerald-400/10 text-emerald-400 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-400/20 transition disabled:opacity-40"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>

        {/* Table */}
        {registrations.length === 0 ? (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
            <Users size={40} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No registrations yet.</p>
          </div>
        ) : (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-white/40 text-xs">
                  <th className="text-left px-5 py-3 font-semibold">#</th>
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold">Registered</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-left px-5 py-3 font-semibold">Certificate</th>
                  <th className="text-left px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg: any, i: number) => {
                  const style = STATUS_STYLES[reg.status] ?? STATUS_STYLES.registered;
                  const isPassing = passingRegId === reg.id;
                  return (
                    <React.Fragment key={reg.id}>
                      <tr className={`border-b border-white/5 hover:bg-white/3 transition ${isPassing ? "bg-emerald-400/5" : ""}`}>
                        <td className="px-5 py-3 text-white/30">{i + 1}</td>
                        <td className="px-5 py-3 text-white font-semibold">{reg.userName || "—"}</td>
                        <td className="px-5 py-3 text-white/60">{reg.userEmail || "—"}</td>
                        <td className="px-5 py-3 text-white/40 text-xs">{formatDate(reg.registeredAt)}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {reg.certPdfUrl ? (
                            <a
                              href={reg.certPdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                            >
                              <FileText size={12} /> View PDF <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {reg.status !== "attended" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(reg.id, "attended")}
                                className="text-xs bg-sky-400/10 text-sky-400 px-2.5 py-1 rounded-lg hover:bg-sky-400/20 transition font-semibold"
                              >
                                Attended
                              </button>
                            )}
                            {reg.status !== "passed" && !isPassing && (
                              <button
                                type="button"
                                onClick={() => handlePassClick(reg.id)}
                                className="text-xs bg-emerald-400/10 text-emerald-400 px-2.5 py-1 rounded-lg hover:bg-emerald-400/20 transition font-semibold"
                              >
                                Pass
                              </button>
                            )}
                            {reg.status !== "failed" && (
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(reg.id, "failed")}
                                className="text-xs bg-red-400/10 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-400/20 transition font-semibold"
                              >
                                Fail
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline PDF upload row — shown when Pass is clicked */}
                      {isPassing && (
                        <tr key={`${reg.id}-pass`} className="border-b border-white/5 bg-emerald-400/5">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                                <FileText size={14} />
                                Upload Certificate PDF (optional)
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 border-dashed rounded-xl px-3 py-2 hover:border-emerald-400/40 transition text-xs text-white/40">
                                <Upload size={12} />
                                {pdfFile ? pdfFile.name : "Choose PDF file"}
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf"
                                  title="Certificate PDF"
                                  className="hidden"
                                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                                />
                              </label>

                              {pdfFile && (
                                <button
                                  type="button"
                                  title="Remove selected file"
                                  onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                  className="text-white/30 hover:text-red-400 transition"
                                >
                                  <X size={14} />
                                </button>
                              )}

                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  onClick={cancelPass}
                                  className="text-xs text-white/40 hover:text-white px-3 py-1.5 rounded-lg transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmPass(reg.id, true)}
                                  disabled={uploading}
                                  className="text-xs bg-white/5 text-white/60 px-3 py-1.5 rounded-lg hover:bg-white/10 transition disabled:opacity-40"
                                >
                                  Pass without PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmPass(reg.id, false)}
                                  disabled={uploading || !pdfFile}
                                  className="text-xs bg-emerald-400 text-[#0F0E17] px-3 py-1.5 rounded-lg hover:bg-emerald-300 transition font-semibold disabled:opacity-40"
                                >
                                  {uploading ? "Uploading…" : "Confirm Pass + Upload"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
