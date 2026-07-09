'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import UndergroundRadioSpray, {
  type SprayPhase,
  type SprayTheme,
  type UndergroundRadioSprayHandle,
} from "@/app/components/spraypaint-components/UndergroundRadioSpray";
import { clampSpeed, loadSprayPreferences, saveSprayPreferences } from "@/app/components/spraypaint-components/spray-preferences";

const THEME_STORAGE_KEY = "undergroundradio-spray-theme";

function getStoredTheme(): SprayTheme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" ? saved : null;
}


export default function Index() {
  const sprayRef = useRef<UndergroundRadioSprayHandle>(null);
  const initialPrefs = loadSprayPreferences();

  const [theme, setTheme] = useState<SprayTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return getStoredTheme() ?? "dark";
  });
  const [loop, setLoop] = useState(initialPrefs.loop);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(initialPrefs.speed);
  const [tiltEnabled, setTiltEnabled] = useState(initialPrefs.tiltEnabled);
  const [showCan, setShowCan] = useState(initialPrefs.showCan);
  const [particlesEnabled, setParticlesEnabled] = useState(initialPrefs.particlesEnabled);
  const [playKey, setPlayKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<SprayPhase>("idle");

  const isDark = theme === "dark";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = theme;
  }, [isDark, theme]);

  useEffect(() => {
    saveSprayPreferences({
      loop,
      speed,
      tiltEnabled,
      showCan,
      particlesEnabled,
    });
  }, [loop, speed, tiltEnabled, showCan, particlesEnabled]);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const handleReplay = useCallback(() => {
    setPaused(false);
    setPlayKey((k) => k + 1);
  }, []);

  const handleProgress = useCallback((value: number, nextPhase: SprayPhase) => {
    setProgress(value);
    setPhase(nextPhase);
    if (nextPhase === "done") setPaused(false);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleSkipToEnd = useCallback(() => {
    sprayRef.current?.skipToEnd();
    setPaused(false);
  }, []);

  const handleExportPng = useCallback(() => {
    sprayRef.current?.exportPng();
  }, []);

  const handleSpeedChange = useCallback((value: number) => {
    setSpeed(clampSpeed(value));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          handleReplay();
          break;
        case "p":
          if (phase === "shake" || phase === "spray") handlePauseToggle();
          break;
        case "s":
          handleSkipToEnd();
          break;
        case "t":
          handleThemeToggle();
          break;
        case "d":
          handleExportPng();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleReplay, handlePauseToggle, handleSkipToEnd, handleThemeToggle, handleExportPng, phase]);

  return (
    <div
      className={`fixed inset-0 bg-background text-foreground ${isDark ? "dark" : ""}`}
      style={{
        backgroundColor: isDark ? "#000" : "#fff",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <main className="relative h-full min-h-0 w-full">
        <UndergroundRadioSpray
          ref={sprayRef}
          key={playKey}
          theme={theme}
          loop={loop}
          paused={paused}
          speed={speed}
          tiltEnabled={tiltEnabled}
          showCanUi={showCan}
          particlesEnabled={particlesEnabled}
          className="absolute inset-0"
          onProgress={handleProgress}
        />
      </main>
    </div>
  );
}
