import { clearTokens, getAccessToken, setTokens } from "@/app/lib/auth";

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

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

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
