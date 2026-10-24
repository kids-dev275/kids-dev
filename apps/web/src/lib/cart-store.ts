import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";

export interface CachedCartProductDisplay {
  name: string;
  slug: string;
  storefrontSlug: string;
  mainImageUrl: string | null;
  sizeName: string;
  colorName: string;
  unitPrice: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  cachedProduct?: CachedCartProductDisplay;
}

export interface AddItemResult {
  success: boolean;
  reason?: "MAX_QUANTITY_EXCEEDED" | "INVALID_QUANTITY" | "INVALID_IDENTITY" | "LIMIT_REACHED";
  currentQuantity?: number;
  maxAllowed?: number;
}

export interface CartState {
  items: CartItem[];
  isHydrated: boolean;
  addItem: (item: {
    productId: string;
    variantId: string;
    quantity: number;
    cachedProduct?: CachedCartProductDisplay;
  }) => AddItemResult;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const CART_STORAGE_KEY = "kids-wear-cart";
export const CART_STORAGE_VERSION = 1;
export const MAX_QUANTITY_PER_VARIANT = 10;
export const MAX_CART_ITEMS = 50;

/**
 * Canonical 8-4-4-4-12 hex UUID regular expression.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a value is a valid UUID string.
 * Strictly rejects generic identifiers such as 'abc', 'product_123', 'not-a-real-uuid'.
 */
export function isValidUuid(val: unknown): val is string {
  if (typeof val !== "string") return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Validates a single raw cart item from storage to prevent runtime crashes or corrupted commerce intent.
 * Enforces valid UUID for productId, valid UUID for variantId, and integer quantity strictly in 1..10.
 * Discards malformed types, non-UUID strings, non-integers, and out-of-bound quantities.
 */
export function isValidRawCartItem(item: any): item is CartItem {
  return (
    item !== null &&
    typeof item === "object" &&
    isValidUuid(item.productId) &&
    isValidUuid(item.variantId) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= MAX_QUANTITY_PER_VARIANT
  );
}

/**
 * Deterministic normalization rule for persisted storage:
 * 1. Discards any malformed item (invalid UUIDs, non-integer quantity, quantity < 1 or > 10).
 * 2. Preserves (productId, variantId) consistency:
 *    - If multiple entries share the exact same variantId but claim different productIds,
 *      the conflicting entry is discarded as corrupted/inconsistent state.
 * 3. Merges valid duplicates with identical (productId, variantId) by summing their quantities.
 * 4. Caps merged duplicate quantities strictly at MAX_QUANTITY_PER_VARIANT (10).
 * 5. Limits total distinct items to MAX_CART_ITEMS (50).
 * Guarantees that hydrated cart never contains duplicate variant IDs, never creates quantity > 10,
 * and never merges conflicting Product/Variant identities.
 */
export function sanitizePersistedCartItems(rawItems: unknown): CartItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const normalizedMap = new Map<string, CartItem>();

  for (const rawItem of rawItems) {
    if (!isValidRawCartItem(rawItem)) {
      continue;
    }

    const cleanProductId = rawItem.productId.trim().toLowerCase();
    const cleanVariantId = rawItem.variantId.trim().toLowerCase();

    const existing = normalizedMap.get(cleanVariantId);
    if (!existing) {
      normalizedMap.set(cleanVariantId, {
        productId: cleanProductId,
        variantId: cleanVariantId,
        quantity: rawItem.quantity,
        cachedProduct: rawItem.cachedProduct,
      });
    } else {
      // Inconsistent state guard: if same variantId has a conflicting productId, discard conflicting entry
      if (existing.productId.toLowerCase() !== cleanProductId) {
        continue;
      }

      // Consistent (productId, variantId) duplicate: merge quantities up to MAX_QUANTITY_PER_VARIANT (10)
      const mergedQuantity = Math.min(
        MAX_QUANTITY_PER_VARIANT,
        existing.quantity + rawItem.quantity
      );
      existing.quantity = mergedQuantity;
      if (rawItem.cachedProduct && !existing.cachedProduct) {
        existing.cachedProduct = rawItem.cachedProduct;
      }
    }
  }

  return Array.from(normalizedMap.values()).slice(0, MAX_CART_ITEMS);
}

export function getCartTotalUnits(items: readonly CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0),
    0
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isHydrated: false,

      addItem: ({ productId, variantId, quantity, cachedProduct }) => {
        // Enforce valid UUID format for both Product and Variant
        if (!isValidUuid(productId) || !isValidUuid(variantId)) {
          return { success: false, reason: "INVALID_IDENTITY" };
        }

        // Enforce integer bound 1–10
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_VARIANT) {
          return { success: false, reason: "INVALID_QUANTITY" };
        }

