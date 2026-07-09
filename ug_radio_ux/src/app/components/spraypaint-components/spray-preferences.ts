export type SprayTheme = "dark" | "light";

export interface SprayPreferences {
  loop: boolean;
  speed: number;
  tiltEnabled: boolean;
  showCan: boolean;
  particlesEnabled: boolean;
}

const STORAGE_KEY = "undergroundradio-spray-prefs";

const DEFAULTS: SprayPreferences = {
  loop: false,
  speed: 1,
  tiltEnabled: true,
  showCan: true,
  particlesEnabled: true,
};

export function loadSprayPreferences(): SprayPreferences {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SprayPreferences>;
    return {
      loop: Boolean(parsed.loop),
      speed: clampSpeed(parsed.speed ?? DEFAULTS.speed),
      tiltEnabled: parsed.tiltEnabled ?? DEFAULTS.tiltEnabled,
      showCan: parsed.showCan ?? DEFAULTS.showCan,
      particlesEnabled: parsed.particlesEnabled ?? DEFAULTS.particlesEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSprayPreferences(prefs: SprayPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clampSpeed(value: number) {
  return Math.min(2, Math.max(0.5, Math.round(value * 10) / 10));
}

export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
