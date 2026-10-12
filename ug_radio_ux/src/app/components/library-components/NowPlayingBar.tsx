"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackArt } from "@/app/components/library-components/track-art";
import {
  ChevronDownIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  SkipNextIcon,
  SkipPreviousIcon,
} from "@/app/components/library-components/icons";
import { formatSeconds } from "@/app/components/library-components/format";
import { usePlayer } from "@/app/lib/player-context";

function hashIndex(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// Standard Fullscreen API works for desktop/Android Chrome, but iOS Safari
// never implemented requestFullscreen() on arbitrary elements — the only
// way to get real fullscreen video there is webkitEnterFullscreen(), which
// hands off to the OS's native video player chrome entirely (our own
// controls don't run while it's active; that's expected, not a bug).
function enterVideoFullscreen(video: HTMLVideoElement) {
  const withWebkit = video as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitRequestFullscreen?: () => void;
  };
  if (video.requestFullscreen) {
    video.requestFullscreen().catch(() => {});
  } else if (withWebkit.webkitEnterFullscreen) {
    withWebkit.webkitEnterFullscreen();
  } else if (withWebkit.webkitRequestFullscreen) {
    withWebkit.webkitRequestFullscreen();
  }
}

export function NowPlayingBar() {
  const {
    currentTrack, isPaused, currentTime, duration,
    togglePlay, seek, playNext, playPrevious, setVideoContainer, videoRef,
  } = usePlayer();
  // while actively dragging, show the dragged position instead of currentTime —
  // currentTime only updates on the audio's next "timeupdate" tick, which lags
  // behind the pointer and makes the thumb jump/fight the drag otherwise
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const displayTime = scrubTime ?? Math.min(currentTime, duration || 0);
  const progress = duration > 0 ? Math.min(displayTime / duration, 1) : 0;

  // avoid the sheet reappearing on its own the next time a track starts —
  // once the track that was expanded goes away (e.g. logout), drop the flag
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!currentTrack) setExpanded(false);
  }, [currentTrack]);

  return (
    <>
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
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpanded(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setExpanded(true);
              }}
              aria-label="Open now playing"
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
            >
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
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={isPaused ? "Play" : "Pause"}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--theme-fg)]"
              >
                {isPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
            </div>
            <div
              className="relative flex h-4 w-full items-center"
              onClick={(e) => e.stopPropagation()}
            >
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

      <AnimatePresence>
        {expanded && currentTrack && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed inset-0 z-[60] flex flex-col bg-[rgb(var(--theme-bg-rgb))] text-[var(--theme-fg)]"
            style={{
              paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
            }}
          >
            <div className="relative flex shrink-0 items-center justify-center px-4 pb-2">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Collapse now playing"
                className="absolute left-4 flex h-9 w-9 items-center justify-center text-[var(--theme-fg)]/70"
              >
                <ChevronDownIcon />
              </button>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Now Playing</p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
              {currentTrack.media_type === "video" ? (
                // The actual <video> element lives in player-context and is
                // portaled into the inner div — ref callback claims it;
                // React calls it with null on unmount (sheet closes, or the
                // track changes to non-video), which releases it back to its
                // default hidden slot where it keeps playing audio-only in
                // the background. The fullscreen button is a sibling, not a
                // child of the portal target, so it isn't wiped out by
                // whatever gets portaled in.
                // -mx-8 cancels the parent's px-8 for this element only, so
                // it runs edge-to-edge instead of being boxed in with the
                // title/scrubber/controls below it — a real size increase on
                // phone-width screens, where max-w-sm was never actually the
                // binding constraint (the padding was).
                <div className="relative -mx-8 aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
                  <div ref={setVideoContainer} className="h-full w-full" />
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) enterVideoFullscreen(videoRef.current);
                    }}
                    aria-label="Fullscreen"
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <FullscreenIcon size={18} />
                  </button>
                </div>
              ) : (
                <TrackArt
                  index={hashIndex(currentTrack.song + currentTrack.artist_name)}
                  size={320}
                  src={currentTrack.coverArt}
                  alt={currentTrack.song}
                  className="max-w-full rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
                />
              )}

              <div className="w-full max-w-sm min-w-0 text-center">
                <p className="truncate text-2xl font-bold text-[var(--theme-fg)]">{currentTrack.song}</p>
                <p className="truncate text-base text-white/50">{currentTrack.artist_name}</p>
              </div>

              <div className="w-full max-w-sm">
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
                <div className="flex items-center justify-between text-xs tabular-nums text-white/40">
                  <span>{formatSeconds(displayTime)}</span>
                  <span>{formatSeconds(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-10">
                <button
                  type="button"
                  onClick={playPrevious}
                  aria-label="Previous track"
                  className="flex h-11 w-11 items-center justify-center text-[var(--theme-fg)]"
                >
                  <SkipPreviousIcon size={28} />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPaused ? "Play" : "Pause"}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[var(--theme-fg)]"
                >
                  {isPaused ? <PlayIcon size={26} /> : <PauseIcon size={26} />}
                </button>
                <button
                  type="button"
                  onClick={playNext}
                  aria-label="Next track"
                  className="flex h-11 w-11 items-center justify-center text-[var(--theme-fg)]"
                >
                  <SkipNextIcon size={28} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
