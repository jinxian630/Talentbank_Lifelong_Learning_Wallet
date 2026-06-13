"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import FeedbackDigest from "@/components/FeedbackDigest";
import { auth } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  getEvent,
  updateParticipantStatus,
  awardBadge,
  revokeBadge,
  markCheckedIn,
} from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import Image from "next/image";
import {
  LogOut, ArrowLeft, CheckCircle, XCircle,
  QrCode, ClipboardList, Users,
  FileSpreadsheet, Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { RegistrationFormField } from "@talentbank/shared";
import { MintBadgeButton } from "@/components/MintBadgeButton";
import { getUserBadges } from "@talentbank/firebase-config";

type Tab = "participants" | "checkin" | "submissions";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]",  label: "Registered" },
  registered: { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]",  label: "Registered" },
  checked_in: { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]",  label: "Checked In" },
  submitted:  { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]",  label: "Submitted"  },
  approved:   { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]",  label: "Approved"   },
  rejected:   { bg: "bg-red-50",       text: "text-red-500",     label: "Rejected"   },
};

export default function AttendancePage() {
  const { user, loading } = useAdminGuard();
  const router            = useRouter();
  const { id }            = useParams<{ id: string }>();

  const [event,               setEvent]               = useState<any>(null);
  const [activeTab,           setActiveTab]           = useState<Tab>("participants");
  const [scanResult,          setScanResult]          = useState<string | null>(null);
  const [scanError,           setScanError]           = useState<string | null>(null);
  const [scanning,            setScanning]            = useState(false);
  const [manualCode,          setManualCode]          = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [badgeMap, setBadgeMap] = useState<Record<string, {
    badgeId: string;
    txHash?: string;
    voucherObjectId?: string;
    voucherTxHash?: string;
  }>>({});
  const scannerRef = useRef<any>(null);

  const fetchEvent = async () => {
    const data = await getEvent(id as string);
    setEvent(data);
    const approved: any[] = ((data as any)?.pendingParticipants ?? []).filter((p: any) => p.status === "approved");
    if (approved.length > 0) {
      const entries = await Promise.all(
        approved.map(async (p: any) => {
          const badges = await getUserBadges(p.uid) as any[];
          const match = badges.find((b) => b.eventId === id);
          return match ? [p.uid, {
            badgeId: match.id,
            txHash: match.onChain?.txHash,
            voucherObjectId: match.onChain?.voucherObjectId,
            voucherTxHash: match.onChain?.voucherTxHash,
          }] : null;
        }),
      );
      setBadgeMap(Object.fromEntries(entries.filter(Boolean) as [string, any][]));
    }
  };

  useEffect(() => { if (user) fetchEvent(); }, [user]);

  useEffect(() => {
    if (activeTab !== "checkin") {
      if (scannerRef.current) { scannerRef.current.clear().catch(() => {}); scannerRef.current = null; }
      return;
    }
    let mounted = true;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (!mounted || scannerRef.current) return;
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 240, height: 240 } }, false);
      scanner.render(
        async (decodedText: string) => {
          setScanError(null); setScanning(true);
          try {
            const found = await markCheckedIn(id as string, decodedText);
            if (found) { setScanResult("✓ Student checked in successfully!"); await fetchEvent(); }
            else { setScanError("QR code not recognised for this event."); }
          } catch (e: any) { setScanError(e.message ?? "Check-in failed."); }
          finally { setScanning(false); setTimeout(() => { setScanResult(null); setScanError(null); }, 4000); }
        },
        () => {},
      );
      scannerRef.current = scanner;
    });
    return () => {
      mounted = false;
      if (scannerRef.current) { scannerRef.current.clear().catch(() => {}); scannerRef.current = null; }
    };
  }, [activeTab, id]);

  const handleApprove = async (p: any) => {
    const wasApproved = p.status === "approved";
    await updateParticipantStatus(id as string, p.uid, "approved");
    if (!wasApproved) await awardBadge(id as string, event.title, p, { shape: event.badgeShape ?? "hexagon", color: event.badgeColor ?? "#FBBF24", emoji: event.badgeEmoji ?? "🏆", badgeImageUrl: event.badgeImageUrl ?? null });
    fetchEvent();
  };
  const handleReject = async (p: any) => {
    const wasApproved = p.status === "approved";
    await updateParticipantStatus(id as string, p.uid, "rejected");
    if (wasApproved) await revokeBadge(id as string, p.uid);
    fetchEvent();
  };

  const exportToExcel = () => {
    const regForm: RegistrationFormField[] = event.registrationForm ?? [];
    const headers = ["#", "Name", "Email", "Status", ...regForm.map((f: RegistrationFormField) => f.label)];
    const rows = participants.map((p: any, i: number) => [
      i + 1, p.name ?? "", p.email ?? "", STATUS_STYLES[p.status]?.label ?? p.status,
      ...regForm.map((f: RegistrationFormField) => { const v = p.registrationData?.[f.id]; if (typeof v === "boolean") return v ? "Yes" : "No"; return v ?? ""; }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.max(h.length, ...rows.map((r: any[]) => String(r[i] ?? "").length), 10) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participants");
    XLSX.writeFile(wb, `${event.title.replace(/[^a-z0-9]/gi, "_")}-participants.xlsx`);
  };

  if (loading || !event) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
    </div>
  );

  const participants = event.pendingParticipants ?? [];
  const checkedIn    = participants.filter((p: any) => p.status === "checked_in");
  const submissions  = participants.filter((p: any) => p.status === "submitted");
  const approved     = participants.filter((p: any) => p.status === "approved");
  const regForm: RegistrationFormField[] = event.registrationForm ?? [];

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "participants", label: "All Participants", icon: Users,         count: participants.length },
    { id: "checkin",      label: "Check-in",         icon: QrCode,        count: checkedIn.length    },
    { id: "submissions",  label: "Submissions",      icon: ClipboardList, count: submissions.length  },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <style>{`
        #qr-reader { width: 100% !important; border: none !important; background: transparent !important; }
        #qr-reader video { border-radius: 12px !important; }
        #qr-reader__scan_region { border-radius: 12px; overflow: hidden; }
        #qr-reader__dashboard_section_csr button { background: #E8923C !important; color: #fff !important; border-radius: 12px !important; border: none !important; padding: 8px 20px !important; font-weight: 700 !important; cursor: pointer; }
        #qr-reader__dashboard_section_swaplink { color: rgba(58,51,44,0.5) !important; font-size: 12px; }
        #qr-reader__status_span { color: rgba(58,51,44,0.5) !important; font-size: 12px; }
      `}</style>

      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "rgba(247,244,238,0.92)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push("/admin/events")} title="Back to events"
            className="transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
            <ArrowLeft size={20} />
          </button>
          <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet" width={80} height={80} className="rounded-xl -my-2" onError={() => {}} />
          <span className="font-semibold text-sm truncate max-w-xs" style={{ color: "var(--color-text-dark)" }}>{event.title}</span>
        </div>
        <button type="button" onClick={() => signOut(auth).then(() => router.push("/"))}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
          <LogOut size={14} /> Sign out
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Event info bar */}
        <div className="flex items-center gap-4">
          <span className="text-3xl">{event.emoji ?? "📅"}</span>
          <div>
            <h1 className="font-extrabold text-xl" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>{event.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: "rgba(58,51,44,0.45)" }}>
              <span>{participants.length} registered</span>
              <span>·</span>
              <span style={{ color: "#4a8a47" }}>{checkedIn.length + approved.length} checked in</span>
              <span>·</span>
              <span style={{ color: "#6E89B8" }}>{submissions.length} awaiting review</span>
              <span>·</span>
              <span style={{ color: "var(--color-primary-orange)" }}>{approved.length} approved</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl p-1.5" style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}>
          {TABS.map(tab => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition"
              style={activeTab === tab.id
                ? { backgroundColor: "rgba(232,146,60,0.12)", color: "var(--color-primary-orange)" }
                : { color: "rgba(58,51,44,0.4)" }}>
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={activeTab === tab.id
                    ? { backgroundColor: "rgba(232,146,60,0.2)", color: "var(--color-primary-orange)" }
                    : { backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.4)" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB: All Participants */}
        {activeTab === "participants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.45)" }}>
                {participants.length} participant{participants.length !== 1 ? "s" : ""}
                {regForm.length > 0 && ` · ${regForm.length} form field${regForm.length !== 1 ? "s" : ""}`}
              </p>
              <button type="button" onClick={exportToExcel} disabled={participants.length === 0}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border transition disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: "rgba(143,191,140,0.15)", color: "#4a8a47", borderColor: "rgba(143,191,140,0.3)" }}>
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
              {participants.length === 0 ? (
                <div className="p-10 text-center text-sm" style={{ color: "rgba(58,51,44,0.35)" }}>No participants yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "rgba(58,51,44,0.03)" }}>
                        {["#", "Name", "Email", "Status"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.45)" }}>{h}</th>
                        ))}
                        {regForm.map((f: RegistrationFormField) => (
                          <th key={f.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "rgba(58,51,44,0.45)" }}>{f.label}</th>
                        ))}
                        {regForm.length > 0 && <th className="px-4 py-3 w-16"><span className="sr-only">Details</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p: any, i: number) => {
                        const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.registered;
                        return (
                          <tr key={p.uid} className="transition group" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                            <td className="px-4 py-3 text-xs" style={{ color: "rgba(58,51,44,0.35)" }}>{i + 1}</td>
                            <td className="px-4 py-3"><p className="font-semibold truncate max-w-[160px]" style={{ color: "var(--color-text-dark)" }}>{p.name || "—"}</p></td>
                            <td className="px-4 py-3"><p className="text-xs truncate max-w-[200px]" style={{ color: "rgba(58,51,44,0.5)" }}>{p.email}</p></td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                            </td>
                            {regForm.map((f: RegistrationFormField) => {
                              const val = p.registrationData?.[f.id];
                              const display = typeof val === "boolean" ? (val ? "Yes" : "No") : (val ?? "—");
                              return <td key={f.id} className="px-4 py-3 text-xs" style={{ color: "rgba(58,51,44,0.55)" }}><span className="truncate block max-w-[180px]">{String(display)}</span></td>;
                            })}
                            {regForm.length > 0 && (
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => setSelectedParticipant(p)}
                                  className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg"
                                  style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.5)" }}
                                  title="View registration details">
                                  <Eye size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Check-in */}
        {activeTab === "checkin" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid var(--color-shadow-grey)" }}>
              <div className="flex items-center gap-3 mb-4">
                <QrCode size={20} style={{ color: "var(--color-primary-orange)" }} />
                <div>
                  <h2 className="font-bold" style={{ color: "var(--color-text-dark)" }}>Scan Student QR Codes</h2>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(58,51,44,0.45)" }}>Point your camera at a student's QR code to check them in</p>
                </div>
              </div>

              <div id="qr-reader" className="rounded-xl overflow-hidden" />

              {scanning && (
                <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--color-primary-orange)" }}>
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
                  Processing check-in…
                </div>
              )}
              {scanResult && (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "rgba(143,191,140,0.15)", border: "1px solid rgba(143,191,140,0.3)", color: "#4a8a47" }}>
                  {scanResult}
                </div>
              )}
              {scanError && (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#ef4444" }}>
                  {scanError}
                </div>
              )}

              <div className="mt-6 pt-5" style={{ borderTop: "1px solid var(--color-shadow-grey)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(58,51,44,0.45)" }}>Or enter 8-digit code manually</p>
                <div className="flex gap-3">
                  <input type="text" inputMode="numeric" maxLength={8} value={manualCode}
                    onChange={e => setManualCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000000"
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none"
                    style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)", color: "var(--color-text-dark)" }}
                  />
                  <button type="button" disabled={manualCode.length !== 8 || scanning}
                    onClick={async () => {
                      setScanError(null); setScanning(true);
                      try {
                        const found = await markCheckedIn(id as string, manualCode);
                        if (found) { setScanResult("✓ Student checked in successfully!"); setManualCode(""); await fetchEvent(); }
                        else { setScanError("Code not recognised for this event."); }
                      } catch (e: any) { setScanError(e.message ?? "Check-in failed."); }
                      finally { setScanning(false); setTimeout(() => { setScanResult(null); setScanError(null); }, 4000); }
                    }}
                    className="px-5 py-3 font-bold text-sm rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "rgba(232,146,60,0.12)", color: "var(--color-primary-orange)", border: "1px solid rgba(232,146,60,0.25)" }}>
                    Check In
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(58,51,44,0.45)" }}>
                Checked In ({checkedIn.length + approved.length})
              </h3>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                {checkedIn.length === 0 && approved.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "rgba(58,51,44,0.35)" }}>No students checked in yet.</div>
                ) : (
                  <div>
                    {[...checkedIn, ...approved].map((p: any) => (
                      <div key={p.uid} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(143,191,140,0.15)" }}>
                          <CheckCircle size={14} style={{ color: "#4a8a47" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-dark)" }}>{p.name}</p>
                          <p className="text-xs truncate" style={{ color: "rgba(58,51,44,0.45)" }}>{p.email}</p>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: "#4a8a47" }}>
                          {p.status === "approved" ? "Approved" : "Checked In"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Submissions */}
        {activeTab === "submissions" && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                <p className="text-3xl mb-3">📭</p>
                <p className="text-sm" style={{ color: "rgba(58,51,44,0.45)" }}>No submissions yet. Students submit after the event ends.</p>
              </div>
            ) : (
              submissions.map((p: any) => (
                <div key={p.uid} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                  {p.submission?.photoUrl && (
                    <img src={p.submission.photoUrl} alt="Event submission" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>{p.name}</p>
                        <p className="text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>{p.email}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-[#6E89B8]/10 text-[#6E89B8]">Submitted</span>
                    </div>
                    {p.submission?.feedback && (
                      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-bg-cream)", border: "1px solid var(--color-shadow-grey)" }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(58,51,44,0.45)" }}>What they learned</p>
                        <p className="text-sm leading-relaxed italic" style={{ color: "rgba(58,51,44,0.7)" }}>"{p.submission.feedback}"</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: "rgba(232,146,60,0.06)", border: "1px solid rgba(232,146,60,0.15)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: event.badgeColor + "25" }}>
                        {event.badgeEmoji ?? "🏆"}
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>Badge to award</p>
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-dark)" }}>{event.title}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => handleApprove(p)}
                        className="flex-1 flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl transition border"
                        style={{ backgroundColor: "rgba(143,191,140,0.15)", color: "#4a8a47", borderColor: "rgba(143,191,140,0.3)" }}>
                        <CheckCircle size={16} /> Award Badge
                      </button>
                      <button type="button" onClick={() => handleReject(p)}
                        className="flex-1 flex items-center justify-center gap-2 font-bold text-sm py-3 rounded-xl transition border bg-red-50 text-red-500 border-red-200 hover:bg-red-100">
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {approved.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(58,51,44,0.45)" }}>
                  Approved ({approved.length})
                </h3>
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                  {approved.map((p: any) => (
                    <div key={p.uid} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                      <CheckCircle size={16} style={{ color: "#4a8a47" }} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-dark)" }}>{p.name}</p>
                        <p className="text-xs truncate" style={{ color: "rgba(58,51,44,0.45)" }}>{p.email}</p>
                      </div>
                      {badgeMap[p.uid] ? (
                        <MintBadgeButton badgeId={badgeMap[p.uid].badgeId} participantUid={p.uid} participantName={p.name}
                          voucherObjectId={badgeMap[p.uid].voucherObjectId} voucherTxHash={badgeMap[p.uid].voucherTxHash}
                          claimTxHash={badgeMap[p.uid].txHash}
                          event={{ id: id as string, title: event.title, badgeEmoji: event.badgeEmoji, badgeColor: event.badgeColor }} />
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: "#4a8a47" }}>Badge awarded</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Feedback Digest */}
        <FeedbackDigest eventId={id as string} />
      </main>

      {/* Registration Detail Modal */}
      {selectedParticipant && (() => {
        const s = STATUS_STYLES[selectedParticipant.status] ?? STATUS_STYLES.registered;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedParticipant(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl"
              style={{ border: "1px solid var(--color-shadow-grey)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                <div>
                  <p className="font-bold text-base" style={{ color: "var(--color-text-dark)" }}>{selectedParticipant.name || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(58,51,44,0.45)" }}>{selectedParticipant.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                  <button type="button" onClick={() => setSelectedParticipant(null)}
                    className="text-lg leading-none w-7 h-7 flex items-center justify-center rounded-lg transition-opacity hover:opacity-60"
                    style={{ color: "rgba(58,51,44,0.4)" }}>✕</button>
                </div>
              </div>
              {regForm.length > 0 && (
                <div className="px-6 pt-4 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.4)" }}>Registration Responses</p>
                </div>
              )}
              <div className="px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
                {regForm.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "rgba(58,51,44,0.35)" }}>This event had no registration form.</p>
                ) : (
                  regForm.map((field: RegistrationFormField) => {
                    const val = selectedParticipant.registrationData?.[field.id];
                    const display = typeof val === "boolean" ? (val ? "Yes" : "No") : (val && String(val).trim() ? String(val) : "—");
                    const isEmpty = display === "—";
                    return (
                      <div key={field.id} className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(58,51,44,0.45)" }}>
                          {field.label}{field.required && <span style={{ color: "var(--color-primary-orange)" }} className="ml-1">*</span>}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: isEmpty ? "rgba(58,51,44,0.3)" : "rgba(58,51,44,0.75)", fontStyle: isEmpty ? "italic" : "normal" }}>{display}</p>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="px-6 pb-5 pt-2" style={{ borderTop: "1px solid var(--color-shadow-grey)" }}>
                <button type="button" onClick={() => setSelectedParticipant(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
                  style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.6)" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
