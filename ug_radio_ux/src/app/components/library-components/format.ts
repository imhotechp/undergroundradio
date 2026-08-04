function parseDurationSeconds(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** DRF DurationField serializes as "HH:MM:SS" — render as the shorter "M:SS". */
export function formatDuration(duration?: string | null): string | null {
  if (!duration) return null;
  const totalSeconds = parseDurationSeconds(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Raw seconds (from <audio>'s currentTime/duration) -> "M:SS". */
export function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatTotalDuration(tracks: { duration?: string | null }[]): string {
  const totalSeconds = tracks.reduce(
    (sum, t) => sum + (t.duration ? parseDurationSeconds(t.duration) : 0),
    0,
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hr ${minutes} min`;
}
