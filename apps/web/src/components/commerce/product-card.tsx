"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getOptimizedMediaUrl } from "@kids-wear/shared";
import { Badge } from "../ui/badge";
import { Price } from "./price";
import type { ApiProductCard } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import {
  addProductCardVariant,
  availableQuickAddColors,
  quickAddSizesForColor,
  retainQuickAddSize,
  resolveQuickAddVariant,
} from "@/lib/quick-add";
import { useTransientFeedback } from "@/lib/use-transient-feedback";

export interface ProductCardMediaItem {
  url: string;
  altText?: string | null;
}

export interface ProductCardProps {
  id?: string;
  name: string;
  slug: string;
  regularPrice: string;
  compareAtPrice?: string | null;
  isNewArrival?: boolean;
  mainImage: ProductCardMediaItem;
  hoverImage?: ProductCardMediaItem | null;
  storefrontSlug?: string;
  href?: string;
  className?: string;
  quickAdd?: ApiProductCard["quickAdd"];
}

/**
 * Storefront-aware product card with a 4:5 main image and optional desktop hover image.
 */
export function ProductCard({
  id,
  name,
  slug,
  regularPrice,
  compareAtPrice,
  isNewArrival = false,
  mainImage,
  hoverImage,
  storefrontSlug,
  href,
  className = "",
  quickAdd,
}: ProductCardProps) {
  // Resolve link: custom href takes precedence, otherwise storefront-scoped PDP link
  const productHref =
    href || (storefrontSlug ? `/${storefrontSlug}/products/${slug}` : `/products/${slug}`);

  const mainAlt = mainImage.altText || name;
  const hoverAlt = hoverImage?.altText || `${name} - alternate view`;
  const colors = availableQuickAddColors(quickAdd);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(() =>
    colors.length === 1 ? colors[0].id : null
  );
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [showSizes, setShowSizes] = useState(false);
  const [feedback, setFeedback, feedbackFading] = useTransientFeedback<{
    type: "success" | "error";
    text: string;
  }>();
  const addItem = useCartStore((state) => state.addItem);
  const canQuickAdd = Boolean(id && storefrontSlug && quickAdd && colors.length);
  const sizeChoices = quickAdd && selectedColorId
    ? quickAddSizesForColor(quickAdd, selectedColorId)
    : [];
  const selectedVariant = resolveQuickAddVariant(quickAdd, selectedColorId, selectedSizeId);

  const selectColor = (colorId: string) => {
    setSelectedColorId(colorId);
    setSelectedSizeId(retainQuickAddSize(quickAdd, colorId, selectedSizeId));
    setFeedback(null);
  };

  const handleQuickAdd = () => {
    if (!canQuickAdd || !id || !storefrontSlug) return;
    if (!showSizes || !selectedColorId) {
      setShowSizes(true);
      return;
    }
    if (!selectedVariant) return;
    const result = addProductCardVariant(
      { id, name, slug, regularPrice, mainImage, quickAdd },
      storefrontSlug,
      selectedColorId,
      selectedSizeId,
      addItem
    );
    if (!result) return;
    setFeedback(result.success
      ? { type: "success", text: "Added to cart" }
      : { type: "error", text: result.reason === "MAX_QUANTITY_EXCEEDED"
        ? "Maximum 10 of this size and color per order."
        : "Could not add this item to cart." });
  };

  return (
    <article
      className={`group relative flex w-full max-w-[20rem] flex-col overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-storefront-contrast)]/40 hover:shadow-md focus-within:border-[var(--color-storefront-contrast)] ${className}`.trim()}
    >
      {/* 4:5 Aspect Ratio Image Container */}
      <Link href={productHref} aria-label={`View ${name}`} className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-storefront-contrast)]">
        {/* Main Image */}
        <Image
          src={getOptimizedMediaUrl(mainImage.url, { width: 600, height: 750, crop: "fill" })}
          alt={mainAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover object-center"
        />

        {/* Optional Desktop Hover Image */}
        {hoverImage?.url && (
          <Image
            src={getOptimizedMediaUrl(hoverImage.url, { width: 600, height: 750, crop: "fill" })}
            alt={hoverAlt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="hidden object-cover object-center opacity-0 transition-opacity duration-300 md:block [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"
            aria-hidden="true"
          />
        )}

        {/* New Badge */}
        {isNewArrival && (
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <Badge variant="new" size="sm">
              New
            </Badge>
          </div>
        )}
      </Link>

      {/* Product Details */}
      <div className="flex flex-1 flex-col px-2 pb-3 pt-4">
        <h3 className="line-clamp-2 min-h-10 font-serif text-base font-semibold leading-snug text-ink transition-colors group-hover:text-[var(--color-storefront-contrast)]">
          <Link href={productHref} className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)]">{name}</Link>
        </h3>

        <div className="mt-auto pt-2">
          <Price price={regularPrice} compareAtPrice={compareAtPrice} size="sm" />
        </div>
        {canQuickAdd && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            <div role="group" aria-label={`Available colors for ${name}`}>
              <p className="mb-2 text-xs font-semibold text-text-muted">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((color) => {
                  const selected = color.id === selectedColorId;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => selectColor(color.id)}
                      aria-pressed={selected}
                      className={`min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)] ${selected
                        ? "border-[var(--color-storefront-contrast)] bg-[var(--color-storefront-contrast)] text-white"
                        : "border-border bg-[var(--color-storefront-accent-soft)] text-ink hover:border-[var(--color-storefront-contrast)]"}`}
                    >
                      {selected ? "✓ " : ""}{color.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {showSizes && (
              <div role="group" aria-label={`Choose size for ${name}`}>
                <p className="mb-2 text-xs font-semibold text-text-muted">Choose Size</p>
                <div className="flex flex-wrap gap-1.5">
                  {sizeChoices.map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      disabled={!size.isAvailable}
                      onClick={() => { setSelectedSizeId(size.id); setFeedback(null); }}
                      aria-pressed={size.id === selectedSizeId}
                      className={`min-h-9 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)] ${!size.isAvailable
                        ? "cursor-not-allowed border-border bg-surface-soft text-text-muted opacity-50 line-through"
                        : size.id === selectedSizeId
                          ? "border-[var(--color-storefront-contrast)] bg-[var(--color-storefront-contrast)] text-white"
                          : "border-border bg-surface text-ink hover:border-[var(--color-storefront-contrast)]"}`}
                    >
                      {size.id === selectedSizeId ? "✓ " : ""}{size.name}
                    </button>
                  ))}
                </div>
                {!selectedColorId && <p className="mt-2 text-xs text-text-muted">Choose a color first.</p>}
              </div>
            )}
            <button
              type="button"
              onClick={handleQuickAdd}
              className={`min-h-11 w-full rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)] ${selectedVariant
                ? "border-[var(--color-storefront-contrast)] bg-[var(--color-storefront-contrast)] text-white hover:bg-[var(--color-storefront-accent-hover)]"
                : "border-border bg-surface-soft text-ink hover:border-[var(--color-storefront-contrast)]"}`}
            >
              Add to Cart
            </button>
            {feedback && (
              <p role={feedback.type === "error" ? "alert" : "status"} className={`text-xs font-medium transition-opacity duration-300 ${feedbackFading ? "opacity-0" : "opacity-100"} ${feedback.type === "error" ? "text-danger" : "text-success"}`}>
                {feedback.text}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
