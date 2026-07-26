export interface NotificationPreferences {
  push: boolean;
  newReleases: boolean;
  playlistUpdates: boolean;
}

const STORAGE_KEY = "undergroundradio-notification-prefs";

const DEFAULTS: NotificationPreferences = {
  push: true,
  newReleases: true,
  playlistUpdates: false,
};

export function loadNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      push: parsed.push ?? DEFAULTS.push,
      newReleases: parsed.newReleases ?? DEFAULTS.newReleases,
      playlistUpdates: parsed.playlistUpdates ?? DEFAULTS.playlistUpdates,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
