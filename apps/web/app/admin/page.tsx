"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/admin/events");
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-cream)" }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary-orange)", borderTopColor: "transparent" }} />
    </div>
  );
}
