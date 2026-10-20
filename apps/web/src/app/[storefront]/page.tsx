import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  STOREFRONT_THEMES,
  StorefrontSlug,
  isValidStorefrontSlug,
} from "@/components/theme/storefront-tokens";
import {
  fetchPublicSettings,
  fetchStorefront,
  fetchStorefrontProducts,
  fetchPublicReviews,
} from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PageContainer } from "@/components/layout/page-container";
import { HeroSlider } from "@/components/home/hero-slider";
import { ShopByAge } from "@/components/home/shop-by-age";
import { NewArrivalsSection } from "@/components/home/new-arrivals-section";
import { EditorialBrandSection } from "@/components/home/editorial-brand-section";
import { WhyKidsWear } from "@/components/home/why-kids-wear";
import { ReviewsPreview } from "@/components/home/reviews-preview";
import { ContactSection } from "@/components/home/contact-section";

interface StorefrontPageProps {
  params: Promise<{ storefront: string }>;
}

/**
 * Storefront homepages consume live Admin-managed state (announcements, hero slides,
 * new arrival products, dynamic flat delivery charge).
 * Request-time dynamic rendering ensures changes reflect immediately without redeployment.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const { storefront } = await params;
  if (!isValidStorefrontSlug(storefront)) {
    return {
      title: "Storefront Not Found — Kids Wear",
    };
  }

  const theme = STOREFRONT_THEMES[storefront];
  return {
    title: `${theme.name} (${theme.ageRange})`,
    description: `Apparel for ${theme.ageRange} in ${theme.name}. Delivered across Pakistan within 10 days.`,
    alternates: {
      canonical: `/${storefront}`,
    },
  };
}

/**
 * Shared Storefront Homepage implementation.
 * Driven by storefront slug parameter with server-side request-time data fetching for settings,
 * active hero slides, and new arrival previews.
 */
export default async function StorefrontHomePage({ params }: StorefrontPageProps) {
  const { storefront } = await params;

  if (!isValidStorefrontSlug(storefront)) {
    notFound();
  }

  // Parallel server-side fetching
  const [settings, storefrontData, newArrivals, reviewsData] = await Promise.all([
    fetchPublicSettings(),
    fetchStorefront(storefront),
    fetchStorefrontProducts(storefront, { isNewArrival: true, limit: 4 }),
    fetchPublicReviews({ storefrontSlug: storefront, limit: 3 }),
  ]);

  // If all public backend services are unreachable, trigger the customer-safe error boundary
  // rather than rendering an empty skeleton without diagnostics.
  if (settings === null && storefrontData === null && newArrivals === null) {
    console.error(
      `[Storefront Outage] All public backend endpoints failed for storefront "${storefront}".`
    );
    throw new Error("Storefront services currently unavailable");
  }

  const theme = STOREFRONT_THEMES[storefront as StorefrontSlug];
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";
  const siteUrl =
    rawSiteUrl && rawSiteUrl !== "undefined"
      ? rawSiteUrl.replace(/\/$/, "")
      : !isProd
        ? "http://localhost:3000"
        : undefined;

  const storefrontJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${theme.name} (${theme.ageRange})`,
    description: `Apparel for ${theme.ageRange} in ${theme.name}. Delivered across Pakistan within 10 days.`,
    ...(siteUrl ? { url: `${siteUrl}/${storefront}` } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "Kids Wear",
      ...(siteUrl ? { url: siteUrl } : {}),
    },
  };

  return (
    <StorefrontShell
      storefront={storefront as StorefrontSlug}
      announcement={settings?.announcement}
    >
      {/* JSON-LD CollectionPage Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storefrontJsonLd) }}
      />

      {/* 1. Hero Slider */}
      <HeroSlider storefront={storefront as StorefrontSlug} slides={storefrontData?.heroSlides} />

      <PageContainer>
        {/* 2. Shop by Age / Cross-Storefront Discovery */}
        <ShopByAge currentStorefront={storefront as StorefrontSlug} />

        {/* 3. New Arrivals / Product Preview */}
        <NewArrivalsSection
          storefront={storefront as StorefrontSlug}
          products={newArrivals?.items}
        />

        {/* 4. Editorial Storytelling Banner */}
        <EditorialBrandSection storefront={storefront as StorefrontSlug} />

        {/* 5. Why Kids Wear / Logistics Standards */}
        <WhyKidsWear flatDeliveryCharge={settings?.shipping?.flatDeliveryCharge} />

        {/* 6. Reviews Preview Placeholder / Live Reviews */}
        <ReviewsPreview reviews={reviewsData?.reviews} />

        {/* 7. Contact / Studio Channels */}
        <ContactSection />
      </PageContainer>
    </StorefrontShell>
  );
}
