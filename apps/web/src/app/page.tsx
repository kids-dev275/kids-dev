import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { StorefrontIdentityIcon } from "@/components/theme/storefront-identity-icon";
import { GatewayCardTrack } from "@/components/gateway/gateway-card-track";

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

interface GatewayCardData {
  slug: "mini-sprouts" | "teen-studio" | "aura-studio";
  title: string;
  age: string;
  link: string;
  image: string;
  imageAlt: string;
  accentColor: string;
  textColor: string;
  panelBg: string;
  objectPosition: string;
}

const GATEWAY_CARDS: GatewayCardData[] = [
  {
    slug: "mini-sprouts",
    title: "Mini Sprouts",
    age: "0–10 Years",
    link: "/mini-sprouts",
    image: "/images/gateway/gateway-mini-sprouts.webp",
    imageAlt: "Children apparel by Mini Sprouts for 0–10 Years",
    accentColor: "#C7656C",
    textColor: "#98454C",
    panelBg: "#FAF0F1",
    objectPosition: "center top",
  },
  {
    slug: "teen-studio",
    title: "Teen Studio",
    age: "11–16 Years",
    link: "/teen-studio",
    image: "/images/gateway/gateway-teen-studio.webp",
    imageAlt: "Teen apparel by Teen Studio for 11–16 Years",
    accentColor: "#875985",
    textColor: "#684266",
    panelBg: "#F5EFF5",
    objectPosition: "center top",
  },
  {
    slug: "aura-studio",
    title: "Aura Studio",
    age: "17+ Years",
    link: "/aura-studio",
    image: "/images/gateway/gateway-aura-studio.webp",
    imageAlt: "Young adult apparel by Aura Studio for 17+ Years",
    accentColor: "#8B6B50",
    textColor: "#674B37",
    panelBg: "#F6EFE8",
    objectPosition: "center top",
  },
];

export default function GatewayPage() {
  return (
    <div className="min-h-screen lg:h-screen lg:max-h-dvh flex flex-col justify-between bg-[#FBF7F2] selection:bg-champagne/30 text-brand-ink lg:overflow-hidden">
      {/* Skip to Main Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-ink focus:text-white focus:rounded focus:ring-2 focus:ring-champagne"
      >
        Skip to main content
      </a>

      {/* JSON-LD Organization Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* Semantic Accessible Heading for Document Outline */}
      <h1 className="sr-only">Kids Wear</h1>

      {/* Centered Gateway Branding */}
      <header className="w-full border-b border-brand-border/60 bg-white/40 backdrop-blur-xs shrink-0">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
          <div className="flex flex-col items-center justify-center text-center">
            <Image
              src="/brand/kids-wear-logo.webp"
              alt="Kids Wear"
              width={150}
              height={98}
              priority
              className="w-[112px] sm:w-[125px] md:w-[138px] lg:w-[148px] h-auto object-contain"
            />
            <p className="font-editorial italic text-[11px] sm:text-xs text-brand-text/80 tracking-wide mt-0.5">
              Little Styles. Brighter Tomorrows.
            </p>
          </div>
        </div>
      </header>

      {/* Main Storefront Cards Area */}
      <main
        id="main-content"
        className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 pb-4 sm:py-4 lg:pt-[14px] lg:pb-5 flex flex-col justify-start items-center min-h-0"
      >
        <div className="mb-5 text-center md:hidden">
          <h2 className="font-editorial text-[23px] leading-tight text-brand-ink">Choose Your Storefront</h2>
          <p className="mt-2 font-sans text-xs leading-relaxed text-brand-muted">Explore styles curated by age and stage.</p>
        </div>
        <GatewayCardTrack indicators={GATEWAY_CARDS.map(({ slug, title, accentColor }) => ({ slug, title, accentColor }))}>
          {GATEWAY_CARDS.map((card) => (
            <Link
              key={card.slug}
              href={card.link}
              prefetch={false}
              data-storefront={card.slug}
              className="group relative flex w-[82vw] shrink-0 snap-center flex-col rounded-[24px] sm:rounded-[28px] overflow-hidden bg-white shadow-subtle hover:shadow-hover border border-brand-border/60 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 h-auto md:w-auto md:shrink md:h-[490px] lg:h-[515px] xl:h-[535px]"
            >
              {/* Upper Image Section (~64%) */}
              <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] md:aspect-auto md:h-[64%] overflow-hidden bg-brand-surface-soft shrink-0">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
                  priority
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  style={{ objectPosition: card.objectPosition }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Distinctive Curved / Arched Lower Panel (~38%) */}
              <div className="relative -mt-5 sm:-mt-5.5 z-10 flex flex-col flex-1">
                {/* SVG Arch curve transition */}
                <div className="w-full overflow-hidden leading-none -mb-[1px]">
                  <svg
                    viewBox="0 0 320 22"
                    fill="none"
                    preserveAspectRatio="none"
                    className="w-full h-5 sm:h-5.5 block"
                    aria-hidden="true"
                  >
                    <path
                      d="M0,22 C80,2 240,2 320,22 L320,22 L0,22 Z"
                      fill={card.panelBg}
                    />
                  </svg>
                </div>

                {/* Panel Body */}
                <div
                  className="flex-1 px-4 sm:px-5 pb-4 sm:pb-5 pt-0.5 flex flex-col items-center text-center justify-between"
                  style={{ backgroundColor: card.panelBg }}
                >
                  <div className="flex flex-col items-center">
                    {/* Decorative Icon */}
                    <div className="mb-1.5 sm:mb-2">
                      <StorefrontIdentityIcon
                        storefront={card.slug}
                        className="w-5 h-5"
                        style={{ color: card.accentColor }}
                      />
                    </div>

                    {/* Storefront Title */}
                    <h2
                      className="font-editorial text-[32px] sm:text-[34px] md:text-[30px] lg:text-[32px] leading-tight font-normal tracking-tight"
                      style={{ color: card.textColor }}
                    >
                      {card.title}
                    </h2>

                    {/* Age Range */}
                    <p
                      className="font-editorial text-[30px] sm:text-[32px] md:text-[28px] lg:text-[30px] leading-tight mt-1"
                      style={{ color: card.textColor }}
                    >
                      {card.age}
                    </p>
                  </div>

                  {/* CTA Button */}
                  <div className="w-full mt-3 sm:mt-4">
                    <span
                      className="w-full min-h-[50px] md:min-h-[44px] inline-flex items-center justify-center gap-2 border bg-transparent py-2 px-4 rounded-md font-sans text-base md:text-sm font-medium tracking-wide transition-colors duration-200 group-hover:bg-white/70 group-active:bg-white focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-offset-2"
                      style={{ borderColor: card.accentColor, color: card.textColor }}
                    >
                      <span>Explore collection</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </GatewayCardTrack>
      </main>

    </div>
  );
}
