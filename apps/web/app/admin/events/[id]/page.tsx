"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
  pending:    { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Registered"   },
  registered: { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Registered"   },
  checked_in: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Checked In"   },
  submitted:  { bg: "bg-sky-400/10",     text: "text-sky-400",     label: "Submitted"    },
  approved:   { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Approved"     },
  rejected:   { bg: "bg-red-400/10",     text: "text-red-400",     label: "Rejected"     },
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

    // Build badge map for all approved participants so MintBadgeButton knows the Firestore doc ID
    const approved: any[] = ((data as any)?.pendingParticipants ?? []).filter(
      (p: any) => p.status === "approved",
    );
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

  useEffect(() => {
    if (user) fetchEvent();
  }, [user]);

  // ── QR scanner lifecycle (only when Check-in tab is active) ──────────────
  useEffect(() => {
    if (activeTab !== "checkin") {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    let mounted = true;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (!mounted || scannerRef.current) return;
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 240, height: 240 } },
        false,
      );
      scanner.render(
        async (decodedText: string) => {
          setScanError(null);
          setScanning(true);
          try {
            const found = await markCheckedIn(id as string, decodedText);
            if (found) {
              setScanResult("✓ Student checked in successfully!");
              await fetchEvent();
            } else {
              setScanError("QR code not recognised for this event.");
            }
          } catch (e: any) {
            setScanError(e.message ?? "Check-in failed.");
          } finally {
            setScanning(false);
            setTimeout(() => { setScanResult(null); setScanError(null); }, 4000);
          }
        },
        () => {},
      );
      scannerRef.current = scanner;
    });

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [activeTab, id]);

  const handleApprove = async (p: any) => {
    const wasApproved = p.status === "approved";
    await updateParticipantStatus(id as string, p.uid, "approved");
    if (!wasApproved) {
      await awardBadge(id as string, event.title, p, {
        shape: event.badgeShape ?? "hexagon",
        color: event.badgeColor ?? "#FBBF24",
        emoji: event.badgeEmoji ?? "🏆",
        badgeImageUrl: event.badgeImageUrl ?? null,
      });
    }
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
      i + 1,
      p.name  ?? "",
      p.email ?? "",
      STATUS_STYLES[p.status]?.label ?? p.status,
      ...regForm.map((f: RegistrationFormField) => {
        const v = p.registrationData?.[f.id];
        if (typeof v === "boolean") return v ? "Yes" : "No";
        return v ?? "";
      }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.max(h.length, ...rows.map((r: any[]) => String(r[i] ?? "").length), 10),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participants");
    XLSX.writeFile(wb, `${event.title.replace(/[^a-z0-9]/gi, "_")}-participants.xlsx`);
  };

  if (loading || !event) {
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  const participants  = event.pendingParticipants ?? [];
  const checkedIn     = participants.filter((p: any) => p.status === "checked_in");
  const submissions   = participants.filter((p: any) => p.status === "submitted");
  const approved      = participants.filter((p: any) => p.status === "approved");
  const regForm: RegistrationFormField[] = event.registrationForm ?? [];

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "participants", label: "All Participants", icon: Users,         count: participants.length },
    { id: "checkin",      label: "Check-in",         icon: QrCode,        count: checkedIn.length    },
    { id: "submissions",  label: "Submissions",      icon: ClipboardList, count: submissions.length  },
  ];

  return (
    <div className="min-h-screen bg-[#0F0E17]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1,h2,h3,.font-black { font-family: 'Outfit', sans-serif; }
        #qr-reader { width: 100% !important; border: none !important; background: transparent !important; }
        #qr-reader video { border-radius: 12px !important; }
        #qr-reader__scan_region { border-radius: 12px; overflow: hidden; }
        #qr-reader__dashboard_section_csr button { background: #fbbf24 !important; color: #0a0a0a !important; border-radius: 12px !important; border: none !important; padding: 8px 20px !important; font-weight: 700 !important; cursor: pointer; }
        #qr-reader__dashboard_section_swaplink { color: #555 !important; font-size: 12px; }
        #qr-reader__status_span { color: #555 !important; font-size: 12px; }
      `}</style>

      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-white/8 bg-[#0F0E17]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push("/admin/events")} title="Back to events" className="text-white/40 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-amber-400 text-[#0F0E17] font-black text-xs px-2.5 py-1 rounded-lg">TB</div>
          <span className="text-white font-semibold text-sm truncate max-w-xs">{event.title}</span>
        </div>
        <button type="button" onClick={() => signOut(auth).then(() => router.push("/"))}
          className="flex items-center gap-1.5 text-white/30 hover:text-red-400 transition text-sm">
          <LogOut size={14} /> Sign out
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Event info bar */}
        <div className="flex items-center gap-4">
          <span className="text-3xl">{event.emoji ?? "📅"}</span>
          <div>
            <h1 className="text-white font-black text-xl">{event.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
              <span>{participants.length} registered</span>
              <span>·</span>
              <span className="text-emerald-400">{checkedIn.length + approved.length} checked in</span>
              <span>·</span>
              <span className="text-sky-400">{submissions.length} awaiting review</span>
              <span>·</span>
              <span className="text-amber-400">{approved.length} approved</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#1A1825] border border-white/8 rounded-2xl p-1.5">
          {TABS.map(tab => (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition
                ${activeTab === tab.id
                  ? "bg-amber-400/15 text-amber-400"
                  : "text-white/30 hover:text-white"}`}>
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab === tab.id ? "bg-amber-400/20 text-amber-400" : "bg-white/8 text-white/30"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: All Participants ── */}
        {activeTab === "participants" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                {participants.length} participant{participants.length !== 1 ? "s" : ""}
                {regForm.length > 0 && ` · ${regForm.length} form field${regForm.length !== 1 ? "s" : ""}`}
              </p>
              <button
                type="button"
                onClick={exportToExcel}
                disabled={participants.length === 0}
                className="flex items-center gap-2 bg-emerald-400/10 hover:bg-emerald-400/20 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-400 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-400/20 transition"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>

            {/* Table */}
            <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
              {participants.length === 0 ? (
                <div className="p-10 text-center text-white/30 text-sm">No participants yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-max">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/3">
                        <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wider w-10">#</th>
                        <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wider">Status</th>
                        {regForm.map((f: RegistrationFormField) => (
                          <th key={f.id} className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                        {regForm.length > 0 && (
                          <th className="px-4 py-3 text-white/40 text-xs font-semibold uppercase tracking-wider w-16">
                            <span className="sr-only">Details</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {participants.map((p: any, i: number) => {
                        const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.registered;
                        return (
                          <tr key={p.uid} className="hover:bg-white/3 transition group">
                            <td className="px-4 py-3 text-white/30 text-xs">{i + 1}</td>
                            <td className="px-4 py-3">
                              <p className="text-white font-semibold truncate max-w-[160px]">{p.name || "—"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white/50 text-xs truncate max-w-[200px]">{p.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                                {s.label}
                              </span>
                            </td>
                            {regForm.map((f: RegistrationFormField) => {
                              const val = p.registrationData?.[f.id];
                              const display = typeof val === "boolean" ? (val ? "Yes" : "No") : (val ?? "—");
                              return (
                                <td key={f.id} className="px-4 py-3 text-white/60 text-xs">
                                  <span className="truncate block max-w-[180px]">{String(display)}</span>
                                </td>
                              );
                            })}
                            {regForm.length > 0 && (
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setSelectedParticipant(p)}
                                  className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/50 hover:text-white"
                                  title="View registration details"
                                >
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

        {/* ── TAB: Check-in (QR Scanner) ── */}
        {activeTab === "checkin" && (
          <div className="space-y-5">
            <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <QrCode size={20} className="text-amber-400" />
                <div>
                  <h2 className="text-white font-bold">Scan Student QR Codes</h2>
                  <p className="text-white/40 text-xs mt-0.5">Point your camera at a student's QR code to check them in</p>
                </div>
              </div>

              <div id="qr-reader" className="rounded-xl overflow-hidden" />

              {scanning && (
                <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm">
                  <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  Processing check-in…
                </div>
              )}
              {scanResult && (
                <div className="mt-4 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-4 py-3 text-emerald-400 text-sm font-semibold">
                  {scanResult}
                </div>
              )}
              {scanError && (
                <div className="mt-4 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {scanError}
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-white/8">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                  Or enter 8-digit code manually
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000000"
                    className="flex-1 bg-[#0F0E17] border border-white/15 rounded-xl px-4 py-3 text-white text-sm font-mono tracking-widest placeholder-white/20 focus:outline-none focus:border-amber-400/50"
                  />
                  <button
                    type="button"
                    disabled={manualCode.length !== 8 || scanning}
                    onClick={async () => {
                      setScanError(null);
                      setScanning(true);
                      try {
                        const found = await markCheckedIn(id as string, manualCode);
                        if (found) {
                          setScanResult("✓ Student checked in successfully!");
                          setManualCode("");
                          await fetchEvent();
                        } else {
                          setScanError("Code not recognised for this event.");
                        }
                      } catch (e: any) {
                        setScanError(e.message ?? "Check-in failed.");
                      } finally {
                        setScanning(false);
                        setTimeout(() => { setScanResult(null); setScanError(null); }, 4000);
                      }
                    }}
                    className="px-5 py-3 bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400 font-bold text-sm rounded-xl transition border border-amber-400/20"
                  >
                    Check In
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">
                Checked In ({checkedIn.length + approved.length})
              </h3>
              <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
                {checkedIn.length === 0 && approved.length === 0 ? (
                  <div className="p-8 text-center text-white/30 text-sm">No students checked in yet.</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {[...checkedIn, ...approved].map((p: any) => (
                      <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
                          <CheckCircle size={14} className="text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-white/40 text-xs truncate">{p.email}</p>
                        </div>
                        <span className="text-xs text-emerald-400 font-semibold">
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

        {/* ── TAB: Submissions (review + award badge) ── */}
        {activeTab === "submissions" && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">📭</p>
                <p className="text-white/40 text-sm">No submissions yet. Students submit after the event ends.</p>
              </div>
            ) : (
              submissions.map((p: any) => (
                <div key={p.uid} className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
                  {p.submission?.photoUrl && (
                    <img
                      src={p.submission.photoUrl}
                      alt="Event submission"
                      className="w-full h-48 object-cover"
                    />
                  )}

                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-white font-bold">{p.name}</p>
                        <p className="text-white/40 text-sm">{p.email}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-400/10 text-sky-400 shrink-0">
                        Submitted
                      </span>
                    </div>

                    {p.submission?.feedback && (
                      <div className="bg-[#0F0E17] border border-white/8 rounded-xl p-4">
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                          What they learned
                        </p>
                        <p className="text-white/80 text-sm leading-relaxed italic">
                          "{p.submission.feedback}"
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 bg-amber-400/5 border border-amber-400/15 rounded-xl p-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: event.badgeColor + "25" }}
                      >
                        {event.badgeEmoji ?? "🏆"}
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Badge to award</p>
                        <p className="text-white text-sm font-semibold">{event.title}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleApprove(p)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 font-bold text-sm py-3 rounded-xl transition border border-emerald-400/20"
                      >
                        <CheckCircle size={16} /> Award Badge
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(p)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-400/10 hover:bg-red-400/20 text-red-400 font-bold text-sm py-3 rounded-xl transition border border-red-400/20"
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {approved.length > 0 && (
              <div>
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                  Approved ({approved.length})
                </h3>
                <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {approved.map((p: any) => (
                      <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                        <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-white/40 text-xs truncate">{p.email}</p>
                        </div>
                        {badgeMap[p.uid] ? (
                          <MintBadgeButton
                            badgeId={badgeMap[p.uid].badgeId}
                            participantUid={p.uid}
                            participantName={p.name}
                            voucherObjectId={badgeMap[p.uid].voucherObjectId}
                            voucherTxHash={badgeMap[p.uid].voucherTxHash}
                            claimTxHash={badgeMap[p.uid].txHash}
                            event={{
                              id: id as string,
                              title: event.title,
                              badgeEmoji: event.badgeEmoji,
                              badgeColor: event.badgeColor,
                            }}
                          />
                        ) : (
                          <span className="text-xs text-emerald-400 font-semibold">Badge awarded</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Registration Detail Modal ── */}
      {selectedParticipant && (() => {
        const s = STATUS_STYLES[selectedParticipant.status] ?? STATUS_STYLES.registered;
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedParticipant(null)}
          >
            <div
              className="bg-[#1A1825] border border-white/8 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/8">
                <div>
                  <p className="text-white font-bold text-base">{selectedParticipant.name || "—"}</p>
                  <p className="text-white/40 text-xs mt-0.5">{selectedParticipant.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedParticipant(null)}
                    className="text-white/30 hover:text-white transition text-lg leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/8"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Form section label */}
              {regForm.length > 0 && (
                <div className="px-6 pt-4 pb-1">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                    Registration Responses
                  </p>
                </div>
              )}

              {/* Form responses */}
              <div className="px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
                {regForm.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-6">
                    This event had no registration form.
                  </p>
                ) : (
                  regForm.map((field: RegistrationFormField) => {
                    const val = selectedParticipant.registrationData?.[field.id];
                    const display = typeof val === "boolean"
                      ? (val ? "Yes" : "No")
                      : (val && String(val).trim() ? String(val) : "—");
                    const isEmpty = display === "—";
                    return (
                      <div key={field.id} className="space-y-1">
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">
                          {field.label}
                          {field.required && <span className="text-amber-400 ml-1">*</span>}
                        </p>
                        <p className={`text-sm leading-relaxed ${isEmpty ? "text-white/20 italic" : "text-white/80"}`}>
                          {display}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-6 pb-5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedParticipant(null)}
                  className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white/50 hover:text-white text-sm font-semibold transition"
                >
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
