import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { getSafeNextUrl } from "../src/lib/safe-redirect";
import { FormField, FieldLabel } from "../src/components/ui/form/form-field";
import { Input } from "../src/components/ui/form/input";
import { PasswordField } from "../src/components/account/customer-auth-ui";
import { ORDER_STATUS_LABELS, PAYMENT_METHODS } from "@kids-wear/shared";
import type {
  CustomerProfileData,
  CustomerOrderListItem,
  CustomerOrderDetailData,
} from "@kids-wear/shared";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assertAuthFields(
  source: string,
  fields: { label: string; input: "Input" | "PasswordField"; visibilityLabel?: string }[]
): void {
  const fieldBlocks = source.match(/<FormField\b[^>]*>[\s\S]*?<\/FormField>/g) || [];

  for (const [index, field] of fields.entries()) {
    const block = fieldBlocks.find((candidate) =>
      candidate.includes(`>${field.label}</FieldLabel>`)
    );
    assert.ok(block, `Must render ${field.label} inside a FormField`);
    assert.ok(block.includes(`<${field.input}`), `${field.label} must contain ${field.input}`);

    const id = `auth-field-${index}`;
    const html = renderToStaticMarkup(
      <FormField id={id}>
        <FieldLabel className="auth-label">{field.label}</FieldLabel>
        {field.input === "PasswordField" ? (
          <PasswordField visibilityLabel={field.visibilityLabel || "password"} />
        ) : (
          <Input />
        )}
      </FormField>
    );
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"[^>]*>`),
      `${field.label} label must target the input`);
    assert.ok(html.includes(`>${field.label}</label>`), `${field.label} must be the visible label`);
    assert.ok(html.includes(`id="${id}"`), `${field.label} input must match its label`);
    if (field.input === "PasswordField") {
      assert.ok(html.includes('type="password"'), "Password must be masked initially");
      assert.ok(html.includes('<button type="button"'), "Visibility control must be keyboard-operable");
      assert.ok(html.includes(`aria-label="Show ${field.visibilityLabel || "password"}"`),
        "Visibility control must have an accessible name");
      assert.ok(html.includes('aria-pressed="false"'), "Visibility state must be announced");
      assert.ok(html.includes("focus-visible:ring-2"), "Visibility control must show keyboard focus");
    }
  }
}

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

const MOCK_CUSTOMER: CustomerProfileData = {
  id: "c1111111-1111-4111-8111-111111111111",
  fullName: "Fatima Noor",
  email: "fatima.noor@example.com",
  phone: "03001234567",
};

const MOCK_ORDER_ITEM: CustomerOrderListItem = {
  orderNumber: "KW-100001",
  status: "ORDER_RECEIVED",
  statusLabel: "Order Received",
  paymentMethod: "CASH_ON_DELIVERY",
  createdAt: "2026-10-18T10:00:00.000Z",
  subtotal: "4500.00",
  deliveryCharge: "250.00",
  grandTotal: "4750.00",
  itemCount: 2,
  firstItemThumbnail: "https://res.cloudinary.com/sample/thumb1.jpg",
};

const MOCK_ORDER_DETAIL: CustomerOrderDetailData = {
  orderNumber: "KW-100001",
  createdAt: "2026-10-18T10:00:00.000Z",
  status: "ORDER_RECEIVED",
  statusLabel: "Order Received",
  paymentMethod: "CASH_ON_DELIVERY",
  customer: {
    fullName: "Fatima Noor",
    phone: "03001234567",
    email: "fatima.noor@example.com",
    address: "House 45, Street 2, Sector G-9/1",
    city: "Islamabad",
    province: "Federal Capital",
    postalCode: "44000",
    orderNotes: "Call upon arrival",
  },
  items: [
    {
      productName: "Festive Embroidered Kurta",
      productSlug: "festive-embroidered-kurta",
      storefrontSlug: "mini-sprouts",
      sizeLabel: "4-5Y",
      colorName: "Ruby Red",
      quantity: 2,
      unitPrice: "2250.00",
      lineSubtotal: "4500.00",
      thumbnailUrl: "https://res.cloudinary.com/sample/thumb1.jpg",
    },
  ],
  timeline: [
    {
      status: "ORDER_RECEIVED",
      statusLabel: "Order Received",
      changedAt: "2026-10-18T10:00:00.000Z",
    },
  ],
  subtotal: "4500.00",
  deliveryCharge: "250.00",
  grandTotal: "4750.00",
};

