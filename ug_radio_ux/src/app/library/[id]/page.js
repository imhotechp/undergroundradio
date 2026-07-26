"use client";

import { useParams } from "next/navigation";
import { getPlaylist } from "@/app/lib/api";
import { useAuthedData } from "@/app/lib/useAuthedData";
import { LibraryScreen } from "@/app/components/library-components/LibraryScreen";
import { StatusCard } from "@/app/components/library-components/StatusCard";

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const { status, data: playlist, error } = useAuthedData(() => getPlaylist(id), [id]);

  if (status === "loading") return <StatusCard>Loading playlist...</StatusCard>;
  if (status === "error") return <StatusCard tone="error">{error}</StatusCard>;

  return (
    <LibraryScreen
      tracks={playlist?.songs ?? []}
      title={playlist?.name ?? "Playlist"}
      backHref="/library"
    />
  );
}
