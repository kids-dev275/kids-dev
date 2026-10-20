import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Truck, ShieldCheck } from "lucide-react";
import {
  STOREFRONT_THEMES,
  StorefrontSlug,
  isValidStorefrontSlug,
} from "@/components/theme/storefront-tokens";
import { fetchPublicSettings, fetchStorefrontProduct } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/pdp/breadcrumbs";
import { ProductMediaGallery } from "@/components/pdp/product-media-gallery";
import { ProductPurchaseConfigurator } from "@/components/pdp/product-purchase-configurator";
import { SizeGuideModal } from "@/components/pdp/size-guide-modal";
import { ProductMetadataSections } from "@/components/pdp/product-metadata-sections";
import { ProductReviewsSection } from "@/components/pdp/product-reviews-section";
import { Price, formatPKR } from "@/components/commerce/price";

interface PDPPageProps {
  params: Promise<{ storefront: string; slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PDPPageProps): Promise<Metadata> {
  const { storefront, slug } = await params;
  if (!isValidStorefrontSlug(storefront)) {
    return { title: "Storefront Not Found — Kids Wear" };
  }

  const theme = STOREFRONT_THEMES[storefront];
  const product = await fetchStorefrontProduct(storefront, slug);

  if (!product) {
    return { title: `Product Not Found — ${theme.name} — Kids Wear` };
  }

  const title = product.seoTitle || `${product.name} — ${theme.name}`;
  const description =
    product.seoDescription || product.shortDescription || product.description.slice(0, 160);

  return {
    title,
    description,
    alternates: {
      canonical: `/${storefront}/products/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: product.media.length > 0 ? [{ url: product.media[0].url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.media.length > 0 ? [product.media[0].url] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: PDPPageProps) {
  const { storefront, slug } = await params;

  if (!isValidStorefrontSlug(storefront)) {
    notFound();
  }

  const validSlug = storefront as StorefrontSlug;
  const theme = STOREFRONT_THEMES[validSlug];

  const [settings, product] = await Promise.all([
    fetchPublicSettings(),
    fetchStorefrontProduct(validSlug, slug),
  ]);

  if (!product) {
    notFound();
  }

  const deliveryCharge = settings?.shipping.flatDeliveryCharge
    ? formatPKR(settings.shipping.flatDeliveryCharge)
    : null;

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";
  const siteUrl =
    rawSiteUrl && rawSiteUrl !== "undefined"
      ? rawSiteUrl.replace(/\/$/, "")
      : !isProd
        ? "http://localhost:3000"
        : undefined;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description,
    image: product.media.map((m) => m.url),
    ...(siteUrl ? { url: `${siteUrl}/${validSlug}/products/${slug}` } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.regularPrice,
      availability: product.variants.some((v) => v.isAvailable)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      ...(siteUrl ? { url: `${siteUrl}/${validSlug}/products/${slug}` } : {}),
    },
  };

  return (
    <StorefrontShell storefront={validSlug} announcement={settings?.announcement}>
      {/* JSON-LD Product Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <PageContainer className="py-6 sm:py-10">
        <Breadcrumbs storefront={validSlug} productName={product.name} />

        {/* Desktop 2-column layout; Mobile single column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mt-4 items-start">
          {/* Left Column: Media Gallery */}
          <div className="lg:col-span-7">
            <ProductMediaGallery media={product.media} productName={product.name} />
          </div>

          {/* Right Column: Product Information & Purchase Configurator */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <div>
              <span
                className="inline-block px-2.5 py-0.5 rounded-full text-xs font-sans font-semibold text-white tracking-wide mb-3"
                style={{ backgroundColor: theme.primaryAccent }}
              >
                {theme.name} ({theme.ageRange})
              </span>

              <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
                {product.name}
              </h1>

              <div className="mt-3">
                <Price
                  price={product.regularPrice}
                  compareAtPrice={product.compareAtPrice}
                  size="lg"
                />
              </div>

              {product.shortDescription && (
                <p className="font-sans text-sm text-text-muted mt-3 leading-relaxed">
                  {product.shortDescription}
                </p>
              )}
            </div>

            {/* Factual Fulfillment Note */}
            <div className="rounded-lg bg-surface-soft border border-border p-3.5 space-y-2 text-xs font-sans text-text-muted">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-accent-storefront shrink-0" aria-hidden="true" />
                <span>
                  Delivery across Pakistan within 10 days
                  {deliveryCharge ? ` (${deliveryCharge} flat rate)` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-accent-storefront shrink-0"
                  aria-hidden="true"
                />
                <span>Cash on Delivery & Manual Bank Transfer accepted</span>
              </div>
            </div>

            {/* Size Guide Trigger if available */}
            {product.sizeGuide && (
              <div className="flex justify-end -mb-2">
                <SizeGuideModal sizeGuide={product.sizeGuide} productName={product.name} />
              </div>
            )}

            {/* Options, Availability & Quantity Configurator */}
            <ProductPurchaseConfigurator
              productId={product.id}
              productSlug={product.slug}
              storefrontSlug={validSlug}
              productPrice={product.regularPrice}
              mainImageUrl={product.media.find((m) => m.isMain)?.url || null}
              sizes={product.sizes}
              colors={product.colors}
              variants={product.variants}
              productName={product.name}
            />
          </div>
        </div>

        {/* Detailed Metadata Sections (Details, Material & Care) */}
        <ProductMetadataSections product={product} className="mt-12" />

        {/* Customer Reviews Section */}
        <ProductReviewsSection
          productId={product.id}
          productName={product.name}
          className="mt-12"
        />
      </PageContainer>
    </StorefrontShell>
  );
}
