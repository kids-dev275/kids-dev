import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import {
  STOREFRONT_THEMES,
  StorefrontSlug,
  isValidStorefrontSlug,
} from "@/components/theme/storefront-tokens";
import { fetchPublicSettings, fetchStorefrontProducts } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PageContainer } from "@/components/layout/page-container";
import { CatalogHeader } from "@/components/catalog/catalog-header";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { Pagination } from "@/components/catalog/pagination";
import { EmptyState, ErrorState } from "@/components/commerce/system-states";
import { Breadcrumbs } from "@/components/pdp/breadcrumbs";

interface ShopPageProps {
  params: Promise<{ storefront: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { storefront } = await params;
  if (!isValidStorefrontSlug(storefront)) {
    return { title: "Storefront Not Found — Kids Wear" };
  }
  const theme = STOREFRONT_THEMES[storefront];
  return {
    title: `Shop All — ${theme.name} (${theme.ageRange})`,
    description: `Complete collection of apparel for ${theme.ageRange} in ${theme.name}. Delivered across Pakistan within 10 days.`,
    alternates: {
      canonical: `/${storefront}/shop`,
    },
  };
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { storefront } = await params;
  const { page: pageParam } = await searchParams;

  if (!isValidStorefrontSlug(storefront)) {
    notFound();
  }

  const validSlug = storefront as StorefrontSlug;
  const theme = STOREFRONT_THEMES[validSlug];

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const [settings, catalogData] = await Promise.all([
    fetchPublicSettings(),
    fetchStorefrontProducts(storefront, { page: currentPage, limit: 12 }),
  ]);

  return (
    <StorefrontShell storefront={validSlug} announcement={settings?.announcement}>
      <PageContainer className="py-6 sm:py-10">
        <Breadcrumbs storefront={validSlug} currentPageTitle="Shop All" />

        <CatalogHeader
          storefront={validSlug}
          title="Shop All"
          description={`Explore Kids Wear apparel designed for ${theme.ageRange}.`}
          totalItems={catalogData?.pagination.totalItems}
        />

        {catalogData === null ? (
          <ErrorState
            title="Unable to load catalog"
            description="We were unable to load the collection at this time. Please check your internet connection or try again shortly."
          />
        ) : catalogData.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10 text-text-muted" aria-hidden="true" />}
            title="No products available"
            description={`There are currently no published products in ${theme.name}. Please check back soon.`}
            action={
              <Link
                href={`/${validSlug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-sans font-semibold text-white bg-accent-storefront hover:opacity-90 transition-opacity"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Return to {theme.name} Home</span>
              </Link>
            }
          />
        ) : (
          <>
            <CatalogGrid products={catalogData.items} storefront={validSlug} />
            <Pagination
              currentPage={currentPage}
              totalPages={catalogData.pagination.totalPages}
              basePath={`/${validSlug}/shop`}
            />
          </>
        )}
      </PageContainer>
    </StorefrontShell>
  );
}
