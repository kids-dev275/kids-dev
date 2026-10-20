import React from "react";
import Link from "next/link";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";
import { Section, SectionHeader } from "@/components/layout/section";
import { ArrowUpRight } from "lucide-react";

export interface ShopByAgeProps {
  currentStorefront: StorefrontSlug;
  className?: string;
}

const STOREFRONT_SLUGS: StorefrontSlug[] = ["mini-sprouts", "teen-studio", "aura-studio"];

/**
 * ShopByAge provides a compact cross-storefront discovery section on each storefront homepage,
 * allowing customers to understand the 3 generational studios and navigate between them.
 */
export function ShopByAge({ currentStorefront, className = "" }: ShopByAgeProps) {
  return (
    <Section spacing="md" className={className}>
      <SectionHeader
        kicker="Storefronts"
        title="Explore by Age"
        description="Explore Kids Wear apparel designed for each age group."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STOREFRONT_SLUGS.map((slug) => {
          const theme = STOREFRONT_THEMES[slug];
          const isCurrent = currentStorefront === slug;

          return (
            <Link
              key={slug}
              href={`/${slug}`}
              className={`group relative flex flex-col justify-between p-6 rounded-lg border bg-surface transition-all duration-200 shadow-subtle ${
                isCurrent
                  ? "border-accent-storefront ring-1 ring-accent-storefront"
                  : "border-border hover:border-accent-storefront/60"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-sans font-semibold text-white tracking-wide"
                    style={{ backgroundColor: theme.primaryAccent }}
                  >
                    {theme.ageRange}
                  </span>
                  {isCurrent ? (
                    <span className="text-xs font-sans font-medium text-accent-storefront">
                      Current Storefront
                    </span>
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-text-muted group-hover:text-ink transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  )}
                </div>

                <h3 className="font-editorial text-xl sm:text-2xl text-ink font-normal">
                  {theme.name}
                </h3>
                <p className="font-sans text-xs text-text-muted mt-1">
                  Apparel for {theme.ageRange}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs font-sans font-semibold text-ink group-hover:text-accent-storefront">
                <span>{isCurrent ? `Viewing ${theme.name}` : `Switch to ${theme.name}`}</span>
                <span aria-hidden="true">&rarr;</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
