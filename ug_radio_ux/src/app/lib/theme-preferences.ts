export interface ThemeColors {
  /** Primary app background (floating panels/headers). */
  bg: string;
  /** Primary text color. */
  fg: string;
  /** Nav bar pill background. */
  navBg: string;
  /** Accent used for active nav tab, "now playing" state, toggles, primary buttons. */
  accent: string;
}

export const DEFAULT_THEME: ThemeColors = {
  bg: "#000000",
  fg: "#ffffff",
  navBg: "#0a0a0a",
  accent: "#fc3c44",
};

const STORAGE_KEY = "undergroundradio-theme";

export function loadTheme(): ThemeColors {
  if (typeof window === "undefined") return { ...DEFAULT_THEME };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw) as Partial<ThemeColors>;
    return {
      bg: parsed.bg ?? DEFAULT_THEME.bg,
      fg: parsed.fg ?? DEFAULT_THEME.fg,
      navBg: parsed.navBg ?? DEFAULT_THEME.navBg,
      accent: parsed.accent ?? DEFAULT_THEME.accent,
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(theme: ThemeColors) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

/** "#rrggbb" -> "r g b", for use inside rgb(var(--x) / alpha%). */
function hexToRgbChannels(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

/** Sets the CSS custom properties every themed component reads from. */
export function applyTheme(theme: ThemeColors) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--theme-bg", theme.bg);
  root.setProperty("--theme-fg", theme.fg);
  root.setProperty("--theme-nav-bg", theme.navBg);
  root.setProperty("--theme-accent", theme.accent);
  // channel-only variant for rgb(var(--theme-bg-rgb) / alpha%) — Tailwind's
  // bg-[var(--x)]/NN opacity modifier silently no-ops when --x is a hex
  // string, so translucent panels need this instead of --theme-bg directly
  const bgRgb = hexToRgbChannels(theme.bg);
  if (bgRgb) root.setProperty("--theme-bg-rgb", bgRgb);
}
