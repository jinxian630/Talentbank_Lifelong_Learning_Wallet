"use client";
import { auth, provider, db } from "@talentbank/firebase-config";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { isAdmin } from "@talentbank/firebase-config";
import { doc, getDoc } from "firebase/firestore";

export default function Home() {
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email!;
      const uid = result.user.uid;
      if (isAdmin(email)) {
        router.push("/admin/events");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", uid));
      if (!userDoc.exists() || !userDoc.data()?.onboarded) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-[#0F0E17] flex items-center justify-center overflow-hidden relative px-6">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-amber-400/20 blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-[120px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-cyan-400/10 blur-[100px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Floating badges decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          {
            emoji: "🏆",
            top: "15%",
            left: "8%",
            size: 40,
            delay: "0s",
            shape: "hexagon",
          },
          {
            emoji: "🚀",
            top: "70%",
            left: "5%",
            size: 32,
            delay: "0.5s",
            shape: "star",
          },
          {
            emoji: "💎",
            top: "25%",
            right: "6%",
            size: 36,
            delay: "1s",
            shape: "diamond",
          },
          {
            emoji: "⚡",
            top: "65%",
            right: "8%",
            size: 30,
            delay: "1.5s",
            shape: "circle",
          },
          {
            emoji: "🎯",
            top: "45%",
            left: "3%",
            size: 28,
            delay: "2s",
            shape: "pentagon",
          },
          {
            emoji: "🌟",
            top: "80%",
            right: "12%",
            size: 34,
            delay: "0.8s",
            shape: "hexagon",
          },
        ].map((b, i) => (
          <div
            key={i}
            className="absolute opacity-30"
            style={{
              top: b.top,
              left: (b as any).left,
              right: (b as any).right,
              animation: `float 6s ease-in-out infinite`,
              animationDelay: b.delay,
            }}
          >
            <div
              style={{
                width: b.size,
                height: b.size,
                background: [
                  "#FBBF24",
                  "#8B5CF6",
                  "#06B6D4",
                  "#F97316",
                  "#10B981",
                ][i % 5],
                clipPath: {
                  hexagon:
                    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  circle: "none",
                  pentagon:
                    "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
                }[b.shape],
                borderRadius: b.shape === "circle" ? "50%" : "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: b.size * 0.5,
              }}
            >
              {b.emoji}
            </div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 flex flex-col items-center gap-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-amber-400/30">
                TB
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs">
                ✦
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black text-white tracking-tight">
                TalentBank
              </h1>
              <p className="text-amber-400 font-semibold text-sm tracking-widest uppercase">
                Badges
              </p>
            </div>
          </div>

          {/* Tagline */}
          <div className="text-center">
            <p className="text-white/70 text-sm leading-relaxed">
              Your lifelong learning wallet.
              <br />
              <span className="text-white/90">
                Earn badges. Build your story.
              </span>
            </p>
          </div>

          {/* Badge showcase row */}
          <div className="flex items-center gap-3 justify-center">
            {[
              { color: "#FBBF24", shape: "hexagon", emoji: "🏆" },
              { color: "#8B5CF6", shape: "star", emoji: "🚀" },
              { color: "#06B6D4", shape: "diamond", emoji: "💡" },
              { color: "#F97316", shape: "pentagon", emoji: "🎯" },
              { color: "#10B981", shape: "circle", emoji: "⚡" },
            ].map((b, i) => (
              <div
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  background: b.color,
                  clipPath: {
                    hexagon:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                    diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    circle: "none",
                    pentagon:
                      "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
                  }[b.shape],
                  borderRadius: b.shape === "circle" ? "50%" : "0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  boxShadow: `0 4px 15px ${b.color}50`,
                }}
              >
                {b.emoji}
              </div>
            ))}
          </div>

          {/* Sign in button */}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 px-6 py-4 rounded-2xl font-semibold hover:bg-amber-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" />
            Continue with Google
          </button>

          <p className="text-white/30 text-xs text-center">
            For students and administrators of participating institutions
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1, h2, h3, .font-black, .font-bold { font-family: 'Outfit', sans-serif; }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(3deg); }
          66% { transform: translateY(-6px) rotate(-2deg); }
        }
      `}</style>
    </main>
  );
}
