"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import type { Track } from "@/app/lib/api";
import { getAccessToken, onAuthChange } from "@/app/lib/auth";

interface PlayerContextValue {
  currentTrack: Track | null;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playQueue: (tracks: Track[], startIndex: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  shuffle: boolean;
  toggleShuffle: () => void;
  // Lets a video surface (the Now Playing full-screen view) claim the
  // already-playing <video> element by giving it a container to render
  // into — see the portal note below. Pass null to release it back to the
  // default hidden container (e.g. on collapse), where it keeps playing
  // audio-only in the background exactly like a song would.
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setVideoContainer: (node: HTMLElement | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function sameTrack(a: Track | null, b: Track | null) {
  return !!a && !!b && a.song === b.song && a.artist_name === b.artist_name;
}

function isVideoTrack(track: Track | null | undefined) {
  return track?.media_type === "video";
}

// Prefers the adaptive HLS manifest once it's ready; falls back to the raw
// file (single quality, but playable immediately) while a video's
// background transcode hasn't finished yet.
function sourceUrlFor(track: Track) {
  return track.hls_url || track.url || "";
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Portal target for the <video> element. null = its own default hidden
  // slot (still mounted, still plays audio-only in the background);
  // non-null = wherever a video-surface consumer (NowPlayingBar) wants it
  // visually shown. Always going through createPortal either way (never
  // conditionally skipping it) is what lets React move the same DOM node
  // between containers instead of unmounting/remounting it — the whole
  // point, since remounting a <video> loses playback position.
  const [videoContainer, setVideoContainer] = useState<HTMLElement | null>(null);
  const [defaultVideoContainer, setDefaultVideoContainer] = useState<HTMLDivElement | null>(null);
  // Tracks whether playback SHOULD be active, independent of transient
  // native `pause` events — moving the portaled <video> to a new DOM
  // parent (opening/closing the full-screen view) can make some browsers
  // pause it as a side effect of being reparented, even though it's the
  // same element/position. Used below to resume automatically after a
  // reparent without un-pausing a video the user deliberately paused.
  const shouldBePlayingRef = useRef(false);

  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // A mode, not a one-time reorder — `queue` itself always stays in its
  // original order (see playNext below), so turning shuffle back off just
  // resumes normal sequential order from wherever the current track
  // actually sits in that order, with no separate bookkeeping needed.
  const [shuffle, setShuffle] = useState(false);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const currentTrack = currentIndex !== null ? (queue[currentIndex] ?? null) : null;

  // Whichever element actually corresponds to the current track — every
  // control function below (play/pause/seek/restart) operates on this
  // rather than hardcoding audioRef, so audio and video share one set of
  // controls instead of two parallel implementations.
  const activeElement = useCallback((): HTMLMediaElement | null => {
    return isVideoTrack(currentTrack) ? videoRef.current : audioRef.current;
  }, [currentTrack]);

  // Loads `url` onto `el`, choosing plain playback, native HLS (Safari/iOS
  // — no CORS needed, the browser loads it the same as any other file), or
  // hls.js (everywhere else — it fetches the manifest/segments itself via
  // JS, which is why the R2 Worker now sends CORS headers). Destroys any
  // previous hls.js instance first; leaving one attached across a track
  // change both leaks it and can fight the new source for control of `el`.
  const attachSource = useCallback((el: HTMLMediaElement, url: string) => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (url.endsWith(".m3u8") && !(el as HTMLVideoElement).canPlayType?.("application/vnd.apple.mpegurl")) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(el as HTMLVideoElement);
        hlsRef.current = hls;
        return;
      }
    }
    el.src = url;
  }, []);

