"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { getOptimizedMediaUrl } from "@kids-wear/shared";
import type { ApiHeroSlide } from "@/lib/api";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface HeroSliderProps {
  slides?: ApiHeroSlide[] | null;
  storefront: StorefrontSlug;
  className?: string;
}

const FALLBACK_COPY = {
  "mini-sprouts": {
    eyebrow: "STYLE FOR LITTLE MOMENTS",
    text: "Playful styles for everyday moments and special days.",
  },
  "teen-studio": {
    eyebrow: "STYLE FOR EVERY MOOD",
    text: "Fresh, expressive styles designed for growing personalities.",
  },
  "aura-studio": {
    eyebrow: "REFINED EVERYDAY STYLE",
    text: "Modern silhouettes and versatile styles for every chapter.",
  },
} as const;

/**
 * HeroSlider renders storefront-specific hero imagery and messaging.
 * Supports distinct desktop and mobile source imagery, manual keyboard-accessible
 * previous/next navigation, indicator dots, and a restrained fallback state when no slides exist.
 */
export function HeroSlider({ slides = [], storefront, className = "" }: HeroSliderProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];
  const configuredSlides = (slides || [])
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const usingFallback = process.env.NODE_ENV !== "production" && (!slides || slides.length === 0);
  const activeSlides: ApiHeroSlide[] = usingFallback
    ? [1, 2, 3].map((number) => ({
        id: `${storefront}-local-${number}`,
        storefrontId: storefront,
        heading: currentTheme.name,
        text: FALLBACK_COPY[storefront].text,
        ctaLabel: `Shop ${currentTheme.name}`,
        ctaLink: `/${storefront}/shop`,
        sortOrder: number,
        isActive: true,
        desktopImageAsset: {
          id: `${storefront}-${number}`,
          secureUrl: `/images/hero/${storefront}/${storefront}-hero-0${number}-desktop.webp`,
          width: 1672,
          height: 941,
          format: "webp",
        },
        mobileImageAsset: null,
      }))
    : configuredSlides;
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = activeSlides.length;

  const goToPrevious = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  }, [total]);

  const goToNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  }, [total]);

  // Keyboard navigation support
  useEffect(() => {
    if (total <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, goToPrevious, goToNext]);

  if (total === 0) {
    return null;
  }

  const slide = activeSlides[currentIndex] || activeSlides[0];
  const hasMultiple = total > 1;

  const desktopImage = slide.desktopImageAsset?.secureUrl;
  const mobileImage = slide.mobileImageAsset?.secureUrl || desktopImage;

  return (
    <section
      aria-label={`${currentTheme.name} Featured Highlights`}
      aria-roledescription="carousel"
      className={`relative w-full overflow-hidden bg-ink/5 border-b border-border ${className}`.trim()}
    >
      {/* Slide Visual Container */}
      <div className="relative flex min-h-[560px] w-full items-end sm:min-h-[480px] sm:items-center lg:min-h-[480px]">
        {/* Single Responsive Picture Element to prevent dual-image preloads */}
        {(desktopImage || mobileImage) && (
          <div className="absolute inset-0 w-full h-full">
            <picture className="w-full h-full">
              {mobileImage && (
                <source
                  media="(max-width: 767px)"
                  srcSet={getOptimizedMediaUrl(mobileImage, {
                    width: 1080,
                    height: 1350,
                    crop: "fill",
                  })}
                />
              )}
              {desktopImage && (
                <source
                  media="(min-width: 768px)"
                  srcSet={getOptimizedMediaUrl(desktopImage, {
                    width: 1920,
                    height: 800,
                    crop: "fill",
                  })}
                />
              )}
              <img
                key={slide.id}
                src={getOptimizedMediaUrl(desktopImage || mobileImage, {
                  width: 1920,
                  height: 800,
                  crop: "fill",
                })}
                alt={slide.heading || `${currentTheme.name} Hero`}
                className={`w-full h-full object-cover animate-[storefront-hero-in_350ms_ease-out] ${usingFallback ? "object-[70%_top] md:object-top" : "object-center"}`}
                loading={currentIndex === 0 ? "eager" : "lazy"}
                fetchPriority={currentIndex === 0 ? "high" : "low"}
              />
            </picture>
            {/* Subtle Gradient Overlay for Content Legibility */}
            <div
              className={`hidden md:block absolute inset-0 ${usingFallback ? "bg-gradient-to-r from-[#FBF7F2]/95 via-[#FBF7F2]/65 to-transparent" : "bg-gradient-to-r from-ink/70 via-ink/40 to-transparent"}`}
            />
            {/* Darker Mobile Overlay for Vertical Text Contrast */}
            <div
              className={`block md:hidden absolute inset-0 ${usingFallback ? "bg-gradient-to-t from-[#FBF7F2] via-[#FBF7F2]/95 via-35% to-transparent" : "bg-gradient-to-t from-ink/80 via-ink/40 to-ink/20"}`}
            />
          </div>
        )}

        {/* Text & CTA Content Box */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-56 sm:py-12 w-full">
          <div className={`max-w-xl space-y-4 ${usingFallback ? "text-ink" : "text-white"}`}>
            {usingFallback && (
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-storefront-contrast)]">
                {FALLBACK_COPY[storefront].eyebrow}
              </p>
            )}
            <span
              className={`inline-block text-xs font-sans font-semibold uppercase tracking-widest ${usingFallback ? "text-[var(--color-storefront-contrast)]" : "rounded-full px-3 py-1 text-white"}`}
              style={!usingFallback ? { backgroundColor: currentTheme.primaryAccent } : undefined}
            >
              {currentTheme.ageRange}
            </span>

            {slide.heading && (
              <h1
                className={`font-editorial text-4xl sm:text-5xl lg:text-6xl font-normal leading-tight ${usingFallback ? "text-ink" : "text-white"}`}
              >
                {slide.heading}
              </h1>
            )}

            {slide.text && (
              <p
                className={`font-sans text-sm sm:text-base leading-relaxed max-w-lg ${usingFallback ? "text-text-base" : "text-white/90"}`}
              >
                {slide.text}
              </p>
            )}

            {slide.ctaLabel && slide.ctaLink && (
              <div className="pt-2">
                <Link
                  href={slide.ctaLink}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-sans font-semibold text-white bg-[var(--color-storefront-contrast)] hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white shadow-subtle"
                >
                  <span>{slide.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Manual Previous / Next Controls */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-surface/80 hover:bg-surface text-ink flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront shadow-subtle"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-surface/80 hover:bg-surface text-ink flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront shadow-subtle"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Indicator Dots */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
              role="tablist"
              aria-label="Slide indicators"
            >
              {activeSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === currentIndex}
                  aria-label={`Go to slide ${idx + 1} of ${total}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    idx === currentIndex
                      ? "w-8 bg-white shadow-xs"
                      : "w-2.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
