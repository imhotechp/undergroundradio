"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackArt } from "@/app/components/library-components/track-art";
import { PauseIcon, PlayIcon } from "@/app/components/library-components/icons";
import { formatSeconds } from "@/app/components/library-components/format";
import { usePlayer } from "@/app/lib/player-context";

function hashIndex(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function NowPlayingBar() {
  const { currentTrack, isPaused, currentTime, duration, togglePlay, seek } = usePlayer();
  // while actively dragging, show the dragged position instead of currentTime —
  // currentTime only updates on the audio's next "timeupdate" tick, which lags
  // behind the pointer and makes the thumb jump/fight the drag otherwise
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const displayTime = scrubTime ?? Math.min(currentTime, duration || 0);
  const progress = duration > 0 ? Math.min(displayTime / duration, 1) : 0;

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
            {duration > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-white/40">
                {formatSeconds(displayTime)} / {formatSeconds(duration)}
              </span>
            )}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPaused ? "Play" : "Pause"}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--theme-fg)]"
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
          <div className="relative flex h-4 w-full items-center">
            <div className="pointer-events-none absolute inset-x-0 h-0.5 w-full bg-white/10">
              <div
                className="h-full bg-[var(--theme-accent)] transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={duration || 0}
              step={0.1}
              value={displayTime}
              disabled={!duration}
              onChange={(e) => {
                const value = Number(e.target.value);
                setScrubTime(value);
                seek(value);
              }}
              onPointerUp={() => setScrubTime(null)}
              onKeyUp={() => setScrubTime(null)}
              className="absolute inset-0 h-full w-full cursor-pointer touch-none opacity-0 disabled:cursor-default"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
