"use client";

import { getLibrary } from "@/app/lib/api";
import { useAuthedData } from "@/app/lib/useAuthedData";
import { LibraryScreen } from "@/app/components/library-components/LibraryScreen";
import { StatusCard } from "@/app/components/library-components/StatusCard";

export default function HomePage() {
  const { status, data: tracks, error } = useAuthedData(getLibrary, []);

  if (status === "loading") return <StatusCard>Loading your library...</StatusCard>;
  if (status === "error") return <StatusCard tone="error">{error}</StatusCard>;

  return <LibraryScreen tracks={tracks ?? []} />;
}
