"use client";

import { useEffect } from "react";
import { applyTheme, loadTheme } from "@/app/lib/theme-preferences";

/** Applies the persisted custom theme as CSS variables on mount. Renders nothing. */
export function ThemeInit() {
  useEffect(() => {
    applyTheme(loadTheme());
  }, []);

  return null;
}
