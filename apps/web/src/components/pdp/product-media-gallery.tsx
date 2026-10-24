"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Play, ImageOff } from "lucide-react";
import { ProductVideoPlayer } from "@/components/pdp/product-video-player";
import { getOptimizedMediaUrl } from "@kids-wear/shared";
import type { ApiProductMediaItem } from "@/lib/api";

export interface ProductMediaGalleryProps {
  media: ApiProductMediaItem[];
  productName: string;
  className?: string;
}

export function ProductMediaGallery({
  media,
  productName,
  className = "",
}: ProductMediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  // Sort media by sortOrder
  const sortedMedia = [...media].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeMedia = sortedMedia[selectedIndex] || sortedMedia[0];

  const handleImageError = (index: number) => {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  if (!activeMedia) {
    return (
      <div
        className={`aspect-[4/5] w-full rounded-lg bg-surface-soft border border-border flex flex-col items-center justify-center text-text-muted ${className}`.trim()}
      >
        <ImageOff className="h-10 w-10 mb-2" aria-hidden="true" />
        <span className="text-xs font-sans">No product media available</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      {/* Active Media Container (4:5 Aspect Ratio) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-soft border border-border shadow-subtle">
        {activeMedia.type === "VIDEO" ? (
          <ProductVideoPlayer
            key={activeMedia.url}
            src={activeMedia.url}
            productName={productName}
          />
        ) : imageErrors[selectedIndex] ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted bg-surface-soft p-4 text-center">
            <ImageOff className="h-10 w-10 mb-2" aria-hidden="true" />
            <span className="text-xs font-sans">Image unavailable</span>
          </div>
        ) : (
          <Image
            src={getOptimizedMediaUrl(activeMedia.url, { width: 800, height: 1000, crop: "fill" })}
            alt={activeMedia.altText || `${productName} view ${selectedIndex + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={selectedIndex === 0}
            onError={() => handleImageError(selectedIndex)}
            className="object-cover object-center"
          />
        )}
      </div>

      {/* Thumbnails Row (if multiple media exist) */}
      {sortedMedia.length > 1 && (
        <div
          className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin"
          role="region"
          aria-label="Product media thumbnails"
        >
          {sortedMedia.map((item, index) => {
            const isSelected = index === selectedIndex;
            const isVideo = item.type === "VIDEO";

            return (
              <button
                key={`${item.url}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`View ${isVideo ? "video" : "image"} ${index + 1} of ${sortedMedia.length}`}
                aria-pressed={isSelected}
                className={`group relative shrink-0 aspect-[4/5] w-16 sm:w-20 rounded-md overflow-hidden border-2 bg-surface-soft transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront ${
                  isSelected
                    ? "border-[var(--color-storefront-contrast)] ring-2 ring-[var(--color-storefront-contrast)] ring-offset-2 opacity-100"
                    : "border-border hover:border-[var(--color-storefront-contrast)] opacity-75 hover:opacity-100"
                }`}
              >
                {isVideo ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black/10 text-ink">
                    <Play className="h-5 w-5" aria-hidden="true" />
                    <span className="sr-only">Video</span>
                  </div>
                ) : imageErrors[index] ? (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <ImageOff className="h-4 w-4" aria-hidden="true" />
                  </div>
                ) : (
                  <Image
                    src={getOptimizedMediaUrl(item.url, { width: 160, height: 200, crop: "fill" })}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover object-center"
                    onError={() => handleImageError(index)}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
