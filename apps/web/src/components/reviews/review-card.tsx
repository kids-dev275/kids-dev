import React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { PublicReviewItem } from "@/lib/api";

export interface ReviewCardProps {
  review: PublicReviewItem;
  className?: string;
  showProductLink?: boolean;
}

/**
 * ReviewCard renders an approved/published customer review.
 * Safely renders plain escaped text; never uses dangerouslySetInnerHTML.
 */
export function ReviewCard({ review, className = "", showProductLink = true }: ReviewCardProps) {
  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-PK", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <article
      className={`rounded-xl border border-border bg-surface p-6 shadow-subtle flex flex-col justify-between space-y-4 ${className}`}
      data-testid="review-card"
    >
      <div className="space-y-3">
        {/* Rating & Date */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1 text-accent-gold"
            role="img"
            aria-label={`${review.rating} out of 5 stars`}
          >
            {[1, 2, 3, 4, 5].map((starVal) => (
              <Star
                key={starVal}
                className={`h-4 w-4 ${
                  starVal <= review.rating
                    ? "fill-current text-amber-400"
                    : "text-border fill-transparent"
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">{review.rating} out of 5 stars</span>
          </div>

          {formattedDate && (
            <time dateTime={review.createdAt} className="font-sans text-xs text-text-muted">
              {formattedDate}
            </time>
          )}
        </div>

        {/* Product Attribution */}
        {showProductLink && review.product && (
          <div>
            <Link
              href={`/${review.product.storefrontSlug}/products/${review.product.slug}`}
              className="font-sans text-xs font-semibold text-accent-storefront hover:underline"
            >
              {review.product.name}
            </Link>
          </div>
        )}

        {/* Escaped Review Text */}
        <p className="font-sans text-sm text-ink leading-relaxed whitespace-pre-line">
          {review.reviewText}
        </p>

        {/* Attached Images (0 to 3) */}
        {review.images && review.images.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {review.images.map((img, idx) => (
              <div
                key={idx}
                className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border border-border bg-surface-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.altText || `Review image for ${review.product?.name || "product"}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewer Name */}
      <div className="pt-2 border-t border-border/60">
        <span className="font-sans text-xs font-medium text-text-base">{review.reviewerName}</span>
      </div>
    </article>
  );
}
