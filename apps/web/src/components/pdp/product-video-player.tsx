"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from "lucide-react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function ProductVideoPlayer({ src, productName }: { src: string; productName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const revealControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setError("This video could not be played. Please try again.");
      }
    } else {
      video.pause();
    }
    revealControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted && video.volume === 0) {
      video.volume = 1;
      setVolume(1);
    }
    video.muted = !video.muted;
    setMuted(video.muted);
    revealControls();
  };

  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.requestFullscreen();
    } catch {
      setError("Fullscreen is unavailable in this browser.");
    }
  };

  return (
    <div
      ref={frameRef}
      className="group relative h-full w-full bg-black text-white"
      onPointerMove={revealControls}
      onTouchStart={revealControls}
      onFocusCapture={revealControls}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={muted}
        preload="metadata"
        tabIndex={0}
        aria-label={`${productName} video presentation. Press Space to play or pause.`}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            void togglePlayback();
          }
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          hideTimer.current = setTimeout(() => setShowControls(false), 3000);
        }}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
          if (hideTimer.current) clearTimeout(hideTimer.current);
        }}
        onEnded={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        className="h-full w-full object-contain focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
      >
        Your browser does not support the video tag.
      </video>

      {!playing && (
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white shadow-lg transition-colors hover:bg-[var(--color-storefront-contrast)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Play className="h-7 w-7 fill-current" aria-hidden="true" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-8 transition-opacity duration-200 sm:px-4 ${playing && !showControls ? "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100" : "opacity-100"}`}
        aria-label="Video controls"
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (videoRef.current) videoRef.current.currentTime = next;
            setCurrentTime(next);
            revealControls();
          }}
          aria-label="Seek video"
          className="w-full accent-[var(--color-storefront-accent)] focus-visible:outline-2 focus-visible:outline-white"
        />
        <div className="mt-1 flex items-center gap-2 text-xs sm:gap-3">
          <button
            type="button"
            onClick={() => void togglePlayback()}
            aria-label={playing ? "Pause video" : "Play video"}
            className="rounded p-1.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <span aria-label={`Elapsed ${formatTime(currentTime)} of ${formatTime(duration)}`} className="tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute video" : "Mute video"}
              className="rounded p-1.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (videoRef.current) {
                  videoRef.current.volume = next;
                  videoRef.current.muted = next === 0;
                }
                setVolume(next);
                setMuted(next === 0);
                revealControls();
              }}
              aria-label="Video volume"
              className="hidden w-16 accent-[var(--color-storefront-accent)] focus-visible:outline-2 focus-visible:outline-white sm:block"
            />
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="rounded p-1.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            >
              {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="absolute left-3 top-3 rounded bg-black/75 p-2 text-xs">{error}</p>}
    </div>
  );
}
