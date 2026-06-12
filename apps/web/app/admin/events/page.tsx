"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { getEvents, deleteEvent } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { LogOut, Plus, Trash2, Pencil, Users, Search, MapPin, Video, ClipboardList, GraduationCap } from "lucide-react";
import EventCalendar from "@/components/EventCalendar";
import Image from "next/image";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-[#E8923C]/10", text: "text-[#E8923C]" },
  Workshop:  { bg: "bg-[#C9A876]/15", text: "text-[#9a7a4a]" },
  Talk:      { bg: "bg-[#6E89B8]/10", text: "text-[#6E89B8]" },
  Others:    { bg: "bg-[#8FBF8C]/15", text: "text-[#4a8a47]" },
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
      </div>
    );

  const EventCard = ({ event, isPast }: { event: any; isPast?: boolean }) => {
    const typeStyle = TYPE_STYLES[event.type] ?? TYPE_STYLES.Others;
    return (
      <div
        className="bg-white rounded-3xl p-5 flex items-start justify-between gap-4 hover:shadow-md transition-all"
        style={{ border: "1px solid var(--color-shadow-grey)" }}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-2xl shrink-0`} aria-hidden="true">
            {event.emoji}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>{event.type}</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPast ? "bg-[#E2DED6] text-[#3A332C]/40" : "bg-[#8FBF8C]/15 text-[#4a8a47]"}`}>
                {isPast ? "Past" : "Upcoming"}
              </span>
              {event.locationType === "online" && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#6E89B8]/10 text-[#6E89B8] flex items-center gap-1">
                  <Video size={10} aria-hidden="true" /> Online
                </span>
              )}
            </div>
            <h3 className="font-bold text-[#3A332C]">{event.title}</h3>
            <p className="text-xs text-[#3A332C]/50 line-clamp-1">{event.description}</p>
            <div className="flex gap-3 text-xs text-[#3A332C]/40 flex-wrap">
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
            className="flex items-center gap-1 text-xs bg-[#6E89B8]/10 text-[#6E89B8] px-3 py-2 rounded-xl hover:bg-[#6E89B8]/20 transition font-semibold"
          >
            <Users size={13} aria-hidden="true" /> Attendance
          </button>
          {!isPast && (
            <button type="button"
              onClick={() => router.push(`/admin/events/${event.id}/edit`)}
              className="flex items-center gap-1 text-xs bg-[#E8923C]/10 text-[#E8923C] px-3 py-2 rounded-xl hover:bg-[#E8923C]/20 transition font-semibold"
            >
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
          )}
          <button type="button"
            onClick={() => handleDelete(event.id)}
            className="flex items-center gap-1 text-xs bg-red-50 text-red-500 px-3 py-2 rounded-xl hover:bg-red-100 transition font-semibold"
          >
            <Trash2 size={13} aria-hidden="true" /> Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      {/* Navbar */}
      <nav
        className="backdrop-blur-xl sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{
          backgroundColor: "rgba(247,244,238,0.92)",
          borderBottom: "1px solid var(--color-shadow-grey)",
        }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Image
              src="/assets/logo/xp_carreer_logo-removebg-preview.png"
              alt="XP Career Wallet"
              width={80}
              height={80}
              className="rounded-xl -my-2"
              onError={() => {}}
            />
          </div>
          <a href="/admin/events" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
            Events
          </a>
          <a href="/admin/students" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
            <Users size={14} aria-hidden="true" /> Attendance
          </a>
          <a href="/admin/feedback" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
            <ClipboardList size={14} aria-hidden="true" /> Feedback
          </a>
          <a href="/admin/exams" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
            <GraduationCap size={14} aria-hidden="true" /> Exams
          </a>
          {isSuperAdmin && (
            <a href="/admin/requests" className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
              <Users size={14} aria-hidden="true" /> Requests
            </a>
          )}
        </div>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out" className="transition-opacity hover:opacity-60" style={{ color: "var(--color-text-dark)" }}>
          <LogOut size={16} aria-hidden="true" />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Events</h1>
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-xl p-1"
              style={{ backgroundColor: "var(--color-shadow-grey)" }}
              role="group" aria-label="View mode"
            >
              <button type="button"
                onClick={() => setViewMode("list")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={viewMode === "list"
                  ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                  : { color: "rgba(58,51,44,0.5)" }}
              >List</button>
              <button type="button"
                onClick={() => setViewMode("calendar")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={viewMode === "calendar"
                  ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                  : { color: "rgba(58,51,44,0.5)" }}
              >Calendar</button>
            </div>
            <button type="button"
              onClick={() => router.push("/admin/events/create")}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-md"
              style={{ backgroundColor: "var(--color-primary-orange)" }}
            >
              <Plus size={16} aria-hidden="true" /> New Event
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div
            className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}
          >
            <Search size={15} style={{ color: "rgba(58,51,44,0.3)" }} aria-hidden="true" />
            <input
              aria-label="Search events"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--color-text-dark)" }}
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            type="month"
            aria-label="Filter by month"
            title="Filter by month"
            className="rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              backgroundColor: "#fff",
              border: "1px solid var(--color-shadow-grey)",
              color: "var(--color-text-dark)",
            }}
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
                  <div className="bg-white rounded-3xl p-10 text-center" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                    <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
                    <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>No events found</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(58,51,44,0.4)" }}>Try a different search or month</p>
                  </div>
                ) : (
                  <>
                    {filterEvents(events).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-success-green)" }}>Upcoming</h2>
                          <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-shadow-grey)" }} aria-hidden="true" />
                        </div>
                        {filterEvents(events).map((event) => <EventCard key={event.id} event={event} />)}
                      </div>
                    )}
                    {filterEvents(pastEvents).length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(58,51,44,0.4)" }}>Past</h2>
                          <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-shadow-grey)" }} aria-hidden="true" />
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
                    <div
                      className="flex rounded-xl p-1 w-fit"
                      style={{ backgroundColor: "var(--color-shadow-grey)" }}
                      role="tablist"
                    >
                      <button type="button" role="tab" aria-selected={!showPast}
                        onClick={() => setShowPast(false)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={!showPast
                          ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                          : { color: "rgba(58,51,44,0.5)" }}
                      >Upcoming ({events.length})</button>
                      <button type="button" role="tab" aria-selected={showPast}
                        onClick={() => setShowPast(true)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={showPast
                          ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                          : { color: "rgba(58,51,44,0.5)" }}
                      >Past ({pastEvents.length})</button>
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
                      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(58,51,44,0.4)" }}>Past Events</h2>
                      <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-shadow-grey)" }} aria-hidden="true" />
                    </div>
                    {pastEvents.map((event) => <EventCard key={event.id} event={event} isPast />)}
                  </div>
                )}
                {events.length === 0 && pastEvents.length === 0 && (
                  <div className="bg-white rounded-3xl p-10 text-center" style={{ border: "1px solid var(--color-shadow-grey)" }}>
                    <div className="text-4xl mb-3" aria-hidden="true">🎯</div>
                    <p className="font-bold" style={{ color: "var(--color-text-dark)" }}>No events yet</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(58,51,44,0.4)" }}>Create your first event!</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <div className="bg-white rounded-3xl p-6" style={{ border: "1px solid var(--color-shadow-grey)" }}>
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
