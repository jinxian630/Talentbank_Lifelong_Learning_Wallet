"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  LogOut, Users, CheckCircle, TrendingUp, Calendar,
  Search, UserX, Award, Send, LayoutGrid,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface EventStats {
  id:             string;
  title:          string;
  emoji:          string;
  type:           string;
  startAt:        Date;
  endAt:          Date;
  registered:     number;
  checkedIn:      number;
  submitted:      number;
  approved:       number;
  rejected:       number;
  attendanceRate: number;
  isPast:         boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(v);
}

const TYPE_COLORS: Record<string, string> = {
  Hackathon: "#fbbf24",
  Workshop:  "#a78bfa",
  Talk:      "#38bdf8",
  Seminar:   "#34d399",
  Bootcamp:  "#38bdf8",
  Others:    "#6b7280",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Registered" },
  registered: { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Registered" },
  checked_in: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Checked In" },
  submitted:  { bg: "bg-sky-400/10",     text: "text-sky-400",     label: "Submitted"  },
  approved:   { bg: "bg-violet-400/10",  text: "text-violet-400",  label: "Approved"   },
  rejected:   { bg: "bg-rose-400/10",    text: "text-rose-400",    label: "Rejected"   },
};

const DONUT_COLORS = {
  notAttended: "#fbbf24",
  checkedIn:   "#34d399",
  submitted:   "#38bdf8",
  approved:    "#a78bfa",
  rejected:    "#fb7185",
};

function rateColor(rate: number) {
  if (rate >= 80) return "text-emerald-400";
  if (rate >= 50) return "text-amber-400";
  return "text-rose-400";
}
function rateBg(rate: number) {
  if (rate >= 80) return "bg-emerald-400";
  if (rate >= 50) return "bg-amber-400";
  return "bg-rose-400";
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function deriveStats(rawEvents: any[]): EventStats[] {
  const now = Date.now();
  return rawEvents.map(ev => {
    const participants: any[] = ev.pendingParticipants ?? [];
    const startAt  = toDate(ev.startAt);
    const endAt    = toDate(ev.endAt);
    const isPast   = endAt.getTime() < now;
    const ATTENDED = new Set(["checked_in", "submitted", "approved", "rejected"]);
    const registered     = participants.length;
    const checkedIn      = participants.filter(p => ATTENDED.has(p.status)).length;
    const submitted      = participants.filter(p => ["submitted", "approved", "rejected"].includes(p.status)).length;
    const approved       = participants.filter(p => p.status === "approved").length;
    const rejected       = participants.filter(p => p.status === "rejected").length;
    const attendanceRate = registered > 0 ? (checkedIn / registered) * 100 : 0;
    return { id: ev.id, title: ev.title ?? "Untitled", emoji: ev.emoji ?? "📅",
      type: ev.type ?? "Others", startAt, endAt, isPast,
      registered, checkedIn, submitted, approved, rejected, attendanceRate };
  });
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "22" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-white/40 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-white font-black text-2xl leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── BAR TOOLTIP ──────────────────────────────────────────────────────────────

function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const reg  = payload.find((p: any) => p.dataKey === "registered")?.value ?? 0;
  const ci   = payload.find((p: any) => p.dataKey === "checkedIn")?.value  ?? 0;
  const rate = reg > 0 ? ((ci / reg) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-[#1A1825] border border-white/15 rounded-xl px-4 py-3 text-xs space-y-1.5 shadow-xl">
      <p className="text-sky-400">Registered: <span className="font-bold">{reg}</span></p>
      <p className="text-emerald-400">Checked In: <span className="font-bold">{ci}</span></p>
      <p className="text-white/50">Rate: <span className="font-bold text-white">{rate}%</span></p>
    </div>
  );
}

// ─── OVERVIEW PANEL ───────────────────────────────────────────────────────────

function OverviewPanel({ pastStats }: { pastStats: EventStats[] }) {
  const totalRegistrations = pastStats.reduce((s, e) => s + e.registered, 0);
  const totalCheckIns      = pastStats.reduce((s, e) => s + e.checkedIn,  0);
  const overallRate        = totalRegistrations > 0
    ? ((totalCheckIns / totalRegistrations) * 100).toFixed(1) : "0.0";

  const barData = useMemo(() => {
    const sorted = [...pastStats].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    return sorted.slice(0, 8).reverse().map(e => ({
      name: truncate(e.title, 13), registered: e.registered, checkedIn: e.checkedIn,
    }));
  }, [pastStats]);

  const donutData = useMemo(() => {
    const notAttended  = pastStats.reduce((s, e) => s + (e.registered - e.checkedIn), 0);
    const checkedInOnly= pastStats.reduce((s, e) => s + (e.checkedIn  - e.submitted),  0);
    const submittedOnly= pastStats.reduce((s, e) => s + (e.submitted  - e.approved - e.rejected), 0);
    const approved     = pastStats.reduce((s, e) => s + e.approved,  0);
    const rejected     = pastStats.reduce((s, e) => s + e.rejected,  0);
    return [
      { name: "Not Attended", value: notAttended,   color: DONUT_COLORS.notAttended },
      { name: "Checked In",   value: checkedInOnly,  color: DONUT_COLORS.checkedIn  },
      { name: "Submitted",    value: submittedOnly,  color: DONUT_COLORS.submitted  },
      { name: "Approved",     value: approved,       color: DONUT_COLORS.approved   },
      { name: "Rejected",     value: rejected,       color: DONUT_COLORS.rejected   },
    ].filter(d => d.value > 0);
  }, [pastStats]);

  const rateByType = useMemo(() => {
    const map = new Map<string, { reg: number; ci: number; count: number }>();
    pastStats.forEach(e => {
      const ex = map.get(e.type) ?? { reg: 0, ci: 0, count: 0 };
      map.set(e.type, { reg: ex.reg + e.registered, ci: ex.ci + e.checkedIn, count: ex.count + 1 });
    });
    return Array.from(map.entries()).map(([type, d]) => ({
      type, rate: d.reg > 0 ? (d.ci / d.reg) * 100 : 0, count: d.count,
      color: TYPE_COLORS[type] ?? "#6b7280",
    })).sort((a, b) => b.rate - a.rate);
  }, [pastStats]);

  if (pastStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-white/30 text-sm">No past events with participants yet.</p>
          <p className="text-white/20 text-xs mt-1">Select an event from the left to see its analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div>
        <h2 className="text-white font-black text-lg mb-1">Overall Overview</h2>
        <p className="text-white/40 text-xs">Aggregated across all {pastStats.length} past events</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Past Events"      value={pastStats.length}   color="#fbbf24" />
        <StatCard icon={Users}       label="Total Registered" value={totalRegistrations} color="#38bdf8" />
        <StatCard icon={CheckCircle} label="Total Check-ins"  value={totalCheckIns}      color="#34d399" />
        <StatCard icon={TrendingUp}  label="Attendance Rate"  value={`${overallRate}%`}  color="#a78bfa" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-[#1A1825] border border-white/8 rounded-2xl p-5">
          <p className="text-white font-bold mb-0.5">Registration vs Check-in</p>
          <p className="text-white/40 text-xs mb-4">Last {barData.length} past events</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={3} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="registered" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="checkedIn"  fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-white/40 text-xs"><span className="w-3 h-3 rounded-sm bg-sky-400 inline-block" /> Registered</span>
            <span className="flex items-center gap-1.5 text-white/40 text-xs"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Checked In</span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#1A1825] border border-white/8 rounded-2xl p-5">
          <p className="text-white font-bold mb-0.5">Status Breakdown</p>
          <p className="text-white/40 text-xs mb-2">All past events combined</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value" labelLine={false}>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <text x="50%" y="44%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={22} fontWeight={900}>{totalCheckIns}</text>
              <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10}>Check-ins</text>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-white/50 text-xs">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="text-white/70 text-xs font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rate by type */}
      {rateByType.length > 1 && (
        <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-5">
          <p className="text-white font-bold mb-0.5">Rate by Event Type</p>
          <p className="text-white/40 text-xs mb-4">Average attendance across all past events</p>
          <div className="space-y-3">
            {rateByType.map(({ type, rate, count, color }) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color }}>{type}
                    <span className="text-white/25 text-xs font-normal ml-2">{count} event{count !== 1 ? "s" : ""}</span>
                  </span>
                  <span className={`text-sm font-bold ${rateColor(rate)}`}>{rate.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${rateBg(rate)}`} style={{ width: `${rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EVENT DETAIL PANEL ───────────────────────────────────────────────────────

function EventDetailPanel({ ev, raw }: { ev: EventStats; raw: any }) {
  const participants: any[] = raw?.pendingParticipants ?? [];
  const ATTENDED = new Set(["checked_in", "submitted", "approved", "rejected"]);
  const noShows  = participants.filter(p => !ATTENDED.has(p.status));
  const attendees= participants.filter(p =>  ATTENDED.has(p.status));
  const tc = TYPE_COLORS[ev.type] ?? "#6b7280";

  const donutData = [
    { name: "Not Attended", value: ev.registered - ev.checkedIn,          color: DONUT_COLORS.notAttended },
    { name: "Checked In",   value: ev.checkedIn  - ev.submitted,           color: DONUT_COLORS.checkedIn  },
    { name: "Submitted",    value: ev.submitted  - ev.approved - ev.rejected, color: DONUT_COLORS.submitted },
    { name: "Approved",     value: ev.approved,                            color: DONUT_COLORS.approved   },
    { name: "Rejected",     value: ev.rejected,                            color: DONUT_COLORS.rejected   },
  ].filter(d => d.value > 0);

  const funnel = [
    { label: "Registered", value: ev.registered, color: "bg-sky-400",    icon: Users        },
    { label: "Checked In", value: ev.checkedIn,  color: "bg-emerald-400", icon: CheckCircle  },
    { label: "Submitted",  value: ev.submitted,  color: "bg-sky-300",    icon: Send         },
    { label: "Approved",   value: ev.approved,   color: "bg-violet-400", icon: Award        },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Event header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-4xl shrink-0">{ev.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-white font-black text-xl leading-tight">{ev.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: tc, backgroundColor: tc + "18" }}>{ev.type}</span>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-white/40 text-xs">
                {ev.startAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/30 text-xs mb-0.5">Attendance Rate</p>
          <p className={`text-4xl font-black leading-none ${rateColor(ev.attendanceRate)}`}>
            {ev.attendanceRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Registered" value={ev.registered} color="#38bdf8" />
        <StatCard icon={CheckCircle} label="Checked In"  value={ev.checkedIn}  color="#34d399" />
        <StatCard icon={Send}        label="Submitted"   value={ev.submitted}  color="#38bdf8" />
        <StatCard icon={Award}       label="Approved"    value={ev.approved}   color="#a78bfa" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut */}
        <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-5">
          <p className="text-white font-bold mb-0.5">Status Breakdown</p>
          <p className="text-white/40 text-xs mb-2">This event</p>
          {ev.registered === 0 ? (
            <p className="text-white/20 text-sm text-center py-10">No participants yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" labelLine={false}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <text x="50%" y="42%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={22} fontWeight={900}>{ev.checkedIn}</text>
                  <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={10}>attended</text>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/50 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />{d.name}
                    </span>
                    <span className="text-white/70 text-xs font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Funnel */}
        <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-5">
          <p className="text-white font-bold mb-0.5">Participation Funnel</p>
          <p className="text-white/40 text-xs mb-5">Progression from registration to approval</p>
          <div className="space-y-4">
            {funnel.map(({ label, value, color, icon: Icon }) => {
              const pct = ev.registered > 0 ? (value / ev.registered) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-white/40" />
                      <span className="text-white/60 text-xs font-medium">{label}</span>
                    </div>
                    <span className="text-white text-xs font-bold">
                      {value} <span className="text-white/30 font-normal">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${color}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* No-shows */}
      {noShows.length > 0 && (
        <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
            <UserX size={15} className="text-rose-400" />
            <p className="text-white font-bold">No-shows <span className="text-rose-400">({noShows.length})</span></p>
            <p className="text-white/30 text-xs">Registered but did not attend</p>
          </div>
          <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
            {noShows.map((p: any) => (
              <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-xs font-bold shrink-0">
                  {(p.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm font-medium truncate">{p.name || "—"}</p>
                  <p className="text-white/30 text-xs truncate">{p.email}</p>
                </div>
                <span className="text-xs text-amber-400 font-semibold shrink-0">No-show</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendees */}
      <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <CheckCircle size={15} className="text-emerald-400" />
          <p className="text-white font-bold">Attendees <span className="text-emerald-400">({attendees.length})</span></p>
        </div>
        {attendees.length === 0 ? (
          <div className="p-10 text-center text-white/30 text-sm">No check-ins recorded yet.</div>
        ) : (
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {attendees.map((p: any) => {
              const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.registered;
              return (
                <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-400/10 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                    {(p.name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{p.name || "—"}</p>
                    <p className="text-white/30 text-xs truncate">{p.email}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AttendanceDashboard() {
  const { user, loading } = useAdminGuard();
  const router = useRouter();

  const [rawEvents,       setRawEvents]       = useState<any[]>([]);
  const [fetching,        setFetching]        = useState(true);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [eventSearch,     setEventSearch]     = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "events"), snap => {
      setRawEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFetching(false);
    });
    return unsub;
  }, [user]);

  const allStats = useMemo(() => deriveStats(rawEvents), [rawEvents]);

  // All events in the sidebar — no filter so every event is reachable
  const pastStats = useMemo(
    () => [...allStats].sort((a, b) => b.startAt.getTime() - a.startAt.getTime()),
    [allStats],
  );

  // Past-only events used for the aggregate overview stats
  const pastOnly = useMemo(
    () => pastStats.filter(e => e.isPast),
    [pastStats],
  );

  const visibleList = useMemo(
    () => eventSearch.trim()
      ? pastStats.filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()))
      : pastStats,
    [pastStats, eventSearch],
  );

  const selectedStats = selectedId ? allStats.find(e => e.id === selectedId) ?? null : null;
  const selectedRaw   = selectedId ? rawEvents.find(e => e.id === selectedId) ?? null  : null;

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0F0E17] overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1,h2,h3,.font-black { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* ── Nav ── */}
      <nav className="shrink-0 border-b border-white/8 bg-[#0F0E17]/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="bg-amber-400 text-[#0F0E17] font-black text-xs px-2.5 py-1 rounded-lg">TB</span>
            <div className="flex items-center gap-1">
              {[
                { label: "Events",     href: "/admin/events"   },
                { label: "Attendance", href: "/admin/students" },
                { label: "Requests",   href: "/admin/requests" },
              ].map(link => (
                <a key={link.href} href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                    ${link.href === "/admin/students"
                      ? "bg-amber-400/10 text-amber-400"
                      : "text-white/40 hover:text-white hover:bg-white/5"}`}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <button type="button"
            onClick={() => signOut(auth).then(() => router.replace("/"))}
            className="flex items-center gap-1.5 text-white/30 hover:text-red-400 transition text-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Event picker sidebar */}
        <div className="w-72 shrink-0 border-r border-white/8 flex flex-col bg-[#0A0A0F]">
          {/* Sidebar header */}
          <div className="px-4 pt-5 pb-3 border-b border-white/8 shrink-0">
            <h1 className="text-white font-black text-lg mb-3">Attendance</h1>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                placeholder="Search events…"
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-amber-400/40"
              />
            </div>
          </div>

          {/* Overview option */}
          <button type="button"
            onClick={() => setSelectedId(null)}
            className={`w-full text-left px-4 py-3 border-b border-white/5 flex items-center gap-2.5 transition shrink-0
              ${selectedId === null
                ? "bg-amber-400/8 border-l-2 border-l-amber-400 text-amber-400"
                : "text-white/40 hover:text-white hover:bg-white/3"}`}>
            <LayoutGrid size={14} />
            <span className="text-sm font-semibold">All Events Overview</span>
          </button>

          {/* Event list */}
          <div className="overflow-y-auto flex-1 py-1">
            {visibleList.length === 0 ? (
              <p className="text-white/20 text-xs text-center mt-8 px-4">No events found.</p>
            ) : (
              visibleList.map(ev => (
                <button type="button" key={ev.id}
                  onClick={() => setSelectedId(ev.id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition group
                    ${selectedId === ev.id
                      ? "bg-white/6 border-l-2 border-l-amber-400"
                      : "hover:bg-white/3 border-l-2 border-l-transparent"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{ev.emoji}</span>
                      <span className={`text-sm font-semibold truncate ${selectedId === ev.id ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                        {ev.title}
                      </span>
                    </div>
                    {ev.isPast
                      ? <span className={`text-xs font-bold shrink-0 ${rateColor(ev.attendanceRate)}`}>{ev.attendanceRate.toFixed(0)}%</span>
                      : <span className="text-xs font-semibold shrink-0 text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">Upcoming</span>
                    }
                  </div>
                  <p className="text-white/25 text-xs mt-0.5 pl-7">
                    {ev.startAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-4 py-3 border-t border-white/8 shrink-0">
            <p className="text-white/20 text-xs">{pastStats.length} event{pastStats.length !== 1 ? "s" : ""} · {pastOnly.length} past</p>
          </div>
        </div>

        {/* RIGHT: Analytics panel */}
        <div className="flex-1 overflow-y-auto">
          {selectedStats && selectedRaw ? (
            <EventDetailPanel ev={selectedStats} raw={selectedRaw} />
          ) : (
            <OverviewPanel pastStats={pastOnly} />
          )}
        </div>
      </div>
    </div>
  );
}