  // Pauses+unloads whichever element ISN'T the one for `track`, so a
  // leftover video doesn't keep decoding (or audibly playing) in the
  // background after switching to an audio track, and vice versa.
  const deactivateOther = useCallback((track: Track) => {
    const inactive = isVideoTrack(track) ? audioRef.current : videoRef.current;
    if (!inactive) return;
    inactive.pause();
    if (hlsRef.current && inactive === videoRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    inactive.removeAttribute("src");
    inactive.load();
  }, []);

  const playQueue = useCallback((tracks: Track[], startIndex: number) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    // set src + play synchronously, inside the same call stack as the click
    // that triggered this — iOS Safari's autoplay policy silently blocks
    // play() if it happens later, e.g. from a useEffect reacting to state
    const track = tracks[startIndex];
    const url = track ? sourceUrlFor(track) : "";
    if (!url) {
      console.error("No url on track, nothing to play:", track);
      return;
    }
    const el = isVideoTrack(track) ? videoRef.current : audioRef.current;
    if (el) {
      attachSource(el, url);
      shouldBePlayingRef.current = true;
      el.play().catch((err) => console.error("play() rejected:", err));
    }
    deactivateOther(track);
  }, [attachSource, deactivateOther]);

  const togglePlay = useCallback(() => {
    const el = activeElement();
    if (!el) return;
    if (el.paused) {
      shouldBePlayingRef.current = true;
      el.play().catch((err) => console.error("play() rejected:", err));
    } else {
      shouldBePlayingRef.current = false;
      el.pause();
    }
  }, [activeElement]);

