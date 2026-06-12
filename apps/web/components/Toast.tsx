"use client";
import { useEffect } from "react";
import { CheckCircle, Trash2, X } from "lucide-react";

export type ToastType = "success" | "delete";

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ type, message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const isDelete  = type === "delete";
  const iconColor = isDelete ? "text-red-400"     : "text-emerald-400";
  const bgBorder  = isDelete ? "border-red-400/20" : "border-emerald-400/20";
  const iconBg    = isDelete ? "bg-red-400/10"     : "bg-emerald-400/10";
  const Icon      = isDelete ? Trash2 : CheckCircle;

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 bg-[#1A1825] border ${bgBorder} rounded-2xl px-4 py-3.5 shadow-2xl shadow-black/40 animate-slide-in min-w-[280px] max-w-xs`}
      role="status"
      aria-live="polite"
    >
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={iconColor} />
      </div>
      <p className="flex-1 text-sm text-white font-medium leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        title="Dismiss"
        className="text-white/30 hover:text-white transition shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
