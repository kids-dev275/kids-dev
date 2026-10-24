"use client";

import React from "react";
import { useCart } from "@/lib/cart-store";

export interface CartUnitBadgeProps {
  className?: string;
}

/**
 * Hydration-safe Cart Unit Badge.
 * Renders the total number of units across all variants in the guest cart.
 * Returns null during SSR or when the cart is empty to avoid hydration mismatch.
 */
export function CartUnitBadge({ className = "" }: CartUnitBadgeProps) {
  const { totalUnits, isHydrated } = useCart();

  if (!isHydrated || totalUnits <= 0) {
    return null;
  }

  return (
    <span
      data-testid="header-cart-badge"
      className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-storefront px-1 text-[10px] font-bold text-white leading-none shadow-xs transition-transform animate-in fade-in zoom-in-75 ${className}`.trim()}
      aria-label={`${totalUnits} ${totalUnits === 1 ? "item" : "items"} in cart`}
    >
      {totalUnits > 99 ? "99+" : totalUnits}
    </span>
  );
}