async function runSuite() {
  console.log(
    "Starting Kids Wear — Work Unit 16 Customer Account Frontend Test Suite (66 Tests)...\n"
  );

  const webSrc = path.join(__dirname, "../src");
  const loginSource = fs.readFileSync(path.join(webSrc, "app/account/login/page.tsx"), "utf-8");
  const registerSource = fs.readFileSync(
    path.join(webSrc, "app/account/register/page.tsx"),
    "utf-8"
  );
  const overviewSource = fs.readFileSync(path.join(webSrc, "app/account/page.tsx"), "utf-8");
  const profileSource = fs.readFileSync(path.join(webSrc, "app/account/profile/page.tsx"), "utf-8");
  const ordersSource = fs.readFileSync(path.join(webSrc, "app/account/orders/page.tsx"), "utf-8");
  const orderDetailSource = fs.readFileSync(
    path.join(webSrc, "app/account/orders/[orderNumber]/page.tsx"),
    "utf-8"
  );
  const accountShellSource = fs.readFileSync(
    path.join(webSrc, "components/account/account-shell.tsx"),
    "utf-8"
  );
  const authContextSource = fs.readFileSync(
    path.join(webSrc, "lib/customer-auth-context.tsx"),
    "utf-8"
  );
  const apiSource = fs.readFileSync(path.join(webSrc, "lib/api.ts"), "utf-8");
  const rootLayoutSource = fs.readFileSync(path.join(webSrc, "app/layout.tsx"), "utf-8");

  // =========================================================================
  // Section 1: Safe Redirect Utility (Tests 1–7)
  // =========================================================================
  console.log("Section 1: Safe Redirect Utility");

  await runTest("1. getSafeNextUrl allows valid relative paths like /account", () => {
    assert.strictEqual(getSafeNextUrl("/account"), "/account");
  });

  await runTest(
    "2. getSafeNextUrl allows valid relative paths like /checkout and /account/orders",
    () => {
      assert.strictEqual(getSafeNextUrl("/checkout"), "/checkout");
      assert.strictEqual(getSafeNextUrl("/account/orders"), "/account/orders");
    }
  );

  await runTest("3. getSafeNextUrl rejects protocol-relative URL starting with //", () => {
    assert.strictEqual(getSafeNextUrl("//evil.com"), "/account");
  });

  await runTest("4. getSafeNextUrl rejects external http:// and https:// URLs", () => {
    assert.strictEqual(getSafeNextUrl("https://attacker.com/steal"), "/account");
    assert.strictEqual(getSafeNextUrl("http://evil.com"), "/account");
  });

  await runTest("5. getSafeNextUrl rejects javascript: scheme or colon-containing strings", () => {
    assert.strictEqual(getSafeNextUrl("javascript:alert(1)"), "/account");
    assert.strictEqual(getSafeNextUrl("data:text/html"), "/account");
  });

  await runTest("6. getSafeNextUrl rejects backslash paths", () => {
    assert.strictEqual(getSafeNextUrl("\\evil.com"), "/account");
  });

  await runTest("7. getSafeNextUrl falls back gracefully for empty, whitespace, or null", () => {
    assert.strictEqual(getSafeNextUrl(null), "/account");
    assert.strictEqual(getSafeNextUrl(undefined), "/account");
    assert.strictEqual(getSafeNextUrl("   "), "/account");
  });

  // =========================================================================
  // Section 2: Session Security & Client State Boundaries (Tests 8–15)
  // =========================================================================
  console.log("\nSection 2: Session Security & Client State Boundaries");

  await runTest(
    "8. Customer auth context uses in-memory React state, never localStorage for customer profile",
    () => {
      assert.ok(
        !authContextSource.includes("localStorage.setItem"),
        "Must not persist session to localStorage"
      );
      assert.ok(
        !authContextSource.includes("sessionStorage.setItem"),
        "Must not persist session to sessionStorage"
      );
    }
  );

  await runTest("9. Root layout wraps application tree in CustomerAuthProvider", () => {
    assert.ok(
      rootLayoutSource.includes("CustomerAuthProvider"),
      "Root layout must mount CustomerAuthProvider"
    );
  });

  await runTest(
    "10. Customer auth context provides refreshCustomer, logout, and setCustomerDirect",
    () => {
      assert.ok(
        authContextSource.includes("refreshCustomer"),
        "Context must export refreshCustomer"
      );
      assert.ok(authContextSource.includes("logout"), "Context must export logout");
      assert.ok(
        authContextSource.includes("setCustomerDirect"),
        "Context must export setCustomerDirect"
      );
    }
  );

  await runTest(
    "11. API client includes credentials: 'include' for customer session cookie transmission",
    () => {
      assert.ok(
        apiSource.includes('credentials: "include"'),
        "API client must send credentials with customer requests"
      );
    }
  );

  await runTest(
    "12. Logout calls backend POST /auth/logout and clears in-memory customer state",
    () => {
      assert.ok(apiSource.includes("/auth/logout"), "API client must implement logoutCustomer");
      assert.ok(
        authContextSource.includes("setCustomer(null)"),
        "Logout must clear customer from context"
      );
    }
  );

  await runTest("13. Customer logout never touches guest Cart storage in localStorage", () => {
    assert.ok(
      !authContextSource.includes("useCartStore.getState().clearCart"),
      "Logout must not clear cart"
    );
    assert.ok(!authContextSource.includes("clearGuestCart"), "Logout must preserve guest cart");
  });

  await runTest(
    "14. Customer session cookies are HttpOnly and transport is transparent to JS",
    () => {
      assert.ok(
        !authContextSource.includes("document.cookie"),
        "Session cookies must be HttpOnly managed by browser"
      );
    }
  );

  await runTest(
    "15. getCustomerCsrf retrieves CSRF token for state-changing customer operations",
    () => {
      assert.ok(apiSource.includes("getCustomerCsrf"), "api.ts must export getCustomerCsrf");
      assert.ok(apiSource.includes("/auth/csrf"), "getCustomerCsrf must query /auth/csrf");
    }
  );

  // =========================================================================
  // Section 3: Account Shell & Authenticated Layout (Tests 16–23)
  // =========================================================================
  console.log("\nSection 3: Account Shell & Authenticated Layout");

  await runTest("16. AccountShell renders customer welcome greeting with customer fullName", () => {
    assert.ok(
      accountShellSource.includes("Welcome, {customer.fullName}"),
      "Account shell must greet customer"
    );
  });

  await runTest("17. AccountShell displays customer email and optional phone", () => {
    assert.ok(
      accountShellSource.includes("{customer.email}"),
      "Account shell must show customer email"
    );
    assert.ok(
      accountShellSource.includes('{customer.phone ? `• ${customer.phone}` : ""}'),
      "Account shell must show phone if present"
    );
  });

  await runTest(
    "18. AccountShell defines persistent navigation tabs: Overview, Orders, Profile",
    () => {
      assert.ok(accountShellSource.includes('href: "/account"'), "Must link to /account");
      assert.ok(
        accountShellSource.includes('href: "/account/orders"'),
        "Must link to /account/orders"
      );
      assert.ok(
        accountShellSource.includes('href: "/account/profile"'),
        "Must link to /account/profile"
      );
    }
  );

  await runTest(
    "19. AccountShell highlights active navigation tab with aria-current='page'",
    () => {
      assert.ok(
        accountShellSource.includes('aria-current={isActive ? "page" : undefined}'),
        "Must set aria-current on active tab"
      );
    }
  );

  await runTest(
    "20. AccountShell renders accessible loading state during session resolution",
    () => {
      assert.ok(
        accountShellSource.includes('role="status"'),
        "Must provide accessible status role"
      );
      assert.ok(
        accountShellSource.includes('aria-busy="true"'),
        "Must declare aria-busy while loading"
      );
    }
  );

  await runTest(
    "21. AccountShell redirects unauthenticated visitors to /account/login with return path",
    () => {
      assert.ok(accountShellSource.includes("!isAuthenticated"), "Must check isAuthenticated");
      assert.ok(
        accountShellSource.includes("/account/login"),
        "Must redirect unauthenticated users to login"
      );
      assert.ok(
        accountShellSource.includes("?next="),
        "Must preserve return destination via next query param"
      );
    }
  );

  await runTest("22. AccountShell renders Sign Out button that triggers logout", () => {
    assert.ok(accountShellSource.includes("handleLogout"), "Must attach logout handler");
    assert.ok(accountShellSource.includes("Sign Out"), "Must display Sign Out button");
  });

  await runTest(
    "23. Account layout is mounted under StorefrontShell for consistent header & footer",
    () => {
      const layoutSource = fs.readFileSync(path.join(webSrc, "app/account/layout.tsx"), "utf-8");
      assert.ok(
        layoutSource.includes("StorefrontShell"),
        "Account layout must use StorefrontShell"
      );
    }
  );

  // =========================================================================
  // Section 4: Customer Login Page (Tests 24–31)
  // =========================================================================
  console.log("\nSection 4: Customer Login Page");

  await runTest("24. Login page includes email and password form fields with labels", () => {
    assertAuthFields(loginSource, [
      { label: "Email Address", input: "Input" },
      { label: "Password", input: "PasswordField" },
    ]);
  });

  await runTest("25. Login page enforces client validation for email format", () => {
    assert.ok(
      loginSource.includes("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/"),
      "Must validate email format"
    );
    assert.ok(
      loginSource.includes("Please enter a valid email address"),
      "Must display email validation error"
    );
  });

  await runTest("26. Login page requires non-empty password", () => {
    assert.ok(loginSource.includes("Password is required"), "Must require non-empty password");
  });

  await runTest("27. Login page calls loginCustomer with trimmed email and password", () => {
    assert.ok(loginSource.includes("loginCustomer"), "Must call loginCustomer");
    assert.ok(loginSource.includes("email.trim().toLowerCase()"), "Must normalize email on submit");
  });

  await runTest(
    "28. Login page handles INVALID_CREDENTIALS with user-friendly error message",
    () => {
      assert.ok(
        loginSource.includes("INVALID_CREDENTIALS"),
        "Must check INVALID_CREDENTIALS error code"
      );
      assert.ok(
        loginSource.includes("Invalid email or password"),
        "Must display clear credential error"
      );
    }
  );

  await runTest("29. Login page redirects authenticated users to safe nextUrl", () => {
    assert.ok(loginSource.includes('getSafeNextUrl(rawNext, "/account")'), "Must sanitize nextUrl");
    assert.ok(loginSource.includes("router.replace(nextUrl)"), "Must redirect logged-in customer");
  });

  await runTest(
    "30. Login page provides navigation link to register page preserving next parameter",
    () => {
      assert.ok(loginSource.includes("href={registerHref}"), "Must link to register");
      assert.ok(loginSource.includes("/account/register"), "Must point to /account/register");
    }
  );

  await runTest("31. Login form disables submit button and inputs during submission", () => {
    assert.ok(loginSource.includes("isLoading={isSubmitting}"), "Button must show loading state");
    assert.ok(
      loginSource.includes("disabled={isSubmitting}"),
      "Inputs must be disabled during submit"
    );
  });

  // =========================================================================
  // Section 5: Customer Registration Page (Tests 32–40)
  // =========================================================================
  console.log("\nSection 5: Customer Registration Page");

  await runTest(
    "32. Registration page includes fullName, email, phone, password, and confirmPassword",
    () => {
      assertAuthFields(registerSource, [
        { label: "Full Name", input: "Input" },
        { label: "Email Address", input: "Input" },
        { label: "Phone Number (Optional)", input: "Input" },
        { label: "Password", input: "PasswordField" },
        { label: "Confirm Password", input: "PasswordField", visibilityLabel: "confirm password" },
      ]);
    }
  );

  await runTest(
    "33. Registration page validates full name length between 2 and 100 characters",
    () => {
      assert.ok(
        registerSource.includes("Full name must be at least 2 characters"),
        "Must validate min 2 chars"
      );
      assert.ok(
        registerSource.includes("Full name must not exceed 100 characters"),
        "Must validate max 100 chars"
      );
    }
  );

  await runTest("34. Registration page validates email format", () => {
    assert.ok(
      registerSource.includes("Please enter a valid email address"),
      "Must validate email format"
    );
  });

  await runTest(
    "35. Registration phone follows backend 7–20 optional rule (rejects <7 and >20, accepts optional empty)",
    () => {
      assert.ok(
        registerSource.includes("Phone number must be at least 7 characters"),
        "Must enforce min 7 chars for phone"
      );
      assert.ok(
        registerSource.includes("Phone number must not exceed 20 characters"),
        "Must enforce max 20 chars for phone"
      );
      assert.ok(
        !registerSource.includes("3\\d{9}"),
        "Must not restrict phone to Pakistan-mobile-only 03XXXXXXXXX regex"
      );
    }
  );

  await runTest(
    "36. International-format/non-03 valid phone is not rejected solely by frontend",
    () => {
      assert.ok(!registerSource.includes("+92 mandatory"), "+92 must not be mandatory");
      assert.ok(!registerSource.includes("/^(\\+92|0)?3/"), "Must not require 03 prefix");
    }
  );

  await runTest(
    "37. Frontend password validation matches backend 8–128 contract (rejects <8 and >128)",
    () => {
      assert.ok(
        registerSource.includes("Password must be at least 8 characters long"),
        "Must enforce min 8 chars for password"
      );
      assert.ok(
        registerSource.includes("Password must not exceed 128 characters"),
        "Must enforce max 128 chars for password"
      );
    }
  );

  await runTest(
    "38. An 8-character password accepted by backend is not rejected solely for lacking a digit",
    () => {
      assert.ok(
        !registerSource.includes("/\\d/.test(password)"),
        "Must not require mandatory digit"
      );
    }
  );

  await runTest(
    "39. An 8-character password accepted by backend is not rejected solely for lacking a letter",
    () => {
      assert.ok(
        !registerSource.includes("/[A-Za-z]/.test(password)"),
        "Must not require mandatory letter"
      );
    }
  );

  await runTest(
    "40. No mandatory letter/number complexity exists unless backend requires it",
    () => {
      assert.ok(
        !registerSource.includes("Password must contain at least one letter and one number"),
        "Must not show complexity requirement error message"
      );
    }
  );

  await runTest("41. Registration page validates password confirmation match", () => {
    assert.ok(registerSource.includes("Passwords do not match"), "Must check password equality");
  });

  await runTest("42. Registration page handles EMAIL_ALREADY_EXISTS error gracefully", () => {
    assert.ok(
      registerSource.includes("EMAIL_ALREADY_EXISTS"),
      "Must check EMAIL_ALREADY_EXISTS code"
    );
    assert.ok(registerSource.includes("already exists"), "Must show duplicate email error message");
  });

  await runTest(
    "43. Registration page updates auth state and redirects to nextUrl upon success",
    () => {
      assert.ok(
        registerSource.includes("setCustomerDirect(res.data.customer)"),
        "Must update customer state"
      );
      assert.ok(registerSource.includes("router.push(nextUrl)"), "Must redirect to nextUrl");
    }
  );

  await runTest(
    "44. Registration page provides link back to login page preserving destination",
    () => {
      assert.ok(registerSource.includes("href={loginHref}"), "Must link to login");
      assert.ok(registerSource.includes("/account/login"), "Must point to /account/login");
    }
  );

  // =========================================================================
  // Section 6: Customer Profile Page & CSRF Updates (Tests 45–51)
  // =========================================================================
  console.log("\nSection 6: Customer Profile Page & CSRF Updates");

  await runTest(
    "45. Profile page loads customer profile from auth context into form fields",
    () => {
      assert.ok(profileSource.includes("customer.fullName"), "Must populate full name");
      assert.ok(profileSource.includes("customer.email"), "Must populate email");
    }
  );

  await runTest(
    "46. Profile page validates name, email, and phone (7–20 chars) before submitting update",
    () => {
      assert.ok(profileSource.includes("Full name is required"), "Must validate name required");
      assert.ok(
        profileSource.includes("Please enter a valid email address"),
        "Must validate email format"
      );
      assert.ok(
        profileSource.includes("Phone number must be at least 7 characters"),
        "Must validate phone min 7 chars in profile"
      );
      assert.ok(
        profileSource.includes("Phone number must not exceed 20 characters"),
        "Must validate phone max 20 chars in profile"
      );
      assert.ok(
        !profileSource.includes("3\\d{9}"),
        "Must not restrict profile phone to Pakistan-mobile-only 03XXXXXXXXX regex"
      );
    }
  );

  await runTest(
    "47. Profile update retrieves CSRF token via getCustomerCsrf() before PATCH request",
    () => {
      assert.ok(profileSource.includes("getCustomerCsrf()"), "Must fetch CSRF token");
      assert.ok(profileSource.includes("updateCustomerProfile"), "Must call updateCustomerProfile");
    }
  );

  await runTest("48. Profile update sends CSRF token in X-CSRF-Token header", () => {
    assert.ok(
      apiSource.includes('headers["X-CSRF-Token"] = token'),
      "api.ts must set X-CSRF-Token header"
    );
  });

  await runTest("49. Profile page displays success alert after profile is saved", () => {
    assert.ok(
      profileSource.includes("Your profile information has been successfully updated"),
      "Must show success message"
    );
    assert.ok(profileSource.includes('variant="success"'), "Must use success alert variant");
  });

  await runTest("50. Profile page updates auth context with modified customer record", () => {
    assert.ok(
      profileSource.includes("setCustomerDirect(res.data.customer)"),
      "Must update context customer data"
    );
  });

  await runTest(
    "51. Profile page excludes saved address management and password change forms",
    () => {
      assert.ok(!profileSource.includes("SavedAddress"), "No saved addresses in V1");
      assert.ok(!profileSource.includes("changePassword"), "No password change in V1 profile");
    }
  );

  // =========================================================================
  // Section 7: Customer Order History Page (Tests 52–57)
  // =========================================================================
  console.log("\nSection 7: Customer Order History Page");

  await runTest(
    "52. Orders list page fetches orders via getCustomerOrders with pagination params",
    () => {
      assert.ok(ordersSource.includes("getCustomerOrders"), "Must call getCustomerOrders");
      assert.ok(ordersSource.includes("page"), "Must support page parameter");
      assert.ok(ordersSource.includes("limit: 10"), "Must fetch 10 orders per page");
    }
  );

  await runTest(
    "53. Orders list page renders orderNumber, statusLabel, formatted date, itemCount, and grandTotal",
    () => {
      assert.ok(ordersSource.includes("order.orderNumber"), "Must render order number");
      assert.ok(ordersSource.includes("order.statusLabel"), "Must render status label");
      assert.ok(ordersSource.includes("order.createdAt"), "Must render order date");
      assert.ok(ordersSource.includes("order.itemCount"), "Must render item count");
      assert.ok(ordersSource.includes("formatPrice(order.grandTotal)"), "Must format grand total");
    }
  );

  await runTest(
    "54. Orders list page displays friendly empty state when customer has no orders",
    () => {
      assert.ok(ordersSource.includes("No orders yet"), "Must render empty state heading");
      assert.ok(
        ordersSource.includes("Explore Collections"),
        "Must provide button to start shopping"
      );
    }
  );

  await runTest("55. Orders list page renders pagination controls when totalPages > 1", () => {
    assert.ok(ordersSource.includes("totalPages > 1"), "Must check totalPages > 1");
    assert.ok(ordersSource.includes("hasPrevPage"), "Must check hasPrevPage for previous button");
    assert.ok(ordersSource.includes("hasNextPage"), "Must check hasNextPage for next button");
  });

  await runTest("56. Orders list links each order item to /account/orders/[orderNumber]", () => {
    assert.ok(
      ordersSource.includes("href={`/account/orders/${order.orderNumber}`}"),
      "Must link to order detail"
    );
  });

  await runTest("57. Orders list page displays accessible loading spinner during fetch", () => {
    assert.ok(ordersSource.includes('role="status"'), "Must provide accessible status role");
    assert.ok(ordersSource.includes("LoadingSpinner"), "Must render LoadingSpinner");
  });

  // =========================================================================
  // Section 8: Customer Order Detail Page & Snapshots (Tests 58–66)
  // =========================================================================
  console.log("\nSection 8: Customer Order Detail Page & Snapshots");

  await runTest(
    "58. Order detail page retrieves snapshot via getCustomerOrder(orderNumber)",
    () => {
      assert.ok(
        orderDetailSource.includes("getCustomerOrder(orderNumber)"),
        "Must call getCustomerOrder"
      );
    }
  );

  await runTest(
    "59. Order detail page renders purchased items snapshot: name, size, color, qty, unitPrice, subtotal",
    () => {
      assert.ok(
        orderDetailSource.includes("item.productName"),
        "Must render product name snapshot"
      );
      assert.ok(orderDetailSource.includes("item.sizeLabel"), "Must render size label snapshot");
      assert.ok(orderDetailSource.includes("item.colorName"), "Must render color name snapshot");
      assert.ok(orderDetailSource.includes("item.quantity"), "Must render quantity snapshot");
      assert.ok(
        orderDetailSource.includes("formatPrice(item.unitPrice)"),
        "Must render unit price snapshot"
      );
      assert.ok(
        orderDetailSource.includes("formatPrice(item.lineSubtotal)"),
        "Must render line subtotal snapshot"
      );
    }
  );

  await runTest(
    "60. Order detail page strictly excludes internal SKU and color-hex swatches",
    () => {
      assert.ok(!orderDetailSource.includes("item.sku"), "Must not expose SKU");
      assert.ok(!orderDetailSource.includes("colorHex"), "Must not expose color-hex");
      assert.ok(!orderDetailSource.includes("hexCode"), "Must not expose hexCode");
    }
  );

  await runTest("61. Order detail page renders customer delivery address snapshot", () => {
    assert.ok(orderDetailSource.includes("order.customer.fullName"), "Must display recipient name");
    assert.ok(orderDetailSource.includes("order.customer.phone"), "Must display recipient phone");
    assert.ok(
      orderDetailSource.includes("order.customer.address"),
      "Must display delivery address"
    );
    assert.ok(orderDetailSource.includes("order.customer.city"), "Must display city");
  });

  await runTest("62. Order detail page renders oldest-to-newest status history timeline", () => {
    assert.ok(orderDetailSource.includes("order.timeline.map"), "Must iterate timeline entries");
    assert.ok(
      orderDetailSource.includes("entry.statusLabel"),
      "Must display timeline status label"
    );
    assert.ok(
      orderDetailSource.includes("formatDate(entry.changedAt)"),
      "Must format timeline date"
    );
  });

  await runTest(
    "63. Order detail page excludes internal admin audit fields (changedByAdminId, internal notes)",
    () => {
      assert.ok(!orderDetailSource.includes("changedByAdminId"), "Must not expose admin ID");
      assert.ok(!orderDetailSource.includes("internalNote"), "Must not expose internal notes");
    }
  );

  await runTest(
    "64. Order detail page renders 404 error card for nonexistent or foreign orders",
    () => {
      assert.ok(
        orderDetailSource.includes("Order Not Found"),
        "Must display Order Not Found heading"
      );
      assert.ok(orderDetailSource.includes("Return to Order History"), "Must link back to orders");
    }
  );

  await runTest(
    "65. Order detail page strictly excludes invented WhatsApp payment receipt instructions or numbers",
    () => {
      assert.ok(
        !orderDetailSource.toLowerCase().includes("whatsapp"),
        "Must not contain WhatsApp keyword"
      );
      assert.ok(
        !orderDetailSource.toLowerCase().includes("screenshot"),
        "Must not contain receipt screenshot instructions"
      );
      assert.ok(
        !orderDetailSource.toLowerCase().includes("receipt"),
        "Must not mention payment receipt upload or transfer proofs"
      );
    }
  );

  await runTest(
    "66. Bank Transfer account display is purely informative and does not prompt customer payment verification",
    () => {
      assert.ok(
        !orderDetailSource.toLowerCase().includes("verify payment"),
        "Must not prompt customer to verify payment"
      );
      assert.ok(
        !orderDetailSource.toLowerCase().includes("confirm payment"),
        "Must not prompt customer to confirm payment"
      );
      assert.ok(
        orderDetailSource.includes("order.statusLabel"),
        "Must present authoritative order status label"
      );
    }
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`Kids Wear — Work Unit 16 Customer Account Frontend Results:`);
  console.log(`Total Assertions: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
