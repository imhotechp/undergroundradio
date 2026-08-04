"use client";

import { useEffect } from "react";
import { applyTheme, isDefaultTheme, loadTheme, mergeTheme, saveTheme } from "@/app/lib/theme-preferences";
import { getMe, updateTheme } from "@/app/lib/api";
import { getAccessToken } from "@/app/lib/auth";

/**
 * Fetches the account's saved theme and applies it, or — if the account has
 * no theme saved yet but this browser does (e.g. a pre-existing localStorage
 * value from before server-side sync existed) — claims the local one as the
 * account's theme instead of silently discarding it. No-ops if logged out.
 */
async function syncThemeFromServer() {
  if (!getAccessToken()) return;
  try {
    const profile = await getMe();
    const hasServerTheme = profile.theme && Object.keys(profile.theme).length > 0;
    if (hasServerTheme) {
      const merged = mergeTheme(profile.theme!);
      applyTheme(merged);
      saveTheme(merged);
    } else {
      const local = loadTheme();
      if (!isDefaultTheme(local)) {
        updateTheme(local).catch(() => {});
      }
    }
  } catch {
    // best-effort; the already-applied local theme remains in place
  }
}

/**
 * Applies the persisted theme as CSS variables on mount, then reconciles
 * with the account's saved theme so it follows the user across devices, not
 * just the browser. Also re-syncs on "auth-changed" — this component mounts
 * once for the whole session (root layout), so without that listener a login
 * that happens *after* mount (the common case, since a fresh session usually
 * starts on /login before any token exists) would never trigger a sync.
 */
export function ThemeInit() {
  useEffect(() => {
    // instant local apply first — avoids a flash of the default theme while
    // the network request below is in flight
    applyTheme(loadTheme());
    syncThemeFromServer();

    window.addEventListener("auth-changed", syncThemeFromServer);
    return () => window.removeEventListener("auth-changed", syncThemeFromServer);
  }, []);

  return null;
}
