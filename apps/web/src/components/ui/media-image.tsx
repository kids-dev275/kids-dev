import React from "react";
import Image from "next/image";

export interface MediaImageProps {
  src: string;
  alt: string;
  aspectRatio?: "4/5" | "1/1" | "16/9" | "auto";
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}

const ASPECT_MAP = {
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
  auto: "",
};

/**
 * MediaImage wraps Next.js Image with a fixed aspect-ratio container
 * to prevent layout shifts (CLS) and provide responsive object-fit styling.
 */
export function MediaImage({
  src,
  alt,
  aspectRatio = "4/5",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
  className = "",
  imageClassName = "",
}: MediaImageProps) {
  const aspectClass = ASPECT_MAP[aspectRatio];

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-soft ${aspectClass} ${className}`.trim()}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover object-center transition-opacity duration-300 ${imageClassName}`.trim()}
      />
    </div>
  );
}
