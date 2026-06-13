"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import Image from "next/image";
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
  Hackathon: "#E8923C",
  Workshop:  "#C9A876",
  Talk:      "#6E89B8",
  Seminar:   "#8FBF8C",
  Bootcamp:  "#6E89B8",
  Others:    "#a0968e",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]",  label: "Registered" },
  registered: { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]",  label: "Registered" },
  checked_in: { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]",  label: "Checked In" },
  submitted:  { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]",  label: "Submitted"  },
  approved:   { bg: "bg-[#C9A876]/15", text: "text-[#9a7a4a]",  label: "Approved"   },
  rejected:   { bg: "bg-red-50",       text: "text-red-500",     label: "Rejected"   },
};

const DONUT_COLORS = {
  notAttended: "#E8923C",
  checkedIn:   "#8FBF8C",
  submitted:   "#6E89B8",
  approved:    "#C9A876",
  rejected:    "#f87171",
};

function rateColor(rate: number) {
  if (rate >= 80) return "text-[#4a8a47]";
  if (rate >= 50) return "text-[#E8923C]";
  return "text-red-500";
}
function rateBg(rate: number) {
  if (rate >= 80) return "bg-[#8FBF8C]";
  if (rate >= 50) return "bg-[#E8923C]";
  return "bg-red-400";
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
    <div className="bg-white rounded-2xl p-5 flex items-start gap-4" style={{ border: "1px solid var(--color-shadow-grey)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "22" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(58,51,44,0.5)" }}>{label}</p>
        <p className="font-extrabold text-2xl leading-none" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>{value}</p>
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
    <div className="bg-white rounded-xl px-4 py-3 text-xs space-y-1.5 shadow-lg" style={{ border: "1px solid var(--color-shadow-grey)" }}>
      <p style={{ color: "#6E89B8" }}>Registered: <span className="font-bold">{reg}</span></p>
      <p style={{ color: "#4a8a47" }}>Checked In: <span className="font-bold">{ci}</span></p>
      <p style={{ color: "rgba(58,51,44,0.5)" }}>Rate: <span className="font-bold" style={{ color: "var(--color-text-dark)" }}>{rate}%</span></p>
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
      color: TYPE_COLORS[type] ?? "#a0968e",
    })).sort((a, b) => b.rate - a.rate);
  }, [pastStats]);

  if (pastStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm" style={{ color: "rgba(58,51,44,0.4)" }}>No past events with participants yet.</p>
          <p className="text-xs mt-1" style={{ color: "rgba(58,51,44,0.3)" }}>Select an event from the left to see its analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-extrabold text-lg mb-1" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Overall Overview</h2>
        <p className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>Aggregated across all {pastStats.length} past events</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Past Events"      value={pastStats.length}   color="#E8923C" />
        <StatCard icon={Users}       label="Total Registered" value={totalRegistrations} color="#6E89B8" />
        <StatCard icon={CheckCircle} label="Total Check-ins"  value={totalCheckIns}      color="#8FBF8C" />
        <StatCard icon={TrendingUp}  label="Attendance Rate"  value={`${overallRate}%`}  color="#C9A876" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-2xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <p className="font-bold mb-0.5" style={{ color: "var(--color-text-dark)" }}>Registration vs Check-in</p>
          <p className="text-xs mb-4" style={{ color: "rgba(58,51,44,0.45)" }}>Last {barData.length} past events</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={3} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: "rgba(58,51,44,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(58,51,44,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(58,51,44,0.04)" }} />
              <Bar dataKey="registered" fill="#6E89B8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="checkedIn"  fill="#8FBF8C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#6E89B8" }} /> Registered
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "#8FBF8C" }} /> Checked In
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <p className="font-bold mb-0.5" style={{ color: "var(--color-text-dark)" }}>Status Breakdown</p>
          <p className="text-xs mb-2" style={{ color: "rgba(58,51,44,0.45)" }}>All past events combined</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value" labelLine={false}>
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <text x="50%" y="44%" dominantBaseline="middle" textAnchor="middle" fill="#3A332C" fontSize={22} fontWeight={900}>{totalCheckIns}</text>
              <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="rgba(58,51,44,0.4)" fontSize={10}>Check-ins</text>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color }} />{d.name}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-dark)" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {rateByType.length > 1 && (
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <p className="font-bold mb-0.5" style={{ color: "var(--color-text-dark)" }}>Rate by Event Type</p>
          <p className="text-xs mb-4" style={{ color: "rgba(58,51,44,0.45)" }}>Average attendance across all past events</p>
          <div className="space-y-3">
            {rateByType.map(({ type, rate, count, color }) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color }}>{type}
                    <span className="text-xs font-normal ml-2" style={{ color: "rgba(58,51,44,0.3)" }}>{count} event{count !== 1 ? "s" : ""}</span>
                  </span>
                  <span className={`text-sm font-bold ${rateColor(rate)}`}>{rate.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-shadow-grey)" }}>
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
  const tc = TYPE_COLORS[ev.type] ?? "#a0968e";

  const donutData = [
    { name: "Not Attended", value: ev.registered - ev.checkedIn,             color: DONUT_COLORS.notAttended },
    { name: "Checked In",   value: ev.checkedIn  - ev.submitted,             color: DONUT_COLORS.checkedIn  },
    { name: "Submitted",    value: ev.submitted  - ev.approved - ev.rejected, color: DONUT_COLORS.submitted },
    { name: "Approved",     value: ev.approved,                               color: DONUT_COLORS.approved   },
    { name: "Rejected",     value: ev.rejected,                               color: DONUT_COLORS.rejected   },
  ].filter(d => d.value > 0);

  const funnel = [
    { label: "Registered", value: ev.registered, color: "bg-[#6E89B8]", icon: Users        },
    { label: "Checked In", value: ev.checkedIn,  color: "bg-[#8FBF8C]", icon: CheckCircle  },
    { label: "Submitted",  value: ev.submitted,  color: "bg-[#6E89B8]", icon: Send         },
    { label: "Approved",   value: ev.approved,   color: "bg-[#C9A876]", icon: Award        },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-4xl shrink-0">{ev.emoji}</span>
          <div className="min-w-0">
            <h2 className="font-extrabold text-xl leading-tight" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>{ev.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: tc, backgroundColor: tc + "18" }}>{ev.type}</span>
              <span style={{ color: "rgba(58,51,44,0.3)" }} className="text-xs">·</span>
              <span className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>
                {ev.startAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs mb-0.5" style={{ color: "rgba(58,51,44,0.4)" }}>Attendance Rate</p>
          <p className={`text-4xl font-extrabold leading-none ${rateColor(ev.attendanceRate)}`}>
            {ev.attendanceRate.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Registered" value={ev.registered} color="#6E89B8" />
        <StatCard icon={CheckCircle} label="Checked In"  value={ev.checkedIn}  color="#8FBF8C" />
        <StatCard icon={Send}        label="Submitted"   value={ev.submitted}  color="#6E89B8" />
        <StatCard icon={Award}       label="Approved"    value={ev.approved}   color="#C9A876" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <p className="font-bold mb-0.5" style={{ color: "var(--color-text-dark)" }}>Status Breakdown</p>
          <p className="text-xs mb-2" style={{ color: "rgba(58,51,44,0.45)" }}>This event</p>
          {ev.registered === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "rgba(58,51,44,0.3)" }}>No participants yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" labelLine={false}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <text x="50%" y="42%" dominantBaseline="middle" textAnchor="middle" fill="#3A332C" fontSize={22} fontWeight={900}>{ev.checkedIn}</text>
                  <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="rgba(58,51,44,0.35)" fontSize={10}>attended</text>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs" style={{ color: "rgba(58,51,44,0.5)" }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />{d.name}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-text-dark)" }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <p className="font-bold mb-0.5" style={{ color: "var(--color-text-dark)" }}>Participation Funnel</p>
          <p className="text-xs mb-5" style={{ color: "rgba(58,51,44,0.45)" }}>Progression from registration to approval</p>
          <div className="space-y-4">
            {funnel.map(({ label, value, color, icon: Icon }) => {
              const pct = ev.registered > 0 ? (value / ev.registered) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={13} style={{ color: "rgba(58,51,44,0.4)" }} />
                      <span className="text-xs font-medium" style={{ color: "rgba(58,51,44,0.6)" }}>{label}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: "var(--color-text-dark)" }}>
                      {value} <span className="font-normal" style={{ color: "rgba(58,51,44,0.3)" }}>({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-shadow-grey)" }}>
                    <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {noShows.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
            <UserX size={15} className="text-red-400" />
            <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>No-shows <span className="text-red-400">({noShows.length})</span></p>
            <p className="text-xs" style={{ color: "rgba(58,51,44,0.4)" }}>Registered but did not attend</p>
          </div>
          <div className="max-h-56 overflow-y-auto" style={{ borderTop: "none" }}>
            {noShows.map((p: any) => (
              <div key={p.uid} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: "var(--color-shadow-grey)", color: "rgba(58,51,44,0.5)" }}>
                  {(p.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-dark)" }}>{p.name || "—"}</p>
                  <p className="text-xs truncate" style={{ color: "rgba(58,51,44,0.4)" }}>{p.email}</p>
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: "var(--color-primary-orange)" }}>No-show</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-shadow-grey)" }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
          <CheckCircle size={15} style={{ color: "#8FBF8C" }} />
          <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>Attendees <span style={{ color: "#4a8a47" }}>({attendees.length})</span></p>
        </div>
        {attendees.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "rgba(58,51,44,0.3)" }}>No check-ins recorded yet.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {attendees.map((p: any) => {
              const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.registered;
              return (
                <div key={p.uid} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: "#8FBF8C22", color: "#4a8a47" }}>
                    {(p.name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-dark)" }}>{p.name || "—"}</p>
                    <p className="text-xs truncate" style={{ color: "rgba(58,51,44,0.4)" }}>{p.email}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
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

  const [rawEvents,   setRawEvents]   = useState<any[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "events"), snap => {
      setRawEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFetching(false);
    });
    return unsub;
  }, [user]);

  const allStats  = useMemo(() => deriveStats(rawEvents), [rawEvents]);
  const pastStats = useMemo(() => [...allStats].sort((a, b) => b.startAt.getTime() - a.startAt.getTime()), [allStats]);
  const pastOnly  = useMemo(() => pastStats.filter(e => e.isPast), [pastStats]);
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      {/* ── Nav ── */}
      <nav className="shrink-0 backdrop-blur-md px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "rgba(247,244,238,0.92)" }}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet" width={80} height={80} className="rounded-xl -my-2" onError={() => {}} />
          </div>
          {[
            { label: "Events",     href: "/admin/events"   },
            { label: "Attendance", href: "/admin/students" },
            { label: "Requests",   href: "/admin/requests" },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
              style={link.href === "/admin/students"
                ? { backgroundColor: "rgba(232,146,60,0.12)", color: "var(--color-primary-orange)" }
                : { color: "rgba(58,51,44,0.5)" }}>
              {link.label}
            </a>
          ))}
        </div>
        <button type="button"
          onClick={() => signOut(auth).then(() => router.replace("/"))}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-60"
          style={{ color: "rgba(58,51,44,0.5)" }}>
          <LogOut size={14} /> Sign out
        </button>
      </nav>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: sidebar */}
        <div className="w-72 shrink-0 flex flex-col bg-white" style={{ borderRight: "1px solid var(--color-shadow-grey)" }}>
          <div className="px-4 pt-5 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--color-shadow-grey)" }}>
            <h1 className="font-extrabold text-lg mb-3" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Attendance</h1>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(58,51,44,0.3)" }} />
              <input
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
                placeholder="Search events…"
                className="w-full rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none"
                style={{
                  backgroundColor: "var(--color-bg-cream)",
                  border: "1px solid var(--color-shadow-grey)",
                  color: "var(--color-text-dark)",
                }}
              />
            </div>
          </div>

          <button type="button"
            onClick={() => setSelectedId(null)}
            className="w-full text-left px-4 py-3 flex items-center gap-2.5 transition shrink-0"
            style={{
              borderBottom: "1px solid var(--color-shadow-grey)",
              borderLeft: selectedId === null ? "3px solid var(--color-primary-orange)" : "3px solid transparent",
              backgroundColor: selectedId === null ? "rgba(232,146,60,0.08)" : "transparent",
              color: selectedId === null ? "var(--color-primary-orange)" : "rgba(58,51,44,0.5)",
            }}>
            <LayoutGrid size={14} />
            <span className="text-sm font-semibold">All Events Overview</span>
          </button>

          <div className="overflow-y-auto flex-1 py-1">
            {visibleList.length === 0 ? (
              <p className="text-xs text-center mt-8 px-4" style={{ color: "rgba(58,51,44,0.3)" }}>No events found.</p>
            ) : (
              visibleList.map(ev => (
                <button type="button" key={ev.id}
                  onClick={() => setSelectedId(ev.id)}
                  className="w-full text-left px-4 py-3 transition"
                  style={{
                    borderBottom: "1px solid var(--color-shadow-grey)",
                    borderLeft: selectedId === ev.id ? "3px solid var(--color-primary-orange)" : "3px solid transparent",
                    backgroundColor: selectedId === ev.id ? "rgba(232,146,60,0.06)" : "transparent",
                  }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{ev.emoji}</span>
                      <span className="text-sm font-semibold truncate" style={{ color: selectedId === ev.id ? "var(--color-text-dark)" : "rgba(58,51,44,0.65)" }}>
                        {ev.title}
                      </span>
                    </div>
                    {ev.isPast
                      ? <span className={`text-xs font-bold shrink-0 ${rateColor(ev.attendanceRate)}`}>{ev.attendanceRate.toFixed(0)}%</span>
                      : <span className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ color: "var(--color-primary-orange)", backgroundColor: "rgba(232,146,60,0.12)" }}>Upcoming</span>
                    }
                  </div>
                  <p className="text-xs mt-0.5 pl-7" style={{ color: "rgba(58,51,44,0.35)" }}>
                    {ev.startAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--color-shadow-grey)" }}>
            <p className="text-xs" style={{ color: "rgba(58,51,44,0.35)" }}>{pastStats.length} event{pastStats.length !== 1 ? "s" : ""} · {pastOnly.length} past</p>
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
