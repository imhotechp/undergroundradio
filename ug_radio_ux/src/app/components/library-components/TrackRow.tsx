"use client";

import type { Track } from "@/app/lib/api";
import { TrackArt } from "@/app/components/library-components/track-art";
import { EqualizerBars } from "@/app/components/library-components/icons";
import { formatDuration } from "@/app/components/library-components/format";

export function TrackRow({
  track,
  index,
  isPlaying,
  onSelect,
}: {
  track: Track;
  index: number;
  isPlaying: boolean;
  onSelect: () => void;
}) {
  const duration = formatDuration(track.duration);

  return (
    <li className="border-b border-white/[0.06] last:border-none">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 py-2.5 text-left active:bg-white/5"
      >
        <div className="relative">
          <TrackArt index={index} size={48} src={track.coverArt} alt={track.song} />
          {isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/55">
              <EqualizerBars />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[15px] font-medium"
            style={{ color: isPlaying ? "var(--theme-accent)" : "var(--theme-fg)" }}
          >
            {track.song}
          </p>
          <p className="truncate text-sm text-white/50">{track.artist_name}</p>
        </div>
        {duration && (
          <span className="shrink-0 text-sm tabular-nums text-white/40">{duration}</span>
        )}
      </button>
    </li>
  );
}
