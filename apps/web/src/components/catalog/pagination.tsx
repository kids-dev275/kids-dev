import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && key !== "page") {
        params.set(key, value);
      }
    }
    params.set("page", String(page));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`flex items-center justify-center gap-4 py-8 ${className}`.trim()}
    >
      {hasPrev ? (
        <Link
          href={buildPageHref(currentPage - 1)}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-sans font-medium rounded-md border border-border bg-surface text-ink hover:border-accent-storefront hover:text-accent-storefront transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Previous</span>
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-sans font-medium rounded-md border border-border bg-surface-soft text-text-muted cursor-not-allowed opacity-60"
          aria-disabled="true"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Previous</span>
        </span>
      )}

      <span className="font-sans text-sm text-text-muted px-2" aria-current="page">
        Page <span className="font-semibold text-ink">{currentPage}</span> of{" "}
        <span className="font-semibold text-ink">{totalPages}</span>
      </span>

      {hasNext ? (
        <Link
          href={buildPageHref(currentPage + 1)}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-sans font-medium rounded-md border border-border bg-surface text-ink hover:border-accent-storefront hover:text-accent-storefront transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
          aria-label="Go to next page"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-sans font-medium rounded-md border border-border bg-surface-soft text-text-muted cursor-not-allowed opacity-60"
          aria-disabled="true"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
