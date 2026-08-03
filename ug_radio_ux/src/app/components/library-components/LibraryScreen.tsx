"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Track } from "@/app/lib/api";
import { usePlayer, sameTrack } from "@/app/lib/player-context";
import { TrackRow } from "@/app/components/library-components/TrackRow";
import { FloatingPanel } from "@/app/components/library-components/FloatingPanel";
import { ChevronLeftIcon, ShuffleIcon } from "@/app/components/library-components/icons";
import { formatTotalDuration } from "@/app/components/library-components/format";

export function LibraryScreen({
  tracks,
  title = "Your Library",
  backHref,
}: {
  tracks: Track[];
  title?: string;
  backHref?: string;
}) {
  const { currentTrack, isPaused, playQueue, togglePlay } = usePlayer();

  const totalDuration = useMemo(() => formatTotalDuration(tracks), [tracks]);

  function handleSelect(index: number) {
    if (sameTrack(tracks[index], currentTrack)) {
      togglePlay();
    } else {
      playQueue(tracks, index);
    }
  }

  function handleShuffle() {
    if (tracks.length === 0) return;
    playQueue(tracks, Math.floor(Math.random() * tracks.length));
  }

  return (
    <FloatingPanel>
      <header className="shrink-0 border-b border-white/5 bg-[var(--theme-bg)]/25 px-4 pb-3 pt-5 backdrop-blur-md">
        <div className="flex items-center gap-1">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center text-white/70"
            >
              <ChevronLeftIcon />
            </Link>
          )}
          <h1 className="truncate text-3xl font-bold tracking-tight text-[var(--theme-fg)]">{title}</h1>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm text-white/40">
            {tracks.length} {tracks.length === 1 ? "Song" : "Songs"}
            {tracks.length > 0 && ` · ${totalDuration}`}
          </p>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={handleShuffle}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 active:bg-white/20"
            >
              <ShuffleIcon />
              Shuffle
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto text-[var(--theme-fg)]">
        {tracks.length === 0 ? (
          <p className="px-4 pt-6 text-white/50">No songs here yet.</p>
        ) : (
          <ul className="px-4">
            {tracks.map((track, index) => (
              <TrackRow
                key={`${track.song}-${track.artist_name}-${index}`}
                track={track}
                index={index}
                isPlaying={sameTrack(track, currentTrack) && !isPaused}
                onSelect={() => handleSelect(index)}
              />
            ))}
          </ul>
        )}
      </div>
    </FloatingPanel>
  );
}
