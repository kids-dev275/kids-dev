"use client";

import { useState } from "react";
import { ReviewSubmissionForm } from "@/components/reviews/review-submission-form";

export function ProductReviewComposer({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={open ? "product-review-form" : undefined}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--color-storefront-contrast)] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-storefront-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)]"
      >
        {open ? "Close Review Form" : "Write a Review"}
      </button>
      {open && (
        <div id="product-review-form" className="mt-5">
          <ReviewSubmissionForm
            key={productId}
            products={[]}
            preselectedProductId={productId}
            preselectedProductName={productName}
          />
        </div>
      )}
    </div>
  );
}
