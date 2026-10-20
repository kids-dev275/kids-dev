import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-subtle space-y-6">
        <span className="inline-block px-3 py-1 rounded-full bg-surface-soft border border-border text-xs font-sans font-semibold text-text-muted">
          404 &bull; Page Not Found
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
          Page Not Found
        </h1>
        <p className="font-sans text-sm text-text-base/80 leading-relaxed">
          The requested page or storefront could not be located. You may return to the Kids Wear
          home gateway or explore one of our three age-based storefronts below.
        </p>

        {/* Primary Navigation Options */}
        <div className="pt-2 flex flex-col gap-2.5">
          <Button variant="primary" href="/" className="w-full">
            Return to Home Gateway
          </Button>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <Link
              href="/mini-sprouts"
              className="px-2 py-2 text-xs font-sans font-semibold text-ink bg-surface-soft hover:bg-surface border border-border rounded-md transition-colors text-center"
            >
              Mini Sprouts
            </Link>
            <Link
              href="/teen-studio"
              className="px-2 py-2 text-xs font-sans font-semibold text-ink bg-surface-soft hover:bg-surface border border-border rounded-md transition-colors text-center"
            >
              Teen Studio
            </Link>
            <Link
              href="/aura-studio"
              className="px-2 py-2 text-xs font-sans font-semibold text-ink bg-surface-soft hover:bg-surface border border-border rounded-md transition-colors text-center"
            >
              Aura Studio
            </Link>
          </div>
        </div>

        {/* Informational Policy Links */}
        <div className="pt-4 border-t border-border flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <Link href="/about" className="hover:text-accent-storefront underline">
            About
          </Link>
          <Link href="/contact" className="hover:text-accent-storefront underline">
            Contact
          </Link>
          <Link href="/shipping-policy" className="hover:text-accent-storefront underline">
            Shipping Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
