import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/section";
import { ProductCard } from "@/components/commerce/product-card";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";
import type { ApiProductCard } from "@/lib/api";

export interface NewArrivalsSectionProps {
  products?: ApiProductCard[] | null;
  storefront: StorefrontSlug;
  className?: string;
}

/**
 * NewArrivalsSection displays a curated preview of products marked isNewArrival.
 * Reuses the presentational ProductCard primitive without fabricating products or reviews.
 */
export function NewArrivalsSection({
  products = [],
  storefront,
  className = "",
}: NewArrivalsSectionProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];
  const items = products || [];

  if (items.length === 0) {
    // Tasteful fallback when no new arrival products are currently published
    return null;
  }

  return (
    <Section spacing="md" className={className}>
      <SectionHeader
        kicker="Just Added"
        title={`New Arrivals in ${currentTheme.name}`}
        description={`Latest additions to the ${currentTheme.name} collection.`}
        action={
          <Link
            href={`/${storefront}/new-arrivals`}
            className="inline-flex items-center gap-1.5 text-sm font-sans font-semibold text-accent-storefront hover:underline"
          >
            <span>View All New Arrivals</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.slice(0, 4).map((p) => (
          <ProductCard
            key={p.id}
            name={p.name}
            slug={p.slug}
            regularPrice={p.regularPrice}
            compareAtPrice={p.compareAtPrice}
            isNewArrival={p.isNewArrival}
            storefrontSlug={storefront}
            mainImage={{
              url: p.mainImage.url,
              altText: p.mainImage.altText,
            }}
            hoverImage={
              p.hoverImage
                ? {
                    url: p.hoverImage.url,
                    altText: p.hoverImage.altText,
                  }
                : null
            }
          />
        ))}
      </div>
    </Section>
  );
}
