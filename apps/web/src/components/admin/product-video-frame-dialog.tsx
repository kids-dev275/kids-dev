"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  getVideoCropError,
  getVideoQualityWarning,
  normalizeVideoCrop,
  type VideoCrop,
} from "@/lib/admin-product-media";

interface ProductVideoFrameDialogProps {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  onCancel: () => void;
  onConfirm: (crop: VideoCrop) => void;
}

export function ProductVideoFrameDialog({
  sourceUrl,
  sourceWidth,
  sourceHeight,
  onCancel,
  onConfirm,
}: ProductVideoFrameDialogProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const cropperRef = useRef<Cropper>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const crop = area ? normalizeVideoCrop(area, sourceWidth, sourceHeight) : null;
  const cropError = crop ? getVideoCropError(crop) : null;
  const qualityWarning = crop ? getVideoQualityWarning(crop) : null;

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const togglePlayback = async () => {
    const video = cropperRef.current?.videoRef.current;
    if (!video) return;
    setPlayError(null);
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setPlayError("This MP4 could not be played in the browser. Please choose another file.");
      }
    } else {
      video.pause();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-video-frame-title"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"
      >
        <h2 id="product-video-frame-title" className="font-heading text-lg text-brand-ink">
          Frame Product Video
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Drag and zoom to keep the model and garment inside the fixed 4:5 frame. Play the video to
          check the crop throughout the clip. Cloudinary will produce the final 1080 × 1350 MP4.
        </p>
        <div className="relative mx-auto mt-4 aspect-4/5 max-h-[55vh] w-full max-w-[340px] overflow-hidden rounded-sm bg-black">
          <Cropper
            ref={cropperRef}
            video={sourceUrl}
            crop={position}
            zoom={zoom}
            aspect={4 / 5}
            mediaProps={{
              autoPlay: false,
              loop: false,
              muted: true,
              playsInline: true,
              preload: "metadata",
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
            }}
            onCropChange={setPosition}
            onZoomChange={setZoom}
            onCropAreaChange={(_, pixels) => setArea(pixels)}
          />
        </div>
        <div className="mx-auto mt-3 flex max-w-[340px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void togglePlayback()}
            className="rounded-sm border border-brand-sand px-3 py-2 text-xs font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink"
          >
            {playing ? "Pause Preview" : "Play Preview"}
          </button>
          <span className="text-xs text-brand-muted">
            Source: {sourceWidth} × {sourceHeight}
          </span>
        </div>
        <label
          htmlFor="product-video-zoom"
          className="mt-4 block text-xs font-semibold text-brand-ink"
        >
          Zoom: {zoom.toFixed(1)}×
        </label>
        <input
          id="product-video-zoom"
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="mt-2 w-full accent-brand-ink"
        />
        {crop && (
          <p className="mt-2 text-xs text-brand-muted">
            Selected crop: {crop.width} × {crop.height} · Final output: 1080 × 1350
          </p>
        )}
        {cropError && (
          <p role="alert" className="mt-3 text-xs text-rose-700">
            {cropError}
          </p>
        )}
        {!cropError && qualityWarning && (
          <p role="status" className="mt-3 text-xs text-amber-800">
            {qualityWarning}
          </p>
        )}
        {playError && (
          <p role="alert" className="mt-3 text-xs text-rose-700">
            {playError}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-brand-sand px-4 py-2 text-xs font-semibold text-brand-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setPosition({ x: 0, y: 0 });
              setZoom(1);
            }}
            className="rounded-sm border border-brand-sand px-4 py-2 text-xs font-semibold text-brand-ink"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => crop && onConfirm(crop)}
            disabled={!crop || !!cropError}
            className="rounded-sm bg-brand-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm Video
          </button>
        </div>
      </div>
    </div>
  );
}
