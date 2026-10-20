"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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

/**
 * HeroSlider renders storefront-specific hero imagery and messaging.
 * Supports distinct desktop and mobile source imagery, manual keyboard-accessible
 * previous/next navigation, indicator dots, and a restrained fallback state when no slides exist.
 */
export function HeroSlider({ slides = [], storefront, className = "" }: HeroSliderProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];
  const activeSlides = (slides || []).filter((s) => s.isActive);
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

  // Restrained fallback when no active slides exist
  if (total === 0) {
    return (
      <section
        aria-label={`${currentTheme.name} Welcome`}
        className={`relative w-full bg-surface-soft border-b border-border py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center ${className}`.trim()}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-sans font-semibold text-white tracking-wide"
            style={{ backgroundColor: currentTheme.primaryAccent }}
          >
            {currentTheme.ageRange}
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-ink font-normal tracking-tight">
            Welcome to {currentTheme.name}
          </h1>
          <p className="font-sans text-sm sm:text-base text-text-base/80 max-w-xl mx-auto leading-relaxed">
            Explore Kids Wear apparel for {currentTheme.ageRange}, delivered across Pakistan within
            10 days.
          </p>
          <div className="pt-4">
            <Link
              href={`/${storefront}/shop`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-sans font-semibold text-white bg-accent-storefront hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-storefront shadow-subtle"
            >
              <span>Explore {currentTheme.name}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const slide = activeSlides[currentIndex];
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
      <div className="relative w-full min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex items-center">
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
                src={getOptimizedMediaUrl(desktopImage || mobileImage, {
                  width: 1920,
                  height: 800,
                  crop: "fill",
                })}
                alt={slide.heading || `${currentTheme.name} Hero`}
                className="w-full h-full object-cover object-center"
                loading={currentIndex === 0 ? "eager" : "lazy"}
                fetchPriority={currentIndex === 0 ? "high" : "low"}
              />
            </picture>
            {/* Subtle Gradient Overlay for Content Legibility */}
            <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/40 to-transparent" />
            {/* Darker Mobile Overlay for Vertical Text Contrast */}
            <div className="block md:hidden absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/40 to-ink/20" />
          </div>
        )}

        {/* Text & CTA Content Box */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
          <div className="max-w-xl text-white space-y-4">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-sans font-semibold text-white tracking-wide shadow-xs"
              style={{ backgroundColor: currentTheme.primaryAccent }}
            >
              {currentTheme.name} &bull; {currentTheme.ageRange}
            </span>

            {slide.heading && (
              <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal leading-tight text-white drop-shadow-xs">
                {slide.heading}
              </h1>
            )}

            {slide.text && (
              <p className="font-sans text-sm sm:text-base text-white/90 leading-relaxed max-w-lg drop-shadow-xs">
                {slide.text}
              </p>
            )}

            {slide.ctaLabel && slide.ctaLink && (
              <div className="pt-2">
                <Link
                  href={slide.ctaLink}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-sans font-semibold text-white bg-accent-storefront hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white shadow-subtle"
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
