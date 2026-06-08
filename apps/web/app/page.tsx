"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { SUPER_ADMIN_EMAILS } from "@talentbank/firebase-config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const snap = await getDoc(doc(db, "admins", user.uid));
      if (snap.exists() && snap.data().status === "approved") {
        router.replace("/admin/events");
      }
    });
    return unsubscribe;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Auto-provision super-admin on first login
      if (SUPER_ADMIN_EMAILS.includes(user.email ?? "")) {
        await setDoc(
          doc(db, "admins", user.uid),
          {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName ?? user.email,
            clubSociety: "TalentBank Admin",
            status: "approved",
            role: "super_admin",
            createdAt: Timestamp.now(),
          },
          { merge: true },
        );
        router.replace("/admin/events");
        return;
      }

      const snap = await getDoc(doc(db, "admins", user.uid));
      if (!snap.exists()) {
        setError("No admin account found. Please register first.");
        await auth.signOut();
        return;
      }

      const data = snap.data();
      if (data.status === "pending") {
        router.replace("/pending");
      } else if (data.status === "approved") {
        router.replace("/admin/events");
      } else {
        setError("Your account has been rejected. Contact the administrator.");
        await auth.signOut();
      }
    } catch (err: any) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">TalentBank</h1>
          <p className="text-gray-500 mt-2">Admin Portal</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-[#111] border border-[#222] rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">Sign In</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Need access?{" "}
            <a href="/register" className="text-indigo-400 hover:text-indigo-300">
              Request admin account
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
