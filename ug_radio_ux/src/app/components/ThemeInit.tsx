"use client";

import { useEffect } from "react";
import { applyTheme, isDefaultTheme, loadTheme, mergeTheme, saveTheme } from "@/app/lib/theme-preferences";
import { getMe, updateTheme } from "@/app/lib/api";
import { getAccessToken } from "@/app/lib/auth";

/**
 * Applies the persisted theme as CSS variables on mount, then reconciles
 * with the account's saved theme (if logged in) so it follows the user
 * across devices, not just the browser.
 */
export function ThemeInit() {
  useEffect(() => {
    // instant local apply first — avoids a flash of the default theme while
    // the network request below is in flight
    const local = loadTheme();
    applyTheme(local);

    if (!getAccessToken()) return;

    getMe()
      .then((profile) => {
        const hasServerTheme = profile.theme && Object.keys(profile.theme).length > 0;
        if (hasServerTheme) {
          const merged = mergeTheme(profile.theme!);
          applyTheme(merged);
          saveTheme(merged);
        } else if (!isDefaultTheme(local)) {
          // account has no theme saved yet, but this browser has a custom
          // one from before server-side sync existed — claim it as the
          // account's theme instead of silently discarding it
          updateTheme(local).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
