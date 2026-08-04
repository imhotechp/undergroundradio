"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/app/lib/api";
import { useAuthedData } from "@/app/lib/useAuthedData";
import { clearTokens } from "@/app/lib/auth";
import { FloatingPanel } from "@/app/components/library-components/FloatingPanel";
import { StatusCard } from "@/app/components/library-components/StatusCard";
import { Toggle } from "@/app/components/library-components/Toggle";
import { gradientForIndex } from "@/app/components/library-components/track-art";
import { ChevronRightIcon } from "@/app/components/library-components/icons";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from "@/app/lib/notification-preferences";
import {
  DEFAULT_THEME,
  applyTheme,
  loadTheme,
  saveTheme,
} from "@/app/lib/theme-preferences";

function SectionLabel({ children }) {
  return (
    <p className="px-4 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-white/35">
      {children}
    </p>
  );
}

function SettingsGroup({ children }) {
  return <div className="mx-4 overflow-hidden rounded-2xl bg-white/5">{children}</div>;
}

function SettingsRow({ label, value, onClick, children }) {
  const interactive = Boolean(onClick);
  const Comp = interactive ? "button" : "div";
  return (
    <Comp
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left last:border-none ${
        interactive ? "active:bg-white/10" : ""
      }`}
    >
      <span className="text-[15px] text-[var(--theme-fg)]">{label}</span>
      {children ?? (
        <span className="flex items-center gap-1 text-sm text-white/40">
          {value}
          {interactive && <ChevronRightIcon />}
        </span>
      )}
    </Comp>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 last:border-none">
      <span className="text-[15px] text-[var(--theme-fg)]">{label}</span>
      <div className="relative h-8 w-8 shrink-0">
        <span
          className="pointer-events-none absolute inset-0 rounded-full border border-white/20"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { status, data: profile, error } = useAuthedData(getMe, []);
  const [prefs, setPrefs] = useState(() => loadNotificationPreferences());
  const [theme, setTheme] = useState(() => loadTheme());

  function updatePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveNotificationPreferences(next);
  }

  function updateThemeField(key, value) {
    const next = { ...theme, [key]: value };
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  function handleResetTheme() {
    setTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
  }

  function handleSignOut() {
    clearTokens();
    router.replace("/login");
  }

  if (status === "loading") return <StatusCard>Loading account...</StatusCard>;
  if (status === "error") return <StatusCard tone="error">{error}</StatusCard>;

  const initial = profile?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <FloatingPanel>
      <header className="shrink-0 border-b border-white/5 bg-[rgb(var(--theme-bg-rgb)/25%)] px-4 pb-3 pt-5 backdrop-blur-md">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--theme-fg)]">Account</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex items-center gap-3 px-4 pt-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{ backgroundImage: gradientForIndex(0) }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[var(--theme-fg)]">
              {profile.username}
            </p>
            <p className="truncate text-sm text-white/40">{profile.email}</p>
          </div>
        </div>

        <SectionLabel>Appearance</SectionLabel>
        <SettingsGroup>
          <ColorField
            label="Background"
            value={theme.bg}
            onChange={(v) => updateThemeField("bg", v)}
          />
          <ColorField label="Font" value={theme.fg} onChange={(v) => updateThemeField("fg", v)} />
          <ColorField
            label="Nav Bar"
            value={theme.navBg}
            onChange={(v) => updateThemeField("navBg", v)}
          />
          <ColorField
            label="Nav Bar Accent"
            value={theme.accent}
            onChange={(v) => updateThemeField("accent", v)}
          />
          <SettingsRow label="Reset to Default" onClick={handleResetTheme} />
        </SettingsGroup>

        <SectionLabel>Subscription</SectionLabel>
        <SettingsGroup>
          <SettingsRow label="Current Plan" value="Free" />
        </SettingsGroup>

        <SectionLabel>Purchase History</SectionLabel>
        <SettingsGroup>
          <div className="px-4 py-6 text-center text-sm text-white/40">No purchases yet</div>
        </SettingsGroup>

        <SectionLabel>Notifications</SectionLabel>
        <SettingsGroup>
          <SettingsRow label="Push Notifications">
            <Toggle
              checked={prefs.push}
              onChange={(v) => updatePref("push", v)}
              label="Push Notifications"
            />
          </SettingsRow>
          <SettingsRow label="New Releases">
            <Toggle
              checked={prefs.newReleases}
              onChange={(v) => updatePref("newReleases", v)}
              label="New Releases"
            />
          </SettingsRow>
          <SettingsRow label="Playlist Updates">
            <Toggle
              checked={prefs.playlistUpdates}
              onChange={(v) => updatePref("playlistUpdates", v)}
              label="Playlist Updates"
            />
          </SettingsRow>
        </SettingsGroup>

        <SectionLabel>Account</SectionLabel>
        <SettingsGroup>
          <SettingsRow label="Username" value={profile.username} />
          <SettingsRow label="Email" value={profile.email} />
          <SettingsRow label="Phone Number" value={profile.phone_number || "Not set"} />
        </SettingsGroup>

        <div className="px-4 pt-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-2xl bg-white/5 py-3 text-center text-[15px] font-medium"
            style={{ color: "var(--theme-accent)" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </FloatingPanel>
  );
}
