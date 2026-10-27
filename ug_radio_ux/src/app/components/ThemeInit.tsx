"use client";

import { useEffect } from "react";
import { applyTheme, DEFAULT_THEME, loadTheme, mergeTheme, saveTheme } from "@/app/lib/theme-preferences";
import { getMe } from "@/app/lib/api";
import { getAccessToken, onAuthChange } from "@/app/lib/auth";

/**
 * Fetches the account's saved theme and applies it. If logged out, resets to
 * default instead — localStorage is a single browser-wide slot, not scoped
 * per account, so leaving a previous account's colors cached would leak them
 * into whichever account logs in next.
 */
async function syncThemeFromServer() {
  if (!getAccessToken()) {
    applyTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
    return;
  }
  try {
    const profile = await getMe();
    const hasServerTheme = profile.theme && Object.keys(profile.theme).length > 0;
    const theme = hasServerTheme ? mergeTheme(profile.theme!) : DEFAULT_THEME;
    applyTheme(theme);
    saveTheme(theme);
  } catch {
    // best-effort; whatever's currently applied (the local cache from the
    // last successful sync) remains in place
  }
}

/**
 * Applies the persisted theme as CSS variables on mount, then reconciles
 * with the account's saved theme so it follows the user across devices, not
 * just the browser. Also re-syncs on any auth change (via onAuthChange,
 * covering both this tab and every other open tab) — this component mounts
 * once for the whole session (root layout), so without that a login or
 * logout that happens *after* mount (the common case, since a fresh session
 * usually starts on /login before any token exists, and a logout in one tab
 * must still reset theme in every other open tab) would never trigger a sync.
 */
export function ThemeInit() {
  useEffect(() => {
    // instant local apply first — avoids a flash of the default theme while
    // the network request below is in flight
    applyTheme(loadTheme());
    syncThemeFromServer();

    return onAuthChange(syncThemeFromServer);
  }, []);

  return null;
}
