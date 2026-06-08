"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
  LogOut, Users, Award, Clock, Search,
  CheckCircle, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { updateParticipantStatus, awardBadge, revokeBadge } from "@talentbank/firebase-config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Participant {
  uid:    string;
  email:  string;
  name:   string;
  status: "pending" | "approved" | "rejected";
}

interface EventRow {
  id:                 string;
  title:              string;
  type:               string;
  emoji:              string;
  badgeShape:         string;
  badgeColor:         string;
  badgeEmoji:         string;
  pendingParticipants: Participant[];
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: "bg-amber-400/10",   text: "text-amber-400",   label: "Pending"  },
  approved: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Approved" },
  rejected: { bg: "bg-red-400/10",     text: "text-red-400",     label: "Rejected" },
};

const TYPE_STYLES: Record<string, string> = {
  Hackathon: "text-amber-400",
  Workshop:  "text-purple-400",
  Talk:      "text-sky-400",
  Seminar:   "text-emerald-400",
  Bootcamp:  "text-sky-400",
  Others:    "text-white/40",
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "18" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-white/40 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-white font-black text-2xl">{value}</p>
      </div>
    </div>
  );
}

// ─── EVENT SECTION ────────────────────────────────────────────────────────────

function EventSection({
  event, filter, onApprove, onReject,
}: {
  event: EventRow;
  filter: StatusFilter;
  onApprove: (uid: string) => void;
  onReject:  (uid: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const participants = event.pendingParticipants.filter(p =>
    filter === "all" ? true : p.status === filter
  );

  if (participants.length === 0) return null;

  const counts = {
    pending:  event.pendingParticipants.filter(p => p.status === "pending").length,
    approved: event.pendingParticipants.filter(p => p.status === "approved").length,
    rejected: event.pendingParticipants.filter(p => p.status === "rejected").length,
  };

  return (
    <div className="bg-[#1A1825] border border-white/8 rounded-2xl overflow-hidden">
      {/* Event header — click to collapse */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{event.emoji || "📅"}</span>
          <div>
            <p className="text-white font-semibold text-sm">{event.title}</p>
            <p className={`text-xs font-medium ${TYPE_STYLES[event.type] ?? "text-white/40"}`}>
              {event.type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status counts */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {counts.pending  > 0 && <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold">{counts.pending} pending</span>}
            {counts.approved > 0 && <span className="bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">{counts.approved} approved</span>}
            {counts.rejected > 0 && <span className="bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full font-semibold">{counts.rejected} rejected</span>}
          </div>
          {expanded ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
        </div>
      </button>

      {/* Participant list */}
      {expanded && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {participants.map(p => {
            const s = STATUS_STYLES[p.status];
            return (
              <div key={p.uid} className="flex items-center justify-between px-5 py-3.5 gap-4">
                {/* Student info */}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{p.name || "—"}</p>
                  <p className="text-white/40 text-xs truncate">{p.email}</p>
                </div>

                {/* Status badge */}
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                  {s.label}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.status !== "approved" && (
                    <button
                      onClick={() => onApprove(p.uid)}
                      className="flex items-center gap-1 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 text-xs px-3 py-1.5 rounded-xl transition font-semibold"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                  )}
                  {p.status !== "rejected" && (
                    <button
                      onClick={() => onReject(p.uid)}
                      className="flex items-center gap-1 bg-red-400/10 hover:bg-red-400/20 text-red-400 text-xs px-3 py-1.5 rounded-xl transition font-semibold"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const router = useRouter();
  const { user, loading } = useAdminGuard();

  const [events,  setEvents]  = useState<EventRow[]>([]);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<StatusFilter>("all");

  // Real-time listener on events collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), snap => {
      const rows: EventRow[] = snap.docs.map(d => ({
        id:    d.id,
        title: d.data().title      ?? "Untitled",
        type:  d.data().type       ?? "Others",
        emoji: d.data().emoji      ?? "📅",
        badgeShape: d.data().badgeShape ?? "hexagon",
        badgeColor: d.data().badgeColor ?? "#FBBF24",
        badgeEmoji: d.data().badgeEmoji ?? "🏆",
        pendingParticipants: (d.data().pendingParticipants ?? []) as Participant[],
      }));
      setEvents(rows);
    });
    return unsub;
  }, []);

  // Derived stats
  const allParticipants = events.flatMap(e => e.pendingParticipants);
  const pendingCount    = allParticipants.filter(p => p.status === "pending").length;
  const approvedCount   = allParticipants.filter(p => p.status === "approved").length;
  const rejectedCount   = allParticipants.filter(p => p.status === "rejected").length;
  const uniqueStudents  = new Set(allParticipants.map(p => p.uid)).size;

  // Apply search + status filter to events
  const filteredEvents = events
    .map(e => ({
      ...e,
      pendingParticipants: e.pendingParticipants.filter(p => {
        const matchesFilter = filter === "all" ? true : p.status === filter;
        const matchesSearch = search
          ? p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.email?.toLowerCase().includes(search.toLowerCase())
          : true;
        return matchesFilter && matchesSearch;
      }),
    }))
    .filter(e => e.pendingParticipants.length > 0);

  const handleApprove = async (event: EventRow, uid: string) => {
    const p = event.pendingParticipants.find(x => x.uid === uid)!;
    const wasApproved = p.status === "approved";
    await updateParticipantStatus(event.id, uid, "approved");
    if (!wasApproved) {
      await awardBadge(event.id, event.title, p, {
        shape: event.badgeShape, color: event.badgeColor, emoji: event.badgeEmoji,
      });
    }
  };

  const handleReject = async (event: EventRow, uid: string) => {
    const p = event.pendingParticipants.find(x => x.uid === uid)!;
    const wasApproved = p.status === "approved";
    await updateParticipantStatus(event.id, uid, "rejected");
    if (wasApproved) await revokeBadge(event.id, uid);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0E17]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1,h2,h3,.font-black { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 border-b border-white/8 bg-[#0F0E17]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="bg-amber-400 text-[#0F0E17] font-black text-xs px-2.5 py-1 rounded-lg">TB</span>
            <div className="flex items-center gap-1">
              {[
                { label: "Events",   href: "/admin/events"   },
                { label: "Students", href: "/admin/students" },
                { label: "Requests", href: "/admin/requests" },
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
          <button
            onClick={() => signOut(auth).then(() => router.replace("/"))}
            className="flex items-center gap-1.5 text-white/30 hover:text-red-400 transition text-sm"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-white font-black text-2xl">Student Status</h1>
          <p className="text-white/40 text-sm mt-1">
            Manage participant approvals across all events
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}        label="Unique Students" value={uniqueStudents} color="#fbbf24" />
          <StatCard icon={Clock}        label="Pending"         value={pendingCount}   color="#f59e0b" />
          <StatCard icon={CheckCircle}  label="Approved"        value={approvedCount}  color="#34d399" />
          <StatCard icon={XCircle}      label="Rejected"        value={rejectedCount}  color="#fb7185" />
        </div>

        {/* ── Filter + Search bar ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Status filter tabs */}
          <div className="flex gap-1 bg-[#1A1825] border border-white/8 rounded-xl p-1">
            {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition
                  ${filter === f
                    ? "bg-amber-400/15 text-amber-400"
                    : "text-white/30 hover:text-white"}`}
              >
                {f}
                {f !== "all" && (
                  <span className="ml-1 opacity-60">
                    ({f === "pending" ? pendingCount : f === "approved" ? approvedCount : rejectedCount})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-[#1A1825] border border-white/8 rounded-xl pl-8 pr-4 py-2
                         text-white text-sm placeholder-white/20 focus:outline-none
                         focus:border-amber-400/40"
            />
          </div>
        </div>

        {/* ── Event sections ── */}
        {events.length === 0 ? (
          <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-12 text-center">
            <p className="text-white/30 text-sm">No events created yet.</p>
            <a href="/admin/events" className="text-amber-400 text-sm mt-2 inline-block hover:underline">
              Create your first event →
            </a>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-[#1A1825] border border-white/8 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">🫙</p>
            <p className="text-white/40 text-sm">
              {search
                ? `No students match "${search}"`
                : filter !== "all"
                  ? `No ${filter} students across any event`
                  : "No students have joined any events yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map(event => (
              <EventSection
                key={event.id}
                event={event}
                filter={filter}
                onApprove={uid => handleApprove(event, uid)}
                onReject={uid  => handleReject(event, uid)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
