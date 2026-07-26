"use client";

import { getPlaylists } from "@/app/lib/api";
import { useAuthedData } from "@/app/lib/useAuthedData";
import { FloatingPanel } from "@/app/components/library-components/FloatingPanel";
import { StatusCard } from "@/app/components/library-components/StatusCard";
import { PlaylistGrid } from "@/app/components/library-components/PlaylistGrid";

export default function LibraryPage() {
  const { status, data: playlists, error } = useAuthedData(getPlaylists, []);

  if (status === "loading") return <StatusCard>Loading your playlists...</StatusCard>;
  if (status === "error") return <StatusCard tone="error">{error}</StatusCard>;

  const count = playlists?.length ?? 0;

  return (
    <FloatingPanel>
      <header className="shrink-0 border-b border-white/5 bg-black/25 px-4 pb-3 pt-5 backdrop-blur-md">
        <h1 className="text-3xl font-bold tracking-tight text-white">Playlists</h1>
        <p className="mt-1 text-sm text-white/40">
          {count} {count === 1 ? "Playlist" : "Playlists"}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto">
        <PlaylistGrid playlists={playlists ?? []} />
      </div>
    </FloatingPanel>
  );
}
