"use client";

import React from "react";
import Image from "next/image";
import { formatPKR } from "@/components/commerce/price";
import type { ApiCartValidatedItem } from "@/lib/api";
import { Truck } from "lucide-react";

export interface CheckoutOrderSummaryProps {
  items: ApiCartValidatedItem[];
  subtotal: string;
  deliveryCharge: string;
  total: string;
  isReviewing?: boolean;
}

export function CheckoutOrderSummary({
  items,
  subtotal,
  deliveryCharge,
  total,
  isReviewing = false,
}: CheckoutOrderSummaryProps) {
  return (
    <div
      data-testid="checkout-order-summary"
      className="p-6 rounded-2xl border border-border bg-surface shadow-subtle space-y-6"
    >
      <div className="pb-3 border-b border-border flex items-baseline justify-between">
        <h3 className="font-editorial text-xl text-ink font-normal tracking-tight">
          Order Summary
        </h3>
        <span className="font-sans text-xs text-text-muted">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Validated Items List */}
      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 divide-y divide-border/60">
        {items.map((item) => (
          <div
            key={item.variantId}
            className="pt-3 first:pt-0 flex items-start gap-3.5"
            data-testid="checkout-summary-item"
          >
            {/* 4:5 Aspect Ratio Thumbnail */}
            <div className="relative w-14 h-[70px] shrink-0 rounded-md overflow-hidden bg-surface-soft border border-border/70">
              {item.product.mainImage?.url ? (
                <Image
                  src={item.product.mainImage.url}
                  alt={item.product.mainImage.altText || item.product.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted font-sans">
                  No Image
                </div>
              )}
            </div>

            {/* Product & Variant Identity */}
            <div className="flex-1 min-w-0 space-y-1">
              <h4 className="font-sans text-xs font-semibold text-ink line-clamp-1">
                {item.product.name}
              </h4>

              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-text-muted font-sans">
                <span>
                  Size: <strong className="font-medium text-ink">{item.variant.size}</strong>
                </span>
                <span>•</span>
                <span>
                  Color: <strong className="font-medium text-ink">{item.variant.color}</strong>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-sans tabular-nums pt-0.5">
                <span className="text-text-muted">
                  Qty: <strong className="font-medium text-ink">{item.quantity}</strong> ×{" "}
                  {formatPKR(item.unitPrice, true)}
                </span>
                <span className="font-semibold text-ink">{formatPKR(item.lineSubtotal, true)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Authoritative Totals */}
      <div className="space-y-3 pt-3 border-t border-border text-sm font-sans tabular-nums">
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
          <span className="font-semibold text-base text-ink">Total</span>
          <span className="font-sans text-lg font-bold text-ink tabular-nums">
            {formatPKR(total, true)}
          </span>
        </div>
      </div>

      {/* Fulfillment Trust Callout */}
      <div className="rounded-lg bg-surface-soft p-3 text-xs font-sans text-text-muted border border-border/50">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-accent-storefront shrink-0" aria-hidden="true" />
          <span>Pakistan-wide delivery within 10 days</span>
        </div>
      </div>
    </div>
  );
}
