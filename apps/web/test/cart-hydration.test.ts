import assert from "node:assert/strict";
import { getCartViewState } from "../src/components/cart/cart-view-state";

const productId = "11111111-1111-4111-8111-111111111111";
const variantId = "33333333-3333-4333-8333-333333333333";
const secondVariantId = "44444444-4444-4444-8444-444444444444";
const storage = new Map<string, string>([
  [
    "kids-wear-cart",
    JSON.stringify({
      state: {
        items: [{ productId, variantId, quantity: 1 }],
        isHydrated: true,
      },
      version: 1,
    }),
  ],
]);

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  },
});

async function main() {
  // Import after localStorage exists to exercise the browser's initial hydration path.
  const { useCartStore, getCartTotalUnits } = await import("../src/lib/cart-store");
  assert.equal(useCartStore.persist.hasHydrated(), true);
  assert.equal(useCartStore.getState().isHydrated, true);
  assert.deepEqual(useCartStore.getState().items.map((item) => item.variantId), [variantId]);
  assert.equal(getCartTotalUnits(useCartStore.getState().items), 1);
  console.log("  ✓ persisted item hydrates before the cart becomes ready; badge count is 1");

  const added = useCartStore.getState().addItem({ productId, variantId: secondVariantId, quantity: 2 });
  assert.equal(added.success, true);
  assert.equal(getCartTotalUnits(useCartStore.getState().items), 3);
  const persisted = JSON.parse(storage.get("kids-wear-cart")!);
  assert.equal(persisted.state.items.length, 2);
  assert.equal("isHydrated" in persisted.state, false);
  console.log("  ✓ PDP-style add updates the same persisted store and total-unit count (1 + 2 = 3)");

  const originalStorage = useCartStore.persist.getOptions().storage!;
  let finishRead!: (value: { state: { items: unknown }; version: number }) => void;
  const pendingRead = new Promise<{ state: { items: unknown }; version: number }>((resolve) => {
    finishRead = resolve;
  });
  useCartStore.persist.setOptions({
    storage: {
      getItem: () => pendingRead,
      setItem: () => {},
      removeItem: () => {},
    },
  });
  useCartStore.getState().setHydrated(false);
  const rehydrating = useCartStore.persist.rehydrate();
  assert.equal(useCartStore.getState().isHydrated, false);
  finishRead({ state: { items: [{ productId, variantId, quantity: 1 }] }, version: 1 });
  await rehydrating;
  assert.equal(useCartStore.getState().isHydrated, true);
  assert.equal(getCartTotalUnits(useCartStore.getState().items), 1);
  console.log("  ✓ asynchronous hydration stays pending until persisted items are restored");

  useCartStore.persist.setOptions({
    storage: {
      getItem: () => { throw new Error("storage unavailable"); },
      setItem: () => {},
      removeItem: () => {},
    },
  });
  await useCartStore.persist.rehydrate();
  assert.equal(useCartStore.getState().isHydrated, true);
  assert.equal(getCartTotalUnits(useCartStore.getState().items), 1);
  useCartStore.persist.setOptions({ storage: originalStorage });
  console.log("  ✓ storage failure releases loading without deleting in-memory cart items");

  const { validateCart } = await import("../src/lib/api");
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  try {
    console.warn = () => {};
    globalThis.fetch = (async (_input, init) => {
      assert(init?.signal instanceof AbortSignal);
      throw new Error("backend unavailable");
    }) as typeof fetch;
    const result = await validateCart([{ productId, variantId, quantity: 1 }]);
    assert.equal(result, null);
    assert.equal(getCartTotalUnits(useCartStore.getState().items), 1);
    console.log("  ✓ validation network failure settles while preserving the local cart");

    globalThis.fetch = async () => new Response(JSON.stringify({
        success: true,
        data: {
          items: [{ variantId, unitPrice: "2950.00" }],
          validItems: [{ variantId, unitPrice: "2950.00" }],
          invalidItems: [],
          subtotal: "2950.00",
          deliveryCharge: "300.00",
          total: "3250.00",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    const validated = await validateCart([{ productId, variantId, quantity: 1 }]);
    assert.equal(validated?.items[0].variantId, variantId);
    assert.equal(validated?.total, "3250.00");
    console.log("  ✓ successful validation returns authoritative item and totals");
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }

  const browserWindow = globalThis.window;
  Reflect.deleteProperty(globalThis, "window");
  try {
    const { CartView } = await import("../src/components/cart/cart-view");
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const serverHtml = renderToStaticMarkup(React.createElement(CartView));
    assert.match(serverHtml, /Loading your shopping bag/);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow });
  }
  console.log("  ✓ server render remains in the hydration-safe loading state");

  useCartStore.getState().setHydrated(false);
  storage.set("kids-wear-cart", JSON.stringify({ state: { items: [] }, version: 1 }));
  await useCartStore.persist.rehydrate();
  assert.equal(useCartStore.getState().isHydrated, true);
  assert.deepEqual(useCartStore.getState().items, []);
  console.log("  ✓ an empty persisted cart hydrates to the empty terminal state");

  assert.equal(getCartViewState(false, 1, true, false, false), "loading");
  assert.equal(getCartViewState(true, 0, true, false, false), "empty");
  assert.equal(getCartViewState(true, 1, false, true, false), "validated");
  assert.equal(getCartViewState(true, 1, false, false, true), "error");
  assert.equal(getCartViewState(true, 1, false, false, false), "error");
  console.log("  ✓ cart view reaches loading, empty, validated, or retryable error states");

  console.log("Cart hydration: 9 passed, 0 failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
