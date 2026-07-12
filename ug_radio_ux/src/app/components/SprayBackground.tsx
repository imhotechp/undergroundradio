"use client";

import { useEffect, useState } from "react";
import UndergroundRadioSpray, {
  type SprayTheme,
} from "@/app/components/spraypaint-components/UndergroundRadioSpray";
import { loadSprayPreferences } from "@/app/components/spraypaint-components/spray-preferences";

const THEME_STORAGE_KEY = "undergroundradio-spray-theme";

function getStoredTheme(): SprayTheme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" ? saved : "dark";
}

/** Full-viewport spray reveal background for the root layout. */
export function SprayBackground() {
  const prefs = loadSprayPreferences();
  const [theme] = useState<SprayTheme>(getStoredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = theme;
  }, [isDark, theme]);

  return (
    <div
      className="fixed inset-0 z-0"
      aria-hidden
      style={{
        backgroundColor: isDark ? "#000" : "#fff",
      }}
    >
      <UndergroundRadioSpray
        theme={theme}
        autoPlay
        loop={prefs.loop}
        speed={prefs.speed}
        tiltEnabled={prefs.tiltEnabled}
        showCanUi={prefs.showCan}
        particlesEnabled={prefs.particlesEnabled}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
