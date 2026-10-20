import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export const metadata: Metadata = {
  title: "Kids Wear",
  description:
    "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.",
  alternates: {
    canonical: "/",
  },
};

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const isProd = process.env.NODE_ENV === "production";
const siteUrl =
  rawSiteUrl && rawSiteUrl !== "undefined"
    ? rawSiteUrl.replace(/\/$/, "")
    : !isProd
      ? "http://localhost:3000"
      : undefined;

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kids Wear",
  description:
    "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.",
  ...(siteUrl ? { url: siteUrl } : {}),
  email: "info@thekidswear.com",
  telephone: "+92 335 0981 321",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Street-05, Darul Islam Colony",
    addressLocality: "Attock",
    addressRegion: "Punjab",
    addressCountry: "PK",
  },
  areaServed: {
    "@type": "Country",
    name: "Pakistan",
  },
};

interface GatewayPanelData {
  slug: StorefrontSlug;
  subtitle: string;
  description: string;
  accentBg: string;
  borderColor: string;
}

const GATEWAY_PANELS: GatewayPanelData[] = [
  {
    slug: "mini-sprouts",
    subtitle: "0–10 Years",
    description: "Explore Kids Wear apparel for ages 0–10.",
    accentBg: "hover:border-[#C7656C] focus-visible:ring-[#C7656C]",
    borderColor: "border-[#C7656C]/30",
  },
  {
    slug: "teen-studio",
    subtitle: "11–16 Years",
    description: "Explore Kids Wear apparel for ages 11–16.",
    accentBg: "hover:border-[#875985] focus-visible:ring-[#875985]",
    borderColor: "border-[#875985]/30",
  },
  {
    slug: "aura-studio",
    subtitle: "17+ Years",
    description: "Explore Kids Wear apparel for ages 17 and above.",
    accentBg: "hover:border-[#8B6B50] focus-visible:ring-[#8B6B50]",
    borderColor: "border-[#8B6B50]/30",
  },
];

export default function GatewayPage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between selection:bg-champagne/30">
      {/* Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-white focus:rounded focus:ring-2 focus:ring-ink"
      >
        Skip to main content
      </a>

      {/* JSON-LD Organization Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* Brand Header */}
      <header className="pt-8 sm:pt-12 pb-6 px-4 sm:px-8 text-center max-w-4xl mx-auto">
        <span className="inline-block text-xs uppercase tracking-[0.25em] font-sans font-semibold text-text-muted mb-3">
          Three Age-Based Storefronts
        </span>
        <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl text-ink font-normal tracking-tight">
          Kids Wear
        </h1>
        <p className="mt-3 font-sans text-sm sm:text-base text-text-base/80 max-w-xl mx-auto leading-relaxed">
          Select a storefront to explore Kids Wear apparel designed for each age group, delivered
          across Pakistan within 10 days.
        </p>
      </header>

      {/* 3-Column Editorial Gateway Panels */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 h-full">
          {GATEWAY_PANELS.map((panel) => {
            const theme = STOREFRONT_THEMES[panel.slug];
            return (
              <Link
                key={panel.slug}
                href={`/${panel.slug}`}
                data-storefront={panel.slug}
                className={`group relative flex flex-col justify-between rounded-xl p-8 bg-surface border transition-all duration-200 shadow-subtle ${panel.borderColor} ${panel.accentBg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
              >
                {/* Top Badge & Age Info */}
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-sans font-semibold text-white tracking-wide"
                      style={{ backgroundColor: theme.primaryAccent }}
                    >
                      {theme.ageRange}
                    </span>
                    <span className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-text-muted group-hover:text-ink transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h2 className="font-editorial text-2xl sm:text-3xl text-ink group-hover:text-ink/90 font-normal">
                    {theme.name}
                  </h2>
                  <p className="font-sans text-xs uppercase tracking-wider text-text-muted mt-1 font-medium">
                    {panel.subtitle}
                  </p>

                  {/* Description */}
                  <p className="font-sans text-sm text-text-base/80 mt-4 leading-relaxed">
                    {panel.description}
                  </p>
                </div>

                {/* Bottom Call to Action */}
                <div className="pt-8 border-t border-border/60 mt-8">
                  <div className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-ink group-hover:underline">
                    <span>Explore {theme.name}</span>
                    <span aria-hidden="true">&rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Gateway Trust Footer */}
      <footer className="py-8 px-4 text-center border-t border-border/50 bg-surface/50 mt-12">
        <p className="font-sans text-xs text-text-muted">
          Pakistan-Wide Delivery &bull; Delivery Within 10 Days &bull; Cash on Delivery & Manual
          Bank Transfer
        </p>
      </footer>
    </div>
  );
}
