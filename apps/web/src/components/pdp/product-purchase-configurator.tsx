"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Check, Minus, Plus, AlertCircle, ShoppingBag } from "lucide-react";
import { OutOfStockState } from "@/components/commerce/system-states";
import type { ApiProductOption, ApiProductVariant } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";

export interface ProductPurchaseConfiguratorProps {
  productId?: string;
  productSlug?: string;
  storefrontSlug?: string;
  productPrice?: string;
  mainImageUrl?: string | null;
  sizes: ApiProductOption[];
  colors: ApiProductOption[];
  variants: ApiProductVariant[];
  productName: string;
  className?: string;
  onVariantResolved?: (variantId: string | null, quantity: number, isAvailable: boolean) => void;
}

export function ProductPurchaseConfigurator({
  productId,
  productSlug,
  storefrontSlug,
  productPrice,
  mainImageUrl,
  sizes,
  colors,
  variants,
  productName,
  className = "",
  onVariantResolved,
}: ProductPurchaseConfiguratorProps) {
  // Single-option auto-selections or user selections
  const [selectedColorState, setSelectedColorId] = useState<string | null>(() =>
    colors.length === 1 ? colors[0].id : null
  );
  const [selectedSizeState, setSelectedSizeId] = useState<string | null>(() =>
    sizes.length === 1 ? sizes[0].id : null
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [feedback, setFeedback] = useState<{
    key: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const addItem = useCartStore((state) => state.addItem);

  // Derive active selections: single options auto-select; clear if invalid
  const selectedColorId = useMemo(() => {
    if (colors.length === 1) return colors[0].id;
    if (selectedColorState && colors.some((c) => c.id === selectedColorState)) {
      return selectedColorState;
    }
    return null;
  }, [colors, selectedColorState]);

  const selectedSizeId = useMemo(() => {
    if (sizes.length === 1) return sizes[0].id;
    if (selectedSizeState && sizes.some((s) => s.id === selectedSizeState)) {
      return selectedSizeState;
    }
    return null;
  }, [sizes, selectedSizeState]);

  // Determine availability of colors based on currently selected size (or general availability)
  const colorAvailabilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const color of colors) {
      if (selectedSizeId) {
        // Color is available if there is an available variant for this color and the selected size
        const match = variants.find(
          (v) =>
            v.productColorId === color.id && v.productSizeId === selectedSizeId && v.isAvailable
        );
        map.set(color.id, Boolean(match));
      } else {
        // Color is available if it has at least one available variant with any size
        const hasAnyAvailable = variants.some(
          (v) => v.productColorId === color.id && v.isAvailable
        );
        map.set(color.id, hasAnyAvailable);
      }
    }
    return map;
  }, [colors, selectedSizeId, variants]);

  // Determine availability of sizes based on currently selected color (or general availability)
  const sizeAvailabilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const size of sizes) {
      if (selectedColorId) {
        // Size is available if there is an available variant for the selected color and this size
        const match = variants.find(
          (v) =>
            v.productSizeId === size.id && v.productColorId === selectedColorId && v.isAvailable
        );
        map.set(size.id, Boolean(match));
      } else {
        // Size is available if it has at least one available variant with any color
        const hasAnyAvailable = variants.some((v) => v.productSizeId === size.id && v.isAvailable);
        map.set(size.id, hasAnyAvailable);
      }
    }
    return map;
  }, [sizes, selectedColorId, variants]);

  // Resolve matching exact variant
  const selectedVariant = useMemo(() => {
    if (!selectedColorId || !selectedSizeId) {
      return null;
    }
    return (
      variants.find(
        (v) => v.productColorId === selectedColorId && v.productSizeId === selectedSizeId
      ) || null
    );
  }, [selectedColorId, selectedSizeId, variants]);

  const isPurchasable = Boolean(selectedVariant?.isAvailable);

  // Notify parent component if callback provided
  useEffect(() => {
    onVariantResolved?.(selectedVariant?.id || null, quantity, isPurchasable);
  }, [selectedVariant, quantity, isPurchasable, onVariantResolved]);

  // Declaratively scope feedback to current exact variant selection & quantity
  const selectionKey = `${selectedVariant?.id || ""}:${quantity}`;
  const activeFeedback = feedback && feedback.key === selectionKey ? feedback : null;

  const handleAddToCart = () => {
    if (!selectedVariant || !isPurchasable || quantity < 1 || quantity > 10) {
      return;
    }

    const selectedSizeOption = sizes.find((s) => s.id === selectedSizeId);
    const selectedColorOption = colors.find((c) => c.id === selectedColorId);

    const result = addItem({
      productId: productId || "",
      variantId: selectedVariant.id,
      quantity,
      cachedProduct: {
        name: productName,
        slug: productSlug || "",
        storefrontSlug: storefrontSlug || "",
        mainImageUrl: mainImageUrl || null,
        sizeName: selectedSizeOption?.name || "",
        colorName: selectedColorOption?.name || "",
        unitPrice: productPrice || "0.00",
      },
    });

    if (result.success) {
      setFeedback({ key: selectionKey, type: "success", message: "Added to cart" });
    } else {
      if (result.reason === "MAX_QUANTITY_EXCEEDED") {
        setFeedback({
          key: selectionKey,
          type: "error",
          message: `Cannot add ${quantity} more. You already have ${result.currentQuantity} in your cart (maximum ${result.maxAllowed} per item).`,
        });
      } else {
        setFeedback({
          key: selectionKey,
          type: "error",
          message: "Could not add item to cart.",
        });
      }
    }
  };

  // Handler for color selection: if changing color makes selected size impossible, clear size
  const handleColorSelect = (colorId: string) => {
    if (selectedColorId === colorId && colors.length > 1) {
      setSelectedColorId(null);
      return;
    }

    setSelectedColorId(colorId);

    // If a size is already selected, verify if this combination exists at all in variants
    if (selectedSizeId) {
      const combinationExists = variants.some(
        (v) => v.productColorId === colorId && v.productSizeId === selectedSizeId
      );
      if (!combinationExists) {
        setSelectedSizeId(null);
      }
    }
  };

  // Handler for size selection: if changing size makes selected color impossible, clear color
  const handleSizeSelect = (sizeId: string) => {
    if (selectedSizeId === sizeId && sizes.length > 1) {
      setSelectedSizeId(null);
      return;
    }

    setSelectedSizeId(sizeId);

    // If a color is already selected, verify if this combination exists at all in variants
    if (selectedColorId) {
      const combinationExists = variants.some(
        (v) => v.productSizeId === sizeId && v.productColorId === selectedColorId
      );
      if (!combinationExists) {
        setSelectedColorId(null);
      }
    }
  };

  // Quantity handlers (enforcing 1–10 bound)
  const decrementQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const incrementQuantity = () => {
    setQuantity((prev) => Math.min(10, prev + 1));
  };

  const selectedColorName = colors.find((c) => c.id === selectedColorId)?.name;
  const selectedSizeName = sizes.find((s) => s.id === selectedSizeId)?.name;

  return (
    <div
      className={`space-y-6 ${className}`.trim()}
      aria-label="Product options and purchase preparation"
      data-selected-variant-id={selectedVariant?.id || ""}
      data-is-purchasable={isPurchasable ? "true" : "false"}
    >
      {/* 1. Color Selector (Textual display names only; no hex/swatches) */}
      {colors.length > 0 && (
        <fieldset className="space-y-2.5">
          <legend className="flex items-center justify-between w-full text-xs font-sans">
            <span className="font-semibold text-ink">
              Color{selectedColorName ? `: ${selectedColorName}` : ""}
            </span>
            <span className="text-text-muted">
              {colors.length} {colors.length === 1 ? "choice" : "choices"}
            </span>
          </legend>

          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Select Color">
            {colors.map((color) => {
              const isSelected = selectedColorId === color.id;
              const isAvailable = colorAvailabilityMap.get(color.id) ?? false;

              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleColorSelect(color.id)}
                  aria-pressed={isSelected}
                  disabled={!isAvailable && selectedSizeId !== null}
                  className={`px-4 py-2 rounded-md text-xs font-sans font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront ${
                    isSelected
                      ? "bg-ink text-white border border-ink shadow-subtle"
                      : isAvailable
                        ? "bg-surface text-ink border border-border hover:border-accent-storefront"
                        : "bg-surface-soft text-text-muted border border-border/60 opacity-50 cursor-not-allowed line-through"
                  }`}
                >
                  <span>{color.name}</span>
                  {!isAvailable && selectedSizeId !== null && (
                    <span className="sr-only"> (Unavailable)</span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* 2. Size Selector (Data-driven active sizes) */}
      {sizes.length > 0 && (
        <fieldset className="space-y-2.5">
          <legend className="flex items-center justify-between w-full text-xs font-sans">
            <span className="font-semibold text-ink">
              Size{selectedSizeName ? `: ${selectedSizeName}` : ""}
            </span>
            <span className="text-text-muted">
              {sizes.length} {sizes.length === 1 ? "size" : "sizes"}
            </span>
          </legend>

          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Select Size">
            {sizes.map((size) => {
              const isSelected = selectedSizeId === size.id;
              const isAvailable = sizeAvailabilityMap.get(size.id) ?? false;

              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => handleSizeSelect(size.id)}
                  aria-pressed={isSelected}
                  disabled={!isAvailable && selectedColorId !== null}
                  className={`min-w-[48px] px-3.5 py-2 rounded-md text-xs font-sans font-medium text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront ${
                    isSelected
                      ? "bg-ink text-white border border-ink shadow-subtle"
                      : isAvailable
                        ? "bg-surface text-ink border border-border hover:border-accent-storefront"
                        : "bg-surface-soft text-text-muted border border-border/60 opacity-50 cursor-not-allowed line-through"
                  }`}
                >
                  <span>{size.name}</span>
                  {!isAvailable && selectedColorId !== null && (
                    <span className="sr-only"> (Unavailable)</span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* 3. Variant Availability Feedback */}
      {selectedColorId && selectedSizeId && (
        <div className="pt-1">
          {isPurchasable ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-sans text-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Available to order (Made-to-order)</span>
            </div>
          ) : (
            <OutOfStockState message="This exact size and color combination is currently unavailable." />
          )}
        </div>
      )}

      {/* 4. Quantity Selector (1–10 bound; disabled until valid combination selected) */}
      <div className="space-y-2">
        <label
          htmlFor="product-quantity-input"
          className="block text-xs font-sans font-semibold text-ink"
        >
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-md border border-border bg-surface shadow-subtle">
            <button
              type="button"
              onClick={decrementQuantity}
              disabled={!isPurchasable || quantity <= 1}
              aria-label="Decrease quantity"
              className="px-3 py-2 text-ink hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded-l-md"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span
              id="product-quantity-input"
              className="w-12 text-center text-sm font-sans font-semibold text-ink select-none"
              aria-live="polite"
              aria-atomic="true"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={incrementQuantity}
              disabled={!isPurchasable || quantity >= 10}
              aria-label="Increase quantity"
              className="px-3 py-2 text-ink hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded-r-md"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <span className="text-xs font-sans text-text-muted">Max 10 per order</span>
        </div>
      </div>

      {/* Selection guidance when options are still pending */}
      {(!selectedColorId || !selectedSizeId) && (
        <p className="text-xs font-sans text-text-muted">
          Please select{" "}
          {!selectedColorId && !selectedSizeId
            ? "a Color and Size"
            : !selectedColorId
              ? "a Color"
              : "a Size"}{" "}
          to proceed.
        </p>
      )}

      {/* 5. Add to Cart Button & Accessible Feedback */}
      <div className="pt-2 space-y-3">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!selectedVariant || !isPurchasable || quantity < 1 || quantity > 10}
          className={`w-full min-h-[48px] px-6 py-3 rounded-lg font-sans text-sm font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 shadow-subtle ${
            selectedVariant && isPurchasable
              ? "bg-ink text-white hover:bg-ink/90 active:scale-[0.99] cursor-pointer"
              : "bg-surface-soft text-text-muted border border-border cursor-not-allowed opacity-75"
          }`}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          <span>
            {!selectedColorId || !selectedSizeId
              ? "Select Size & Color"
              : !isPurchasable
                ? "Unavailable"
                : "Add to Cart"}
          </span>
        </button>

        {/* Live Feedback Notification */}
        {activeFeedback && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3 rounded-md text-xs font-sans font-medium flex items-center gap-2 transition-all ${
              activeFeedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
            }`}
          >
            {activeFeedback.type === "success" ? (
              <Check
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            )}
            <span>{activeFeedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
