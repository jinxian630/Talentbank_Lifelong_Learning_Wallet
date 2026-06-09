"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import type { AdminDoc, AdminStatus } from "@talentbank/firebase-config";
import { LogOut, CheckCircle, XCircle, Clock, Users } from "lucide-react";

type FilterTab = "pending" | "approved" | "rejected";

export default function AdminRequestsPage() {
  const { user, isSuperAdmin, loading } = useAdminGuard();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminDoc[]>([]);
  const [tab, setTab] = useState<FilterTab>("pending");

  useEffect(() => {
    if (loading || !user) return;
    if (!isSuperAdmin) {
      router.replace("/admin/events");
      return;
    }
    const unsubscribe = onSnapshot(collection(db, "admins"), (snap) => {
      setAdmins(snap.docs.map((d) => d.data() as AdminDoc));
    });
    return unsubscribe;
  }, [loading, user, isSuperAdmin, router]);

  const updateStatus = async (uid: string, status: AdminStatus) => {
    const data: any = { status };
    if (status === "approved") {
      data.approvedAt = Timestamp.now();
      data.approvedBy = user?.uid;
    }
    await updateDoc(doc(db, "admins", uid), data);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = admins.filter((a) => a.status === tab && a.role !== "super_admin");
  const pendingCount = admins.filter((a) => a.status === "pending" && a.role !== "super_admin").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg">TalentBank</span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/admin/events" className="text-gray-500 hover:text-white transition-colors">
              Events
            </a>
            <a href="/admin/students" className="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5">
              <Users size={14} />
              Attendance
            </a>
            <a href="/admin/requests" className="text-white font-medium flex items-center gap-1.5">
              <Users size={14} />
              Admin Requests
              {pendingCount > 0 && (
                <span className="bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </a>
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Admin Requests</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-[#222] rounded-lg p-1 mb-6 w-fit">
          {(["pending", "approved", "rejected"] as FilterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {t}
              <span className="ml-1.5 text-xs opacity-70">
                ({admins.filter((a) => a.status === t && a.role !== "super_admin").length})
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            No {tab} requests.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((admin) => (
              <div
                key={admin.uid}
                className="bg-[#111] border border-[#222] rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <p className="text-white font-medium">{admin.displayName}</p>
                  <p className="text-gray-500 text-sm">{admin.email}</p>
                  <p className="text-indigo-400 text-xs">{admin.clubSociety}</p>
                </div>

                <div className="flex items-center gap-2">
                  {tab === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(admin.uid, "approved")}
                        className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle size={14} />
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(admin.uid, "rejected")}
                        className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </>
                  )}
                  {tab === "approved" && (
                    <button
                      onClick={() => updateStatus(admin.uid, "rejected")}
                      className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <XCircle size={14} />
                      Revoke
                    </button>
                  )}
                  {tab === "rejected" && (
                    <button
                      onClick={() => updateStatus(admin.uid, "pending")}
                      className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Clock size={14} />
                      Re-review
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
