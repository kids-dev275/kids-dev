import React from "react";
import Link from "next/link";
import { MessageSquareQuote, ExternalLink } from "lucide-react";
import { fetchPublicReviews } from "@/lib/api";
import { ReviewCard } from "@/components/reviews/review-card";
import { ProductReviewComposer } from "@/components/pdp/product-review-composer";

export interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  className?: string;
}

export async function ProductReviewsSection({
  productId,
  productName,
  className = "",
}: ProductReviewsSectionProps) {
  const reviewsData = await fetchPublicReviews({
    productId,
    limit: 5,
  });

  const reviews = (reviewsData?.reviews || []).filter((review) => review.product.id === productId);
  const reviewCount = reviewsData?.pagination?.totalReviews ?? reviews.length;

  return (
    <section
      id="product-reviews"
      aria-labelledby="product-reviews-heading"
      className={`rounded-xl border border-border bg-surface p-6 sm:p-10 shadow-subtle ${className}`}
      data-testid="product-reviews-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
        <div>
          <h2
            id="product-reviews-heading"
            className="font-editorial text-2xl sm:text-3xl text-ink font-normal tracking-tight"
          >
            Customer Reviews
          </h2>
          <p className="font-sans text-xs sm:text-sm text-text-muted mt-1">
            Genuine experiences with {productName}.
          </p>
          {reviewCount > 0 && (
            <p className="mt-2 text-xs font-semibold text-[var(--color-storefront-contrast)]">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {reviews.length > 0 && <ProductReviewComposer productId={productId} productName={productName} />}
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-accent-storefront hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-storefront"
            data-testid="all-reviews-link"
          >
            <span>Community Reviews</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border bg-surface-soft/60 p-8 text-center space-y-3"
          data-testid="product-no-reviews"
        >
          <div className="h-10 w-10 rounded-full bg-surface border border-border text-accent-storefront flex items-center justify-center mx-auto mb-2 shadow-subtle">
            <MessageSquareQuote className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="font-editorial text-base text-ink font-medium">No Reviews Yet</h3>
          <p className="font-sans text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            Be the first to review {productName}.
          </p>
          <ProductReviewComposer productId={productId} productName={productName} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="product-reviews-list">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} showProductLink={false} />
          ))}
        </div>
      )}
    </section>
  );
}
