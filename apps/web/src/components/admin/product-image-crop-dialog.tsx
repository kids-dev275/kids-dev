"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCropError, normalizeProductImage } from "@/lib/admin-product-media";

interface ProductImageCropDialogProps {
  sourceUrl: string;
  sourceName: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export function ProductImageCropDialog({
  sourceUrl,
  sourceName,
  onCancel,
  onConfirm,
}: ProductImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isProcessing, onCancel]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview]
  );

  const changeFraming = () => {
    setPreview(null);
    setError(null);
  };

  const handlePreview = async () => {
    if (!area) return;
    setIsProcessing(true);
    setError(null);
    try {
      const file = await normalizeProductImage(sourceUrl, area, sourceName);
      setPreview({ file, url: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare this crop.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-crop-title"
        className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"
      >
        <h2 id="product-crop-title" className="font-heading text-lg text-brand-ink">
          Crop Product Image
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Frame the head and garment inside the fixed 4:5 crop. The final image will be 1200 × 1500.
        </p>

        {preview ? (
          <div className="mx-auto mt-4 w-full max-w-[260px]">
            <p className="mb-2 text-xs font-semibold text-brand-ink">
              Exact 1200 × 1500 crop preview
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt="Exact cropped product image preview"
              className="aspect-4/5 w-full rounded-sm border border-brand-sand object-contain"
            />
          </div>
        ) : (
          <>
            <div className="relative mx-auto mt-4 h-[min(55vh,480px)] w-full overflow-hidden rounded-sm bg-brand-ink">
              <Cropper
                image={sourceUrl}
                crop={crop}
                zoom={zoom}
                aspect={4 / 5}
                onCropChange={(next) => {
                  changeFraming();
                  setCrop(next);
                }}
                onZoomChange={(next) => {
                  changeFraming();
                  setZoom(next);
                }}
                onCropAreaChange={(_, pixels) => setArea(pixels)}
              />
            </div>
            <label
              htmlFor="product-crop-zoom"
              className="mt-4 block text-xs font-semibold text-brand-ink"
            >
              Zoom: {zoom.toFixed(1)}×
            </label>
            <input
              id="product-crop-zoom"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(event) => {
                changeFraming();
                setZoom(Number(event.target.value));
              }}
              className="mt-2 w-full accent-brand-ink"
            />
          </>
        )}

        {(error || (area && !preview && getCropError(area))) && (
          <p role="alert" className="mt-3 text-xs text-rose-700">
            {error || (area && getCropError(area))}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-sm border border-brand-sand px-4 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setCrop({ x: 0, y: 0 });
              setZoom(1);
              changeFraming();
            }}
            disabled={isProcessing}
            className="rounded-sm border border-brand-sand px-4 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50"
          >
            Reset
          </button>
          {preview ? (
            <>
              <button
                type="button"
                onClick={changeFraming}
                className="rounded-sm border border-brand-sand px-4 py-2 text-xs font-semibold text-brand-ink"
              >
                Back to Crop
              </button>
              <button
                type="button"
                onClick={() => onConfirm(preview.file)}
                className="rounded-sm bg-brand-ink px-4 py-2 text-xs font-semibold text-white"
              >
                Confirm Crop &amp; Upload Image
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePreview}
              disabled={!area || !!getCropError(area) || isProcessing}
              className="rounded-sm bg-brand-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? "Preparing Preview..." : "Preview Crop"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
