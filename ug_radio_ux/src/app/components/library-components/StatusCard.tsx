"use client";

import type { ReactNode } from "react";

/** Loading/error state that fills the same footprint as FloatingPanel. */
export function StatusCard({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={`fixed inset-x-3 z-0 flex items-center justify-center rounded-3xl border border-white/10 bg-[var(--theme-bg)]/20 px-4 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] backdrop-blur-sm ${
        tone === "error" ? "text-red-400" : "text-white/50"
      }`}
      style={{
        top: "calc(env(safe-area-inset-top) + 0.75rem)",
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}
