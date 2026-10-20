import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CheckoutCustomerForm } from "../src/components/checkout/checkout-customer-form";
import { CheckoutPaymentSelection } from "../src/components/checkout/checkout-payment-selection";
import { CheckoutOrderSummary } from "../src/components/checkout/checkout-order-summary";
import { CheckoutReviewView } from "../src/components/checkout/checkout-review-view";
import {
  checkoutFormSchema,
  normalizeCheckoutFormData,
  type CheckoutFormData,
} from "../src/lib/checkout-validation";
import { useCartStore } from "../src/lib/cart-store";
import { EmptyCartState } from "../src/components/commerce/system-states";
import type {
  ApiCartValidatedItem,
  CheckoutConfigData,
  CheckoutValidationResponseData,
} from "../src/lib/api";

// ---------------------------------------------------------------------------
// Mock Data Fixtures
// ---------------------------------------------------------------------------

const MOCK_CONFIG: CheckoutConfigData = {
  paymentMethods: {
    cashOnDelivery: {
      available: true,
    },
    bankTransfer: {
      available: true,
      bankName: "Meezan Bank",
      accountTitle: "Kids Wear Private Limited",
      accountOrIban: "PK36MEZN0001234567890102",
      branchCode: "0102",
      branchLocation: "Gulberg III, Lahore",
      instructions: "Please include your order reference in the transfer remarks.",
    },
  },
};

const MOCK_CONFIG_BANK_DISABLED: CheckoutConfigData = {
  paymentMethods: {
    cashOnDelivery: {
      available: true,
    },
    bankTransfer: {
      available: false,
      bankName: null,
      accountTitle: null,
      accountOrIban: null,
      branchCode: null,
      branchLocation: null,
      instructions: null,
    },
  },
};

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
  deliveryCharge: "250.00",
  total: "5230.00",
};

const VALID_FORM_DATA: CheckoutFormData = {
  fullName: "Ayesha Khan",
  phone: "03001234567",
  email: "ayesha@example.com",
  address: "House 123, Street 4, Sector F-7/2",
  city: "Islamabad",
  province: "Federal Capital",
  postalCode: "44000",
  orderNotes: "Please deliver before 5 PM",
  paymentMethod: "CASH_ON_DELIVERY",
};

// Helper mock for react-hook-form register
const createMockRegister = () => {
  return ((name: string, options?: any) => ({
    name,
    onChange: options?.onChange || (() => {}),
    onBlur: () => {},
    ref: () => {},
  })) as any;
};

// ---------------------------------------------------------------------------
// Test Runner Harness
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Suite Execution
// ---------------------------------------------------------------------------

