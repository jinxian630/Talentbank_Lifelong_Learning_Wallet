"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { SUPER_ADMIN_EMAILS } from "@talentbank/firebase-config";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    clubSociety: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(form.email.toLowerCase());
      const { user } = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );
      await updateProfile(user, { displayName: form.displayName });
      await setDoc(doc(db, "admins", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: form.displayName,
        clubSociety: form.clubSociety,
        status: isSuperAdminEmail ? "approved" : "pending",
        role: isSuperAdminEmail ? "super_admin" : "admin",
        createdAt: Timestamp.now(),
      });
      router.replace(isSuperAdminEmail ? "/admin/events" : "/pending");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else {
        setError("Registration failed. Please try again.");
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
          <p className="text-gray-500 mt-2">Request Admin Access</p>
        </div>

        <form
          onSubmit={handleRegister}
          className="bg-[#111] border border-[#222] rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">Create Account</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Full Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={set("displayName")}
              required
              placeholder="Jane Smith"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              placeholder="admin@example.com"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Club / Society</label>
            <input
              type="text"
              value={form.clubSociety}
              onChange={set("clubSociety")}
              required
              placeholder="e.g. Chess Club, Drama Society"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              placeholder="Min. 6 characters"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
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
            {loading ? "Submitting…" : "Request Access"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
