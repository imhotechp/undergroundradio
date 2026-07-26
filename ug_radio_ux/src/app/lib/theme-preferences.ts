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

/** Sets the CSS custom properties every themed component reads from. */
export function applyTheme(theme: ThemeColors) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--theme-bg", theme.bg);
  root.setProperty("--theme-fg", theme.fg);
  root.setProperty("--theme-nav-bg", theme.navBg);
  root.setProperty("--theme-accent", theme.accent);
}
