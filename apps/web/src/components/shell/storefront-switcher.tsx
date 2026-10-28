import React from "react";
import Link from "next/link";
import {
  STOREFRONT_THEMES,
  STOREFRONT_SLUGS,
  type StorefrontSlug,
} from "@/components/theme/storefront-tokens";

export interface StorefrontSwitcherProps {
  currentStorefront: StorefrontSlug;
  className?: string;
}

/** Links to the three storefront homepages without changing route preference behavior. */
export function StorefrontSwitcher({
  currentStorefront,
  className = "",
}: StorefrontSwitcherProps) {
  return (
    <nav
      aria-label="Storefront Switcher"
      className={`grid w-full max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 ${className}`.trim()}
    >
      {STOREFRONT_SLUGS.map((slug) => {
        const theme = STOREFRONT_THEMES[slug];
        const isCurrent = currentStorefront === slug;

        return (
          <Link
            key={slug}
            href={`/${slug}`}
            prefetch={false}
            aria-current={isCurrent ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center rounded-md border px-4 py-2 text-center font-sans transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 ${
              isCurrent
                ? "border-[var(--color-storefront-contrast)] bg-[var(--color-storefront-contrast)] text-white"
                : "border-border bg-surface text-ink hover:border-[var(--color-storefront-contrast)] hover:bg-surface-soft"
            }`}
          >
            <span className="text-sm font-semibold leading-tight">{theme.name}</span>
            <span
              className={`mt-0.5 text-xs leading-tight ${isCurrent ? "text-white" : "text-text-muted"}`}
            >
              {theme.ageRange}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
