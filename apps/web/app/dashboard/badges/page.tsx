"use client";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { auth } from "@talentbank/firebase-config";
import { getUserBadges } from "@talentbank/firebase-config";
import { signOut } from "firebase/auth";
import { LogOut, Calendar, Award, User } from "lucide-react";

const BADGE_CLIPS: Record<string, string> = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  circle: "none",
  square: "none",
};

export default function BadgesPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [badges, setBadges] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading]);

  useEffect(() => {
    if (user) getUserBadges(user.uid).then(setBadges);
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#0F0E17]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap'); * { font-family: 'DM Sans', sans-serif; } h1,h2,h3,.font-black,.font-bold,.font-semibold { font-family: 'Outfit', sans-serif; }`}</style>

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
              className={`flex items-center gap-1.5 px-5 py-4 text-sm font-semibold border-b-2 transition ${tab.id === "badges" ? "border-amber-400 text-amber-400" : "border-transparent text-white/40 hover:text-white/70"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {badges.length === 0 ? (
          <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-16 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-amber-400/10 flex items-center justify-center text-4xl">
              🏅
            </div>
            <p className="font-bold text-xl text-white">No badges yet!</p>
            <p className="text-sm text-white/40">
              Join events and get approved to earn badges.
            </p>
            <button
              onClick={() => router.push("/dashboard/events")}
              className="mt-2 bg-amber-400 text-[#0F0E17] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-white text-xl">My Collection</h2>
              <span className="text-sm text-white/40">
                {badges.length} badge{badges.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <button
                  key={badge.id}
                  onClick={() => setSelected(badge)}
                  className="bg-[#1A1825] border border-white/8 rounded-3xl p-6 flex flex-col items-center gap-3 hover:border-amber-400/30 hover:bg-[#1E1C2E] transition-all duration-200 group"
                >
                  <div className="relative">
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        background: badge.color,
                        clipPath: BADGE_CLIPS[badge.shape] ?? "none",
                        borderRadius:
                          badge.shape === "circle"
                            ? "50%"
                            : badge.shape === "square"
                              ? "12px"
                              : "0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 32,
                        boxShadow: `0 8px 32px ${badge.color}40`,
                        transition: "transform 0.2s",
                      }}
                      className="group-hover:scale-110"
                    >
                      {badge.emoji}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white text-center leading-tight">
                    {badge.eventTitle}
                  </p>
                  <p className="text-xs text-white/30">
                    {badge.awardedAt?.toDate().toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[#1A1825] border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 120,
                height: 120,
                background: selected.color,
                clipPath: BADGE_CLIPS[selected.shape] ?? "none",
                borderRadius:
                  selected.shape === "circle"
                    ? "50%"
                    : selected.shape === "square"
                      ? "16px"
                      : "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                boxShadow: `0 16px 48px ${selected.color}50`,
              }}
            >
              {selected.emoji}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-white">
                {selected.eventTitle}
              </h2>
              <p className="text-sm text-white/40 mt-1">
                Awarded {selected.awardedAt?.toDate().toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full bg-amber-400 text-[#0F0E17] py-3 rounded-2xl font-bold hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
