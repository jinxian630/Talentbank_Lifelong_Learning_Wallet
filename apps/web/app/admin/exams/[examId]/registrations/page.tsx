"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, storage } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getCertExam, getExamRegistrations, updateExamRegistrationStatus } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as XLSX from "xlsx";
import Image from "next/image";
import {
  LogOut, ArrowLeft, GraduationCap, Users,
  ClipboardList, Calendar, FileSpreadsheet,
  Upload, FileText, ExternalLink, X,
} from "lucide-react";
import type { ExamRegistrationStatus } from "@talentbank/shared";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  registered: { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]",  label: "Registered" },
  attended:   { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]",  label: "Attended"   },
  passed:     { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]",  label: "Passed"     },
  failed:     { bg: "bg-red-50",       text: "text-red-500",     label: "Failed"     },
};

export default function ExamRegistrationsPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [passingRegId, setPassingRegId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [examData, regs] = await Promise.all([getCertExam(examId), getExamRegistrations(examId)]);
    setExam(examData);
    const sorted = [...(regs as any[])].sort((a, b) => {
      const da = a.registeredAt?.toDate?.() ?? new Date(0);
      const db2 = b.registeredAt?.toDate?.() ?? new Date(0);
      return da.getTime() - db2.getTime();
    });
    setRegistrations(sorted);
    setDataLoading(false);
  };

  useEffect(() => { if (user && examId) fetchData(); }, [user, examId]);

  const handleStatusUpdate = async (regId: string, status: ExamRegistrationStatus) => {
    await updateExamRegistrationStatus(regId, status); fetchData();
  };
  const handlePassClick = (regId: string) => { setPassingRegId(regId); setPdfFile(null); };
  const cancelPass = () => { setPassingRegId(null); setPdfFile(null); };
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
      setPassingRegId(null); setPdfFile(null); fetchData();
    } catch { alert("Failed to update status. Please try again."); }
    finally { setUploading(false); }
  };
  const handleLogout = async () => { await signOut(auth); router.push("/"); };
  const formatDate = (ts: any) => {
    try {
      const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return "—"; }
  };
  const exportToExcel = () => {
    if (!exam) return;
    const headers = ["#", "Name", "Email", "Registered At", "Status", "Certificate"];
    const rows = registrations.map((r: any, i: number) => [i + 1, r.userName ?? "", r.userEmail ?? "", formatDate(r.registeredAt), STATUS_STYLES[r.status]?.label ?? r.status, r.certPdfUrl ?? ""]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map((r: any[]) => String(r[i] ?? "").length), 10) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, `${(exam.title ?? "exam").replace(/[^a-z0-9]/gi, "_")}-registrations.xlsx`);
  };

  if (loading || dataLoading) return (
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

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        <button type="button" onClick={() => router.push("/admin/exams")}
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-60 w-fit font-semibold"
          style={{ color: "rgba(58,51,44,0.5)" }}>
          <ArrowLeft size={14} /> Back to Exams
        </button>

        {exam && (
          <div className="bg-white rounded-3xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
            <h1 className="text-xl font-extrabold mb-2" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>{exam.title}</h1>
            <div className="flex gap-4 text-xs flex-wrap items-center" style={{ color: "rgba(58,51,44,0.5)" }}>
              <span>📅 {formatDate(exam.examDate)}</span>
              {(exam.examUrl || exam.location) && (
                <a href={exam.examUrl ?? exam.location} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:opacity-70 transition" style={{ color: "#6E89B8" }}>
                  🔗 Online <ExternalLink size={10} />
                </a>
              )}
              <span>⚡ {exam.requiredXP} XP required</span>
              <span>👥 {exam.registeredCount}/{exam.maxSlots} registered</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>
            Registrations <span className="text-sm font-normal ml-2" style={{ color: "rgba(58,51,44,0.45)" }}>({registrations.length})</span>
          </h2>
          <button type="button" onClick={exportToExcel} disabled={registrations.length === 0}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-40"
            style={{ backgroundColor: "rgba(143,191,140,0.15)", color: "#4a8a47", border: "1px solid rgba(143,191,140,0.3)" }}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>

        {registrations.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center" style={{ border: "1px solid var(--color-shadow-grey)" }}>
            <Users size={40} className="mx-auto mb-3" style={{ color: "rgba(58,51,44,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(58,51,44,0.4)" }}>No registrations yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ borderBottom: "1px solid var(--color-shadow-grey)", color: "rgba(58,51,44,0.45)" }}>
                  {["#", "Name", "Email", "Registered", "Status", "Certificate", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg: any, i: number) => {
                  const style = STATUS_STYLES[reg.status] ?? STATUS_STYLES.registered;
                  const isPassing = passingRegId === reg.id;
                  return (
                    <React.Fragment key={reg.id}>
                      <tr className="transition" style={{
                        borderBottom: "1px solid var(--color-shadow-grey)",
                        backgroundColor: isPassing ? "rgba(143,191,140,0.06)" : "transparent",
                      }}>
                        <td className="px-5 py-3 text-xs" style={{ color: "rgba(58,51,44,0.35)" }}>{i + 1}</td>
                        <td className="px-5 py-3 font-semibold" style={{ color: "var(--color-text-dark)" }}>{reg.userName || "—"}</td>
                        <td className="px-5 py-3" style={{ color: "rgba(58,51,44,0.55)" }}>{reg.userEmail || "—"}</td>
                        <td className="px-5 py-3 text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>{formatDate(reg.registeredAt)}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>{style.label}</span>
                        </td>
                        <td className="px-5 py-3">
                          {reg.certPdfUrl ? (
                            <a href={reg.certPdfUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs hover:opacity-70 transition" style={{ color: "#4a8a47" }}>
                              <FileText size={12} /> View PDF <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span className="text-xs" style={{ color: "rgba(58,51,44,0.25)" }}>—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {reg.status !== "attended" && (
                              <button type="button" onClick={() => handleStatusUpdate(reg.id, "attended")}
                                className="text-xs bg-[#6E89B8]/10 text-[#6E89B8] px-2.5 py-1 rounded-lg hover:bg-[#6E89B8]/20 transition font-semibold">
                                Attended
                              </button>
                            )}
                            {reg.status !== "passed" && !isPassing && (
                              <button type="button" onClick={() => handlePassClick(reg.id)}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg transition"
                                style={{ backgroundColor: "rgba(143,191,140,0.15)", color: "#4a8a47" }}>
                                Pass
                              </button>
                            )}
                            {reg.status !== "failed" && (
                              <button type="button" onClick={() => handleStatusUpdate(reg.id, "failed")}
                                className="text-xs bg-red-50 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-100 transition font-semibold">
                                Fail
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isPassing && (
                        <tr key={`${reg.id}-pass`} style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "rgba(143,191,140,0.06)" }}>
                          <td colSpan={7} className="px-5 py-4">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#4a8a47" }}>
                                <FileText size={14} /> Upload Certificate PDF (optional)
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer rounded-xl px-3 py-2 transition text-xs border border-dashed"
                                style={{ backgroundColor: "var(--color-bg-cream)", borderColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.5)" }}>
                                <Upload size={12} />
                                {pdfFile ? pdfFile.name : "Choose PDF file"}
                                <input ref={fileInputRef} type="file" accept=".pdf" title="Certificate PDF" className="hidden"
                                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
                              </label>
                              {pdfFile && (
                                <button type="button" title="Remove selected file"
                                  onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                  className="transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.4)" }}>
                                  <X size={14} />
                                </button>
                              )}
                              <div className="flex items-center gap-2 ml-auto">
                                <button type="button" onClick={cancelPass}
                                  className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-60"
                                  style={{ color: "rgba(58,51,44,0.5)" }}>
                                  Cancel
                                </button>
                                <button type="button" onClick={() => confirmPass(reg.id, true)} disabled={uploading}
                                  className="text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                                  style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.6)" }}>
                                  Pass without PDF
                                </button>
                                <button type="button" onClick={() => confirmPass(reg.id, false)} disabled={uploading || !pdfFile}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-40 text-white"
                                  style={{ backgroundColor: "#4a8a47" }}>
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
