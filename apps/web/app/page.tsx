"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-bg-cream)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <Image
            src="/assets/logo/xp_carreer_logo-removebg-preview.png"
            alt="XP Career Wallet"
            width={180}
            height={180}
            className="rounded-2xl"
            onError={() => {}}
          />
          <h1
            className="text-2xl font-extrabold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-orange)" }}
          >
            XP Career Wallet
          </h1>
          <p className="text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>
            Admin Portal
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-3xl p-8 space-y-5"
          style={{
            backgroundColor: "#fff",
            boxShadow: "0 4px 24px rgba(58,51,44,0.08)",
            border: "1px solid var(--color-shadow-grey)",
          }}
        >
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}
          >
            Sign In
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="text-sm font-semibold"
              style={{ color: "rgba(58,51,44,0.6)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                backgroundColor: "var(--color-bg-cream)",
                border: "1.5px solid var(--color-shadow-grey)",
                color: "var(--color-text-dark)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary-orange)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-shadow-grey)")}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="text-sm font-semibold"
              style={{ color: "rgba(58,51,44,0.6)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                backgroundColor: "var(--color-bg-cream)",
                border: "1.5px solid var(--color-shadow-grey)",
                color: "var(--color-text-dark)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary-orange)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-shadow-grey)")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-2.5 rounded-xl transition-opacity disabled:opacity-50 text-white"
            style={{ backgroundColor: "var(--color-primary-orange)" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className="text-center text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>
            Need access?{" "}
            <a
              href="/register"
              className="font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "var(--color-primary-blue)" }}
            >
              Request admin account
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
