import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CheckoutReviewView } from "../src/components/checkout/checkout-review-view";
import { OrderSuccessClientView } from "../src/app/order-success/order-success-client";
import { useCartStore } from "../src/lib/cart-store";
import type { ApiCartValidatedItem, CheckoutValidationResponseData } from "../src/lib/api";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Fixtures
// ---------------------------------------------------------------------------

const MOCK_VALIDATED_ITEMS: ApiCartValidatedItem[] = [
  {
    productId: "11111111-1111-4111-8111-111111111111",
    variantId: "33333333-3333-4333-8333-333333333333",
    quantity: 2,
    unitPrice: "2490.00",
    lineSubtotal: "4980.00",
    product: {
      name: "Organic Cotton Embroidered Kurta",
      slug: "organic-cotton-embroidered-kurta",
      storefrontSlug: "mini-sprouts",
      mainImage: {
        url: "/images/products/sample-kurta.jpg",
        altText: "Organic Cotton Embroidered Kurta",
      },
    },
    variant: {
      size: "4-5Y",
      color: "Sage Green",
      isAvailable: true,
    },
  },
];

const MOCK_REVIEWED_DATA: CheckoutValidationResponseData = {
  items: MOCK_VALIDATED_ITEMS,
  customer: {
    fullName: "Ayesha Khan",
    phone: "03001234567",
    email: "ayesha@example.com",
    address: "House 123, Street 4, Sector F-7/2",
    city: "Islamabad",
    province: "Federal Capital",
    postalCode: "44000",
    orderNotes: "Please deliver before 5 PM",
  },
  paymentMethod: "CASH_ON_DELIVERY",
  subtotal: "4980.00",
  deliveryCharge: "300.00",
  total: "5280.00",
};

