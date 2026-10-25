"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/commerce/system-states";
import { isValidStorefrontSlug } from "@/components/theme/storefront-tokens";

export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const storefrontSegment = usePathname().split("/")[1];
  const storefront = isValidStorefrontSlug(storefrontSegment) ? storefrontSegment : undefined;

  return (
    <div data-storefront={storefront} className="min-h-screen bg-canvas flex flex-col justify-center py-16">
      <PageContainer>
        <div className="max-w-md mx-auto space-y-3 text-center">
          <ErrorState
            title="Storefront Unavailable"
            description="We were unable to load the storefront catalog at this moment. Please try again shortly."
            onRetry={reset}
            className="!pb-0"
          />
          <div>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-storefront-contrast)] px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-subtle transition-colors hover:bg-[var(--color-storefront-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)]"
            >
              Return to Gateway
            </Link>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
