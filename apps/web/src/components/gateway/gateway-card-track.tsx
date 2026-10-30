"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface GatewayIndicator {
  slug: string;
  title: string;
  accentColor: string;
}

export function getActiveGatewayIndex(ratios: readonly number[]): number {
  return ratios.reduce((active, ratio, index) => ratio > (ratios[active] ?? 0) ? index : active, 0);
}

export function GatewayCardTrack({
  children,
  indicators,
}: {
  children: ReactNode;
  indicators: readonly GatewayIndicator[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;

    const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-storefront]"));
    const visibility = cards.map(() => 0);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = cards.indexOf(entry.target as HTMLElement);
        if (index >= 0) visibility[index] = entry.intersectionRatio;
      }
      setActiveIndex(getActiveGatewayIndex(visibility));
    }, { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] });

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={trackRef}
        data-gateway-track
        role="region"
        aria-label="Storefront cards"
        className="flex w-[calc(100%+2rem)] -mx-4 px-4 gap-4 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-[calc(100%+3rem)] sm:-mx-6 sm:px-6 md:grid md:grid-cols-3 md:gap-5 lg:gap-[22px] md:overflow-visible md:snap-none md:scroll-auto md:px-0 md:w-[calc(100%-24px)] md:mx-auto items-stretch md:my-0"
      >
        {children}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 md:hidden" aria-hidden="true">
        {indicators.map((indicator, index) => (
          <span
            key={indicator.slug}
            data-active={activeIndex === index}
            className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ${activeIndex === index ? "w-5" : "w-1.5 bg-brand-border"}`}
            style={activeIndex === index ? { backgroundColor: indicator.accentColor } : undefined}
          />
        ))}
      </div>
      <p className="sr-only md:hidden" role="status" aria-live="polite">
        {indicators[activeIndex]?.title ?? indicators[0]?.title}, card {activeIndex + 1} of {indicators.length}
      </p>
    </>
  );
}
