"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      // Listen for status changes — auto-redirect when approved
      unsubscribeDoc = onSnapshot(doc(db, "admins", user.uid), (snap) => {
        if (!snap.exists()) return;
        const { status } = snap.data();
        if (status === "approved") router.replace("/admin/events");
        if (status === "rejected") handleSignOut();
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc?.();
    };
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-[#111] border border-[#222] rounded-2xl p-10 space-y-6">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Awaiting Approval</h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Your admin account request has been submitted. A super-admin will
              review and approve your access shortly.
            </p>
          </div>

          <div className="bg-[#1a1a1a] rounded-lg px-4 py-3 text-sm text-gray-400 text-left">
            This page will automatically redirect you once your account is approved.
          </div>

          <button
            onClick={handleSignOut}
            className="w-full border border-[#333] hover:border-[#555] text-gray-400 hover:text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
