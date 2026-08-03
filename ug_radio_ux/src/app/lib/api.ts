import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setTokens } from "@/app/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export interface Track {
  song: string;
  artist_name: string;
  coverArt?: string;
  producer?: string;
  lyrics?: string;
  duration?: string | null;
  plays?: number | null;
  nft_status?: boolean | null;
}

export interface Playlist {
  id: number;
  name: string;
  coverArt?: string;
  song_count: number;
}

export interface PlaylistDetail {
  id: number;
  name: string;
  songs: Track[];
}

export interface Profile {
  username: string;
  email: string;
  phone_number: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Access tokens live 5 minutes; refresh tokens live 1 day. This dedupes
// concurrent 401s into a single refresh call instead of firing one per
// in-flight request.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) throw new Error("No refresh token");
      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) throw new Error("Refresh failed");
      const body = await response.json();
      setAccessToken(body.access);
      return body.access as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const doFetch = (accessToken: string | null) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  };

  let response = await doFetch(getAccessToken());

  if (response.status === 401) {
    try {
      const newAccessToken = await refreshAccessToken();
      response = await doFetch(newAccessToken);
    } catch {
      clearTokens();
      throw new ApiError(401, "Session expired. Please log in again.");
    }
  }

  if (response.status === 401) {
    clearTokens();
    throw new ApiError(401, "Session expired. Please log in again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error ?? "Something went wrong.");
  }
  return response.json();
}

export async function login(username: string, password: string, token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${API_BASE_URL}/login/${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "Login failed.");
  }
  setTokens(body.access, body.refresh);
  return body;
}

export async function signup(
  username: string,
  password: string,
  email: string,
  phoneNumber: string,
  token?: string,
) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${API_BASE_URL}/musicv2/${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      email,
      phone_number: phoneNumber,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.error ?? "Signup failed.");
  }
  setTokens(body.access, body.refresh);
  return body;
}

export async function getLibrary(): Promise<Track[]> {
  return apiFetch("/ground/");
}

export async function getPlaylists(): Promise<Playlist[]> {
  return apiFetch("/playlists/");
}

export async function getPlaylist(id: string): Promise<PlaylistDetail> {
  return apiFetch(`/playlists/${id}/`);
}

export async function getMe(): Promise<Profile> {
  return apiFetch("/me/");
}
