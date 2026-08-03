"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/app/lib/api";
import { TrackArt } from "@/app/components/library-components/track-art";
import { PauseIcon, PlayIcon } from "@/app/components/library-components/icons";

export function NowPlayingBar({
  track,
  index,
  isPaused,
  onTogglePlay,
}: {
  track: Track | null;
  index: number;
  isPaused: boolean;
  onTogglePlay: () => void;
}) {
  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed inset-x-2 z-40 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-xl"
          style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        >
          <TrackArt index={index} size={40} src={track.coverArt} alt={track.song} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--theme-fg)]">{track.song}</p>
            <p className="truncate text-xs text-white/50">{track.artist_name}</p>
          </div>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPaused ? "Play" : "Pause"}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--theme-fg)]"
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
