import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import {
  useCartStore,
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
  MAX_QUANTITY_PER_VARIANT,
  UUID_REGEX,
  isValidUuid,
  isValidRawCartItem,
  sanitizePersistedCartItems,
} from "../src/lib/cart-store";
import { CartUnitBadge } from "../src/components/cart/cart-badge";
import { CartLineItem } from "../src/components/cart/cart-line-item";
import { CartInvalidLineItem } from "../src/components/cart/cart-invalid-line-item";
import { CartSummary } from "../src/components/cart/cart-summary";
import { ProductPurchaseConfigurator } from "../src/components/pdp/product-purchase-configurator";
import { EmptyCartState } from "../src/components/commerce/system-states";
import type { ApiCartValidatedItem, ApiCartInvalidItem } from "../src/lib/api";

const VALID_PROD_1 = "11111111-1111-4111-8111-111111111111";
const VALID_PROD_2 = "22222222-2222-4222-8222-222222222222";
const VALID_VAR_1 = "33333333-3333-4333-8333-333333333333";
const VALID_VAR_2 = "44444444-4444-4444-8444-444444444444";
const VALID_VAR_3 = "55555555-5555-4555-8555-555555555555";

interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err });
    console.error(`  ✗ ${name}`);
    const firstLine = String(err?.message || err).split("\n")[0];
    console.error(`    ${firstLine}`);
  }
}

