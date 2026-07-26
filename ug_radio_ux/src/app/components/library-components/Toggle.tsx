"use client";

import { motion } from "framer-motion";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[27px] w-[47px] shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: checked ? "var(--theme-accent)" : "rgba(255,255,255,0.15)" }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 35 }}
        className="absolute top-[2px] h-[23px] w-[23px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}
