"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/commerce/system-states";
import { Button } from "@/components/ui/button";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error locally without exposing sensitive details
    console.error("Storefront runtime error:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-16">
      <PageContainer>
        <div className="max-w-md mx-auto space-y-6 text-center">
          <ErrorState
            title="Storefront Unavailable"
            description="We were unable to load the storefront catalog at this moment. Please check your connection and try again."
            onRetry={reset}
          />
          <div className="pt-2">
            <Button variant="ghost" href="/">
              Return to Root Gateway
            </Button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
