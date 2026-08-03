"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TrackArt } from "@/app/components/library-components/track-art";
import { PauseIcon, PlayIcon } from "@/app/components/library-components/icons";
import { usePlayer } from "@/app/lib/player-context";

function hashIndex(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function NowPlayingBar() {
  const { currentTrack, isPaused, currentTime, duration, togglePlay } = usePlayer();
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed inset-x-2 z-40 overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-xl"
          style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <TrackArt
              index={hashIndex(currentTrack.song + currentTrack.artist_name)}
              size={40}
              src={currentTrack.coverArt}
              alt={currentTrack.song}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--theme-fg)]">{currentTrack.song}</p>
              <p className="truncate text-xs text-white/50">{currentTrack.artist_name}</p>
            </div>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPaused ? "Play" : "Pause"}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--theme-fg)]"
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
          <div className="h-0.5 w-full bg-white/10">
            <div
              className="h-full bg-[var(--theme-accent)] transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
