"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function getMostVisibleHeroSlideIndex(visibility: readonly number[]): number | null {
  const mostVisible = Math.max(...visibility);
  return mostVisible > 0 ? visibility.indexOf(mostVisible) : null;
}

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
  const trackRef = useRef<HTMLDivElement>(null);

  const total = activeSlides.length;
  const slideIds = activeSlides.map((slide) => slide.id).join("|");

  const scrollToMobileSlide = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const left = index * track.clientWidth;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.scrollLeft = left;
    } else {
      track.scrollTo({ left, behavior: "smooth" });
    }
  }, []);

  const goToPrevious = useCallback(() => {
    if (total <= 1) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      const track = trackRef.current;
      const index = track ? Math.round(track.scrollLeft / track.clientWidth) : currentIndex;
      scrollToMobileSlide(Math.max(0, index - 1));
      return;
    }
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  }, [currentIndex, scrollToMobileSlide, total]);

  const goToNext = useCallback(() => {
    if (total <= 1) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      const track = trackRef.current;
      const index = track ? Math.round(track.scrollLeft / track.clientWidth) : currentIndex;
      scrollToMobileSlide(Math.min(total - 1, index + 1));
      return;
    }
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  }, [currentIndex, scrollToMobileSlide, total]);

  const selectSlide = useCallback(
    (index: number) => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        scrollToMobileSlide(index);
      } else {
        setCurrentIndex(index);
      }
    },
    [scrollToMobileSlide]
  );

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

  useEffect(() => {
    const track = trackRef.current;
    if (!track || total <= 1) return;
    const elements = Array.from(track.querySelectorAll<HTMLElement>("[data-hero-slide]"));
    const visibility = new Array<number>(elements.length).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!window.matchMedia("(max-width: 767px)").matches) return;
        for (const entry of entries) {
          const index = elements.indexOf(entry.target as HTMLElement);
          if (index >= 0) visibility[index] = entry.intersectionRatio;
        }
        const activeIndex = getMostVisibleHeroSlideIndex(visibility);
        if (activeIndex !== null) setCurrentIndex(activeIndex);
      },
      { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [slideIds, total]);

  if (total === 0) {
    return null;
  }

  const hasMultiple = total > 1;

  return (
    <section
      aria-label={`${currentTheme.name} Featured Highlights`}
      aria-roledescription="carousel"
      className={`relative w-full overflow-hidden bg-ink/5 border-b border-border ${className}`.trim()}
    >
      <div
        ref={trackRef}
        data-hero-track
        className="flex w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:overflow-hidden md:snap-none"
      >
        {activeSlides.map((slide, index) => {
          const desktopImage = slide.desktopImageAsset?.secureUrl;
          const mobileImage = slide.mobileImageAsset?.secureUrl || desktopImage;
          return (
            <div
              key={slide.id}
              data-hero-slide
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${total}`}
              className={`relative flex min-h-[560px] w-full shrink-0 snap-start snap-always items-end sm:min-h-[480px] sm:items-center lg:min-h-[480px] ${index === currentIndex ? "md:flex" : "md:hidden"}`}
            >
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
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "low"}
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
                  <span className="inline-block rounded-full bg-[var(--color-storefront-contrast)] px-4 py-1.5 text-[15px] leading-tight font-sans font-semibold uppercase tracking-widest text-white">
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
                        className="inline-flex min-h-[50px] w-full max-w-[240px] items-center justify-center rounded-sm border-2 border-[var(--color-storefront-contrast)] bg-white/90 px-6 py-3 text-center font-sans text-[15px] font-medium text-[var(--color-storefront-contrast)] transition-colors duration-200 hover:bg-[var(--color-storefront-contrast)] hover:text-white active:bg-[var(--color-storefront-accent-hover)] active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-storefront-contrast)] focus-visible:ring-offset-2 sm:w-[232px]"
                      >
                        <span>{slide.ctaLabel}</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Previous / Next Controls */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden h-11 w-11 rounded-full bg-surface/80 hover:bg-surface text-ink md:flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront shadow-subtle"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden h-11 w-11 rounded-full bg-surface/80 hover:bg-surface text-ink md:flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront shadow-subtle"
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
                onClick={() => selectSlide(idx)}
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
    </section>
  );
}
