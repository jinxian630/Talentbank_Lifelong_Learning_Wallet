"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import type { AdminDoc, AdminStatus } from "@talentbank/firebase-config";
import { LogOut, CheckCircle, XCircle, Clock, Users } from "lucide-react";
import Image from "next/image";

type FilterTab = "pending" | "approved" | "rejected";

export default function AdminRequestsPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminDoc[]>([]);
  const [tab, setTab] = useState<FilterTab>("pending");

  useEffect(() => {
    if (loading || !user) return;
    if (!isSuperAdmin) { router.replace("/admin/events"); return; }
    const unsubscribe = onSnapshot(collection(db, "admins"), (snap) => {
      setAdmins(snap.docs.map((d) => d.data() as AdminDoc));
    });
    return unsubscribe;
  }, [loading, user, isSuperAdmin, router]);

  const updateStatus = async (uid: string, status: AdminStatus) => {
    const data: any = { status };
    if (status === "approved") { data.approvedAt = Timestamp.now(); data.approvedBy = user?.uid; }
    await updateDoc(doc(db, "admins", uid), data);
  };

  const handleSignOut = async () => { await signOut(auth); router.replace("/"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
    </div>
  );

  const filtered = admins.filter((a) => a.status === tab && a.role !== "super_admin");
  const pendingCount = admins.filter((a) => a.status === "pending" && a.role !== "super_admin").length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <header className="px-6 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-shadow-grey)", backgroundColor: "rgba(247,244,238,0.92)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Image src="/assets/logo/xp_carreer_logo-removebg-preview.png" alt="XP Career Wallet" width={80} height={80} className="rounded-xl -my-2" onError={() => {}} />
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/admin/events" className="font-semibold transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>Events</a>
            <a href="/admin/students" className="font-semibold transition-opacity hover:opacity-60 flex items-center gap-1.5" style={{ color: "rgba(58,51,44,0.5)" }}>
              <Users size={14} /> Attendance
            </a>
            <a href="/admin/requests" className="font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-dark)" }}>
              <Users size={14} /> Admin Requests
              {pendingCount > 0 && (
                <span className="text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-primary-orange)" }}>{pendingCount}</span>
              )}
            </a>
          </nav>
        </div>
        <button onClick={handleSignOut} className="flex items-center gap-2 text-sm transition-opacity hover:opacity-60" style={{ color: "rgba(58,51,44,0.5)" }}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-extrabold mb-6" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>Admin Requests</h1>

        <div className="flex gap-1 rounded-xl p-1 mb-6 w-fit" style={{ backgroundColor: "var(--color-shadow-grey)" }}>
          {(["pending", "approved", "rejected"] as FilterTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition"
              style={tab === t
                ? { backgroundColor: "var(--color-primary-orange)", color: "#fff" }
                : { color: "rgba(58,51,44,0.5)" }}>
              {t} <span className="ml-1 text-xs opacity-70">({admins.filter((a) => a.status === t && a.role !== "super_admin").length})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "rgba(58,51,44,0.4)" }}>No {tab} requests.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((admin) => (
              <div key={admin.uid} className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between"
                style={{ border: "1px solid var(--color-shadow-grey)" }}>
                <div className="space-y-0.5">
                  <p className="font-semibold" style={{ color: "var(--color-text-dark)" }}>{admin.displayName}</p>
                  <p className="text-sm" style={{ color: "rgba(58,51,44,0.5)" }}>{admin.email}</p>
                  <p className="text-xs" style={{ color: "var(--color-primary-blue)" }}>{admin.clubSociety}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tab === "pending" && (<>
                    <button onClick={() => updateStatus(admin.uid, "approved")}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition font-semibold bg-[#8FBF8C]/15 text-[#4a8a47] hover:bg-[#8FBF8C]/25">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => updateStatus(admin.uid, "rejected")}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition font-semibold bg-red-50 text-red-500 hover:bg-red-100">
                      <XCircle size={14} /> Reject
                    </button>
                  </>)}
                  {tab === "approved" && (
                    <button onClick={() => updateStatus(admin.uid, "rejected")}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition font-semibold bg-red-50 text-red-500 hover:bg-red-100">
                      <XCircle size={14} /> Revoke
                    </button>
                  )}
                  {tab === "rejected" && (
                    <button onClick={() => updateStatus(admin.uid, "pending")}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl transition font-semibold bg-[#E8923C]/10 text-[#E8923C] hover:bg-[#E8923C]/20">
                      <Clock size={14} /> Re-review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
