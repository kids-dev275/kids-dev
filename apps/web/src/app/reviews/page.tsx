import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchPublicSettings, fetchPublicReviews, fetchEligibleProductsForReview } from "@/lib/api";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";
import { PageContainer } from "@/components/layout/page-container";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewSubmissionForm } from "@/components/reviews/review-submission-form";
import { MessageSquareQuote, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Reviews — Kids Wear",
  description: "Read genuine customer reviews and feedback on Kids Wear children's apparel.",
  alternates: {
    canonical: "/reviews",
  },
};

interface ReviewsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const { page: rawPage } = await searchParams;
  const currentPage = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;

  const [settings, reviewsData, eligibleProducts] = await Promise.all([
    fetchPublicSettings(),
    fetchPublicReviews({ page: currentPage, limit: 10 }),
    fetchEligibleProductsForReview(),
  ]);

  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <PageContainer className="py-8 sm:py-12">
        {/* Header */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-sans font-semibold tracking-wide uppercase text-accent-storefront bg-surface-soft border border-border mb-3">
            Customer Community
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
            Customer Reviews
          </h1>
          <p className="font-sans text-sm sm:text-base text-text-muted mt-2 leading-relaxed">
            Authentic experiences from families across Pakistan. Read genuine thoughts on our fit,
            craftsmanship, and fabric comfort.
          </p>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Review Form */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <ReviewSubmissionForm products={eligibleProducts} />
          </div>

          {/* Right Column: Published Reviews */}
          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-editorial text-2xl text-ink font-normal">Approved Reviews</h2>
              {pagination && (
                <span className="font-sans text-xs text-text-muted font-medium">
                  {pagination.totalReviews} {pagination.totalReviews === 1 ? "Review" : "Reviews"}
                </span>
              )}
            </div>

            {reviews.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border bg-surface-soft/60 p-10 text-center space-y-3"
                data-testid="no-reviews-state"
              >
                <div className="h-12 w-12 rounded-full bg-surface border border-border text-accent-storefront flex items-center justify-center mx-auto mb-2 shadow-subtle">
                  <MessageSquareQuote className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-editorial text-lg text-ink font-normal">
                  No Reviews Published Yet
                </h3>
                <p className="font-sans text-xs sm:text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
                  Be the first to share your experience with our collection! Submitted reviews are
                  published after moderation.
                </p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="reviews-list">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                  <nav
                    aria-label="Review pagination"
                    className="flex items-center justify-between pt-6 border-t border-border mt-8"
                  >
                    <div>
                      {pagination.hasPrevPage ? (
                        <Link
                          href={`/reviews?page=${currentPage - 1}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-ink bg-surface border border-border rounded-md hover:bg-surface-soft transition-colors"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Previous</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-text-muted/50 cursor-not-allowed">
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Previous</span>
                        </span>
                      )}
                    </div>

                    <span className="font-sans text-xs text-text-muted">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <div>
                      {pagination.hasNextPage ? (
                        <Link
                          href={`/reviews?page=${currentPage + 1}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-ink bg-surface border border-border rounded-md hover:bg-surface-soft transition-colors"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-text-muted/50 cursor-not-allowed">
                          <span>Next</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </nav>
                )}
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </SharedStorefrontShell>
  );
}
