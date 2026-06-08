"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@talentbank/firebase-config";
import type { AdminDoc } from "@talentbank/firebase-config";
import { SUPER_ADMIN_EMAILS } from "@talentbank/firebase-config";

interface AdminGuardResult {
  user: User | null;
  adminDoc: AdminDoc | null;
  isSuperAdmin: boolean;
  loading: boolean;
}

export function useAdminGuard(): AdminGuardResult {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [adminDoc, setAdminDoc] = useState<AdminDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/");
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "admins", firebaseUser.uid));
      if (!snap.exists()) {
        router.replace("/");
        setLoading(false);
        return;
      }

      const data = snap.data() as AdminDoc;

      if (data.status === "pending") {
        router.replace("/pending");
        setLoading(false);
        return;
      }

      if (data.status !== "approved") {
        router.replace("/");
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setAdminDoc(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [router]);

  const isSuperAdmin =
    adminDoc?.role === "super_admin" ||
    SUPER_ADMIN_EMAILS.includes(user?.email ?? "");

  return { user, adminDoc, isSuperAdmin, loading };
}
