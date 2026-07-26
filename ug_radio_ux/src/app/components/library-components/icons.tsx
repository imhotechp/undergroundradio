"use client";

import { motion } from "framer-motion";

export function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4.5v15l14-7.5-14-7.5z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z" />
    </svg>
  );
}

export function ShuffleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h3.5c2 0 3.3 1 4.5 2.7M3 18h3.5c2 0 3.3-1 4.5-2.7M15 6h6M15 18h6M18 3l3 3-3 3M18 15l3 3-3 3" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function EqualizerBars() {
  return (
    <div className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: "var(--theme-accent)" }}
          initial={{ height: 4 }}
          animate={{ height: [4, 14, 6, 12, 4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
