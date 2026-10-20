"use client";

import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { ApiCartInvalidItem } from "@/lib/api";
import type { CartItem } from "@/lib/cart-store";

export interface CartInvalidLineItemProps {
  invalidItem: ApiCartInvalidItem;
  cachedItem?: CartItem;
  onRemove: (variantId: string) => void;
}

export function CartInvalidLineItem({
  invalidItem,
  cachedItem,
  onRemove,
}: CartInvalidLineItemProps) {
  const title = cachedItem?.cachedProduct?.name || "Product Option";
  const size = cachedItem?.cachedProduct?.sizeName;
  const color = cachedItem?.cachedProduct?.colorName;

  return (
    <div
      data-testid={`cart-invalid-line-${invalidItem.variantId}`}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 shadow-subtle transition-all"
    >
      <div className="flex items-start gap-3.5 flex-1">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h4 className="font-sans text-sm font-semibold text-ink line-clamp-1">{title}</h4>

          {(size || color) && (
            <div className="flex items-center gap-2 text-xs font-sans text-text-muted">
              {size && <span>Size: {size}</span>}
              {size && color && <span>&bull;</span>}
              {color && <span>Color: {color}</span>}
            </div>
          )}

          <p className="text-xs font-sans font-medium text-amber-800 dark:text-amber-300">
            {invalidItem.message || "This option is no longer available."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end w-full sm:w-auto pt-2 sm:pt-0">
        <button
          type="button"
          onClick={() => onRemove(invalidItem.variantId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium text-amber-900 bg-amber-200/70 hover:bg-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label={`Remove unavailable item ${title} from cart`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Remove Item</span>
        </button>
      </div>
    </div>
  );
}
