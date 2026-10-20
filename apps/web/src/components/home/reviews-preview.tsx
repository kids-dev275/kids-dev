import React from "react";
import Link from "next/link";
import { MessageSquareHeart, ExternalLink } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/section";
import { ReviewCard } from "@/components/reviews/review-card";
import type { PublicReviewItem } from "@/lib/api";

export interface ReviewsPreviewProps {
  reviews?: PublicReviewItem[];
  className?: string;
}

/**
 * ReviewsPreview renders customer reviews on the storefront homepage.
 * When approved reviews exist, it displays genuine customer feedback.
 * When no approved reviews exist yet, it displays an honest placeholder without fabricating ratings.
 */
export function ReviewsPreview({ reviews = [], className = "" }: ReviewsPreviewProps) {
  const hasReviews = reviews && reviews.length > 0;

  return (
    <Section spacing="md" id="reviews" className={className}>
      <SectionHeader
        kicker="Customer Reviews"
        title="Customer Feedback"
        description="Authentic feedback from families dressing their children in Kids Wear."
      />

      {hasReviews ? (
        <div className="space-y-6">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="homepage-reviews-grid"
          >
            {reviews.slice(0, 3).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          <div className="text-center pt-2">
            <Link
              href="/reviews"
              className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-accent-storefront hover:underline"
              data-testid="homepage-view-all-reviews"
            >
              <span>Explore All Community Reviews</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        /* Customer Reviews Placeholder Boundary */
        <div className="rounded-xl border border-dashed border-border bg-surface-soft/60 p-8 sm:p-12 text-center max-w-3xl mx-auto">
          <div className="h-12 w-12 rounded-full bg-surface border border-border text-accent-storefront flex items-center justify-center mx-auto mb-4 shadow-subtle">
            <MessageSquareHeart className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="font-editorial text-xl sm:text-2xl text-ink font-normal mb-2">
            No Customer Reviews Yet
          </h3>
          <p className="font-sans text-xs sm:text-sm text-text-base/80 max-w-md mx-auto leading-relaxed">
            Customer reviews and celebration snapshots will be published here as they are received.
          </p>
        </div>
      )}
    </Section>
  );
}
