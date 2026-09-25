"use client";

import { useEffect } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="animate-dialog-pop relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[24px] border border-zinc-200/80 bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 break-words text-sm leading-relaxed text-zinc-500">
          {message}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onCancel}
            autoFocus
            disabled={busy}
            className="h-12 flex-1 rounded-2xl border border-zinc-200 text-sm font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`h-12 flex-1 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-zinc-950 hover:bg-zinc-800"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
