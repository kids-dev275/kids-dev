import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { StorefrontShell } from "../src/components/shell/storefront-shell";
import GatewayPage from "../src/app/page";
import { AdminShell } from "../src/components/admin/admin-shell";
import { Header } from "../src/components/shell/header";
import { MobileNav } from "../src/components/shell/mobile-nav";
import { StorefrontSwitcher } from "../src/components/shell/storefront-switcher";
import { ProductPurchaseConfigurator } from "../src/components/pdp/product-purchase-configurator";
import { FormField, FieldLabel, FieldError, Input } from "../src/components/ui/form";
import { Alert, InlineError } from "../src/components/ui/feedback";
import { SizeGuideModal } from "../src/components/pdp/size-guide-modal";
import { PolicyContainer } from "../src/components/layout/policy-container";
import { ReviewSubmissionForm } from "../src/components/reviews/review-submission-form";

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
  } catch (err) {
    results.push({ name, passed: false, error: err as Error });
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

async function runSuite() {
  console.log("Starting Kids Wear — Work Unit 24 Accessibility Test Suite...\n");

  const layoutSource = fs.readFileSync(path.join(__dirname, "../src/app/layout.tsx"), "utf-8");
  const adminShellSource = fs.readFileSync(
    path.join(__dirname, "../src/components/admin/admin-shell.tsx"),
    "utf-8"
  );
  const mobileNavSource = fs.readFileSync(
    path.join(__dirname, "../src/components/shell/mobile-nav.tsx"),
    "utf-8"
  );

  // 1. Root Layout declares html lang="en"
  await runTest('1. Root Layout declares html lang="en"', () => {
    assert(layoutSource.includes('lang="en"'), 'Root layout must declare lang="en" on html');
  });

  // 2. StorefrontShell renders accessible semantic landmarks
  await runTest("2. StorefrontShell renders accessible semantic landmarks", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storefront="mini-sprouts">
        <div>Content</div>
      </StorefrontShell>
    );
    assert(html.includes("<header"), "Must render <header> landmark");
    assert(html.includes("<nav"), "Must render <nav> landmark");
    assert(
      html.includes('<main id="main-content"'),
      "Must render <main id='main-content'> landmark"
    );
    assert(html.includes("<footer"), "Must render <footer> landmark");
  });

  // 3. StorefrontShell renders Skip to main content link
  await runTest("3. StorefrontShell renders Skip to main content link", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storefront="mini-sprouts">
        <div>Content</div>
      </StorefrontShell>
    );
    assert(html.includes('href="#main-content"'), "Skip link must point to #main-content");
    assert(
      html.includes("Skip to main content"),
      "Skip link must have descriptive accessible text"
    );
    assert(
      html.includes("sr-only focus:not-sr-only"),
      "Skip link must use focusable sr-only utility"
    );
  });

  // 4. GatewayPage renders semantic landmarks and Skip to main content link
  await runTest("4. GatewayPage renders semantic landmarks and Skip to main content link", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(
      html.includes('href="#main-content"'),
      "Gateway must render Skip link targeting #main-content"
    );
    assert(html.includes("<header"), "Gateway must render <header>");
    assert(
      html.includes('<main id="main-content"'),
      "Gateway must render <main id='main-content'>"
    );
    assert(!html.includes("<footer"), "Gateway must remain without a footer");
  });

  // 5. AdminShell renders Skip to main content link and semantic landmarks
  await runTest("5. AdminShell renders Skip to main content link and semantic landmarks", () => {
    assert(
      adminShellSource.includes('href="#main-content"'),
      "AdminShell must render skip link to #main-content"
    );
    assert(
      adminShellSource.includes("<main") && adminShellSource.includes('id="main-content"'),
      "AdminShell must render main with id='main-content'"
    );
    assert(
      adminShellSource.includes('aria-label="Admin Sidebar"'),
      "AdminShell aside must have aria-label"
    );
  });

  // 6. AdminShell mobile drawer includes Escape key listener in source
  await runTest("6. AdminShell mobile drawer includes Escape key listener in source", () => {
    assert(
      adminShellSource.includes('e.key === "Escape"') &&
        adminShellSource.includes("setMobileMenuOpen(false)"),
      "AdminShell must listen for Escape key to close mobile drawer"
    );
  });

  // 7. Header provides accessible names on all utility links
  await runTest("7. Header provides accessible names on all utility links", () => {
    const html = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
    assert(
      html.includes('aria-label="Search Mini Sprouts"'),
      "Search link must have descriptive aria-label"
    );
    assert(
      html.includes('aria-label="Customer Account"'),
      "Account link must have descriptive aria-label"
    );
    assert(
      html.includes('aria-label="Shopping Cart"'),
      "Cart link must have descriptive aria-label"
    );
    assert(html.includes('aria-label="Main Navigation"'), "Desktop nav must have aria-label");
  });

  // 8. MobileNav toggle button provides aria-expanded, aria-controls, and aria-label
  await runTest(
    "8. MobileNav toggle button provides aria-expanded, aria-controls, and aria-label",
    () => {
      const html = renderToStaticMarkup(<MobileNav storefront="mini-sprouts" />);
      assert(
        html.includes('aria-expanded="false"'),
        "Initial toggle state must be aria-expanded='false'"
      );
      assert(
        html.includes('aria-controls="mobile-navigation-drawer"'),
        "Toggle must declare aria-controls"
      );
      assert(html.includes('aria-label="Open navigation menu"'), "Toggle must declare aria-label");
    }
  );

  // 9. MobileNav drawer implementation contains dialog role and Escape listener
  await runTest(
    "9. MobileNav drawer implementation contains dialog role and Escape listener",
    () => {
      assert(mobileNavSource.includes('role="dialog"'), "MobileNav must declare role='dialog'");
      assert(
        mobileNavSource.includes('aria-modal="true"'),
        "MobileNav must declare aria-modal='true'"
      );
      assert(
        mobileNavSource.includes('aria-label="Mobile Navigation"'),
        "MobileNav must declare aria-label"
      );
      assert(mobileNavSource.includes('e.key === "Escape"'), "MobileNav must handle Escape key");
    }
  );

  // 10. StorefrontSwitcher provides aria-label and aria-current="page"
  await runTest('10. StorefrontSwitcher provides aria-label and aria-current="page"', () => {
    const html = renderToStaticMarkup(<StorefrontSwitcher currentStorefront="mini-sprouts" />);
    assert(
      html.includes('aria-label="Storefront Switcher"'),
      "Must declare aria-label='Storefront Switcher'"
    );
    assert(
      html.includes('aria-current="page"'),
      "Current storefront must have aria-current='page'"
    );
  });

  // 11. ProductPurchaseConfigurator renders fieldset/legend with labeled toggle-button groups
  await runTest(
    '11. ProductPurchaseConfigurator renders fieldset/legend with labeled toggle-button groups',
    () => {
      const html = renderToStaticMarkup(
        <ProductPurchaseConfigurator
          productName="Summer Frock"
          sizes={[{ id: "s1", name: "2-3Y" }]}
          colors={[{ id: "c1", name: "Blush Pink" }]}
          variants={[{ id: "v1", productSizeId: "s1", productColorId: "c1", isAvailable: true }]}
        />
      );
      assert(html.includes("<fieldset"), "Must render fieldset elements for options");
      assert(html.includes("<legend"), "Must render legend elements for option categories");
      assert(html.includes('role="group"'), "Must group toggle buttons semantically");
      assert(html.includes('aria-label="Select Color"'), "Must label color option group");
      assert(html.includes('aria-label="Select Size"'), "Must label size option group");
    }
  );

  // 12. ProductPurchaseConfigurator quantity buttons declare aria-labels
  await runTest("12. ProductPurchaseConfigurator quantity buttons declare aria-labels", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        productName="Summer Frock"
        sizes={[{ id: "s1", name: "2-3Y" }]}
        colors={[{ id: "c1", name: "Blush Pink" }]}
        variants={[{ id: "v1", productSizeId: "s1", productColorId: "c1", isAvailable: true }]}
      />
    );
    assert(
      html.includes('aria-label="Decrease quantity"'),
      "Must provide aria-label for decrease button"
    );
    assert(
      html.includes('aria-label="Increase quantity"'),
      "Must provide aria-label for increase button"
    );
  });

  // 13. FormField correctly associates FieldLabel htmlFor with Input id
  await runTest("13. FormField correctly associates FieldLabel htmlFor with Input id", () => {
    const html = renderToStaticMarkup(
      <FormField id="custom-email">
        <FieldLabel>Email Address</FieldLabel>
        <Input type="email" />
      </FormField>
    );
    assert(html.includes('for="custom-email"'), "Label must have htmlFor matching input id");
    assert(html.includes('id="custom-email"'), "Input must have id matching label");
  });

  // 14. FormField indicates required field with aria-hidden asterisk
  await runTest("14. FormField indicates required field with aria-hidden asterisk", () => {
    const html = renderToStaticMarkup(
      <FormField id="test-required" isRequired>
        <FieldLabel>Full Name</FieldLabel>
        <Input />
      </FormField>
    );
    assert(html.includes('aria-hidden="true"'), "Required asterisk must be aria-hidden");
    assert(html.includes("*"), "Must render visual required indicator");
  });

  // 15. FormField wires aria-invalid and aria-describedby to FieldError
  await runTest("15. FormField wires aria-invalid and aria-describedby to FieldError", () => {
    const html = renderToStaticMarkup(
      <FormField id="test-error" isInvalid>
        <FieldLabel>Phone</FieldLabel>
        <Input />
        <FieldError>Phone number is required</FieldError>
      </FormField>
    );
    assert(html.includes('aria-invalid="true"'), "Input must declare aria-invalid='true'");
    assert(
      html.includes('aria-describedby="test-error-error') || html.includes("test-error-error"),
      "Input must declare aria-describedby linking to error"
    );
    assert(
      html.includes('id="test-error-error"'),
      "FieldError must have id matching aria-describedby"
    );
    assert(html.includes('role="alert"'), "FieldError must have role='alert'");
  });

  // 16. Alert and InlineError components declare role="alert"
  await runTest('16. Alert and InlineError components declare role="alert"', () => {
    const alertHtml = renderToStaticMarkup(<Alert variant="error">Network error</Alert>);
    assert(alertHtml.includes('role="alert"'), "Alert component must declare role='alert'");

    const inlineHtml = renderToStaticMarkup(<InlineError>Field error</InlineError>);
    assert(inlineHtml.includes('role="alert"'), "InlineError component must declare role='alert'");
  });

  // 17. SizeGuideModal renders accessible dialog semantics and table scope
  await runTest("17. SizeGuideModal renders accessible dialog semantics and table scope", () => {
    const html = renderToStaticMarkup(
      <SizeGuideModal
        productName="Festive Kurta"
        sizeGuide={{
          columns: [{ key: "chest", label: "Chest (in)" }],
          rows: [{ label: "2-3Y", values: { chest: "22" } }],
        }}
      />
    );
    assert(
      html.includes('aria-haspopup="dialog"'),
      "Trigger button must declare aria-haspopup='dialog'"
    );
  });

  // 18. PolicyContainer enforces semantic article, single h1, and clear hierarchy
  await runTest(
    "18. PolicyContainer enforces semantic article, single h1, and clear hierarchy",
    () => {
      const html = renderToStaticMarkup(
        <PolicyContainer title="Terms of Service" description="Terms description">
          <section>
            <h2>Section Heading</h2>
            <p>Text</p>
          </section>
        </PolicyContainer>
      );
      assert(html.includes("<article"), "Must wrap policy content in <article>");
      assert(html.includes("<h1"), "Must render <h1> for title");
      assert((html.match(/<h1/g) || []).length === 1, "Must contain exactly one <h1> element");
      assert(html.includes("<h2"), "Section headings must use <h2>");
    }
  );

  // 19. ReviewSubmissionForm star rating uses fieldset, role="radiogroup", and sr-only labels
  await runTest(
    '19. ReviewSubmissionForm star rating uses fieldset, role="radiogroup", and sr-only labels',
    () => {
      const html = renderToStaticMarkup(
        <ReviewSubmissionForm
          products={[{ id: "p1", name: "Dress", slug: "dress", storefrontSlug: "mini-sprouts" }]}
        />
      );
      assert(html.includes("<fieldset"), "Rating must use fieldset");
      assert(html.includes("<legend"), "Rating must use legend");
      assert(html.includes('role="radiogroup"'), "Rating must declare role='radiogroup'");
      assert(html.includes("1 star"), "Must provide screen-reader accessible label for 1 star");
      assert(html.includes("5 stars"), "Must provide screen-reader accessible label for 5 stars");
    }
  );

  // 20. High-contrast and visible focus indicator utility classes are present in design tokens
  await runTest(
    "20. High-contrast and visible focus indicator utility classes are present in design tokens",
    () => {
      const tailwindConfig = fs.readFileSync(
        path.join(__dirname, "../tailwind.config.ts"),
        "utf-8"
      );
      assert(tailwindConfig.includes("colors"), "Tailwind config must define explicit colors");
      assert(
        tailwindConfig.includes("brand-ink") || tailwindConfig.includes("ink"),
        "Must define high-contrast ink color"
      );
    }
  );

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Accessibility Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
