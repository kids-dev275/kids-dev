import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import {
  STOREFRONT_THEMES,
  StorefrontSlug,
  isValidStorefrontSlug,
} from "@/components/theme/storefront-tokens";
import { fetchPublicSettings, searchStorefrontProducts } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PageContainer } from "@/components/layout/page-container";
import { SearchBar } from "@/components/catalog/search-bar";
import { CatalogHeader } from "@/components/catalog/catalog-header";
import { CatalogGrid } from "@/components/catalog/catalog-grid";
import { Pagination } from "@/components/catalog/pagination";
import { EmptyState, NoResultsState, ErrorState } from "@/components/commerce/system-states";
import { Breadcrumbs } from "@/components/pdp/breadcrumbs";

interface SearchPageProps {
  params: Promise<{ storefront: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { storefront } = await params;
  const { q } = await searchParams;

  if (!isValidStorefrontSlug(storefront)) {
    return { title: "Storefront Not Found — Kids Wear" };
  }
  const theme = STOREFRONT_THEMES[storefront];
  return {
    title: q ? `Search results for "${q}" — ${theme.name}` : `Search — ${theme.name}`,
    description: `Search apparel in ${theme.name} (${theme.ageRange}). Delivered across Pakistan within 10 days.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { storefront } = await params;
  const { q: queryParam, page: pageParam } = await searchParams;

  if (!isValidStorefrontSlug(storefront)) {
    notFound();
  }

  const validSlug = storefront as StorefrontSlug;
  const theme = STOREFRONT_THEMES[validSlug];
  const query = (queryParam || "").trim();
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  // Parallel server-side fetching: only execute search query if query is non-empty
  const [settings, searchResults] = await Promise.all([
    fetchPublicSettings(),
    query.length > 0
      ? searchStorefrontProducts(validSlug, { q: query, page: currentPage, limit: 12 })
      : Promise.resolve(undefined),
  ]);

  return (
    <StorefrontShell storefront={validSlug} announcement={settings?.announcement}>
      <PageContainer className="py-6 sm:py-10">
        <Breadcrumbs storefront={validSlug} currentPageTitle="Search" />

        <div className="mb-8">
          <CatalogHeader
            storefront={validSlug}
            title={query ? `Search: "${query}"` : "Search"}
            description={`Find Kids Wear apparel in ${theme.name} for ${theme.ageRange}.`}
            totalItems={searchResults ? searchResults.pagination.totalItems : undefined}
          />

          <div className="mt-4">
            <SearchBar storefront={validSlug} initialQuery={query} />
          </div>
        </div>

        {/* 1. Prompt state when no query provided */}
        {!query && (
          <EmptyState
            icon={<SearchIcon className="h-10 w-10 text-text-muted" aria-hidden="true" />}
            title={`Search products in ${theme.name}`}
            description="Enter a product name, type, or keyword in the box above to find apparel."
          />
        )}

        {/* 2. Error state when backend search fails */}
        {query && searchResults === null && (
          <ErrorState
            title="Search unavailable"
            description="We were unable to complete your search at this moment. Please check your query or try again shortly."
          />
        )}

        {/* 3. No results state */}
        {query && searchResults && searchResults.items.length === 0 && (
          <NoResultsState query={query} />
        )}

        {/* 4. Results grid */}
        {query && searchResults && searchResults.items.length > 0 && (
          <>
            <CatalogGrid products={searchResults.items} storefront={validSlug} />
            <Pagination
              currentPage={currentPage}
              totalPages={searchResults.pagination.totalPages}
              basePath={`/${validSlug}/search`}
              searchParams={{ q: query }}
            />
          </>
        )}
      </PageContainer>
    </StorefrontShell>
  );
}
