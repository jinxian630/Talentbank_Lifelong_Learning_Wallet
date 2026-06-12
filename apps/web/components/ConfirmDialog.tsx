"use client";
import { Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  title:       string;
  message:     string;
  confirmLabel?: string;
  onConfirm:   () => void;
  onCancel:    () => void;
  loading?:    boolean;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Delete", onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-[#1A1825] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl shadow-black/60 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-400/10 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 id="confirm-title" className="font-bold text-white text-base leading-tight">{title}</h3>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 bg-white/5 hover:bg-white/10 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</>
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
