"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, AlertCircle } from "lucide-react";
import { formatPKR } from "@/components/commerce/price";

export interface CartSummaryProps {
  subtotal: string;
  deliveryCharge: string;
  total: string;
  hasInvalidItems: boolean;
  isValidating: boolean;
  itemCount: number;
}

export function CartSummary({
  subtotal,
  deliveryCharge,
  total,
  hasInvalidItems,
  isValidating,
  itemCount,
}: CartSummaryProps) {
  const isCheckoutDisabled = itemCount === 0 || hasInvalidItems || isValidating;

  return (
    <div
      data-testid="cart-summary"
      className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6"
    >
      <h3 className="font-editorial text-xl text-ink font-normal tracking-tight pb-3 border-b border-border">
        Order Summary
      </h3>

      <div className="space-y-3 text-sm font-sans">
        <div className="flex items-center justify-between text-text-muted">
          <span>Subtotal</span>
          <span className="font-medium text-ink">{formatPKR(subtotal, true)}</span>
        </div>

        <div className="flex items-center justify-between text-text-muted">
          <div className="flex items-center gap-1.5">
            <span>Delivery</span>
            <span className="text-[11px] text-text-muted/80">(Flat Rate)</span>
          </div>
          <span className="font-medium text-ink">
            {parseFloat(deliveryCharge) > 0 ? formatPKR(deliveryCharge, true) : "Free"}
          </span>
        </div>

        <div className="pt-3 border-t border-border flex items-baseline justify-between">
          <span className="font-semibold text-base text-ink">Estimated Total</span>
          <span className="font-editorial text-2xl text-ink font-normal tracking-tight">
            {formatPKR(total, true)}
          </span>
        </div>
      </div>

      {/* Fulfillment Details */}
      <div className="rounded-lg bg-surface-soft p-3.5 space-y-2 text-xs font-sans text-text-muted border border-border/50">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-accent-storefront shrink-0" aria-hidden="true" />
          <span>Delivery across Pakistan within 10 days</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-storefront shrink-0" aria-hidden="true" />
          <span>Cash on Delivery & Manual Bank Transfer accepted</span>
        </div>
      </div>

      {/* Checkout CTA Boundary */}
      <div className="space-y-2 pt-2">
        {isCheckoutDisabled ? (
          <button
            type="button"
            disabled
            className="w-full min-h-[48px] px-6 py-3 rounded-lg font-sans text-sm font-semibold tracking-wide bg-surface-soft text-text-muted border border-border cursor-not-allowed flex items-center justify-center gap-2"
            aria-disabled="true"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Link
            href="/checkout"
            className="w-full min-h-[48px] px-6 py-3 rounded-lg font-sans text-sm font-semibold tracking-wide bg-ink text-white hover:bg-ink/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 shadow-subtle cursor-pointer"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}

        {hasInvalidItems && (
          <p className="text-xs font-sans text-amber-800 dark:text-amber-300 flex items-center gap-1.5 pt-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Please remove unavailable items before proceeding to checkout.</span>
          </p>
        )}
      </div>
    </div>
  );
}
