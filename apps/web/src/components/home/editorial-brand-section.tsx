import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";
import { Section } from "@/components/layout/section";

export interface EditorialBrandSectionProps {
  storefront: StorefrontSlug;
  className?: string;
}

/**
 * EditorialBrandSection provides a brand storytelling feature banner.
 * Editorial storytelling section presenting Kids Wear apparel; not a discounts or promotion engine.
 */
export function EditorialBrandSection({ storefront, className = "" }: EditorialBrandSectionProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];

  return (
    <Section spacing="md" className={className}>
      <div className="relative overflow-hidden rounded-2xl bg-surface border border-border p-8 sm:p-12 lg:p-16 shadow-subtle">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-soft border border-border text-xs font-sans font-semibold text-accent-storefront">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kids Wear</span>
          </div>

          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-ink font-normal tracking-tight leading-tight">
            Apparel for Each Age Group
          </h2>

          <p className="font-sans text-sm sm:text-base text-text-base/80 leading-relaxed">
            Kids Wear provides apparel for different age groups across three age-based storefronts.
            Orders are delivered across Pakistan within 10 days with Cash on Delivery and manual
            bank transfer support.
          </p>

          <div className="pt-2">
            <Link
              href={`/${storefront}/shop`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-sans font-semibold text-white bg-accent-storefront hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-storefront shadow-subtle"
            >
              <span>Explore {currentTheme.name}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
