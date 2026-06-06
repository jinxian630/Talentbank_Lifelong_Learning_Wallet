"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/admin/events");
  }, []);
  return (
    <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
