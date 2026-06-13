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

  const isDelete = type === "delete";
  const Icon     = isDelete ? Trash2 : CheckCircle;
  const iconColor = isDelete ? "#f87171" : "#4a8a47";
  const iconBg    = isDelete ? "rgba(248,113,113,0.1)" : "rgba(143,191,140,0.15)";
  const borderColor = isDelete ? "rgba(248,113,113,0.2)" : "rgba(143,191,140,0.3)";

  return (
    <div
      className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-xl animate-slide-in min-w-[280px] max-w-xs"
      style={{ backgroundColor: "#fff", border: `1px solid ${borderColor}` }}
      role="status"
      aria-live="polite"
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <p className="flex-1 text-sm font-medium leading-snug" style={{ color: "var(--color-text-dark)" }}>{message}</p>
      <button type="button" onClick={onClose} title="Dismiss"
        className="transition-opacity hover:opacity-60 shrink-0"
        style={{ color: "rgba(58,51,44,0.4)" }}>
        <X size={14} />
      </button>
    </div>
  );
}
