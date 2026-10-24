"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { validateCart, ApiCartValidationResult } from "@/lib/api";
import { LoadingState, ErrorState, EmptyCartState } from "@/components/commerce/system-states";
import { CartLineItem } from "./cart-line-item";
import { CartInvalidLineItem } from "./cart-invalid-line-item";
import { CartSummary } from "./cart-summary";
import { getCartViewState } from "./cart-view-state";

export function CartView() {
  const { items, isHydrated, totalUnits, updateQuantity, removeItem } = useCart();

  const [validationData, setValidationData] = useState<ApiCartValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<boolean>(false);
  const validationRequestId = useRef(0);

  // Perform authoritative cart validation
  const revalidateCart = useCallback(async () => {
    const requestId = ++validationRequestId.current;
    setIsValidating(true);
    setValidationError(false);
    try {
      if (items.length === 0) {
        setValidationData({
          items: [],
          validItems: [],
          invalidItems: [],
          subtotal: "0.00",
          deliveryCharge: "0.00",
          total: "0.00",
        });
        return;
      }

      const payload = items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      }));
      const result = await validateCart(payload);
      if (requestId !== validationRequestId.current) return;

      if (result) {
        setValidationData(result);
      } else {
        setValidationData(null);
        setValidationError(true);
      }
    } catch {
      if (requestId === validationRequestId.current) {
        setValidationData(null);
        setValidationError(true);
      }
    } finally {
      if (requestId === validationRequestId.current) setIsValidating(false);
    }
  }, [items]);

  // Initial and reactive validation when stored cart state updates
  useEffect(() => {
    if (!isHydrated) return;

    let isCancelled = false;

    const run = async () => {
      // Yield to avoid synchronous setState in effect body
      await Promise.resolve();
      if (isCancelled) return;
      await revalidateCart();
    };

    void run();

    return () => {
      isCancelled = true;
      validationRequestId.current += 1;
    };
  }, [isHydrated, revalidateCart]);

  // Handle quantity changes
  const handleQuantityChange = (variantId: string, newQuantity: number) => {
    updateQuantity(variantId, newQuantity);
  };

  // Handle removing a line (either valid or invalid)
  const handleRemove = (variantId: string) => {
    removeItem(variantId);
  };

  const viewState = getCartViewState(
    isHydrated,
    items.length,
    isValidating,
    validationData !== null,
    validationError
  );

  // 1. Loading / Initial Hydration State
  if (viewState === "loading") {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <LoadingState
          title="Loading your shopping bag..."
          message="Checking live product availability and authoritative prices..."
        />
      </div>
    );
  }

  // 2. Empty Cart State
  if (viewState === "empty") {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <EmptyCartState shopHref="/" />
      </div>
    );
  }

  // 3. API Outage Error State (Customer cart is preserved)
  if (viewState === "error") {
    return (
      <div className="py-16 sm:py-24 min-h-[420px] flex items-center justify-center">
        <ErrorState
          title="Unable to verify shopping bag"
          description="We couldn't connect to our servers to verify product availability and pricing. Your items remain safely in your bag."
          onRetry={revalidateCart}
          retryLabel="Retry Verification"
        />
      </div>
    );
  }

  const validItems = validationData?.items || [];
  const invalidItems = validationData?.invalidItems || [];
  const hasInvalidItems = invalidItems.length > 0;

  // Map cached items for display assistance in invalid state
  const cachedItemsMap = new Map(items.map((i) => [i.variantId, i]));

  return (
    <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="text-xs uppercase tracking-widest font-sans font-semibold text-text-muted">
            Guest Cart
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight mt-1">
            Shopping Bag
            <span className="font-sans text-xl text-text-muted font-normal ml-3">
              ({totalUnits} {totalUnits === 1 ? "unit" : "units"})
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded p-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Continue Shopping</span>
          </Link>

          {isValidating && (
            <span className="inline-flex items-center gap-1 text-xs font-sans text-text-muted animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>Updating...</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Line Items on Left, Order Summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Invalid Items & Valid Lines */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section: Unavailable / Stale Lines */}
          {hasInvalidItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Items requiring attention ({invalidItems.length})
                </h3>
                <span className="text-xs font-sans text-text-muted">
                  Must be removed to proceed
                </span>
              </div>

              <div className="space-y-3">
                {invalidItems.map((inv) => (
                  <CartInvalidLineItem
                    key={inv.variantId}
                    invalidItem={inv}
                    cachedItem={cachedItemsMap.get(inv.variantId)}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section: Valid Cart Lines */}
          {validItems.length > 0 ? (
            <div className="space-y-4">
              {hasInvalidItems && (
                <h3 className="font-sans text-sm font-semibold text-ink pt-2">
                  Available Items ({validItems.length})
                </h3>
              )}
              <div className="space-y-3">
                {validItems.map((item) => (
                  <CartLineItem
                    key={item.variantId}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          ) : (
            hasInvalidItems && (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-surface-soft space-y-3">
                <p className="font-sans text-sm text-text-muted">
                  All items currently in your bag are unavailable.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-ink text-white font-sans text-xs font-semibold hover:bg-ink/90 transition-colors"
                >
                  Discover New Arrivals
                </Link>
              </div>
            )
          )}
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-4 sticky top-24">
          <CartSummary
            subtotal={validationData?.subtotal || "0.00"}
            deliveryCharge={validationData?.deliveryCharge || "0.00"}
            total={validationData?.total || "0.00"}
            hasInvalidItems={hasInvalidItems}
            isValidating={isValidating}
            itemCount={validItems.length}
          />
        </div>
      </div>
    </div>
  );
}
