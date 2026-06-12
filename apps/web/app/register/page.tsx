"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { SUPER_ADMIN_EMAILS } from "@talentbank/firebase-config";

const inputClass = "w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none";
const inputStyle = {
  backgroundColor: "var(--color-bg-cream)",
  border: "1.5px solid var(--color-shadow-grey)",
  color: "var(--color-text-dark)",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "", email: "", password: "", confirmPassword: "", clubSociety: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(form.email.toLowerCase());
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(user, { displayName: form.displayName });
      await setDoc(doc(db, "admins", user.uid), {
        uid: user.uid, email: user.email, displayName: form.displayName,
        clubSociety: form.clubSociety,
        status: isSuperAdminEmail ? "approved" : "pending",
        role: isSuperAdminEmail ? "super_admin" : "admin",
        createdAt: Timestamp.now(),
      });
      router.replace(isSuperAdminEmail ? "/admin/events" : "/pending");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") setError("This email is already registered. Try signing in.");
      else if (code === "auth/invalid-email") setError("Invalid email address.");
      else setError("Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet"
            width={180} height={180} className="rounded-2xl" onError={() => {}} />
          <p className="text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>Request Admin Access</p>
        </div>

        <form onSubmit={handleRegister} className="rounded-3xl p-8 space-y-5"
          style={{ backgroundColor: "#fff", boxShadow: "0 4px 24px rgba(58,51,44,0.08)", border: "1px solid var(--color-shadow-grey)" }}>
          <h2 className="text-lg font-bold" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>
            Create Account
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {[
            { label: "Full Name",        field: "displayName",    type: "text",     placeholder: "Jane Smith" },
            { label: "Email",            field: "email",          type: "email",    placeholder: "admin@example.com" },
            { label: "Club / Society",   field: "clubSociety",    type: "text",     placeholder: "e.g. Chess Club, Drama Society" },
            { label: "Password",         field: "password",       type: "password", placeholder: "Min. 6 characters" },
            { label: "Confirm Password", field: "confirmPassword", type: "password", placeholder: "••••••••" },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-sm font-semibold" style={{ color: "rgba(58,51,44,0.6)" }}>{label}</label>
              <input type={type} value={(form as any)[field]} onChange={set(field)} required
                placeholder={placeholder} className={inputClass} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary-orange)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-shadow-grey)")}
              />
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="w-full font-bold py-2.5 rounded-xl transition-opacity disabled:opacity-50 text-white"
            style={{ backgroundColor: "var(--color-primary-orange)" }}>
            {loading ? "Submitting…" : "Request Access"}
          </button>

          <p className="text-center text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>
            Already have an account?{" "}
            <a href="/" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: "var(--color-primary-blue)" }}>
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