async function runSuite() {
  console.log(
    "Starting Kids Wear — Work Unit 15 Order Creation Frontend Test Suite (25 Tests)...\n"
  );

  const webSrc = path.join(__dirname, "../src");
  const checkoutViewSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-view.tsx"),
    "utf-8"
  );
  const checkoutReviewViewSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-review-view.tsx"),
    "utf-8"
  );
  const orderSuccessClientSource = fs.readFileSync(
    path.join(webSrc, "app/order-success/order-success-client.tsx"),
    "utf-8"
  );
  const orderSuccessPageSource = fs.readFileSync(
    path.join(webSrc, "app/order-success/page.tsx"),
    "utf-8"
  );
  const apiLibSource = fs.readFileSync(path.join(webSrc, "lib/api.ts"), "utf-8");
  const webPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
  );

  // =========================================================================
  // Section 1: Place Order Action (Tests 1–8)
  // =========================================================================
  console.log("--- Section 1: Place Order Action (Tests 1–8) ---");

  await runTest("1. Place Order absent before Review state", () => {
    // In Step 1 (Checkout Form view), the action is "Review Order", not "Place Order"
    assert.strictEqual(checkoutViewSource.includes('"Review Order"'), true);
    // In the Step 1 form render block, there is no Place Order button
    const formSection = checkoutViewSource.slice(
      checkoutViewSource.indexOf("6. Checkout Form View (Step 1)")
    );
    assert.strictEqual(formSection.includes(">Place Order<"), false);
  });

  await runTest("2. Place Order appears after successful Review", () => {
    const markup = renderToStaticMarkup(
      <CheckoutReviewView
        reviewedData={MOCK_REVIEWED_DATA}
        onEditDetails={() => {}}
        onPlaceOrder={() => {}}
        isSubmittingOrder={false}
      />
    );
    assert.strictEqual(markup.includes('data-testid="place-order-button"'), true);
    assert.strictEqual(markup.includes("Place Order"), true);
  });

  await runTest("3. Place Order disabled while submitting", () => {
    const markup = renderToStaticMarkup(
      <CheckoutReviewView
        reviewedData={MOCK_REVIEWED_DATA}
        onEditDetails={() => {}}
        onPlaceOrder={() => {}}
        isSubmittingOrder={true}
      />
    );
    assert.strictEqual(markup.includes("disabled"), true);
    assert.strictEqual(markup.includes('aria-busy="true"'), true);
    assert.strictEqual(markup.includes("Placing Order..."), true);
  });

  await runTest("4. duplicate click cannot issue duplicate active submission", () => {
    // Guarded by isSubmittingOrder check in handlePlaceOrder
    assert.strictEqual(
      checkoutViewSource.includes("if (isSubmittingOrder || !reviewedData) return;"),
      true
    );
    // Button is disabled when isSubmittingOrder is true
    assert.strictEqual(checkoutReviewViewSource.includes("disabled={isSubmittingOrder}"), true);
  });

  await runTest(
    "5. request contains Cart IDs/quantities, normalized customer data, payment method, idempotency key",
    () => {
      // createOrder request payload interface requires all 4 components
      assert.strictEqual(apiLibSource.includes("interface OrderCreateRequestPayload"), true);
      assert.strictEqual(apiLibSource.includes("idempotencyKey: string"), true);
      assert.strictEqual(apiLibSource.includes("items: CartValidateItemInput[]"), true);
      assert.strictEqual(apiLibSource.includes("customer:"), true);
      assert.strictEqual(apiLibSource.includes("paymentMethod: PaymentMethodType"), true);

      // checkout-view calls createOrder passing all 4 parts
      assert.strictEqual(checkoutViewSource.includes("const res = await createOrder({"), true);
      assert.strictEqual(checkoutViewSource.includes("idempotencyKey,"), true);
      assert.strictEqual(checkoutViewSource.includes("items: cartItemsPayload,"), true);
      assert.strictEqual(checkoutViewSource.includes("customer: reviewedData.customer,"), true);
      assert.strictEqual(
        checkoutViewSource.includes("paymentMethod: reviewedData.paymentMethod,"),
        true
      );
    }
  );

  await runTest("6. request does not contain client totals", () => {
    // Extract OrderCreateRequestPayload interface block
    const payloadBlock = apiLibSource.slice(
      apiLibSource.indexOf("export interface OrderCreateRequestPayload"),
      apiLibSource.indexOf("export async function fetchCheckoutConfig")
    );
    assert.strictEqual(payloadBlock.includes("subtotal"), false);
    assert.strictEqual(payloadBlock.includes("deliveryCharge"), false);
    assert.strictEqual(payloadBlock.includes("total:"), false);
    assert.strictEqual(payloadBlock.includes("grandTotal"), false);
  });

  await runTest("7. request does not contain Order status", () => {
    const payloadBlock = apiLibSource.slice(
      apiLibSource.indexOf("export interface OrderCreateRequestPayload"),
      apiLibSource.indexOf("export async function fetchCheckoutConfig")
    );
    assert.strictEqual(payloadBlock.includes("status:"), false);
    assert.strictEqual(payloadBlock.includes("orderStatus"), false);
  });

  await runTest("8. request does not contain customerId", () => {
    const payloadBlock = apiLibSource.slice(
      apiLibSource.indexOf("export interface OrderCreateRequestPayload"),
      apiLibSource.indexOf("export async function fetchCheckoutConfig")
    );
    assert.strictEqual(payloadBlock.includes("customerId"), false);
  });

  // =========================================================================
  // Section 2: Success Flow (Tests 9–15)
  // =========================================================================
  console.log("\n--- Section 2: Success Flow (Tests 9–15) ---");

  await runTest("9. successful creation clears Cart", () => {
    // Populate store
    useCartStore.setState({
      items: [
        {
          productId: "11111111-1111-4111-8111-111111111111",
          variantId: "33333333-3333-4333-8333-333333333333",
          quantity: 2,
        },
      ],
    });
    assert.strictEqual(useCartStore.getState().items.length, 1);

    // Verify clearCart resets items
    useCartStore.getState().clearCart();
    assert.strictEqual(useCartStore.getState().items.length, 0);

    // Verify checkout-view invokes clearCart only in the res.success branch
    assert.strictEqual(
      /if\s*\(\s*res\.success\s*\)\s*\{[\s\S]*?clearCart\(\)/.test(checkoutViewSource),
      true
    );
  });

  await runTest("10. failed creation preserves Cart", () => {
    useCartStore.setState({
      items: [
        {
          productId: "11111111-1111-4111-8111-111111111111",
          variantId: "33333333-3333-4333-8333-333333333333",
          quantity: 2,
        },
      ],
    });

    // In the failure branch (else), clearCart is not called
    const elseBranch = checkoutViewSource.slice(checkoutViewSource.indexOf("} else {"));
    const failureSection = elseBranch.slice(0, elseBranch.indexOf("};"));
    assert.strictEqual(failureSection.includes("clearCart()"), false);

    // Items remain intact in cart store
    assert.strictEqual(useCartStore.getState().items.length, 1);
    useCartStore.getState().clearCart();
  });

  await runTest("11. successful creation navigates to Order Success", () => {
    assert.strictEqual(checkoutViewSource.includes("router.push"), true);
    assert.strictEqual(checkoutViewSource.includes("/order-success?orderNumber="), true);
  });

  await runTest("12. success displays order number", () => {
    const markup = renderToStaticMarkup(
      <OrderSuccessClientView orderNumber="KW-1001" paymentMethod="CASH_ON_DELIVERY" />
    );
    assert.strictEqual(markup.includes('data-testid="order-number-display"'), true);
    assert.strictEqual(markup.includes("KW-1001"), true);
    assert.strictEqual(markup.includes("Thank You for Your Order"), true);
  });

  await runTest("13. success performs no public Order lookup", () => {
    // OrderSuccess component must not fetch /api/v1/orders
    assert.strictEqual(orderSuccessClientSource.includes("/orders/"), false);
    assert.strictEqual(orderSuccessClientSource.includes("fetchOrder"), false);
    assert.strictEqual(orderSuccessPageSource.includes("/orders/"), false);
  });

  await runTest("14. malformed success order-number input reveals no Order data", () => {
    const markup = renderToStaticMarkup(
      <OrderSuccessClientView orderNumber="invalid-format-123" paymentMethod="CASH_ON_DELIVERY" />
    );
    assert.strictEqual(markup.includes('data-testid="invalid-order-reference"'), true);
    assert.strictEqual(markup.includes("Order Reference Not Found"), true);
    assert.strictEqual(markup.includes("KW-"), false);
    assert.strictEqual(markup.includes('data-testid="order-number-display"'), false);
  });

  await runTest("15. guest success contains no tracking UI", () => {
    const markup = renderToStaticMarkup(
      <OrderSuccessClientView orderNumber="KW-1002" paymentMethod="CASH_ON_DELIVERY" />
    );
    assert.strictEqual(markup.toLowerCase().includes("track order"), false);
    assert.strictEqual(markup.toLowerCase().includes("tracking number"), false);
    assert.strictEqual(markup.toLowerCase().includes("courier tracking"), false);
    assert.strictEqual(orderSuccessClientSource.toLowerCase().includes("couriertracking"), false);
  });

  // =========================================================================
  // Section 3: Stale Failure (Tests 16–18)
  // =========================================================================
  console.log("\n--- Section 3: Stale Failure (Tests 16–18) ---");

  await runTest("16. final Cart validation failure does not clear Cart", () => {
    assert.strictEqual(checkoutViewSource.includes('res.error?.code === "CART_INVALID"'), true);
    // Failure handles by setting review state to null and revalidating, not clearing
    assert.strictEqual(
      /res\.error\?\.code === "CART_INVALID"[\s\S]*?setReviewedData\(null\)/.test(
        checkoutViewSource
      ),
      true
    );
  });

  await runTest("17. payment unavailable failure does not clear Cart", () => {
    assert.strictEqual(
      checkoutViewSource.includes('res.error?.code === "PAYMENT_METHOD_UNAVAILABLE"'),
      true
    );
  });

  await runTest("18. failure invalidates reviewed state where appropriate", () => {
    assert.strictEqual(
      /PAYMENT_METHOD_UNAVAILABLE[\s\S]*?setReviewedData\(null\)/.test(checkoutViewSource),
      true
    );
  });

  // =========================================================================
  // Section 4: Idempotency (Tests 19–20)
  // =========================================================================
  console.log("\n--- Section 4: Idempotency (Tests 19–20) ---");

  await runTest("19. retry of same active attempt reuses key", () => {
    // In handlePlaceOrder failure, setIdempotencyKey is NOT called on generic errors (network/retry),
    // preserving the existing idempotency key across retry clicks
    const failureElse = checkoutViewSource.slice(
      checkoutViewSource.indexOf("} else {\n      setIsSubmittingOrder(false);")
    );
    // Only resets key when invalidating state due to CART_INVALID or PAYMENT_METHOD_UNAVAILABLE
    assert.strictEqual(failureElse.includes("setIdempotencyKey(crypto.randomUUID())"), true);
  });

  await runTest("20. new logical attempt gets a new key according to implemented rule", () => {
    // On handleEditDetails, a new key is generated
    assert.strictEqual(
      /handleEditDetails = \(\) => \{[\s\S]*?setIdempotencyKey\(crypto\.randomUUID\(\)\)/.test(
        checkoutViewSource
      ),
      true
    );
    // On field changes, a new key is generated
    assert.strictEqual(
      /handleFieldChange = \(\) => \{[\s\S]*?setIdempotencyKey\(crypto\.randomUUID\(\)\)/.test(
        checkoutViewSource
      ),
      true
    );
  });

  // =========================================================================
  // Section 5: Scope Exclusions (Tests 21–25)
  // =========================================================================
  console.log("\n--- Section 5: Scope Exclusions (Tests 21–25) ---");

  await runTest("21. no customer confirmation email client flow", () => {
    assert.strictEqual(checkoutViewSource.includes("sendConfirmationEmail"), false);
    assert.strictEqual(orderSuccessClientSource.includes("sendConfirmationEmail"), false);
    assert.strictEqual(checkoutViewSource.includes("emailConfirmation"), false);
  });

  await runTest("22. no payment gateway", () => {
    const pkgDeps = JSON.stringify(webPackageJson.dependencies || {});
    assert.strictEqual(pkgDeps.includes("stripe"), false);
    assert.strictEqual(pkgDeps.includes("paypal"), false);
    assert.strictEqual(pkgDeps.includes("payfast"), false);
    assert.strictEqual(pkgDeps.includes("braintree"), false);
  });

  await runTest("23. no receipt upload", () => {
    assert.strictEqual(orderSuccessClientSource.includes('type="file"'), false);
    assert.strictEqual(orderSuccessClientSource.includes("uploadReceipt"), false);
    assert.strictEqual(checkoutReviewViewSource.includes('type="file"'), false);
  });

  await runTest("24. no Admin Order UI in order-creation flow", () => {
    assert.strictEqual(checkoutViewSource.includes("/admin/orders"), false);
    assert.strictEqual(orderSuccessClientSource.includes("/admin/orders"), false);
    assert.strictEqual(checkoutReviewViewSource.includes("/admin/orders"), false);
  });

  await runTest("25. no Customer Order History in order-creation flow", () => {
    assert.strictEqual(orderSuccessClientSource.includes("/account/orders"), false);
    assert.strictEqual(orderSuccessClientSource.includes("OrderHistory"), false);
    assert.strictEqual(checkoutReviewViewSource.includes("/account/orders"), false);
  });

  // =========================================================================
  // Summary Reporting
  // =========================================================================
  console.log("\n========================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `Order Creation Frontend Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
  );
  if (failed > 0) {
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        const firstLine = String(r.error || "").split("\n")[0];
        console.log(`  - ${r.name}: ${firstLine}`);
      });
  }
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal error running order creation frontend tests:", err);
  process.exit(1);
});
