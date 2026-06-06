"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { getEvents, joinEvent, leaveEvent, getUserProfile } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { LogOut, Calendar, Award, User, Search } from "lucide-react";
import EventCalendar from "@/components/EventCalendar";
import AIChatbot from "@/components/AIChatbot";

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Hackathon: { bg: "bg-amber-400/10", text: "text-amber-400" },
  Workshop: { bg: "bg-purple-400/10", text: "text-purple-400" },
  Talk: { bg: "bg-cyan-400/10", text: "text-cyan-400" },
};

function getWeekLabel(date: Date) {
  const now = new Date();
  const diffDays = Math.floor(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7) return "This Week";
  if (diffDays < 14) return "Next Week";
  if (diffDays < 21) return "In 2 Weeks";
  return `In ${Math.floor(diffDays / 7)} Weeks`;
}

export default function StudentEvents() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [monthFilter, setMonthFilter] = useState(
    new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" })
      .slice(0, 7),
  );
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading]);

  useEffect(() => {
    if (user) fetchEvents();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchEvents();
      getUserProfile(user.uid).then(setUserProfile);
    }
  }, [user]);

  const fetchEvents = async () => {
    const data = await getEvents();
    const now = new Date();
    const filtered = data
      .filter((e: any) => e.endAt?.toDate() > now)
      .sort((a: any, b: any) => a.startAt?.toDate() - b.startAt?.toDate())
      .map((e: any) => ({
        ...e,
        isOngoing: e.startAt?.toDate() <= now && e.endAt?.toDate() >= now,
      }));
    setEvents(filtered);
  };

  const isJoined = (event: any) =>
    event.pendingParticipants?.some((p: any) => p.uid === user?.uid);
  const isCapReached = (event: any) =>
    event.cap && event.pendingParticipants?.length >= event.cap;
  const isRegClosed = (event: any) => event.regDeadline?.toDate() < new Date();

  const hasConflict = (event: any) => {
    const start = event.startAt?.toDate();
    const end = event.endAt?.toDate();
    return events.some((e) => {
      if (e.id === event.id || !isJoined(e)) return false;
      return start < e.endAt?.toDate() && end > e.startAt?.toDate();
    });
  };

  const handleJoin = async (event: any) => {
    if (hasConflict(event)) {
      alert("You have a scheduling conflict!");
      return;
    }
    await joinEvent(event.id, user);
    fetchEvents();
  };

  const handleLeave = async (event: any) => {
    await leaveEvent(event.id, user);
    fetchEvents();
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const filtered = events.filter((e) => {
    const matchSearch =
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.type?.toLowerCase().includes(search.toLowerCase());
    const matchMonth =
      !monthFilter ||
      e.startAt?.toDate().toISOString().slice(0, 7) === monthFilter;
    return matchSearch && matchMonth;
  });

  const grouped = filtered.reduce((acc: any, event: any) => {
    const label = getWeekLabel(event.startAt?.toDate() ?? new Date());
    if (!acc[label]) acc[label] = [];
    acc[label].push(event);
    return acc;
  }, {});

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1,h2,h3,.font-black,.font-bold,.font-semibold { font-family: 'Outfit', sans-serif; }
      `}</style>

      {/* Navbar */}
      <nav className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-amber-400 text-white rounded-xl px-3 py-1 font-black text-sm shadow-lg shadow-amber-400/30">
            TB
          </div>
          <span className="font-bold text-white">TalentBank</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-400/50 hover:border-amber-400 transition"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-amber-400 flex items-center justify-center text-white text-xs font-bold">
                {user?.displayName?.[0]}
              </div>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-red-400 transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-[#0F0E17]/80 border-b border-white/8 backdrop-blur-xl px-6">
        <div className="max-w-4xl mx-auto flex">
          {[
            {
              id: "events",
              label: "Events",
              icon: <Calendar size={15} />,
              path: "/dashboard/events",
            },
            {
              id: "badges",
              label: "Badges",
              icon: <Award size={15} />,
              path: "/dashboard/badges",
            },
            {
              id: "profile",
              label: "Profile",
              icon: <User size={15} />,
              path: "/dashboard/profile",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex items-center gap-1.5 px-5 py-4 text-sm font-semibold border-b-2 transition ${
                tab.id === "events"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* View Toggle */}
        <div className="flex justify-end">
          <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "list" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "calendar" ? "bg-amber-400 text-[#0F0E17]" : "text-white/40 hover:text-white"}`}
            >
              Calendar
            </button>
          </div>
        </div>
        {viewMode === "list" && (
          <>
            {/* Search + Filter */}
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-3 bg-white/5 border border-white/8 rounded-2xl px-4 py-3">
                <Search size={16} className="text-white/30" />
                <input
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
                  placeholder="Search events by name or type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <input
                type="month"
                className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white/60 outline-none focus:border-amber-400/40"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            {/* Events */}
            {Object.keys(grouped).length === 0 ? (
              <div className="bg-white/5 border border-white/8 rounded-3xl p-12 text-center">
                <div className="text-5xl mb-4">🎯</div>
                <p className="font-bold text-lg text-white">
                  No upcoming events
                </p>
                <p className="text-sm mt-1 text-white/40">Check back soon!</p>
              </div>
            ) : (
              Object.entries(grouped).map(([week, weekEvents]: any) => (
                <div key={week} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">
                      {week}
                    </h2>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>
                  {weekEvents.map((event: any) => {
                    const joined = isJoined(event);
                    const capReached = isCapReached(event);
                    const regClosed = isRegClosed(event);
                    const conflict = !joined && hasConflict(event);
                    const typeStyle = TYPE_STYLES[event.type] ?? {
                      bg: "bg-green-400/10",
                      text: "text-green-400",
                    };

                    return (
                      <div
                        key={event.id}
                        className={`bg-[#1A1825] border rounded-3xl p-5 flex items-start justify-between gap-4 cursor-pointer transition-all duration-200 group ${
                          regClosed || capReached
                            ? "border-white/4 opacity-50 hover:opacity-70"
                            : "border-white/8 hover:border-amber-400/30 hover:bg-[#1E1C2E]"
                        }`}
                        onClick={() =>
                          router.push(`/dashboard/events/${event.id}`)
                        }
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl ${typeStyle.bg} flex items-center justify-center text-2xl shrink-0 ${!regClosed && !capReached ? "group-hover:scale-110 transition-transform duration-200" : ""}`}
                          >
                            {regClosed || capReached ? "🔒" : event.emoji}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text}`}
                              >
                                {event.type}
                              </span>
                              {joined && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-400/10 text-green-400">
                                  Joined ✓
                                </span>
                              )}
                              {event.isOngoing && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 animate-pulse">
                                  🔴 Live Now
                                </span>
                              )}
                              {conflict && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-400/10 text-red-400">
                                  ⚠ Conflict
                                </span>
                              )}
                              {capReached && !joined && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/5 text-white/30">
                                  🚫 Full
                                </span>
                              )}
                              {regClosed && !joined && !capReached && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/5 text-white/30">
                                  ✕ Reg Closed
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-white">
                              {event.title}
                            </h3>
                            <p className="text-xs text-white/40">
                              📅 {event.startAt?.toDate().toLocaleDateString()}{" "}
                              · Reg closes{" "}
                              {event.regDeadline?.toDate().toLocaleDateString()}
                              {event.cap &&
                                ` · 👥 ${event.pendingParticipants?.length ?? 0}/${event.cap}`}
                            </p>
                          </div>
                        </div>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 pt-1"
                        >
                          {joined ? (
                            <button
                              onClick={() => handleLeave(event)}
                              className="text-xs bg-red-400/10 text-red-400 px-3 py-2 rounded-xl hover:bg-red-400/20 transition font-semibold"
                            >
                              Leave
                            </button>
                          ) : regClosed || capReached ? (
                            <span className="text-xs bg-white/5 text-white/20 px-3 py-2 rounded-xl font-semibold">
                              {capReached ? "Full" : "Closed"}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoin(event)}
                              className="text-xs bg-amber-400 text-[#0F0E17] px-3 py-2 rounded-xl hover:bg-amber-300 transition font-bold shadow-lg shadow-amber-400/20"
                            >
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </>
        )}

        {viewMode === "calendar" && (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-6">
            <EventCalendar
              events={events}
              userId={user?.uid}
              onEventClick={(event) =>
                router.push(`/dashboard/events/${event.id}`)
              }
            />
          </div>
        )}
      </div>
      <AIChatbot userProfile={userProfile} events={events} />
    </main>
  );
}