        const cleanProductId = productId.trim().toLowerCase();
        const cleanVariantId = variantId.trim().toLowerCase();

        const currentItems = get().items;
        const existingIndex = currentItems.findIndex(
          (item) => item.variantId.toLowerCase() === cleanVariantId || item.variantId === variantId
        );

        if (existingIndex >= 0) {
          const existingItem = currentItems[existingIndex];

          // Reject conflicting product identity for same variant
          if (existingItem.productId.toLowerCase() !== cleanProductId) {
            return { success: false, reason: "INVALID_IDENTITY" };
          }

          const combinedQuantity = existingItem.quantity + quantity;

          // Reject excess additions that would exceed maximum 10 units
          if (combinedQuantity > MAX_QUANTITY_PER_VARIANT) {
            return {
              success: false,
              reason: "MAX_QUANTITY_EXCEEDED",
              currentQuantity: existingItem.quantity,
              maxAllowed: MAX_QUANTITY_PER_VARIANT,
            };
          }

          // Merge quantities for same exact variant
          const updatedItems = [...currentItems];
          updatedItems[existingIndex] = {
            ...existingItem,
            quantity: combinedQuantity,
            cachedProduct: cachedProduct || existingItem.cachedProduct,
          };

          set({ items: updatedItems });
          return { success: true, currentQuantity: combinedQuantity };
        }

        // Check maximum distinct cart items limit
        if (currentItems.length >= MAX_CART_ITEMS) {
          return { success: false, reason: "LIMIT_REACHED" };
        }

        // Add new variant item
        const newItem: CartItem = {
          productId: cleanProductId,
          variantId: cleanVariantId,
          quantity,
          cachedProduct,
        };

        set({ items: [...currentItems, newItem] });
        return { success: true, currentQuantity: quantity };
      },

      updateQuantity: (variantId: string, quantity: number) => {
        // Enforce valid Variant UUID and strict integer quantity in [1, 10]
        // Discards / no-ops invalid calls without silently clamping or converting invalid intent
        if (
          !isValidUuid(variantId) ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > MAX_QUANTITY_PER_VARIANT
        ) {
          return;
        }

        const cleanVariantId = variantId.trim().toLowerCase();
        const currentItems = get().items;
        const updated = currentItems.map((item) =>
          item.variantId.toLowerCase() === cleanVariantId ? { ...item, quantity } : item
        );
        set({ items: updated });
      },

      removeItem: (variantId: string) => {
        // Safely no-op if variantId is not a valid UUID
        if (!isValidUuid(variantId)) {
          return;
        }

        const cleanVariantId = variantId.trim().toLowerCase();
        const currentItems = get().items;
        set({
          items: currentItems.filter((item) => item.variantId.toLowerCase() !== cleanVariantId),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },
    }),
    {
      name: CART_STORAGE_KEY,
      version: CART_STORAGE_VERSION,
      // Hydrate after the store exists: the completion callback needs useCartStore.
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<CartState>),
        isHydrated: false,
      }),
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return {
            getItem: (key: string) => {
              try {
                return window.localStorage.getItem(key);
              } catch {
                return null;
              }
            },
            setItem: (key: string, value: string) => {
              try {
                window.localStorage.setItem(key, value);
              } catch {
                // Ignore storage write failures (quota exceeded, private browsing)
              }
            },
            removeItem: (key: string) => {
              try {
                window.localStorage.removeItem(key);
              } catch {
                // Ignore storage removal failures
              }
            },
          };
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      // Migrate or filter persisted data safely
      migrate: (persistedState: any, version: number) => {
        // Incompatible or unknown version resets safely to empty items
        if (
          version !== CART_STORAGE_VERSION ||
          !persistedState ||
          typeof persistedState !== "object"
        ) {
          return { items: [] };
        }
        const sanitized = sanitizePersistedCartItems(persistedState.items);
        return { ...persistedState, items: sanitized };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          // A storage read error must not discard items already in memory.
          useCartStore.setState({ isHydrated: true });
          return;
        }
        // Sanitize items upon rehydration from storage (discards malformed lines, merges duplicate variant IDs <= 10)
        const sanitized = sanitizePersistedCartItems(state.items);
        useCartStore.setState({ items: sanitized, isHydrated: true });
      },
    }
  )
);

if (typeof window !== "undefined") {
  void useCartStore.persist.rehydrate();
}

const emptySubscribe = () => () => {};

/**
 * React hook for safe Cart consumption in Next.js App Router components.
 * Guarantees zero SSR hydration mismatch and provides unit count calculation.
 */
export function useCart() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const store = useCartStore();

  const isHydrated = isMounted && store.isHydrated;
  const totalUnits = isHydrated ? getCartTotalUnits(store.items) : 0;

  return {
    ...store,
    isHydrated,
    totalUnits,
  };
}
