"use client";

import type { ReactNode } from "react";
import { usePlayer } from "@/app/lib/player-context";

/** Shared floating glass card shell used by the library/playlist screens. */
export function FloatingPanel({ children }: { children: ReactNode }) {
  const { currentTrack } = usePlayer();
  // NowPlayingBar floats from 6rem to ~9.75rem off the bottom while a track is
  // loaded, and it renders above this panel (z-40 vs z-0) — so when it's up,
  // pull the panel's bottom edge above it too, or its last item (e.g. the
  // account page's Sign Out button) ends up hidden underneath the capsule.
  const bottomRem = currentTrack ? 9.75 : 5.5;

  return (
    <div
      className="fixed inset-x-3 z-0 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/20%)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] backdrop-blur-sm transition-[bottom]"
      style={{
        top: "calc(env(safe-area-inset-top) + 0.75rem)",
        bottom: `calc(${bottomRem}rem + env(safe-area-inset-bottom))`,
      }}
    >
      {children}
    </div>
  );
}
