"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { ApiCartValidatedItem } from "@/lib/api";
import { formatPKR } from "@/components/commerce/price";
import {
  STOREFRONT_THEMES,
  StorefrontSlug,
  isValidStorefrontSlug,
} from "@/components/theme/storefront-tokens";

export interface CartLineItemProps {
  item: ApiCartValidatedItem;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
}

export function CartLineItem({ item, onQuantityChange, onRemove }: CartLineItemProps) {
  const storefrontSlug = item.product.storefrontSlug;
  const theme = isValidStorefrontSlug(storefrontSlug)
    ? STOREFRONT_THEMES[storefrontSlug as StorefrontSlug]
    : null;

  return (
    <div
      data-testid={`cart-line-${item.variantId}`}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface shadow-subtle transition-all"
    >
      {/* Product Image & Main Details */}
      <div className="flex items-start gap-4 flex-1">
        {/* Product Media Thumbnail */}
        <Link
          href={`/${storefrontSlug}/products/${item.product.slug}`}
          className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-surface-soft border border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
        >
          {item.product.mainImage?.url ? (
            <Image
              src={item.product.mainImage.url}
              alt={item.product.mainImage.altText || item.product.name}
              fill
              className="object-cover object-top transition-transform hover:scale-105"
              sizes="(max-width: 640px) 80px, 96px"
              unoptimized
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs font-sans text-text-muted">
              No Image
            </div>
          )}
        </Link>

        {/* Product Meta */}
        <div className="space-y-1.5 flex-1 min-w-0">
          {/* Storefront indicator */}
          {theme && (
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold tracking-wide text-white uppercase"
              style={{ backgroundColor: theme.primaryAccent }}
            >
              {theme.name}
            </span>
          )}

          {/* Product Name Link */}
          <h4 className="font-editorial text-base sm:text-lg text-ink font-normal tracking-tight line-clamp-1">
            <Link
              href={`/${storefrontSlug}/products/${item.product.slug}`}
              className="hover:text-accent-storefront transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-storefront rounded"
            >
              {item.product.name}
            </Link>
          </h4>

          {/* Selected Variant Options */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-sans text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="font-medium text-ink">Size:</span> {item.variant.size}
            </span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-medium text-ink">Color:</span> {item.variant.color}
            </span>
          </div>

          {/* Authoritative Unit Price */}
          <div className="text-xs font-sans tabular-nums text-text-muted pt-0.5">
            Unit Price:{" "}
            <span className="font-semibold text-ink">{formatPKR(item.unitPrice, true)}</span>
          </div>
        </div>
      </div>

      {/* Stepper, Subtotal & Remove Controls */}
      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
        {/* Quantity Stepper (1–10 bound) */}
        <div className="inline-flex items-center rounded-md border border-border bg-surface-soft shadow-xs">
          <button
            type="button"
            onClick={() => onQuantityChange(item.variantId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label={`Decrease quantity of ${item.product.name}`}
            className="px-2.5 py-1.5 text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded-l-md"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span
            className="w-8 text-center text-xs font-sans font-semibold text-ink select-none"
            aria-live="polite"
            aria-label={`Quantity: ${item.quantity}`}
          >
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange(item.variantId, item.quantity + 1)}
            disabled={item.quantity >= 10}
            aria-label={`Increase quantity of ${item.product.name}`}
            className="px-2.5 py-1.5 text-ink hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded-r-md"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Line Subtotal */}
        <div className="text-right sm:min-w-[90px]">
          <span className="block text-xs font-sans text-text-muted sm:hidden">Subtotal:</span>
          <span className="font-sans tabular-nums text-sm sm:text-base font-semibold text-ink tracking-tight">
            {formatPKR(item.lineSubtotal, true)}
          </span>
        </div>

        {/* Explicit Remove Action */}
        <button
          type="button"
          onClick={() => onRemove(item.variantId)}
          aria-label={`Remove ${item.product.name} (${item.variant.size}, ${item.variant.color}) from cart`}
          className="min-h-[36px] min-w-[36px] p-2 flex items-center justify-center rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