  const playNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i === null || queue.length === 0) return i;
      if (shuffle) {
        if (queue.length === 1) return i; // nothing else to pick
        let next = Math.floor(Math.random() * queue.length);
        while (next === i) next = Math.floor(Math.random() * queue.length); // avoid an immediate repeat
        return next;
      }
      return i + 1 < queue.length ? i + 1 : i;
    });
  }, [queue.length, shuffle]);

  const playPrevious = useCallback(() => {
    // standard media-player behavior: restart the current track if it's
    // already partway through, only skip back to the previous track if
    // we're still near the start
    const el = activeElement();
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    setCurrentIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, [activeElement]);

  const seek = useCallback((time: number) => {
    const el = activeElement();
    if (el) el.currentTime = time;
  }, [activeElement]);

  // load + play whenever the selected track changes (covers playNext/playPrevious/
  // ended-auto-advance; the initial click is also handled synchronously in
  // playQueue above for autoplay-gesture purposes — guard here avoids reloading
  // the same src twice when this fires right after that direct call)
  useEffect(() => {
    if (!currentTrack) return;
    const url = sourceUrlFor(currentTrack);
    if (!url) return;
    const el = isVideoTrack(currentTrack) ? videoRef.current : audioRef.current;
    if (!el || el.src === url) return;
    attachSource(el, url);
    shouldBePlayingRef.current = true;
    el.play().catch((err) => console.error("play() rejected:", err));
    deactivateOther(currentTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.url, currentTrack?.hls_url, currentTrack?.media_type]);

  // Moves the real <video> DOM node between containers via plain
  // `appendChild` rather than changing createPortal's target container
  // (which is instead held fixed on defaultVideoContainer below, forever).
  // React's portal reconciliation includes the container itself in deciding
  // whether to reuse a portal's fiber — switching it unmounts and remounts
  // the whole subtree, which for a <video> means losing its loaded source
  // and position entirely (confirmed: readyState/duration reset to
  // nothing), not just a transient pause. A hand-rolled DOM move sidesteps
  // React's diffing for this altogether and verified to preserve playback
  // with zero interruption. shouldBePlayingRef's resume call below is
  // just a safety net in case some browser's move semantics differ from
  // Chromium's (which doesn't even pause for this).
  useEffect(() => {
    const video = videoRef.current;
    const target = videoContainer ?? defaultVideoContainer;
    if (!video || !target || video.parentElement === target) return;
    target.appendChild(video);
    if (shouldBePlayingRef.current) video.play().catch(() => {});
  }, [videoContainer, defaultVideoContainer]);

  // native <audio>/<video> events -> React state. Attached to both
  // elements permanently (both stay mounted for the life of the app) —
  // only the one actually in use ever has a real src, so only it ever
  // fires anything meaningful; sharing one handler set is simpler than
  // re-attaching listeners on every track/media-type change.
  useEffect(() => {
    const elements = [audioRef.current, videoRef.current].filter((el): el is HTMLMediaElement => !!el);
    if (!elements.length) return;
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);
    const onTimeUpdate = (e: Event) => setCurrentTime((e.currentTarget as HTMLMediaElement).currentTime);
    const onLoadedMetadata = (e: Event) => setDuration((e.currentTarget as HTMLMediaElement).duration || 0);
    const onEnded = () => {
      shouldBePlayingRef.current = false;
      playNext();
    };
    const onError = (e: Event) => {
      const el = e.currentTarget as HTMLMediaElement;
      console.error("Playback error for", el.src, el.error);
    };
    for (const el of elements) {
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("timeupdate", onTimeUpdate);
      el.addEventListener("loadedmetadata", onLoadedMetadata);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
    }
    return () => {
      for (const el of elements) {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("timeupdate", onTimeUpdate);
        el.removeEventListener("loadedmetadata", onLoadedMetadata);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      }
    };
  }, [playNext]);

  // stop and clear playback on logout — otherwise the audio (and the
  // NowPlayingBar showing it) keeps going right through the login screen
  const stopPlaybackForLogout = useCallback(() => {
    for (const el of [audioRef.current, videoRef.current]) {
      if (!el) continue;
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setQueue([]);
    setCurrentIndex(null);
  }, []);

  useEffect(() => {
    return onAuthChange(() => {
      if (getAccessToken()) return;
      stopPlaybackForLogout();
    });
  }, [stopPlaybackForLogout]);

  // lock-screen / Control Center metadata (title, artist, artwork)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.song,
      artist: currentTrack.artist_name,
      artwork: currentTrack.coverArt
        ? [{ src: currentTrack.coverArt, sizes: "512x512", type: "image/png" }]
        : [],
    });
  }, [currentTrack]);

  // lock-screen hardware controls (play/pause/seek/skip). Deliberately not
  // registering seekbackward/seekforward (±10s skip): iOS shows either that
  // pair or previoustrack/nexttrack on the lock screen, not both, and
  // registering both had it default to the skip-10s pair — leaving them
  // unset makes it fall back to previous/next track instead.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => activeElement()?.play().catch((err) => console.error("play() rejected:", err)));
    navigator.mediaSession.setActionHandler("pause", () => activeElement()?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      const el = activeElement();
      if (el && details.seekTime != null) el.currentTime = details.seekTime;
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [playNext, playPrevious, activeElement]);

  // lock-screen play/pause state
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPaused ? "paused" : "playing";
  }, [isPaused]);

  // lock-screen scrubber position
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!duration || !Number.isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: activeElement()?.playbackRate ?? 1,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // browser can reject transient out-of-range values (e.g. mid-seek); safe to ignore
    }
  }, [duration, currentTime, activeElement]);

  const videoElement = (
    <video ref={videoRef} playsInline className="h-full w-full object-contain" />
  );

  return (
    <PlayerContext.Provider
      value={{
        currentTrack, isPaused, currentTime, duration,
        playQueue, togglePlay, playNext, playPrevious, seek,
        videoRef, setVideoContainer, shuffle, toggleShuffle,
      }}
    >
      {children}
      <audio ref={audioRef} />
      {/* Always mounted, off-screen by default — a video keeps playing
          audio-only in the background when no one has claimed it visually
          (e.g. the Now Playing sheet is collapsed), exactly like a song does. */}
      <div
        ref={setDefaultVideoContainer}
        aria-hidden
        style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
      />
      {/* Portal target is always defaultVideoContainer, never videoContainer
          directly — see the move-effect above for why (switching a portal's
          own container unmounts/remounts it). Visually relocating the video
          to videoContainer, when claimed, happens there via a real DOM move
          on top of this fixed portal, not by changing this call. */}
      {defaultVideoContainer && createPortal(videoElement, defaultVideoContainer)}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

export { sameTrack };