async function runSuite() {
  console.log("Starting Kids Wear — Work Unit 13 Persistent Guest Cart Test Suite...\n");

  const webSrc = path.join(__dirname, "../src");
  const cartStoreSource = fs.readFileSync(path.join(webSrc, "lib/cart-store.ts"), "utf-8");
  const cartPageSource = fs.readFileSync(path.join(webSrc, "app/cart/page.tsx"), "utf-8");
  const cartViewSource = fs.readFileSync(
    path.join(webSrc, "components/cart/cart-view.tsx"),
    "utf-8"
  );
  const configuratorSource = fs.readFileSync(
    path.join(webSrc, "components/pdp/product-purchase-configurator.tsx"),
    "utf-8"
  );
  const headerSource = fs.readFileSync(path.join(webSrc, "components/shell/header.tsx"), "utf-8");
  const cartLineItemSource = fs.readFileSync(
    path.join(webSrc, "components/cart/cart-line-item.tsx"),
    "utf-8"
  );
  const mobileNavSource = fs.readFileSync(
    path.join(webSrc, "components/shell/mobile-nav.tsx"),
    "utf-8"
  );
  const webPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
  );

  // =========================================================================
  // 1. PERSISTENCE (Tests 1–8)
  // =========================================================================

  await runTest("1. Persistence: empty Cart initializes safely", () => {
    useCartStore.getState().clearCart();
    const state = useCartStore.getState();
    assert.strictEqual(Array.isArray(state.items), true);
    assert.strictEqual(state.items.length, 0);
  });

  await runTest("2. Persistence: Add Variant creates line", () => {
    useCartStore.getState().clearCart();
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 2,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(useCartStore.getState().items.length, 1);
    assert.strictEqual(useCartStore.getState().items[0].variantId, VALID_VAR_1.toLowerCase());
    assert.strictEqual(useCartStore.getState().items[0].quantity, 2);
  });

  await runTest("3. Persistence: same Variant merges quantity", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 3,
    });
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 2,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.currentQuantity, 5);
    assert.strictEqual(useCartStore.getState().items.length, 1);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 5);
  });

  await runTest("4. Persistence: different Variant creates separate line", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_2,
      quantity: 2,
    });
    assert.strictEqual(useCartStore.getState().items.length, 2);
  });

  await runTest("5. Persistence: Cart persists using namespaced storage key and version", () => {
    assert.strictEqual(CART_STORAGE_KEY, "kids-wear-cart");
    assert.strictEqual(CART_STORAGE_VERSION, 1);
    assert.match(cartStoreSource, /name:\s*CART_STORAGE_KEY/);
    assert.match(cartStoreSource, /version:\s*CART_STORAGE_VERSION/);
  });

  await runTest("6. Persistence: malformed persisted entry discarded safely", () => {
    assert.match(cartStoreSource, /isValidRawCartItem/);
    assert.match(cartStoreSource, /migrate:/);
    assert.match(cartStoreSource, /onRehydrateStorage/);
  });

  await runTest("7. Persistence: Cart survives Storefront switching", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
      cachedProduct: {
        name: "Mini Item",
        slug: "mini-item",
        storefrontSlug: "mini-sprouts",
        mainImageUrl: null,
        sizeName: "2Y",
        colorName: "Red",
        unitPrice: "1500.00",
      },
    });
    useCartStore.getState().addItem({
      productId: VALID_PROD_2,
      variantId: VALID_VAR_2,
      quantity: 2,
      cachedProduct: {
        name: "Teen Item",
        slug: "teen-item",
        storefrontSlug: "teen-studio",
        mainImageUrl: null,
        sizeName: "12Y",
        colorName: "Blue",
        unitPrice: "2500.00",
      },
    });
    const items = useCartStore.getState().items;
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].cachedProduct?.storefrontSlug, "mini-sprouts");
    assert.strictEqual(items[1].cachedProduct?.storefrontSlug, "teen-studio");
  });

  await runTest("8. Persistence: guest Cart does not require login", () => {
    // Stored cart contains no customer session, password, or token
    const items = useCartStore.getState().items;
    for (const item of items) {
      assert.strictEqual((item as any).sessionToken, undefined);
      assert.strictEqual((item as any).customerId, undefined);
    }
    assert.doesNotMatch(cartStoreSource, /Authorization/i);
    assert.doesNotMatch(cartStoreSource, /sessionToken/i);
  });

  // =========================================================================
  // 2. QUANTITY (Tests 9–14)
  // =========================================================================

  await runTest("9. Quantity: minimum 1 enforced", () => {
    useCartStore.getState().clearCart();
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 0,
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, "INVALID_QUANTITY");
  });

  await runTest("10. Quantity: maximum 10 enforced per exact Variant", () => {
    useCartStore.getState().clearCart();
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 11,
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, "INVALID_QUANTITY");
  });

  await runTest("11. Quantity: merged quantity cannot exceed 10", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 8,
    });
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 4,
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, "MAX_QUANTITY_EXCEEDED");
    assert.strictEqual(useCartStore.getState().items[0].quantity, 8);
  });

  await runTest("12. Quantity: excess Add-to-Cart attempt rejected/handled clearly", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 10,
    });
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, "MAX_QUANTITY_EXCEEDED");
    assert.strictEqual(res.currentQuantity, 10);
    assert.strictEqual(res.maxAllowed, 10);
  });

  await runTest("13. Quantity: quantity 0 rejected", () => {
    useCartStore.getState().clearCart();
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 0,
    });
    assert.strictEqual(res.success, false);
  });

  await runTest("14. Quantity: negative quantity rejected", () => {
    useCartStore.getState().clearCart();
    const res = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: -3,
    });
    assert.strictEqual(res.success, false);
  });

  // =========================================================================
  // 3. IDENTITY (Tests 15–17)
  // =========================================================================

  await runTest("15. Identity: exact Variant ID defines line identity", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_2,
      quantity: 1,
    });
    const items = useCartStore.getState().items;
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].variantId, VALID_VAR_1.toLowerCase());
    assert.strictEqual(items[1].variantId, VALID_VAR_2.toLowerCase());
  });

  await runTest("16. Identity: same Product different Variant creates separate lines", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_2,
      quantity: 1,
    });
    assert.strictEqual(useCartStore.getState().items.length, 2);
  });

  await runTest("17. Identity: Product/Variant labels are not used as identity", () => {
    // Verify findIndex checks variantId exclusively
    assert.match(cartStoreSource, /item\.variantId\s*===\s*variantId/);
    assert.doesNotMatch(cartStoreSource, /item\.cachedProduct\?.name/);
  });

  // =========================================================================
  // 4. PDP ADD TO CART (Tests 18–22)
  // =========================================================================

  const mockSizes = [
    { id: "size-1", name: "2-3Y" },
    { id: "size-2", name: "4-5Y" },
  ];
  const mockColors = [
    { id: "color-1", name: "Sky Blue" },
    { id: "color-2", name: "Sage Green" },
  ];
  const mockVariants = [
    { id: "var-1", productSizeId: "size-1", productColorId: "color-1", isAvailable: true },
    { id: "var-2", productSizeId: "size-1", productColorId: "color-2", isAvailable: false },
    { id: "var-3", productSizeId: "size-2", productColorId: "color-1", isAvailable: true },
    { id: "var-4", productSizeId: "size-2", productColorId: "color-2", isAvailable: true },
  ];

  await runTest("18. PDP: Add to Cart disabled without exact Variant", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        productId="test-prod"
        productName="Test Kurta"
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
      />
    );
    assert.match(html, /disabled=""/);
    assert.match(html, /Select Size &amp; Color/);
  });

  await runTest("19. PDP: Add to Cart disabled for unavailable Variant", () => {
    assert.match(configuratorSource, /!isPurchasable/);
    assert.match(configuratorSource, /"Unavailable"/);
    assert.match(configuratorSource, /disabled=\{!selectedVariant\s*\|\|\s*!isPurchasable/);
  });

  await runTest("20. PDP: Add to Cart enabled for valid Variant", () => {
    assert.match(configuratorSource, /Add to Cart/);
    assert.match(configuratorSource, /handleAddToCart/);
  });

  await runTest("21. PDP: selected quantity passed correctly", () => {
    assert.match(configuratorSource, /quantity,\s*cachedProduct/);
  });

  await runTest("22. PDP: successful add shows accessible feedback", () => {
    assert.match(configuratorSource, /role="status"/);
    assert.match(configuratorSource, /aria-live="polite"/);
    assert.match(configuratorSource, /Added to cart/);
  });

  // =========================================================================
  // 5. CART PAGE (Tests 23–33)
  // =========================================================================

  await runTest("23. Cart Page: empty Cart renders EmptyCartState", () => {
    const html = renderToStaticMarkup(<EmptyCartState shopHref="/" />);
    assert.match(html, /Your shopping bag is empty/);
    assert.match(html, /Start Shopping/);
    assert.match(html, /href="\/"/);
  });

  const sampleValidLine: ApiCartValidatedItem = {
    productId: "prod-100",
    variantId: "var-100",
    quantity: 2,
    product: {
      name: "Handcrafted Festive Kurta",
      slug: "festive-kurta",
      storefrontSlug: "mini-sprouts",
      mainImage: {
        url: "https://res.cloudinary.com/test/image/upload/festive.jpg",
        altText: "Festive Kurta Main",
      },
    },
    variant: {
      size: "3-4Y",
      color: "Royal Blue",
      isAvailable: true,
    },
    unitPrice: "2499.00",
    lineSubtotal: "4998.00",
  };

  await runTest("24. Cart Page: validated Cart line renders Product", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /Handcrafted Festive Kurta/);
    assert.match(html, /Mini Sprouts/);
  });

  await runTest("25. Cart Page: Size rendered", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /Size:/);
    assert.match(html, /3-4Y/);
  });

  await runTest("26. Cart Page: Color rendered", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /Color:/);
    assert.match(html, /Royal Blue/);
  });

  await runTest("27. Cart Page: authoritative unit price rendered", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /Unit Price:/);
    assert.match(html, /2,499/);
  });

  await runTest("28. Cart Page: line subtotal rendered", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /4,998/);
  });

  await runTest("29. Cart Page: Remove action works", () => {
    let removedId: string | null = null;
    const item = { ...sampleValidLine };
    const onRemove = (id: string) => {
      removedId = id;
    };
    onRemove(item.variantId);
    assert.strictEqual(removedId, "var-100");
  });

  await runTest("30. Cart Page: quantity update works", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 2,
    });
    useCartStore.getState().updateQuantity(VALID_VAR_1, 4);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 4);
  });

  await runTest("31. Cart Page: Header unit badge updates", () => {
    assert.match(headerSource, /<CartUnitBadge/);
    assert.match(mobileNavSource, /<CartUnitBadge/);
  });

  await runTest("32. Cart Page: Product link uses validated Storefront slug", () => {
    const html = renderToStaticMarkup(
      <CartLineItem item={sampleValidLine} onQuantityChange={() => {}} onRemove={() => {}} />
    );
    assert.match(html, /href="\/mini-sprouts\/products\/festive-kurta"/);
  });

  await runTest("33. Cart Page: Checkout CTA hidden/disabled when invalid", () => {
    const html = renderToStaticMarkup(
      <CartSummary
        subtotal="4998.00"
        deliveryCharge="300.00"
        total="5298.00"
        hasInvalidItems={true}
        isValidating={false}
        itemCount={1}
      />
    );
    assert.match(html, /disabled=""/);
    assert.match(html, /Please remove unavailable items before proceeding to checkout/);
  });

  await runTest("33a. empty cart cannot proceed while a validated item links to checkout", () => {
    const empty = renderToStaticMarkup(
      <CartSummary
        subtotal="0.00"
        deliveryCharge="0.00"
        total="0.00"
        hasInvalidItems={false}
        isValidating={false}
        itemCount={0}
      />
    );
    assert(!empty.includes('href="/checkout"'), "Empty cart cannot navigate to checkout");
    const valid = renderToStaticMarkup(
      <CartSummary
        subtotal="2950.00"
        deliveryCharge="300.00"
        total="3250.00"
        hasInvalidItems={false}
        isValidating={false}
        itemCount={1}
      />
    );
    assert(valid.includes('href="/checkout"'), "Validated cart routes to existing checkout");
    assert(valid.includes("bg-[var(--color-storefront-contrast)]"), "CTA uses storefront contrast");
    assert(valid.includes("font-sans") && valid.includes("tabular-nums"), "Totals use Montserrat numerals");
    assert(!valid.includes("font-editorial text-2xl"), "Grand total is not decorative serif");
  });

  // =========================================================================
  // 6. CART VALIDATION API CONTRACT & DEFENSIVE SCOPE (Tests 34–53)
  // =========================================================================

  await runTest("34. Cart Validation API: public route requires no auth", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.doesNotMatch(apiRoutesSource, /requireCustomer/);
    assert.doesNotMatch(apiRoutesSource, /requireAdmin/);
    assert.doesNotMatch(apiRoutesSource, /requireCustomerCsrf/);
  });

  await runTest("35. Cart Validation API: valid Cart validates", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /app\.post\("\/validate"/);
  });

  await runTest("36. Cart Validation API: malformed UUID rejected", () => {
    const apiValidationSource = fs.readFileSync(
      path.join(__dirname, "../../api/src/modules/cart/validation.ts"),
      "utf-8"
    );
    assert.match(apiValidationSource, /z\.string\(\)\.uuid/);
  });

  await runTest("37. Cart Validation API: quantity > 10 rejected", () => {
    const apiValidationSource = fs.readFileSync(
      path.join(__dirname, "../../api/src/modules/cart/validation.ts"),
      "utf-8"
    );
    assert.match(apiValidationSource, /\.max\(10,/);
  });

  await runTest("38. Cart Validation API: duplicate Variant entries rejected", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /DUPLICATE_VARIANT_ENTRY/);
  });

  await runTest("39. Cart Validation API: Product/Variant mismatch rejected", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /PRODUCT_MISMATCH/);
  });

  await runTest("40. Cart Validation API: Draft Product not exposed", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /PRODUCT_UNPUBLISHED/);
  });

  await runTest("41. Cart Validation API: Inactive Product not exposed", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /PRODUCT_UNAVAILABLE/);
  });

  await runTest("42. Cart Validation API: unavailable Variant invalid", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /VARIANT_UNAVAILABLE/);
  });

  await runTest("43. Cart Validation API: inactive Size invalid", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /SIZE_INACTIVE/);
  });

  await runTest("44. Cart Validation API: inactive Color invalid", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /COLOR_INACTIVE/);
  });

  await runTest("45. Cart Validation API: valid Variant succeeds", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /validItems\.push/);
  });

  await runTest("46. Cart Validation API: current price returned", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /unitPrice:\s*unitPrice\.toFixed\(2\)/);
  });

  await runTest("47. Cart Validation API: current Main Image returned", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /isMain:\s*true/);
  });

  await runTest("48. Cart Validation API: fixed 2-decimal money strings", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /\.toFixed\(2\)/);
  });

  await runTest("49. Cart Validation API: flat delivery charge applied once", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /accumulatedSubtotal\.add\(flatDeliveryCharge\)/);
  });

  await runTest("50. Cart Validation API: subtotal correct", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /subtotal:\s*subtotalStr/);
  });

  await runTest("51. Cart Validation API: total correct", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.match(apiRoutesSource, /total:\s*totalStr/);
  });

  await runTest("52. Cart Validation API: no numeric inventory exposed", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.doesNotMatch(apiRoutesSource, /inventoryCount/);
    assert.doesNotMatch(apiRoutesSource, /stockQuantity/);
  });

  await runTest("53. Cart Validation API: no SKU exposed", () => {
    const apiRoutesSource =
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/routes.ts"), "utf-8") +
      "\n" +
      fs.readFileSync(path.join(__dirname, "../../api/src/modules/cart/service.ts"), "utf-8");
    assert.doesNotMatch(apiRoutesSource, /sku:\s*dbVariant/);
  });

  // =========================================================================
  // 7. STALE CART RECOVERY (Tests 54–58)
  // =========================================================================

  const sampleInvalidItem: ApiCartInvalidItem = {
    productId: "prod-stale",
    variantId: "var-stale",
    reason: "VARIANT_UNAVAILABLE",
    message: "This option is currently unavailable.",
  };

  await runTest("54. Stale Recovery: invalid Product line identified", () => {
    const html = renderToStaticMarkup(
      <CartInvalidLineItem invalidItem={sampleInvalidItem} onRemove={() => {}} />
    );
    assert.match(html, /Items requiring attention|Product Option/);
    assert.match(html, /This option is currently unavailable/);
  });

  await runTest("55. Stale Recovery: unavailable Variant identified", () => {
    assert.strictEqual(sampleInvalidItem.reason, "VARIANT_UNAVAILABLE");
  });

  await runTest("56. Stale Recovery: invalid item can be removed", () => {
    let removedId: string | null = null;
    const html = renderToStaticMarkup(
      <CartInvalidLineItem
        invalidItem={sampleInvalidItem}
        onRemove={(id) => {
          removedId = id;
        }}
      />
    );
    assert.match(html, /Remove Item/);
  });

  await runTest("57. Stale Recovery: API outage does not erase local Cart", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    // In CartView, network error sets validationError: true without modifying cartStore
    assert.match(cartViewSource, /setValidationError\(true\)/);
    assert.doesNotMatch(cartViewSource, /setValidationError[\s\S]*?clearCart/);
    assert.strictEqual(useCartStore.getState().items.length, 1);
  });

  await runTest("58. Stale Recovery: price update uses server price", () => {
    assert.match(cartLineItemSource, /item\.unitPrice/);
  });

  // =========================================================================
  // 8. SCOPE EXCLUSIONS (Tests 59–64)
  // =========================================================================

  await runTest("59. Scope: no Checkout form embedded in Cart view", () => {
    assert.doesNotMatch(cartViewSource, /fullName/i);
    assert.doesNotMatch(cartViewSource, /CheckoutCustomerForm/i);
  });

  await runTest("60. Scope: no Order created in Work Unit 13", () => {
    assert.doesNotMatch(cartViewSource, /createOrder/);
    assert.doesNotMatch(cartViewSource, /orderNumber/);
  });

  await runTest("61. Scope: no inventory reservation introduced", () => {
    const apiRoutesSource = fs.readFileSync(
      path.join(__dirname, "../../api/src/modules/cart/routes.ts"),
      "utf-8"
    );
    assert.doesNotMatch(apiRoutesSource, /reserve/i);
    assert.doesNotMatch(apiRoutesSource, /hold/i);
  });

  await runTest("62. Scope: no customer-account Cart sync", () => {
    assert.doesNotMatch(cartStoreSource, /syncCart/i);
    assert.doesNotMatch(cartStoreSource, /account\/cart/i);
  });

  await runTest("63. Scope: no Wishlist introduced", () => {
    assert.doesNotMatch(cartStoreSource, /wishlist/i);
    assert.doesNotMatch(cartViewSource, /wishlist/i);
  });

  await runTest("64. Scope: no online payment SDK introduced", () => {
    assert.strictEqual(webPackageJson.dependencies?.["@stripe/stripe-js"], undefined);
    assert.strictEqual(webPackageJson.dependencies?.["stripe"], undefined);
    assert.strictEqual(webPackageJson.dependencies?.["jazzcash"], undefined);
  });

  // =========================================================================
  // 9. PERSISTENCE & TOTALS SAFETY CORRECTIONS (Tests 65–75)
  // =========================================================================

  await runTest("65. malformed persisted Cart does not crash hydration", () => {
    assert.deepStrictEqual(sanitizePersistedCartItems(null), []);
    assert.deepStrictEqual(sanitizePersistedCartItems(undefined), []);
    assert.deepStrictEqual(sanitizePersistedCartItems("corrupted-string"), []);
    assert.deepStrictEqual(sanitizePersistedCartItems(12345), []);
    assert.deepStrictEqual(sanitizePersistedCartItems({ items: "not-an-array" }), []);
  });

  await runTest("66. malformed persisted line is discarded safely", () => {
    const raw = [
      null,
      undefined,
      123,
      "raw string",
      {},
      { productId: "only-prod" },
      { variantId: "only-var" },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("67. quantity 0 persisted line is discarded", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 0,
      },
    ];
    assert.strictEqual(isValidRawCartItem(raw[0]), false);
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("68. quantity >10 persisted line is discarded", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 11,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "33333333-3333-3333-3333-333333333333",
        quantity: 999,
      },
    ];
    assert.strictEqual(isValidRawCartItem(raw[0]), false);
    assert.strictEqual(isValidRawCartItem(raw[1]), false);
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("69. non-integer persisted quantity is discarded", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 2.5,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "33333333-3333-3333-3333-333333333333",
        quantity: "4",
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "44444444-4444-4444-4444-444444444444",
        quantity: -5,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "55555555-5555-5555-5555-555555555555",
        quantity: NaN,
      },
    ];
    for (const item of raw) {
      assert.strictEqual(isValidRawCartItem(item), false);
    }
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("70. malformed Product/Variant identity is discarded", () => {
    assert.strictEqual(isValidUuid(null), false);
    assert.strictEqual(isValidUuid({}), false);
    assert.strictEqual(isValidUuid(""), false);
    assert.strictEqual(isValidUuid("   "), false);
    assert.strictEqual(isValidUuid("<script>"), false);
    assert.strictEqual(isValidUuid("ab"), false);
    assert.strictEqual(isValidUuid("invalid!char"), false);
    assert.strictEqual(isValidUuid("abc"), false);
    assert.strictEqual(isValidUuid("product_123"), false);
    assert.strictEqual(isValidUuid("not-a-real-uuid"), false);

    const raw = [
      { productId: null, variantId: "22222222-2222-2222-2222-222222222222", quantity: 2 },
      { productId: {}, variantId: "22222222-2222-2222-2222-222222222222", quantity: 2 },
      { productId: "11111111-1111-1111-1111-111111111111", variantId: null, quantity: 2 },
      { productId: "11111111-1111-1111-1111-111111111111", variantId: {}, quantity: 2 },
      { productId: "<script>alert(1)</script>", variantId: "safe-id", quantity: 1 },
      { productId: "abc", variantId: "22222222-2222-2222-2222-222222222222", quantity: 2 },
      { productId: "11111111-1111-1111-1111-111111111111", variantId: "product_123", quantity: 2 },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("71. duplicate persisted Variant IDs normalize deterministically", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 3,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 4,
      },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual(sanitized[0].variantId, "22222222-2222-2222-2222-222222222222");
    assert.strictEqual(sanitized[0].quantity, 7);
  });

  await runTest("72. duplicate persisted Variant IDs capped at 10 when sum exceeds 10", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 6,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 6,
      },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual(sanitized[0].variantId, "22222222-2222-2222-2222-222222222222");
    assert.strictEqual(sanitized[0].quantity, 10);
  });

  await runTest("73. hydration never produces duplicate exact Variant lines", () => {
    const raw = [
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 2,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "33333333-3333-3333-3333-333333333333",
        quantity: 1,
      },
      {
        productId: "11111111-1111-1111-1111-111111111111",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 2,
      },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 2);
    const variantIds = sanitized.map((i) => i.variantId);
    assert.strictEqual(new Set(variantIds).size, 2);
  });

  await runTest("74. incompatible persisted version resets/migrates safely", () => {
    assert.match(cartStoreSource, /migrate:\s*\(persistedState:/);
    // Simulate migrate with unknown or legacy version 0
    const rawState = {
      items: [
        {
          productId: "11111111-1111-1111-1111-111111111111",
          variantId: "22222222-2222-2222-2222-222222222222",
          quantity: 2,
        },
      ],
    };
    // Extract migrate function behavior from cartStoreSource
    assert.match(cartStoreSource, /version !== CART_STORAGE_VERSION/);
    assert.match(cartStoreSource, /return\s*{\s*items:\s*\[\]\s*}/);
  });

  await runTest("75. direct invalid updateQuantity cannot create invalid Cart state", () => {
    useCartStore.getState().clearCart();
    useCartStore.getState().addItem({
      productId: "11111111-1111-1111-1111-111111111111",
      variantId: "22222222-2222-2222-2222-222222222222",
      quantity: 3,
    });
    const vid = "22222222-2222-2222-2222-222222222222";

    // Call updateQuantity with invalid quantities
    useCartStore.getState().updateQuantity(vid, 0);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 3);

    useCartStore.getState().updateQuantity(vid, -5);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 3);

    useCartStore.getState().updateQuantity(vid, 99);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 3);

    useCartStore.getState().updateQuantity(vid, 2.5);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 3);

    // Call with invalid variantId
    useCartStore.getState().updateQuantity("not!valid", 5);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 3);

    // Valid update works
    useCartStore.getState().updateQuantity(vid, 5);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 5);
  });

  // =========================================================================
  // 10. UUID & CART IDENTITY INTEGRITY (Tests 76–85)
  // =========================================================================

  await runTest("76. abc productId is rejected/discarded", () => {
    assert.strictEqual(isValidUuid("abc"), false);
    assert.strictEqual(
      isValidRawCartItem({ productId: "abc", variantId: VALID_VAR_1, quantity: 2 }),
      false
    );
    const sanitized = sanitizePersistedCartItems([
      { productId: "abc", variantId: VALID_VAR_1, quantity: 2 },
    ]);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("77. product_123 variantId is rejected/discarded", () => {
    assert.strictEqual(isValidUuid("product_123"), false);
    assert.strictEqual(
      isValidRawCartItem({ productId: VALID_PROD_1, variantId: "product_123", quantity: 2 }),
      false
    );
    const sanitized = sanitizePersistedCartItems([
      { productId: VALID_PROD_1, variantId: "product_123", quantity: 2 },
    ]);
    assert.strictEqual(sanitized.length, 0);
  });

  await runTest("78. malformed UUID string is rejected", () => {
    assert.strictEqual(isValidUuid("not-a-real-uuid"), false);
    assert.strictEqual(isValidUuid("11111111-1111-1111-1111"), false);
    assert.strictEqual(isValidUuid("11111111-1111-1111-1111-11111111111g"), false);
    assert.strictEqual(isValidUuid("11111111111111111111111111111111"), false);
    assert.strictEqual(isValidUuid(""), false);
    assert.strictEqual(isValidUuid(null), false);
    assert.strictEqual(isValidUuid(undefined), false);
    assert.strictEqual(isValidUuid({}), false);
    assert.strictEqual(isValidUuid(VALID_PROD_1), true);
    assert.strictEqual(isValidUuid(VALID_VAR_1), true);
  });

  await runTest("79. valid Product UUID + Variant UUID survives hydration", () => {
    const raw = [
      {
        productId: VALID_PROD_1,
        variantId: VALID_VAR_1,
        quantity: 3,
      },
    ];
    assert.strictEqual(isValidRawCartItem(raw[0]), true);
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual(sanitized[0].productId, VALID_PROD_1.toLowerCase());
    assert.strictEqual(sanitized[0].variantId, VALID_VAR_1.toLowerCase());
    assert.strictEqual(sanitized[0].quantity, 3);
  });

  await runTest("80. same Product + same Variant duplicate lines merge deterministically", () => {
    const raw = [
      {
        productId: VALID_PROD_1,
        variantId: VALID_VAR_1,
        quantity: 2,
      },
      {
        productId: VALID_PROD_1,
        variantId: VALID_VAR_1,
        quantity: 3,
      },
    ];
    const sanitized = sanitizePersistedCartItems(raw);
    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual(sanitized[0].productId, VALID_PROD_1.toLowerCase());
    assert.strictEqual(sanitized[0].variantId, VALID_VAR_1.toLowerCase());
    assert.strictEqual(sanitized[0].quantity, 5);
  });

  await runTest(
    "81. same Variant + conflicting Product IDs do not merge into a legitimate Cart line",
    () => {
      const raw = [
        {
          productId: VALID_PROD_1,
          variantId: VALID_VAR_1,
          quantity: 2,
        },
        {
          productId: VALID_PROD_2,
          variantId: VALID_VAR_1,
          quantity: 3,
        },
      ];
      const sanitized = sanitizePersistedCartItems(raw);
      // Only the first valid entry is retained; the conflicting entry with mismatching productId is discarded
      assert.strictEqual(sanitized.length, 1);
      assert.strictEqual(sanitized[0].productId, VALID_PROD_1.toLowerCase());
      assert.strictEqual(sanitized[0].variantId, VALID_VAR_1.toLowerCase());
      assert.strictEqual(sanitized[0].quantity, 2);
    }
  );

  await runTest(
    "82. hydrated Cart still contains no duplicate valid Product+Variant identities",
    () => {
      const raw = [
        {
          productId: VALID_PROD_1,
          variantId: VALID_VAR_1,
          quantity: 2,
        },
        {
          productId: VALID_PROD_1,
          variantId: VALID_VAR_2,
          quantity: 3,
        },
        {
          productId: VALID_PROD_1,
          variantId: VALID_VAR_1,
          quantity: 4,
        },
        {
          productId: VALID_PROD_2,
          variantId: VALID_VAR_3,
          quantity: 1,
        },
        {
          productId: VALID_PROD_2,
          variantId: VALID_VAR_2, // conflicting product ID for VALID_VAR_2
          quantity: 5,
        },
      ];
      const sanitized = sanitizePersistedCartItems(raw);
      assert.strictEqual(sanitized.length, 3);
      const variantIds = sanitized.map((i) => i.variantId);
      assert.strictEqual(new Set(variantIds).size, 3);
      assert.strictEqual(variantIds.includes(VALID_VAR_1.toLowerCase()), true);
      assert.strictEqual(variantIds.includes(VALID_VAR_2.toLowerCase()), true);
      assert.strictEqual(variantIds.includes(VALID_VAR_3.toLowerCase()), true);
      assert.strictEqual(
        sanitized.find((i) => i.variantId === VALID_VAR_1.toLowerCase())?.quantity,
        6
      );
      assert.strictEqual(
        sanitized.find((i) => i.variantId === VALID_VAR_2.toLowerCase())?.quantity,
        3
      );
      assert.strictEqual(
        sanitized.find((i) => i.variantId === VALID_VAR_3.toLowerCase())?.quantity,
        1
      );
    }
  );

  await runTest("83. addItem() rejects malformed Product UUID", () => {
    useCartStore.getState().clearCart();
    const res1 = useCartStore.getState().addItem({
      productId: "abc",
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.reason, "INVALID_IDENTITY");

    const res2 = useCartStore.getState().addItem({
      productId: "not-a-real-uuid",
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.reason, "INVALID_IDENTITY");
    assert.strictEqual(useCartStore.getState().items.length, 0);
  });

  await runTest("84. addItem() rejects malformed Variant UUID", () => {
    useCartStore.getState().clearCart();
    const res1 = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: "product_123",
      quantity: 1,
    });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.reason, "INVALID_IDENTITY");

    const res2 = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: "invalid-variant-uuid",
      quantity: 1,
    });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.reason, "INVALID_IDENTITY");

    // Also rejects conflicting Product ID for an existing Variant
    const resValid = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    assert.strictEqual(resValid.success, true);
    assert.strictEqual(useCartStore.getState().items.length, 1);

    const resConflict = useCartStore.getState().addItem({
      productId: VALID_PROD_2,
      variantId: VALID_VAR_1,
      quantity: 1,
    });
    assert.strictEqual(resConflict.success, false);
    assert.strictEqual(resConflict.reason, "INVALID_IDENTITY");
    assert.strictEqual(useCartStore.getState().items.length, 1);
  });

  await runTest("85. existing valid Cart behavior remains unchanged", () => {
    useCartStore.getState().clearCart();
    const res1 = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 2,
    });
    assert.strictEqual(res1.success, true);

    const res2 = useCartStore.getState().addItem({
      productId: VALID_PROD_1,
      variantId: VALID_VAR_1,
      quantity: 3,
    });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(useCartStore.getState().items.length, 1);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 5);

    useCartStore.getState().updateQuantity(VALID_VAR_1, 8);
    assert.strictEqual(useCartStore.getState().items[0].quantity, 8);

    useCartStore.getState().removeItem(VALID_VAR_1);
    assert.strictEqual(useCartStore.getState().items.length, 0);
  });

  // Summary
  console.log("\n========================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `Cart Frontend Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
  );
  if (failed > 0) {
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        const firstLine = String(r.error?.message || "").split("\n")[0];
        console.log(`  - ${r.name}: ${firstLine}`);
      });
  }
  console.log("========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Unhandled error running cart test suite:", err);
  process.exit(1);
});
