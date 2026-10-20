import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { StorefrontScope, STOREFRONT_THEMES } from "../src/components/theme/storefront-theme";
import { Typography, Heading, Text } from "../src/components/ui/typography";
import { Button } from "../src/components/ui/button";
import { Badge } from "../src/components/ui/badge";
import { Card, Surface, Panel, Divider } from "../src/components/ui/card";
import {
  FormField,
  FieldLabel,
  FieldError,
  FieldHint,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
} from "../src/components/ui/form";
import { Price, formatPKR } from "../src/components/commerce/price";
import { ProductCard } from "../src/components/commerce/product-card";
import {
  Alert,
  InlineError,
  SuccessMessage,
  LoadingSpinner,
  Skeleton,
} from "../src/components/ui/feedback";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  NoResultsState,
  EmptyCartState,
  OutOfStockState,
} from "../src/components/commerce/system-states";
import { NavLink, IconButton, DesktopNav } from "../src/components/ui/navigation";
import DesignSystemPage, { isDesignSystemAvailable } from "../src/app/design-system/page";

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
  console.log("Starting Kids Wear — Work Unit 10 Frontend Design System Test Suite...\n");

  const globalsCss = fs.readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf-8");
  const tailwindConfig = fs.readFileSync(path.join(__dirname, "../tailwind.config.ts"), "utf-8");
  const productCardSource = fs.readFileSync(
    path.join(__dirname, "../src/components/commerce/product-card.tsx"),
    "utf-8"
  );

  // 1. typography tokens render correctly
  await runTest("1. typography tokens render correctly", () => {
    const htmlDisplay = renderToStaticMarkup(
      <Typography variant="display">Editorial Title</Typography>
    );
    assert(htmlDisplay.includes("font-serif"), "Display must use serif font");
    assert(htmlDisplay.includes("Editorial Title"), "Must render text");

    const htmlH1 = renderToStaticMarkup(<Heading level={1}>Heading One</Heading>);
    assert(htmlH1.startsWith("<h1"), "Must render h1 tag");
    assert(htmlH1.includes("font-serif"), "Must use serif font");

    const htmlBody = renderToStaticMarkup(<Text variant="body">Body Copy</Text>);
    assert(htmlBody.includes("font-sans"), "Body must use sans font");
  });

  // 2. Mini theme applies Mini accent
  await runTest("2. Mini theme applies Mini accent", () => {
    assert(
      STOREFRONT_THEMES["mini-sprouts"].primaryAccent === "#C7656C",
      "Mini Sprouts accent must be #C7656C"
    );
    const html = renderToStaticMarkup(
      <StorefrontScope storefront="mini-sprouts">
        <span>Child</span>
      </StorefrontScope>
    );
    assert(html.includes('data-storefront="mini-sprouts"'), "Scope must set data-storefront");
    assert(
      globalsCss.includes('[data-storefront="mini-sprouts"]'),
      "CSS must define mini selector"
    );
    assert(globalsCss.includes("#c7656c"), "CSS must declare #c7656c accent");
  });

  // 3. Teen theme applies Teen accent
  await runTest("3. Teen theme applies Teen accent", () => {
    assert(
      STOREFRONT_THEMES["teen-studio"].primaryAccent === "#875985",
      "Teen Studio accent must be #875985"
    );
    const html = renderToStaticMarkup(
      <StorefrontScope storefront="teen-studio">
        <span>Child</span>
      </StorefrontScope>
    );
    assert(html.includes('data-storefront="teen-studio"'), "Scope must set data-storefront");
    assert(globalsCss.includes('[data-storefront="teen-studio"]'), "CSS must define teen selector");
    assert(globalsCss.includes("#875985"), "CSS must declare #875985 accent");
  });

  // 4. Aura theme applies Aura accent
  await runTest("4. Aura theme applies Aura accent", () => {
    assert(
      STOREFRONT_THEMES["aura-studio"].primaryAccent === "#8B6B50",
      "Aura Studio accent must be #8B6B50"
    );
    const html = renderToStaticMarkup(
      <StorefrontScope storefront="aura-studio">
        <span>Child</span>
      </StorefrontScope>
    );
    assert(html.includes('data-storefront="aura-studio"'), "Scope must set data-storefront");
    assert(globalsCss.includes('[data-storefront="aura-studio"]'), "CSS must define aura selector");
    assert(globalsCss.includes("#8b6b50"), "CSS must declare #8b6b50 accent");
  });

  // 5. Button variants render without type errors
  await runTest("5. Button variants render without type errors", () => {
    const primary = renderToStaticMarkup(<Button variant="primary">Primary</Button>);
    const secondary = renderToStaticMarkup(<Button variant="secondary">Secondary</Button>);
    const outline = renderToStaticMarkup(<Button variant="outline">Outline</Button>);
    const ghost = renderToStaticMarkup(<Button variant="ghost">Ghost</Button>);

    assert(primary.includes("bg-accent-storefront"), "Primary must use storefront accent");
    assert(secondary.includes("bg-surface-soft"), "Secondary must use surface-soft");
    assert(outline.includes("border-border"), "Outline must use border");
    assert(ghost.includes("bg-transparent"), "Ghost must be transparent");
  });

  // 6. disabled Button semantics correct
  await runTest("6. disabled Button semantics correct", () => {
    const disabledBtn = renderToStaticMarkup(<Button disabled>Disabled</Button>);
    assert(disabledBtn.includes("disabled"), "Must include disabled HTML attribute");
    assert(disabledBtn.includes("disabled:opacity-50"), "Must include disabled opacity class");

    // Link composition
    const linkBtn = renderToStaticMarkup(<Button href="/collections">Shop Now</Button>);
    assert(linkBtn.startsWith("<a"), "Link button must render <a> element");
    assert(linkBtn.includes('href="/collections"'), "Link must have href attribute");
  });

  // 7. Input label/error association correct
  await runTest("7. Input label/error association correct", () => {
    const html = renderToStaticMarkup(
      <FormField id="test-field" isInvalid isRequired>
        <FieldLabel>User Email</FieldLabel>
        <Input placeholder="user@example.com" />
        <FieldError>Invalid email address</FieldError>
      </FormField>
    );

    assert(html.includes('for="test-field"'), "FieldLabel must have matching htmlFor");
    assert(html.includes('id="test-field"'), "Input must receive field id");
    assert(html.includes('id="test-field-error"'), "FieldError must receive error id");
    assert(html.includes("test-field-error"), "Input must be aria-describedby error");
    assert(html.includes('aria-invalid="true"'), "Input must be aria-invalid='true'");
    assert(html.includes('role="alert"'), "FieldError must have role='alert'");
  });

  // 8. ProductCard renders Main Image
  await runTest("8. ProductCard renders Main Image", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        name="Kurta Pajama"
        slug="kurta-pajama"
        regularPrice="2499.00"
        mainImage={{ url: "/images/main.jpg", altText: "Front view of Kurta" }}
      />
    );
    assert(html.includes("main.jpg"), "Must contain main image url");
    assert(html.includes("Front view of Kurta"), "Must contain main image alt text");
  });

  // 9. ProductCard works without Hover Image
  await runTest("9. ProductCard works without Hover Image", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        name="Linen Shirt"
        slug="linen-shirt"
        regularPrice="1999.00"
        mainImage={{ url: "/images/main.jpg" }}
        hoverImage={null}
      />
    );
    assert(html.includes("main.jpg"), "Must render main image");
    assert(!html.includes("hover.jpg"), "Must not render hover image elements");
  });

  // 10. ProductCard supports optional Hover Image
  await runTest("10. ProductCard supports optional Hover Image", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        name="Linen Shirt"
        slug="linen-shirt"
        regularPrice="1999.00"
        mainImage={{ url: "/images/main.jpg" }}
        hoverImage={{ url: "/images/hover.jpg", altText: "Back view" }}
      />
    );
    assert(html.includes("hover.jpg"), "Must render hover image url");
    assert(html.includes("hidden md:block"), "Hover image must be hidden on mobile");
  });

  // 11. New badge only appears when requested
  await runTest("11. New badge only appears when requested", () => {
    const withNew = renderToStaticMarkup(
      <ProductCard
        name="Shirt"
        slug="shirt"
        regularPrice="1000.00"
        isNewArrival={true}
        mainImage={{ url: "/images/main.jpg" }}
      />
    );
    assert(withNew.includes("New"), "New badge must appear when isNewArrival=true");

    const withoutNew = renderToStaticMarkup(
      <ProductCard
        name="Shirt"
        slug="shirt"
        regularPrice="1000.00"
        isNewArrival={false}
        mainImage={{ url: "/images/main.jpg" }}
      />
    );
    assert(!withoutNew.includes("New</span>"), "New badge must not appear when isNewArrival=false");
  });

  // 12. Price component formats PKR consistently
  await runTest("12. Price component formats PKR consistently", () => {
    assert(formatPKR("2499.00") === "Rs. 2,499", "formatPKR must format 2499.00 to Rs. 2,499");
    assert(formatPKR("300.00") === "Rs. 300", "formatPKR must format 300.00 to Rs. 300");
    const html = renderToStaticMarkup(<Price price="2499.00" />);
    assert(html.includes("Rs. 2,499"), "Price component must render Rs. 2,499");
  });

  // 13. compare-at price presentation works
  await runTest("13. compare-at price presentation works", () => {
    const html = renderToStaticMarkup(<Price price="2499.00" compareAtPrice="3499.00" />);
    assert(html.includes("Rs. 2,499"), "Must render current price");
    assert(html.includes("Rs. 3,499"), "Must render compare-at price");
    assert(html.includes("line-through"), "Compare-at price must have strikethrough class");
  });

  // 14. EmptyState renders configurable content
  await runTest("14. EmptyState renders configurable content", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No Saved Outfits"
        description="Browse our storefronts to build your wishlist later."
        action={<Button>Explore Now</Button>}
      />
    );
    assert(html.includes("No Saved Outfits"), "Must render title");
    assert(html.includes("Browse our storefronts"), "Must render description");
    assert(html.includes("Explore Now"), "Must render action button");
  });

  // 15. NoResultsState renders
  await runTest("15. NoResultsState renders", () => {
    const html = renderToStaticMarkup(<NoResultsState query="Festive Kurta" />);
    assert(html.includes("No products found"), "Must render title");
    assert(html.includes("Festive Kurta"), "Must mention query parameter");
  });

  // 16. ErrorState renders
  await runTest("16. ErrorState renders", () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Failed to Load Collection" retryLabel="Reload Page" onRetry={() => {}} />
    );
    assert(html.includes('role="alert"'), "ErrorState must have role='alert'");
    assert(html.includes("Failed to Load Collection"), "Must render title");
    assert(html.includes("Reload Page"), "Must render retry button");
  });

  // 17. Loading/Skeleton state renders
  await runTest("17. Loading/Skeleton state renders", () => {
    const loadingHtml = renderToStaticMarkup(<LoadingState title="Loading Catalog..." />);
    assert(loadingHtml.includes('role="status"'), "LoadingState must have role='status'");
    assert(loadingHtml.includes("Loading Catalog..."), "Must render title");

    const skeletonHtml = renderToStaticMarkup(<Skeleton className="h-6 w-32" />);
    assert(skeletonHtml.includes("animate-pulse"), "Skeleton must include animate-pulse");
    assert(
      skeletonHtml.includes("motion-reduce:animate-none"),
      "Skeleton must respect reduced-motion"
    );
  });

  // 18. OutOfStockState renders
  await runTest("18. OutOfStockState renders", () => {
    const html = renderToStaticMarkup(<OutOfStockState />);
    assert(html.includes("unavailable"), "Must render unavailable notice");
  });

  // 19. keyboard focus visibly present
  await runTest("19. keyboard focus visibly present", () => {
    assert(globalsCss.includes(":focus-visible"), "globals.css must define :focus-visible");
    assert(
      globalsCss.includes("outline: 2px solid"),
      "globals.css must specify accessible outline"
    );
    const btnHtml = renderToStaticMarkup(<Button>Action</Button>);
    assert(btnHtml.includes("focus-visible:ring-2"), "Button must include focus-visible:ring-2");
  });

  // 20. components remain usable at mobile width
  await runTest("20. components remain usable at mobile width", () => {
    // Check mobile-first structure in ProductCard and PageContainer
    const cardHtml = renderToStaticMarkup(
      <ProductCard
        name="Shirt"
        slug="shirt"
        regularPrice="1000.00"
        mainImage={{ url: "/images/main.jpg" }}
      />
    );
    assert(cardHtml.includes("aspect-[4/5]"), "ProductCard maintains 4:5 ratio on mobile");
    assert(!cardHtml.includes("hidden lg:block w-full"), "Card must be visible on mobile");
  });

  // 21. components remain usable at tablet width
  await runTest("21. components remain usable at tablet width", () => {
    const navHtml = renderToStaticMarkup(
      <DesktopNav>
        <span>Menu</span>
      </DesktopNav>
    );
    assert(navHtml.includes("md:flex"), "DesktopNav activates from md breakpoint");
  });

  // 22. components remain usable at desktop width
  await runTest("22. components remain usable at desktop width", () => {
    assert(
      tailwindConfig.includes('container: "1320px"'),
      "tailwind.config.ts defines container: 1320px"
    );
  });

  // 23. no horizontal overflow from primitives
  await runTest("23. no horizontal overflow from primitives", () => {
    const cardHtml = renderToStaticMarkup(
      <ProductCard
        name="Shirt"
        slug="shirt"
        regularPrice="1000.00"
        mainImage={{ url: "/images/main.jpg" }}
      />
    );
    assert(
      cardHtml.includes("overflow-hidden"),
      "ProductCard image container must be overflow-hidden"
    );
  });

  // 24. reduced-motion rule present
  await runTest("24. reduced-motion rule present", () => {
    assert(
      globalsCss.includes("@media (prefers-reduced-motion: reduce)"),
      "globals.css must contain prefers-reduced-motion media query"
    );
    assert(
      globalsCss.includes("animation-duration: 0.01ms !important"),
      "globals.css must neutralize animation durations in reduced-motion"
    );
  });

  // 25. no customer-facing Wishlist/Quick Add accidentally introduced
  await runTest("25. no customer-facing Wishlist/Quick Add accidentally introduced", () => {
    assert(
      !productCardSource.toLowerCase().includes("wishlist"),
      "ProductCard must NOT contain wishlist"
    );
    assert(
      !productCardSource.toLowerCase().includes("quickadd"),
      "ProductCard must NOT contain quickAdd"
    );
    assert(
      !productCardSource.toLowerCase().includes("quick add"),
      "ProductCard must NOT contain Quick Add"
    );
    assert(
      !productCardSource.toLowerCase().includes("rating"),
      "ProductCard must NOT contain rating"
    );
    assert(
      !productCardSource.toLowerCase().includes("reviews"),
      "ProductCard must NOT contain reviews"
    );
    assert(
      !productCardSource.toLowerCase().includes("cartstore"),
      "ProductCard must NOT couple to cart state"
    );
  });

  // 26. design-system available in development
  await runTest("26. design-system available in development", () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      assert.strictEqual(
        isDesignSystemAvailable(),
        true,
        "Design system must be available in development"
      );

      const element = DesignSystemPage();
      assert(element !== null && typeof element === "object", "Must return React element");
      const html = renderToStaticMarkup(element);
      assert(html.includes("Design System Showcase"), "Showcase must render in development");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // 27. design-system unavailable in production
  await runTest("27. design-system unavailable in production", () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      assert.strictEqual(
        isDesignSystemAvailable(),
        false,
        "Design system must be unavailable in production"
      );

      let threwNotFound = false;
      try {
        DesignSystemPage();
      } catch (err: unknown) {
        const error = err as { digest?: string; message?: string };
        if (
          error.digest?.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
          error.digest?.includes("NEXT_NOT_FOUND") ||
          error.message?.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
          error.message?.includes("NEXT_NOT_FOUND")
        ) {
          threwNotFound = true;
        }
      }
      assert.strictEqual(
        threwNotFound,
        true,
        "DesignSystemPage must trigger Next.js notFound() in production"
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Frontend Design System Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