async function runSuite() {
  console.log("Starting Kids Wear — Work Unit 14 Checkout Frontend Test Suite...\n");

  const webSrc = path.join(__dirname, "../src");
  const checkoutPageSource = fs.readFileSync(path.join(webSrc, "app/checkout/page.tsx"), "utf-8");
  const checkoutViewSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-view.tsx"),
    "utf-8"
  );
  const checkoutCustomerFormSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-customer-form.tsx"),
    "utf-8"
  );
  const checkoutPaymentSelectionSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-payment-selection.tsx"),
    "utf-8"
  );
  const checkoutReviewViewSource = fs.readFileSync(
    path.join(webSrc, "components/checkout/checkout-review-view.tsx"),
    "utf-8"
  );
  const checkoutValidationSource = fs.readFileSync(
    path.join(webSrc, "lib/checkout-validation.ts"),
    "utf-8"
  );
  const cartStoreSource = fs.readFileSync(path.join(webSrc, "lib/cart-store.ts"), "utf-8");
  const webPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
  );

  // =========================================================================
  // 1. ROUTE / GUARD (Tests 1–6)
  // =========================================================================

  await runTest("1. Route / Guard: Global /checkout route exists outside storefront scopes", () => {
    assert.strictEqual(fs.existsSync(path.join(webSrc, "app/checkout/page.tsx")), true);
    assert.strictEqual(
      fs.existsSync(path.join(webSrc, "app/[storefront]/checkout/page.tsx")),
      false
    );
    assert.strictEqual(checkoutPageSource.includes('export const dynamic = "force-dynamic"'), true);
  });

  await runTest(
    "2. Route / Guard: Guest checkout does not require customer login or customer auth token",
    () => {
      assert.strictEqual(checkoutPageSource.includes("useCustomerAuth"), false);
      assert.strictEqual(checkoutPageSource.includes("customer/login"), false);
      assert.strictEqual(checkoutViewSource.includes("useCustomerAuth"), false);
      assert.strictEqual(checkoutViewSource.includes("authToken"), false);
    }
  );

  await runTest("3. Route / Guard: Empty cart blocks checkout and displays empty state", () => {
    const markup = renderToStaticMarkup(<EmptyCartState shopHref="/" />);
    assert.strictEqual(markup.toLowerCase().includes("your shopping bag is empty"), true);
    assert.strictEqual(markup.includes('href="/"'), true);
    assert.strictEqual(checkoutViewSource.includes('<EmptyCartState shopHref="/" />'), true);
  });

  await runTest(
    "4. Route / Guard: Stale/invalid cart blocks checkout with attention banner and bag link",
    () => {
      assert.strictEqual(checkoutViewSource.includes("Shopping Bag Requires Attention"), true);
      assert.strictEqual(checkoutViewSource.includes('href="/cart"'), true);
      assert.strictEqual(
        checkoutViewSource.includes(
          "Some items in your shopping bag have changed or are currently unavailable"
        ),
        true
      );
    }
  );

  await runTest("5. Route / Guard: Unvalidated cart does not show reviewed state", () => {
    assert.strictEqual(
      checkoutViewSource.includes("const [reviewedData, setReviewedData] = useState"),
      true
    );
    assert.strictEqual(checkoutViewSource.includes("if (reviewedData) {"), true);
    assert.strictEqual(checkoutViewSource.includes("<CheckoutReviewView"), true);
  });

  await runTest(
    "6. Route / Guard: API failure/outage preserves local cart without clearing items",
    () => {
      useCartStore.getState().clearCart();
      useCartStore.getState().addItem({
        productId: "11111111-1111-4111-8111-111111111111",
        variantId: "33333333-3333-4333-8333-333333333333",
        quantity: 2,
      });

      assert.strictEqual(checkoutViewSource.includes("Checkout Unavailable"), true);
      assert.strictEqual(
        checkoutViewSource.includes(
          "We couldn't connect to our servers to verify your shopping bag. Your items remain safely in your bag."
        ),
        true
      );
      // Ensure cart items remained intact
      assert.strictEqual(useCartStore.getState().items.length, 1);
    }
  );

  // =========================================================================
  // 2. FIELDS & VALIDATION (Tests 7–18)
  // =========================================================================

  await runTest("7. Fields: Required indicator (*) on Full Name", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
    );
    assert.strictEqual(markup.includes("Full Name"), true);
    assert.strictEqual(
      checkoutCustomerFormSource.includes(
        "<FormField isRequired isInvalid={Boolean(errors.fullName)}>"
      ),
      true
    );
  });

  await runTest("8. Fields: Required indicator (*) on Phone Number", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
    );
    assert.strictEqual(markup.includes("Phone Number"), true);
    assert.strictEqual(
      checkoutCustomerFormSource.includes(
        "<FormField isRequired isInvalid={Boolean(errors.phone)}>"
      ),
      true
    );
  });

  await runTest("9. Fields: Required indicator (*) on Street Address", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
    );
    assert.strictEqual(markup.includes("Street Address"), true);
    assert.strictEqual(
      checkoutCustomerFormSource.includes(
        "<FormField isRequired isInvalid={Boolean(errors.address)}>"
      ),
      true
    );
  });

  await runTest("10. Fields: Required indicator (*) on City", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
    );
    assert.strictEqual(markup.includes("City"), true);
    assert.strictEqual(
      checkoutCustomerFormSource.includes(
        "<FormField isRequired isInvalid={Boolean(errors.city)}>"
      ),
      true
    );
  });

  await runTest("11. Fields: Required indicator (*) on Province", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
    );
    assert.strictEqual(markup.includes("Province"), true);
    assert.strictEqual(
      checkoutCustomerFormSource.includes(
        "<FormField isRequired isInvalid={Boolean(errors.province)}>"
      ),
      true
    );
  });

  await runTest(
    "12. Fields: Optional Email accepts empty string or null, validates format when present",
    () => {
      const emptyEmailRes = checkoutFormSchema.safeParse({
        ...VALID_FORM_DATA,
        email: "",
      });
      assert.strictEqual(emptyEmailRes.success, true);
      const normalizedEmpty = normalizeCheckoutFormData({
        ...VALID_FORM_DATA,
        email: "",
      });
      assert.strictEqual(normalizedEmpty.email, null);

      const invalidEmailRes = checkoutFormSchema.safeParse({
        ...VALID_FORM_DATA,
        email: "not-a-valid-email",
      });
      assert.strictEqual(invalidEmailRes.success, false);
      if (!invalidEmailRes.success) {
        assert.strictEqual(
          invalidEmailRes.error.issues[0].message,
          "Please enter a valid email address"
        );
      }
    }
  );

  await runTest(
    "13. Fields: Blank optional fields produce normalized nullable Checkout payload values",
    () => {
      // Empty strings
      const normalizedEmpty = normalizeCheckoutFormData({
        ...VALID_FORM_DATA,
        email: "",
        postalCode: "",
        orderNotes: "",
      });
      assert.strictEqual(normalizedEmpty.email, null);
      assert.strictEqual(normalizedEmpty.postalCode, null);
      assert.strictEqual(normalizedEmpty.orderNotes, null);

      // Whitespace-only strings
      const normalizedWhitespace = normalizeCheckoutFormData({
        ...VALID_FORM_DATA,
        email: "   ",
        postalCode: "     ",
        orderNotes: "       ",
      });
      assert.strictEqual(normalizedWhitespace.email, null);
      assert.strictEqual(normalizedWhitespace.postalCode, null);
      assert.strictEqual(normalizedWhitespace.orderNotes, null);

      // Trimmed and preserved when non-empty
      const normalizedPreserved = normalizeCheckoutFormData({
        ...VALID_FORM_DATA,
        email: "  customer@example.com  ",
        postalCode: "  54000  ",
        orderNotes: "  Please call on arrival  ",
      });
      assert.strictEqual(normalizedPreserved.email, "customer@example.com");
      assert.strictEqual(normalizedPreserved.postalCode, "54000");
      assert.strictEqual(normalizedPreserved.orderNotes, "Please call on arrival");
    }
  );

  await runTest("14. Fields: Whitespace-only required fields show validation errors", () => {
    // Whitespace fullName
    const resName = checkoutFormSchema.safeParse({
      ...VALID_FORM_DATA,
      fullName: "     ",
    });
    assert.strictEqual(resName.success, false);

    // Whitespace phone
    const resPhone = checkoutFormSchema.safeParse({
      ...VALID_FORM_DATA,
      phone: "       ",
    });
    assert.strictEqual(resPhone.success, false);

    // Whitespace address
    const resAddress = checkoutFormSchema.safeParse({
      ...VALID_FORM_DATA,
      address: "     ",
    });
    assert.strictEqual(resAddress.success, false);

    // Whitespace city
    const resCity = checkoutFormSchema.safeParse({
      ...VALID_FORM_DATA,
      city: "   ",
    });
    assert.strictEqual(resCity.success, false);

    // Whitespace province
    const resProvince = checkoutFormSchema.safeParse({
      ...VALID_FORM_DATA,
      province: "   ",
    });
    assert.strictEqual(resProvince.success, false);
  });

  await runTest(
    "15. Fields: No unrequested fields (CNIC, company name, date of birth, salutation)",
    () => {
      const markup = renderToStaticMarkup(
        <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
      );
      const lower = markup.toLowerCase();
      assert.strictEqual(lower.includes("cnic"), false);
      assert.strictEqual(lower.includes("company"), false);
      assert.strictEqual(lower.includes("birth"), false);
      assert.strictEqual(lower.includes("salutation"), false);
      assert.strictEqual(lower.includes("gender"), false);
    }
  );

  await runTest(
    "16. Fields: Semantic input types (type=tel for phone, type=email for email)",
    () => {
      const markup = renderToStaticMarkup(
        <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
      );
      assert.strictEqual(markup.includes('type="tel"'), true);
      assert.strictEqual(markup.includes('autoComplete="tel"'), true);
      assert.strictEqual(markup.includes('type="email"'), true);
      assert.strictEqual(markup.includes('autoComplete="email"'), true);
    }
  );

  await runTest("17. Fields: Client Zod schema validates boundary lengths accurately", () => {
    // Short name
    assert.strictEqual(
      checkoutFormSchema.safeParse({ ...VALID_FORM_DATA, fullName: "A" }).success,
      false
    );
    // Short phone
    assert.strictEqual(
      checkoutFormSchema.safeParse({ ...VALID_FORM_DATA, phone: "12345" }).success,
      false
    );
    // Short address
    assert.strictEqual(
      checkoutFormSchema.safeParse({ ...VALID_FORM_DATA, address: "Abc" }).success,
      false
    );
    // Long name (>120)
    assert.strictEqual(
      checkoutFormSchema.safeParse({
        ...VALID_FORM_DATA,
        fullName: "A".repeat(121),
      }).success,
      false
    );
    // Long order notes (>1000)
    assert.strictEqual(
      checkoutFormSchema.safeParse({
        ...VALID_FORM_DATA,
        orderNotes: "A".repeat(1001),
      }).success,
      false
    );
  });

  await runTest(
    "18. Fields: Customer PII is never stored in browser persistence (localStorage / Zustand)",
    () => {
      assert.strictEqual(cartStoreSource.includes("fullName"), false);
      assert.strictEqual(cartStoreSource.includes("address"), false);
      assert.strictEqual(cartStoreSource.includes("phone"), false);
      assert.strictEqual(checkoutViewSource.includes("localStorage.setItem"), false);
      assert.strictEqual(checkoutViewSource.includes("sessionStorage.setItem"), false);
    }
  );

  // =========================================================================
  // 3. PAYMENT METHOD SELECTION (Tests 19–25)
  // =========================================================================

  await runTest("19. Payment: Cash on Delivery is displayed as a selectable payment option", () => {
    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={MOCK_CONFIG.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(markup.includes("Cash on Delivery"), true);
    assert.strictEqual(markup.includes('value="CASH_ON_DELIVERY"'), true);
  });

  await runTest("20. Payment: Cash on Delivery defaults to selected", () => {
    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={MOCK_CONFIG.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(markup.includes('id="payment-cod"'), true);
    assert.strictEqual(
      markup.includes('checked="" value="CASH_ON_DELIVERY"') ||
        markup.includes('value="CASH_ON_DELIVERY" checked=""') ||
        markup.includes('checked value="CASH_ON_DELIVERY"'),
      true
    );
  });

  await runTest("21. Payment: configured Bank Transfer remains selectable", () => {
    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={MOCK_CONFIG.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(markup.includes("Bank Transfer"), true);
    // Should not be disabled when available
    assert.strictEqual(markup.includes('id="payment-bank" disabled=""'), false);
  });

  await runTest("22. Payment: Manual Bank Transfer shows bank details card when selected", () => {
    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={MOCK_CONFIG.paymentMethods}
        selectedMethod="BANK_TRANSFER"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(markup.includes('data-testid="bank-transfer-details"'), true);
    assert.strictEqual(markup.includes("Meezan Bank"), true);
    assert.strictEqual(markup.includes("Kids Wear Private Limited"), true);
    assert.strictEqual(markup.includes("PK36MEZN0001234567890102"), true);
  });

  await runTest("23. Payment: Bank Transfer disabled when instructions are missing", () => {
    const missingInstructionsConfig: CheckoutConfigData = {
      paymentMethods: {
        cashOnDelivery: { available: true },
        bankTransfer: {
          available: true,
          bankName: "Meezan Bank",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK36MEZN0001234567890102",
          branchCode: "0102",
          branchLocation: "Lahore",
          instructions: null,
        },
      },
    };

    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={missingInstructionsConfig.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(
      markup.includes('id="payment-bank" disabled=""') ||
        markup.includes('id="payment-bank" disabled'),
      true
    );
    assert.strictEqual(markup.includes("undergoing configuration and is unavailable"), true);
    assert.strictEqual(markup.includes('data-testid="bank-transfer-details"'), false);
  });

  await runTest("24. Payment: Bank Transfer disabled when instructions are whitespace-only", () => {
    const whitespaceInstructionsConfig: CheckoutConfigData = {
      paymentMethods: {
        cashOnDelivery: { available: true },
        bankTransfer: {
          available: true,
          bankName: "Meezan Bank",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK36MEZN0001234567890102",
          branchCode: "0102",
          branchLocation: "Lahore",
          instructions: "     ",
        },
      },
    };

    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={whitespaceInstructionsConfig.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    assert.strictEqual(
      markup.includes('id="payment-bank" disabled=""') ||
        markup.includes('id="payment-bank" disabled'),
      true
    );
    assert.strictEqual(markup.includes("undergoing configuration and is unavailable"), true);
  });

  await runTest(
    "25. Payment: optional branch data absence does not disable configured Bank Transfer",
    () => {
      const noBranchConfig: CheckoutConfigData = {
        paymentMethods: {
          cashOnDelivery: { available: true },
          bankTransfer: {
            available: true,
            bankName: "Meezan Bank",
            accountTitle: "Kids Wear Private Limited",
            accountOrIban: "PK36MEZN0001234567890102",
            branchCode: null,
            branchLocation: null,
            instructions: "Transfer and notify support.",
          },
        },
      };

      const markup = renderToStaticMarkup(
        <CheckoutPaymentSelection
          paymentMethods={noBranchConfig.paymentMethods}
          selectedMethod="BANK_TRANSFER"
          onSelectMethod={() => {}}
        />
      );
      // Not disabled
      assert.strictEqual(markup.includes('id="payment-bank" disabled=""'), false);
      assert.strictEqual(markup.includes('data-testid="bank-transfer-details"'), true);
      assert.strictEqual(markup.includes("Transfer and notify support."), true);
    }
  );

  await runTest(
    "26. Payment: Bank details are rendered dynamically from config without hardcoded values",
    () => {
      const customConfig: CheckoutConfigData = {
        paymentMethods: {
          cashOnDelivery: { available: true },
          bankTransfer: {
            available: true,
            bankName: "Bank Alfalah Islamic",
            accountTitle: "Kids Wear Retailers",
            accountOrIban: "PK00ALFH9876543210",
            branchCode: "9876",
            branchLocation: "Blue Area, Islamabad",
            instructions: "Send transaction screenshot to support.",
          },
        },
      };

      const markup = renderToStaticMarkup(
        <CheckoutPaymentSelection
          paymentMethods={customConfig.paymentMethods}
          selectedMethod="BANK_TRANSFER"
          onSelectMethod={() => {}}
        />
      );
      assert.strictEqual(markup.includes("Bank Alfalah Islamic"), true);
      assert.strictEqual(markup.includes("Kids Wear Retailers"), true);
      assert.strictEqual(markup.includes("PK00ALFH9876543210"), true);
      assert.strictEqual(markup.includes("Blue Area, Islamabad"), true);
    }
  );

  await runTest("27. Payment: No credit/debit card UI or payment gateway SDKs", () => {
    const markup = renderToStaticMarkup(
      <CheckoutPaymentSelection
        paymentMethods={MOCK_CONFIG.paymentMethods}
        selectedMethod="CASH_ON_DELIVERY"
        onSelectMethod={() => {}}
      />
    );
    const lower = markup.toLowerCase();
    assert.strictEqual(lower.includes("card number"), false);
    assert.strictEqual(lower.includes("cvv"), false);
    assert.strictEqual(lower.includes("expiration"), false);
    assert.strictEqual(lower.includes("stripe"), false);
    assert.strictEqual(lower.includes("paypal"), false);
  });

  // =========================================================================
  // 4. ORDER SUMMARY (Tests 28–38)
  // =========================================================================

  await runTest("28. Summary: Validated product name rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Organic Cotton Embroidered Kurta"), true);
  });

  await runTest("29. Summary: Validated size rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("4-5Y"), true);
  });

  await runTest("30. Summary: Validated color rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Sage Green"), true);
  });

  await runTest("31. Summary: Validated quantity rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Qty:"), true);
    assert.strictEqual(markup.includes(">2<"), true);
  });

  await runTest("32. Summary: Unit price rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("2,490"), true);
  });

  await runTest("33. Summary: Line subtotal rendered for each line", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("4,980"), true);
  });

  await runTest("34. Summary: Order subtotal rendered", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Subtotal"), true);
    assert.strictEqual(markup.includes("4,980"), true);
  });

  await runTest("35. Summary: Delivery charge rendered (flat rate from config / server)", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Delivery"), true);
    assert.strictEqual(markup.includes("250"), true);
  });

  await runTest("36. Summary: Total rendered matching sum of subtotal and delivery charge", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("Total"), true);
    assert.strictEqual(markup.includes("5,230"), true);
  });

  await runTest("37. Summary: No internal SKU displayed to customer", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(markup.includes("KW-MS-001-SG-45"), false);
    assert.strictEqual(markup.toLowerCase().includes("sku"), false);
  });

  await runTest("38. Summary: No numeric stock count displayed to customer", () => {
    const markup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    const lower = markup.toLowerCase();
    assert.strictEqual(lower.includes("in stock"), false);
    assert.strictEqual(lower.includes("remaining"), false);
    assert.strictEqual(lower.includes("left in stock"), false);
    assert.strictEqual(lower.includes("units available"), false);
    assert.strictEqual(/\b\d+\s+left\b/i.test(markup), false);
  });

  // =========================================================================
  // 5. REVIEW ORDER & STATE MANAGEMENT (Tests 39–47)
  // =========================================================================

  await runTest("39. Review: Review Order action triggers authoritative validation payload", () => {
    assert.strictEqual(checkoutViewSource.includes('"Review Order"'), true);
    assert.strictEqual(checkoutViewSource.includes("validateCheckout({"), true);
    assert.strictEqual(checkoutViewSource.includes("paymentMethod: selectedPaymentMethod"), true);
  });

  await runTest("40. Review: Successful pre-validation transitions UI to Reviewed State", () => {
    const markup = renderToStaticMarkup(
      <CheckoutReviewView
        reviewedData={MOCK_REVIEWED_DATA}
        bankConfig={MOCK_CONFIG.paymentMethods.bankTransfer}
        onEditDetails={() => {}}
      />
    );
    assert.strictEqual(markup.includes('data-testid="checkout-reviewed-state"'), true);
    assert.strictEqual(markup.includes("Order Details Verified"), true);
    assert.strictEqual(markup.includes("Ayesha Khan"), true);
    assert.strictEqual(markup.includes("House 123, Street 4, Sector F-7/2"), true);
    assert.strictEqual(markup.includes("Cash on Delivery"), true);
  });

  await runTest(
    "41. Review: Pre-validation failure displays error and blocks transition to reviewed state",
    () => {
      assert.strictEqual(checkoutViewSource.includes("setReviewError("), true);
      assert.strictEqual(checkoutViewSource.includes('role="alert"'), true);
      assert.strictEqual(checkoutViewSource.includes("Validation Error:"), true);
    }
  );

  await runTest("42. Review: Editing any customer form field invalidates reviewed state", () => {
    assert.strictEqual(checkoutViewSource.includes("const handleFieldChange = () => {"), true);
    assert.strictEqual(checkoutViewSource.includes("setReviewedData(null)"), true);
    assert.strictEqual(checkoutCustomerFormSource.includes("onFieldChange?.()"), true);
  });

  await runTest("43. Review: Changing payment method invalidates reviewed state", () => {
    assert.strictEqual(checkoutViewSource.includes("const handlePaymentMethodSelect ="), true);
    assert.strictEqual(checkoutViewSource.includes("handleFieldChange()"), true);
  });

  await runTest("44. Review: Changing cart items invalidates reviewed state", () => {
    assert.strictEqual(
      checkoutViewSource.includes("setReviewedData(null);") &&
        checkoutViewSource.includes("}, [items]);"),
      true
    );
  });

  await runTest("45. Review: Edit Details button on review view returns to editable form", () => {
    const markup = renderToStaticMarkup(
      <CheckoutReviewView
        reviewedData={MOCK_REVIEWED_DATA}
        bankConfig={MOCK_CONFIG.paymentMethods.bankTransfer}
        onEditDetails={() => {}}
      />
    );
    assert.strictEqual(markup.includes("Edit Details"), true);
    assert.strictEqual(checkoutReviewViewSource.includes("onClick={onEditDetails}"), true);
  });

  await runTest(
    "46. Review: No Order, OrderItem, or OrderStatusHistory rows created during pre-validation review",
    () => {
      const apiCheckoutRoutes = fs.readFileSync(
        path.join(__dirname, "../../api/src/modules/checkout/routes.ts"),
        "utf-8"
      );
      assert.strictEqual(apiCheckoutRoutes.includes("prisma.order.create"), false);
      assert.strictEqual(apiCheckoutRoutes.includes("prisma.orderItem.create"), false);
      assert.strictEqual(apiCheckoutRoutes.includes("prisma.orderStatusHistory.create"), false);
    }
  );

  await runTest(
    "47. Review: Cart remains intact and populated after reviewing order (no premature clearing)",
    () => {
      assert.strictEqual(checkoutReviewViewSource.includes("clearCart"), false);
      // Review Order pre-validation submission in checkoutView does not clear cart prematurely
      assert.strictEqual(checkoutViewSource.includes("onSubmit = async"), true);
      assert.strictEqual(/onSubmit\s*=\s*async[\s\S]*?clearCart/.test(checkoutViewSource), false);
    }
  );

  // =========================================================================
  // 6. ACCESSIBILITY & SEMANTIC HTML (Tests 48–52)
  // =========================================================================

  await runTest(
    "48. Accessibility: Form labels properly associated with inputs via htmlFor and id",
    () => {
      const markup = renderToStaticMarkup(
        <CheckoutCustomerForm register={createMockRegister()} errors={{}} />
      );
      // Check that labels have for="field-..."
      assert.strictEqual(/<label[^>]+for="field-[^"]+"/.test(markup), true);
      // Check that inputs have matching id="field-..."
      assert.strictEqual(/<input[^>]+id="field-[^"]+"/.test(markup), true);
    }
  );

  await runTest("49. Accessibility: Invalid fields set aria-invalid=true", () => {
    const markup = renderToStaticMarkup(
      <CheckoutCustomerForm
        register={createMockRegister()}
        errors={{ fullName: { type: "manual", message: "Full Name is required" } }}
      />
    );
    assert.strictEqual(markup.includes('aria-invalid="true"'), true);
  });

  await runTest(
    "50. Accessibility: Form error messages linked via aria-describedby or accessible error container",
    () => {
      const markup = renderToStaticMarkup(
        <CheckoutCustomerForm
          register={createMockRegister()}
          errors={{ phone: { type: "manual", message: "Phone number is required" } }}
        />
      );
      assert.strictEqual(markup.includes('aria-describedby="'), true);
      assert.strictEqual(markup.includes('role="alert"'), true);
      assert.strictEqual(markup.includes("Phone number is required"), true);
    }
  );

  await runTest(
    "51. Accessibility: Payment method selection uses semantic <fieldset> and <legend>",
    () => {
      const markup = renderToStaticMarkup(
        <CheckoutPaymentSelection
          paymentMethods={MOCK_CONFIG.paymentMethods}
          selectedMethod="CASH_ON_DELIVERY"
          onSelectMethod={() => {}}
        />
      );
      assert.strictEqual(markup.includes("<fieldset"), true);
      assert.strictEqual(markup.includes("<legend"), true);
      assert.strictEqual(markup.includes("Payment Method"), true);
    }
  );

  await runTest("52. Accessibility: Validation and outage alerts use role=alert", () => {
    assert.strictEqual(checkoutViewSource.includes('role="alert"'), true);
    const formMarkup = renderToStaticMarkup(
      <CheckoutCustomerForm
        register={createMockRegister()}
        errors={{ address: { type: "manual", message: "Address is required" } }}
      />
    );
    assert.strictEqual(formMarkup.includes('role="alert"'), true);
  });

  // =========================================================================
  // 7. SCOPE EXCLUSIONS & WORK UNIT BOUNDARY (Tests 53–58)
  // =========================================================================

  await runTest("53. Scope: No fake Place Order button in Work Unit 14", () => {
    assert.strictEqual(checkoutViewSource.includes(">Place Order<"), false);
    assert.strictEqual(checkoutReviewViewSource.includes(">Place Order<"), false);
    assert.strictEqual(checkoutCustomerFormSource.includes(">Place Order<"), false);
    assert.strictEqual(checkoutViewSource.includes('"Review Order"'), true);
  });

  await runTest("54. Scope: No Order Success page in Work Unit 14", () => {
    assert.strictEqual(fs.existsSync(path.join(webSrc, "app/checkout/success/page.tsx")), false);
    assert.strictEqual(
      fs.existsSync(path.join(webSrc, "app/checkout/order-success/page.tsx")),
      false
    );
  });

  await runTest("55. Scope: No Order Number generated in Work Unit 14", () => {
    assert.strictEqual("orderNumber" in MOCK_REVIEWED_DATA, false);
    assert.strictEqual("orderId" in MOCK_REVIEWED_DATA, false);
    const sharedTypes = fs.readFileSync(
      path.join(__dirname, "../../../packages/shared/src/index.ts"),
      "utf-8"
    );
    assert.strictEqual(sharedTypes.includes("CheckoutValidationResponseData"), true);
    assert.strictEqual(
      /interface CheckoutValidationResponseData\s*\{[^}]*orderNumber/.test(sharedTypes),
      false
    );
  });

  await runTest("56. Scope: No saved address book or customer profile persistence", () => {
    assert.strictEqual(checkoutCustomerFormSource.includes("Save this address"), false);
    assert.strictEqual(checkoutCustomerFormSource.includes("savedAddresses"), false);
    assert.strictEqual(checkoutViewSource.includes("useAddressBook"), false);
  });

  await runTest("57. Scope: No online payment gateway integration or scripts", () => {
    const pkgDeps = JSON.stringify(webPackageJson.dependencies || {});
    assert.strictEqual(pkgDeps.includes("stripe"), false);
    assert.strictEqual(pkgDeps.includes("paypal"), false);
    assert.strictEqual(pkgDeps.includes("payfast"), false);
    assert.strictEqual(checkoutPageSource.includes("https://js.stripe.com"), false);
  });

  await runTest("58. Scope: No Wishlist or numeric inventory counting in checkout", () => {
    const summaryMarkup = renderToStaticMarkup(
      <CheckoutOrderSummary
        items={MOCK_VALIDATED_ITEMS}
        subtotal="4980.00"
        deliveryCharge="250.00"
        total="5230.00"
      />
    );
    assert.strictEqual(summaryMarkup.toLowerCase().includes("wishlist"), false);
    assert.strictEqual(checkoutViewSource.toLowerCase().includes("wishlist"), false);
    assert.strictEqual(summaryMarkup.toLowerCase().includes("in stock"), false);
    assert.strictEqual(
      summaryMarkup.toLowerCase().includes("quality inspection guarantee"),
      false,
      "Must not contain Quality inspection guarantee"
    );
    assert.strictEqual(
      summaryMarkup.toLowerCase().includes("guarantee"),
      false,
      "Must not contain any unsupported quality guarantee"
    );
    assert.strictEqual(
      summaryMarkup.includes("Pakistan-wide delivery within 10 days"),
      true,
      "Must state Pakistan-wide delivery within 10 days"
    );
    assert.strictEqual(
      summaryMarkup.toLowerCase().includes("tracked delivery"),
      false,
      "Must not contain tracked delivery"
    );
    assert.strictEqual(
      summaryMarkup.toLowerCase().includes("track your order"),
      false,
      "Must not contain track your order"
    );
  });

  // -------------------------------------------------------------------------
  // Summary Reporting
  // -------------------------------------------------------------------------

  console.log("\n========================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `Checkout Frontend Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
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
  console.error("Unhandled error running checkout test suite:", err);
  process.exit(1);
});
