"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
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

  // Pull-down-to-dismiss: drag only starts from the header's grabber handle
  // (dragListener={false} + dragControls.start on pointerdown there), not
  // the whole sheet — otherwise this would fight the seek scrubber and the
  // video's own touch handling for pointer events.
  const dragControls = useDragControls();
  function handleSheetDragEnd(_event: unknown, info: PanInfo) {
    // Low bar on purpose: either one works — drag about a sixth of the way
    // down, or just flick in that direction at any distance. Matches native
    // sheet dismiss gestures (iOS/Android), which don't require dragging
    // anywhere near the full screen height either.
    if (info.offset.y > 70 || info.velocity.y > 350) setExpanded(false);
  }

  // avoid the sheet reappearing on its own the next time a track starts —
  // once the track that was expanded goes away (e.g. logout), drop the flag
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!currentTrack) setExpanded(false);
  }, [currentTrack]);

  // Shared between the video and audio branches below — title/artist,
  // scrubber, and prev/play/next, unchanged either way. Takes `track`
  // explicitly (rather than closing over `currentTrack` directly) so
  // TypeScript keeps the non-null narrowing from the call site's `&&` guard.
  function trackInfoAndControls(track: NonNullable<typeof currentTrack>) {
    return (
      <>
        <div className="w-full max-w-sm min-w-0 text-center">
          <p className="truncate text-2xl font-bold text-[var(--theme-fg)]">{track.song}</p>
          <p className="truncate text-base text-white/50">{track.artist_name}</p>
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
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            // Same lg: centering as FloatingPanel/StatusCard — otherwise this
            // capsule stretches the full width of a laptop-size window.
            // max-w-md (not max-w-2xl) matches the NavBar directly below it,
            // so the two floating pieces line up instead of one being
            // noticeably wider than the other.
            className="fixed inset-x-2 z-40 overflow-hidden rounded-xl border border-white/10 bg-white/10 backdrop-blur-xl lg:inset-x-auto lg:left-1/2 lg:w-full lg:max-w-md lg:-translate-x-1/2"
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
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            // dragConstraints pins the resting position at exactly 0, so
            // every bit of downward movement is technically "outside"
            // those constraints — dragElastic is how much of that is
            // actually allowed to show, where 1 = the sheet tracks the
            // finger exactly 1:1 and lower values add rubber-band
            // resistance (less visible movement per pixel dragged). Set
            // near 1 on purpose — it also directly scales what onDragEnd's
            // info.offset reports, so a low resistance value here is what
            // makes the small physical drag below actually register.
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={handleSheetDragEnd}
            className="fixed inset-0 z-[60] flex flex-col bg-[rgb(var(--theme-bg-rgb))] text-[var(--theme-fg)]"
            style={{
              paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
            }}
          >
            {/* Drag only starts from here (the grabber + header row), not
                the whole sheet, so it doesn't fight the seek scrubber or
                the video's own touch handling further down. Generous
                vertical padding (not just the thin visible bar) so the
                actual touch target to START a drag is much bigger than
                what's drawn — easy to catch without aiming precisely. */}
            <div
              className="relative flex shrink-0 touch-none flex-col items-center gap-3 px-4 pt-1 pb-5"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-12 rounded-full bg-white/25" aria-hidden />
              <div className="relative flex w-full items-center justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Collapse now playing"
                  className="absolute left-0 flex h-9 w-9 items-center justify-center text-[var(--theme-fg)]/70"
                >
                  <ChevronDownIcon />
                </button>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Now Playing</p>
              </div>
            </div>

            {/* overflow-y-auto is the safety net: on a laptop browser window
                (address bar + tab strip eating into viewport height), the
                320px art + text + scrubber + buttons can be taller than
                what's left after the header, which otherwise clips the
                buttons off the bottom with no way to reach them. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8">
              {currentTrack.media_type === "video" ? (
                <>
                  {/* flex-1 + min-h-0 instead of aspect-video: the box now
                      fills essentially the whole remaining screen — title/
                      scrubber/controls are an absolutely-positioned overlay
                      INSIDE it (below), not a separate sibling block taking
                      up its own space. The <video> itself (in player-context)
                      uses object-contain, so it still letterboxes/
                      pillarboxes correctly at whatever size the box ends up.
                      -mx-8 cancels the parent's horizontal padding so it's
                      edge-to-edge.
                      The actual <video> element lives in player-context and
                      is portaled into the inner div — ref callback claims
                      it; React calls it with null on unmount (sheet closes,
                      or the track changes to non-video), which releases it
                      back to its default hidden slot where it keeps playing
                      audio-only in the background. The fullscreen button and
                      the controls overlay are siblings, not children, of the
                      portal target, so neither is wiped out by whatever gets
                      portaled in. */}
                  <div className="relative -mx-8 min-h-0 flex-1 overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
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
                    {/* Gradient backdrop behind the floating controls — the
                        video content underneath is arbitrary, so the title
                        text and scrubber need guaranteed contrast rather
                        than relying on whatever happens to be in frame. */}
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-6 pb-6 pt-14">
                      {currentTrack && trackInfoAndControls(currentTrack)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
                  <TrackArt
                    index={hashIndex(currentTrack.song + currentTrack.artist_name)}
                    size={260}
                    src={currentTrack.coverArt}
                    alt={currentTrack.song}
                    className="max-w-full rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
                  />
                  {currentTrack && trackInfoAndControls(currentTrack)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
