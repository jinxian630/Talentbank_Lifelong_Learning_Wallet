"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getEvents, deleteEvent } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { LogOut, Plus, Trash2, Pencil, Users, Search, MapPin, Video, ClipboardList, GraduationCap } from "lucide-react";
import EventCalendar from "@/components/EventCalendar";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-amber-400/10",  text: "text-amber-400"  },
  Workshop:  { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk:      { bg: "bg-cyan-400/10",   text: "text-cyan-400"   },
  Others:    { bg: "bg-green-400/10",  text: "text-green-400"  },
};

export default function AdminEvents() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [search,      setSearch]      = useState("");
  const [monthFilter, setMonthFilter] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).slice(0, 7),
  );
  const [showPast,  setShowPast]  = useState(false);
  const [viewMode,  setViewMode]  = useState<"list" | "calendar">("list");

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    const data   = await getEvents();
    const now    = new Date();
    const sorted = [...data].sort((a: any, b: any) => {
      const dateA = a.startAt?.toDate?.() ?? new Date(0);
      const dateB = b.startAt?.toDate?.() ?? new Date(0);
      if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
    setEvents(
      sorted
        .filter((e: any) => (e.endAt?.toDate?.() ?? new Date(0)) >= now)
        .map((e: any) => ({
          ...e,
          isOngoing: e.startAt?.toDate?.() <= now && e.endAt?.toDate?.() >= now,
        })),
    );
    setPastEvents(
      sorted.filter((e: any) => (e.endAt?.toDate?.() ?? new Date(0)) < now).reverse(),
    );
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this event?")) {
      await deleteEvent(id);
      fetchEvents();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const filterEvents = (list: any[]) =>
    list.filter((e) => {
      const matchSearch =
        e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.type?.toLowerCase().includes(search.toLowerCase());
      const matchMonth =
        !monthFilter || e.startAt?.toDate().toISOString().slice(0, 7) === monthFilter;
      return matchSearch && matchMonth;
    });

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const EventCard = ({ event, isPast }: { event: any; isPast?: boolean }) => {
    const typeStyle = TYPE_STYLES[event.type] ?? TYPE_STYLES.Others;
    return (
      <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-5 flex items-start justify-between gap-4 hover:border-amber-400/20 transition-all">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-2xl shrink-0`} aria-hidden="true">
            {event.emoji}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>{event.type}</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPast ? "bg-white/5 text-white/30" : "bg-green-400/10 text-green-400"}`}>
                {isPast ? "Past" : "Upcoming"}
              </span>
              {event.locationType === "online" && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 flex items-center gap-1">
                  <Video size={10} aria-hidden="true" /> Online
                </span>
              )}
            </div>
            <h3 className="font-bold text-white">{event.title}</h3>
            <p className="text-xs text-white/40 line-clamp-1">{event.description}</p>
            <div className="flex gap-3 text-xs text-white/30 flex-wrap">
              <span>📅 {event.startAt?.toDate().toLocaleDateString()} – {event.endAt?.toDate().toLocaleDateString()}</span>
              <span>⏰ Reg: {event.regDeadline?.toDate().toLocaleDateString()}</span>
              {event.cap && <span>👥 Cap: {event.cap}</span>}
              {event.venueAddress && (
                <span className="flex items-center gap-1"><MapPin size={10} aria-hidden="true" /> {event.venueAddress}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button type="button"
            onClick={() => router.push(`/admin/events/${event.id}`)}
            className="flex items-center gap-1 text-xs bg-cyan-400/10 text-cyan-400 px-3 py-2 rounded-xl hover:bg-cyan-400/20 transition font-semibold"
          >
            <Users size={13} aria-hidden="true" /> Attendance
          </button>
          {!isPast && (
            <button type="button"
              onClick={() => router.push(`/admin/events/${event.id}/edit`)}
              className="flex items-center gap-1 text-xs bg-amber-400/10 text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-400/20 transition font-semibold"
            >
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
          )}
          <button type="button"
            onClick={() => handleDelete(event.id)}
            className="flex items-center gap-1 text-xs bg-red-400/10 text-red-400 px-3 py-2 rounded-xl hover:bg-red-400/20 transition font-semibold"
          >
            <Trash2 size={13} aria-hidden="true" /> Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3,.font-black,.font-bold { font-family: 'Outfit', sans-serif; }`}</style>

      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">TB</div>
            <span className="font-bold text-white">TalentBank <span className="text-amber-400">Admin</span></span>
          </div>
          <a href="/admin/students" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
            <ClipboardList size={14} aria-hidden="true" /> Feedback Forms
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition">
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Events</h1>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1" role="group" aria-label="View mode">
              <button type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "list" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                List
              </button>
              <button type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "calendar" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
              >
                Calendar
              </button>
            </div>
            <button type="button"
              onClick={() => router.push("/admin/events/create")}
              className="flex items-center gap-2 bg-amber-400 text-[#0F0E17] px-4 py-2.5 rounded-xl text-sm font-black hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              <Plus size={16} aria-hidden="true" /> New Event
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
            <Search size={15} className="text-white/30" aria-hidden="true" />
            <input
              aria-label="Search events"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="month"
            aria-label="Filter by month"
            title="Filter by month"
            className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/60 outline-none focus:border-amber-400/40"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <>
            {search || monthFilter ? (
              <div className="flex flex-col gap-4">
                {filterEvents([...events, ...pastEvents]).length === 0 ? (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
                    <p className="font-bold text-white">No events found</p>
                    <p className="text-sm text-white/30 mt-1">Try a different search or month</p>
                  </div>
                ) : (
                  <>
                    {filterEvents(events).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-green-400">Upcoming</h2>
                          <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                        </div>
                        {filterEvents(events).map((event) => <EventCard key={event.id} event={event} />)}
                      </div>
                    )}
                    {filterEvents(pastEvents).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Past</h2>
                          <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                        </div>
                        {filterEvents(pastEvents).map((event) => <EventCard key={event.id} event={event} isPast />)}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {events.length > 0 && pastEvents.length > 0 && (
                  <>
                    <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 w-fit" role="tablist">
                      <button type="button" role="tab" aria-selected={!showPast}
                        onClick={() => setShowPast(false)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${!showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Upcoming ({events.length})
                      </button>
                      <button type="button" role="tab" aria-selected={showPast}
                        onClick={() => setShowPast(true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${showPast ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
                      >
                        Past ({pastEvents.length})
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {!showPast
                        ? events.map((event) => <EventCard key={event.id} event={event} />)
                        : pastEvents.map((event) => <EventCard key={event.id} event={event} isPast />)}
                    </div>
                  </>
                )}
                {events.length > 0 && pastEvents.length === 0 && (
                  <div className="flex flex-col gap-3">
                    {events.map((event) => <EventCard key={event.id} event={event} />)}
                  </div>
                )}
                {events.length === 0 && pastEvents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">Past Events</h2>
                      <div className="flex-1 h-px bg-white/8" aria-hidden="true" />
                    </div>
                    {pastEvents.map((event) => <EventCard key={event.id} event={event} isPast />)}
                  </div>
                )}
                {events.length === 0 && pastEvents.length === 0 && (
                  <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-10 text-center">
                    <div className="text-4xl mb-3" aria-hidden="true">🎯</div>
                    <p className="font-bold text-white">No events yet</p>
                    <p className="text-sm text-white/30 mt-1">Create your first event!</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-6">
            <EventCalendar
              events={[...events, ...pastEvents]}
              onEventClick={(event) => router.push(`/admin/events/${event.id}`)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
