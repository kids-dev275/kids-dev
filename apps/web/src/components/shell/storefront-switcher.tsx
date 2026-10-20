import React from "react";
import Link from "next/link";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface StorefrontSwitcherProps {
  currentStorefront: StorefrontSlug;
  className?: string;
  variant?: "pill" | "compact";
}

const STOREFRONT_SLUGS: StorefrontSlug[] = ["mini-sprouts", "teen-studio", "aura-studio"];

/**
 * Compact, keyboard-accessible Storefront Switcher allowing movement
 * between Mini Sprouts, Teen Studio, and Aura Studio homepages.
 */
export function StorefrontSwitcher({
  currentStorefront,
  className = "",
  variant = "pill",
}: StorefrontSwitcherProps) {
  return (
    <nav
      aria-label="Storefront Switcher"
      className={`inline-flex items-center ${className}`.trim()}
    >
      <div
        className={`flex items-center gap-1 rounded-full p-1 border border-border bg-surface shadow-subtle ${
          variant === "compact" ? "text-xs" : "text-xs sm:text-sm"
        }`}
      >
        {STOREFRONT_SLUGS.map((slug) => {
          const theme = STOREFRONT_THEMES[slug];
          const isCurrent = currentStorefront === slug;

          return (
            <Link
              key={slug}
              href={`/${slug}`}
              aria-current={isCurrent ? "page" : undefined}
              className={`px-3 py-1 rounded-full font-sans font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront ${
                isCurrent
                  ? "bg-accent-storefront text-white shadow-subtle font-semibold"
                  : "text-text-base hover:text-ink hover:bg-surface-soft"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isCurrent ? "bg-white" : ""}`}
                style={!isCurrent ? { backgroundColor: theme.primaryAccent } : undefined}
                aria-hidden="true"
              />
              <span>{theme.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
