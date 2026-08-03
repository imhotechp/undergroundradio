"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Track } from "@/app/lib/api";

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
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function sameTrack(a: Track | null, b: Track | null) {
  return !!a && !!b && a.song === b.song && a.artist_name === b.artist_name;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = currentIndex !== null ? (queue[currentIndex] ?? null) : null;

  const playQueue = useCallback((tracks: Track[], startIndex: number) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const playNext = useCallback(() => {
    setCurrentIndex((i) => (i !== null && i + 1 < queue.length ? i + 1 : i));
  }, [queue.length]);

  const playPrevious = useCallback(() => {
    setCurrentIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  // load + play whenever the selected track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.url) return;
    audio.src = currentTrack.url;
    audio.play().catch(() => {});
  }, [currentTrack?.url]);

  // native <audio> events -> React state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => playNext();
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playNext]);

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

  // lock-screen hardware controls (play/pause/seek/skip)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const audio = audioRef.current;
    navigator.mediaSession.setActionHandler("play", () => audio?.play().catch(() => {}));
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (audio && details.seekTime != null) audio.currentTime = details.seekTime;
    });
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      if (audio) audio.currentTime = audio.currentTime + (details.seekOffset ?? 10);
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
  }, [playNext, playPrevious]);

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
        playbackRate: audioRef.current?.playbackRate ?? 1,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // browser can reject transient out-of-range values (e.g. mid-seek); safe to ignore
    }
  }, [duration, currentTime]);

  return (
    <PlayerContext.Provider
      value={{ currentTrack, isPaused, currentTime, duration, playQueue, togglePlay, playNext, playPrevious, seek }}
    >
      {children}
      <audio ref={audioRef} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

export { sameTrack };
