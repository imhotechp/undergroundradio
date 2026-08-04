"use client";

import type { ReactNode } from "react";

/** Shared floating glass card shell used by the library/playlist screens. */
export function FloatingPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-3 z-0 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/20%)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] backdrop-blur-sm"
      style={{
        top: "calc(env(safe-area-inset-top) + 0.75rem)",
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}
