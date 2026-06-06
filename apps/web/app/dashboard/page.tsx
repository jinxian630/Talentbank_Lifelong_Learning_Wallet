"use client";
import { auth, db } from "@talentbank/firebase-config";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { LogOut, Award, Calendar, User } from "lucide-react";

export default function Dashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [badges, setBadges] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("events");

  useEffect(() => {
    if (!loading && !user) router.push("/");
    if (!loading && user) router.push("/dashboard/events");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetchBadges();
    fetchEvents();
  }, [user]);

  const fetchBadges = async () => {
    const q = query(collection(db, "badges"), where("userId", "==", user!.uid));
    const snap = await getDocs(q);
    setBadges(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const fetchEvents = async () => {
    const snap = await getDocs(collection(db, "events"));
    setEvents(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white rounded-xl px-3 py-1 font-bold text-sm">
            TB
          </div>
          <span className="font-semibold text-gray-800">TalentBank Badges</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition text-sm"
        >
          <LogOut size={16} /> Logout
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
          {user?.photoURL && (
            <img src={user.photoURL} className="w-16 h-16 rounded-full" />
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {user?.displayName}
            </h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <p className="text-blue-600 text-sm font-medium mt-1">
              {badges.length} badge{badges.length !== 1 ? "s" : ""} earned
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "events" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            <Calendar size={16} /> Events
          </button>
          <button
            onClick={() => setActiveTab("badges")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "badges" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            <Award size={16} /> My Badges
          </button>
        </div>

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-gray-700">Upcoming Events</h2>
            {events.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
                No events yet. Check back later!
              </div>
            )}
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-2xl p-6 shadow-sm flex items-start justify-between gap-4"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-gray-800">{event.title}</h3>
                  <p className="text-gray-500 text-sm">{event.description}</p>
                  <span
                    className={`text-xs font-medium mt-1 px-2 py-1 rounded-full w-fit ${event.status === "upcoming" ? "bg-green-100 text-green-700" : event.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}
                  >
                    {event.status}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-400 whitespace-nowrap">
                  {event.date?.toDate?.()?.toLocaleDateString() ?? ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-gray-700">My Badges</h2>
            {badges.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
                No badges yet. Attend events to earn badges!
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3 text-center"
                >
                  <div className="bg-blue-100 text-blue-600 rounded-full p-4">
                    <Award size={32} />
                  </div>
                  <h3 className="font-semibold text-gray-800">
                    {badge.eventTitle}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Awarded{" "}
                    {badge.awardedAt?.toDate?.()?.toLocaleDateString() ?? ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
