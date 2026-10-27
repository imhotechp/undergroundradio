const ACCESS_TOKEN_KEY = "undergroundradio-access-token";
const REFRESH_TOKEN_KEY = "undergroundradio-refresh-token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  // lets anything that only checked auth state once on mount (e.g. ThemeInit,
  // which mounts once for the whole session in the root layout) react to a
  // fresh login/signup instead of missing it entirely
  window.dispatchEvent(new Event("auth-changed"));
}

export function setAccessToken(access: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  // lets ThemeInit (and anything else watching auth state) reset
  // account-specific state on logout instead of leaking it into whichever
  // account logs in next on this browser
  window.dispatchEvent(new Event("auth-changed"));
}

// Fires `cb` whenever the access token changes, in THIS tab or any other
// open tab of the same origin — one place for every consumer (player
// playback, theme sync, …) to react to login/logout instead of each one
// separately learning about both signals it takes to cover every tab:
//   - "auth-changed": a same-window custom event setTokens/clearTokens
//     dispatch above, for the tab that actually made the change.
//   - the native "storage" event: fires automatically in every OTHER open
//     tab when localStorage changes, but never in the tab that made the
//     change — without it, logging out in one tab would leave every other
//     tab (including one already sitting on /login) unaware.
// Returns an unsubscribe function for effect cleanup.
export function onAuthChange(cb: () => void): () => void {
  function onAuthChanged() {
    cb();
  }
  function onStorage(e: StorageEvent) {
    if (e.key !== null && e.key !== ACCESS_TOKEN_KEY) return;
    if (e.newValue) return; // key still has a value — token wasn't cleared
    cb();
  }
  window.addEventListener("auth-changed", onAuthChanged);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("auth-changed", onAuthChanged);
    window.removeEventListener("storage", onStorage);
  };
}
