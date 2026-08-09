"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getLibrary } from "@/app/lib/api";
import { useAuthedData } from "@/app/lib/useAuthedData";
import { LibraryScreen } from "@/app/components/library-components/LibraryScreen";
import { StatusCard } from "@/app/components/library-components/StatusCard";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 6; // ~9s — long enough for mp3juug's callback to land

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justJoined = searchParams.get("justJoined") === "1";

  const { status, data: tracks, error } = useAuthedData(getLibrary, []);
  const [polledTracks, setPolledTracks] = useState(null);
  const [polling, setPolling] = useState(false);

  // Coming from a fresh /musicv2 signup or login: the song that link
  // referenced is attached by a separate, async mp3juug.com → /api/add/
  // callback that may not have landed by the time the fetch above ran.
  // Poll briefly instead of leaving the user staring at an empty library
  // until they happen to navigate away and back.
  useEffect(() => {
    if (!justJoined || status !== "ready") return;
    if ((tracks?.length ?? 0) > 0) {
      router.replace("/home");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    setPolling(true);

    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const result = await getLibrary();
        if (cancelled) return;
        if (result.length > 0 || attempts >= MAX_POLL_ATTEMPTS) {
          setPolledTracks(result);
          setPolling(false);
          clearInterval(interval);
          router.replace("/home");
        }
      } catch (err) {
        if (cancelled) return;
        setPolling(false);
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justJoined, status]);

  if (status === "loading") return <StatusCard>Loading your library...</StatusCard>;
  if (status === "error") return <StatusCard tone="error">{error}</StatusCard>;
  if (polling) return <StatusCard>Adding your song to your library...</StatusCard>;

  return <LibraryScreen tracks={polledTracks ?? tracks ?? []} />;
}
