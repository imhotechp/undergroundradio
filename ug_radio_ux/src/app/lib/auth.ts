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
