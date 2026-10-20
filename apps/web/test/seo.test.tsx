import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import GatewayPage, { metadata as gatewayMetadata } from "../src/app/page";
import StorefrontHomePage, {
  generateMetadata as storefrontMetadata,
} from "../src/app/[storefront]/page";
import { generateMetadata as shopMetadata } from "../src/app/[storefront]/shop/page";
import { generateMetadata as newArrivalsMetadata } from "../src/app/[storefront]/new-arrivals/page";
import { generateMetadata as searchMetadata } from "../src/app/[storefront]/search/page";
import { metadata as cartMetadata } from "../src/app/cart/page";
import { metadata as checkoutMetadata } from "../src/app/checkout/page";
import { metadata as orderSuccessMetadata } from "../src/app/order-success/page";
import { metadata as accountLayoutMetadata } from "../src/app/account/layout";
import { metadata as adminLayoutMetadata } from "../src/app/admin/layout";
import { metadata as aboutMetadata } from "../src/app/about/page";
import { metadata as contactMetadata } from "../src/app/contact/page";
import { metadata as shippingPolicyMetadata } from "../src/app/shipping-policy/page";
import { metadata as returnExchangeMetadata } from "../src/app/return-exchange-policy/page";
import { metadata as privacyPolicyMetadata } from "../src/app/privacy-policy/page";
import { metadata as termsMetadata } from "../src/app/terms/page";
import { metadata as reviewsMetadata } from "../src/app/reviews/page";

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
  console.log("Starting Kids Wear — Work Unit 24 Technical SEO Test Suite...\n");

  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // 1. robots() returns valid MetadataRoute.Robots structure
  await runTest("1. robots() returns valid MetadataRoute.Robots structure", () => {
    const rules = robots();
    assert(rules.rules, "Robots output must have rules");
    assert(
      Array.isArray(rules.rules) || typeof rules.rules === "object",
      "Rules must be an array or object"
    );
  });

  // 2. robots() explicitly disallows private, transactional, and search routes
  await runTest(
    "2. robots() explicitly disallows private, transactional, and search routes",
    () => {
      const r = robots();
      const ruleObj = Array.isArray(r.rules) ? r.rules[0] : r.rules;
      const disallow = Array.isArray(ruleObj.disallow) ? ruleObj.disallow : [ruleObj.disallow];

      assert(disallow.includes("/admin"), "Must disallow /admin");
      assert(disallow.includes("/account"), "Must disallow /account");
      assert(disallow.includes("/cart"), "Must disallow /cart");
      assert(disallow.includes("/checkout"), "Must disallow /checkout");
      assert(disallow.includes("/order-success"), "Must disallow /order-success");
      assert(disallow.includes("/design-system"), "Must disallow /design-system");
      assert(
        !disallow.includes("/*?*q="),
        "Search queries must not be crawl-blocked so crawlers can read page-level noindex"
      );
      assert(ruleObj.allow === "/", "Must allow root /");
    }
  );

  // 3. robots() handles sitemap property based on NEXT_PUBLIC_SITE_URL
  await runTest("3. robots() handles sitemap property based on NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com";
    const withUrl = robots();
    assert.strictEqual(
      withUrl.sitemap,
      "https://staging.example.com/sitemap.xml",
      "Sitemap must reference site URL"
    );

    delete process.env.NEXT_PUBLIC_SITE_URL;
    const withoutUrl = robots();
    assert.strictEqual(
      withoutUrl.sitemap,
      undefined,
      "Sitemap must be omitted when site URL is unset"
    );
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  // 4. sitemap() returns array including static canonical routes
  await runTest("4. sitemap() returns array including static canonical routes", async () => {
    const map = await sitemap();
    assert(Array.isArray(map), "sitemap must return an array");
    const urls = map.map((entry) => entry.url);

    // Gateway
    assert(
      urls.some((u) => u.endsWith("/")),
      "Sitemap must include root gateway /"
    );

    // Policy and info pages
    assert(
      urls.some((u) => u.endsWith("/about")),
      "Sitemap must include /about"
    );
    assert(
      urls.some((u) => u.endsWith("/contact")),
      "Sitemap must include /contact"
    );
    assert(
      urls.some((u) => u.endsWith("/shipping-policy")),
      "Sitemap must include /shipping-policy"
    );
    assert(
      urls.some((u) => u.endsWith("/return-exchange-policy")),
      "Sitemap must include /return-exchange-policy"
    );
    assert(
      urls.some((u) => u.endsWith("/privacy-policy")),
      "Sitemap must include /privacy-policy"
    );
    assert(
      urls.some((u) => u.endsWith("/terms")),
      "Sitemap must include /terms"
    );
    assert(
      urls.some((u) => u.endsWith("/reviews")),
      "Sitemap must include /reviews"
    );
  });

  // 5. sitemap() includes all three age-based storefronts and catalog endpoints
  await runTest(
    "5. sitemap() includes all three age-based storefronts and catalog endpoints",
    async () => {
      const map = await sitemap();
      const urls = map.map((entry) => entry.url);

      for (const slug of ["mini-sprouts", "teen-studio", "aura-studio"]) {
        assert(
          urls.some((u) => u.endsWith(`/${slug}`)),
          `Sitemap must include /${slug}`
        );
        assert(
          urls.some((u) => u.endsWith(`/${slug}/shop`)),
          `Sitemap must include /${slug}/shop`
        );
        assert(
          urls.some((u) => u.endsWith(`/${slug}/new-arrivals`)),
          `Sitemap must include /${slug}/new-arrivals`
        );
      }
    }
  );

  // 6. sitemap() strictly excludes private and transactional routes
  await runTest("6. sitemap() strictly excludes private and transactional routes", async () => {
    const map = await sitemap();
    const urls = map.map((entry) => entry.url);

    for (const url of urls) {
      assert(!url.includes("/admin"), "Sitemap must not contain /admin");
      assert(!url.includes("/account"), "Sitemap must not contain /account");
      assert(!url.includes("/cart"), "Sitemap must not contain /cart");
      assert(!url.includes("/checkout"), "Sitemap must not contain /checkout");
      assert(!url.includes("/order-success"), "Sitemap must not contain /order-success");
      assert(!url.includes("/design-system"), "Sitemap must not contain /design-system");
      assert(!url.includes("/search"), "Sitemap must not contain search pages");
    }
  });

  // 7. sitemap() sets valid metadata attributes (changeFrequency, priority, lastModified)
  await runTest(
    "7. sitemap() sets valid metadata attributes (changeFrequency, priority, lastModified)",
    async () => {
      const map = await sitemap();
      for (const entry of map) {
        assert(entry.url.startsWith("http"), `URL must be absolute: ${entry.url}`);
        assert(entry.changeFrequency, `Entry must define changeFrequency: ${entry.url}`);
        assert(
          typeof entry.priority === "number",
          `Entry must define numeric priority: ${entry.url}`
        );
        assert(
          entry.lastModified instanceof Date,
          `Entry must define lastModified date: ${entry.url}`
        );
      }
    }
  );

  // 8. Root layout metadata provides title template and descriptive fallback
  await runTest("8. Root layout metadata provides title template and descriptive fallback", () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, "../src/app/layout.tsx"), "utf-8");
    assert(
      layoutSource.includes('template: "%s | Kids Wear"'),
      "Title template must brand with %s | Kids Wear"
    );
    assert(
      layoutSource.includes('default: "Kids Wear"'),
      "Default title must be factual Kids Wear"
    );
    assert(
      layoutSource.includes(
        "Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years."
      ),
      "Root layout must have descriptive description"
    );
  });

  // 9. Root layout metadata handles metadataBase gracefully
  await runTest("9. Root layout metadata handles metadataBase gracefully", () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, "../src/app/layout.tsx"), "utf-8");
    assert(
      layoutSource.includes("metadataBase: siteUrl ? new URL(siteUrl) : undefined"),
      "Root layout must set metadataBase conditionally"
    );
  });

  // 10. Gateway page metadata defines canonical /
  await runTest("10. Gateway page metadata defines canonical /", () => {
    assert.strictEqual(gatewayMetadata.alternates?.canonical, "/", "Gateway must have canonical /");
  });

  // 11. Storefront homepage metadata defines canonical /:storefront
  await runTest("11. Storefront homepage metadata defines canonical /:storefront", async () => {
    const meta = await storefrontMetadata({
      params: Promise.resolve({ storefront: "mini-sprouts" }),
    });
    assert.strictEqual(
      meta.alternates?.canonical,
      "/mini-sprouts",
      "Storefront must have canonical /mini-sprouts"
    );
  });

  // 12. Storefront shop and new-arrivals metadata define canonical paths
  await runTest(
    "12. Storefront shop and new-arrivals metadata define canonical paths",
    async () => {
      const shopMeta = await shopMetadata({
        params: Promise.resolve({ storefront: "mini-sprouts" }),
        searchParams: Promise.resolve({}),
      });
      assert.strictEqual(shopMeta.alternates?.canonical, "/mini-sprouts/shop");

      const newArrivalsMeta = await newArrivalsMetadata({
        params: Promise.resolve({ storefront: "teen-studio" }),
        searchParams: Promise.resolve({}),
      });
      assert.strictEqual(newArrivalsMeta.alternates?.canonical, "/teen-studio/new-arrivals");
    }
  );

  // 13. Policy pages define canonical alternates
  await runTest("13. Policy pages define canonical alternates", () => {
    assert.strictEqual(aboutMetadata.alternates?.canonical, "/about");
    assert.strictEqual(contactMetadata.alternates?.canonical, "/contact");
    assert.strictEqual(shippingPolicyMetadata.alternates?.canonical, "/shipping-policy");
    assert.strictEqual(returnExchangeMetadata.alternates?.canonical, "/return-exchange-policy");
    assert.strictEqual(privacyPolicyMetadata.alternates?.canonical, "/privacy-policy");
    assert.strictEqual(termsMetadata.alternates?.canonical, "/terms");
    assert.strictEqual(reviewsMetadata.alternates?.canonical, "/reviews");
  });

  // 14. Private transactional routes enforce robots: { index: false, follow: false }
  await runTest(
    "14. Private transactional routes enforce robots: { index: false, follow: false }",
    () => {
      const privateMetas = [
        { name: "cart", meta: cartMetadata },
        { name: "checkout", meta: checkoutMetadata },
        { name: "order-success", meta: orderSuccessMetadata },
        { name: "account-layout", meta: accountLayoutMetadata },
        { name: "admin-layout", meta: adminLayoutMetadata },
      ];

      for (const item of privateMetas) {
        assert(item.meta.robots, `${item.name} must declare robots metadata`);
        const robotsRule = item.meta.robots as { index?: boolean; follow?: boolean };
        assert.strictEqual(robotsRule.index, false, `${item.name} must be noindex`);
        assert.strictEqual(robotsRule.follow, false, `${item.name} must be nofollow`);
      }
    }
  );

  // 15. Search page enforces robots: { index: false, follow: true }
  await runTest("15. Search page enforces robots: { index: false, follow: true }", async () => {
    const meta = await searchMetadata({
      params: Promise.resolve({ storefront: "mini-sprouts" }),
      searchParams: Promise.resolve({ q: "shirt" }),
    });
    assert(meta.robots, "Search page must declare robots metadata");
    const robotsRule = meta.robots as { index?: boolean; follow?: boolean };
    assert.strictEqual(robotsRule.index, false, "Search results must be noindex");
    assert.strictEqual(
      robotsRule.follow,
      true,
      "Search results must allow following product links"
    );
  });

  // 16. Gateway page renders valid Organization JSON-LD structured data without physical store semantics
  await runTest(
    "16. Gateway page renders valid Organization JSON-LD structured data without physical store semantics",
    () => {
      const html = renderToStaticMarkup(<GatewayPage />);
      assert(
        html.includes("application/ld+json"),
        "Gateway must render application/ld+json script"
      );
      assert(html.includes('"@type":"Organization"'), "JSON-LD must specify Organization type");
      assert(html.includes('"name":"Kids Wear"'), "JSON-LD must specify Kids Wear name");
      assert(html.includes('"areaServed"'), "JSON-LD must specify confirmed areaServed");
      assert(!html.includes('"priceRange"'), "JSON-LD must not include arbitrary priceRange");
      assert(
        !html.includes('"ClothingStore"'),
        "JSON-LD must not claim an unconfirmed physical retail store"
      );
    }
  );

  // 17. Storefront homepage source declares CollectionPage JSON-LD structured data
  await runTest(
    "17. Storefront homepage source declares CollectionPage JSON-LD structured data",
    () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../src/app/[storefront]/page.tsx"),
        "utf-8"
      );
      assert(
        source.includes("application/ld+json"),
        "Storefront page must include application/ld+json"
      );
      assert(
        source.includes('"CollectionPage"'),
        "Storefront page must declare CollectionPage schema"
      );
    }
  );

  // 18. PDP page source declares Product JSON-LD structured data with PKR Offer
  await runTest(
    "18. PDP page source declares Product JSON-LD structured data with PKR Offer",
    () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../src/app/[storefront]/products/[slug]/page.tsx"),
        "utf-8"
      );
      assert(source.includes("application/ld+json"), "PDP page must include application/ld+json");
      assert(
        source.includes('"@type": "Product"') || source.includes('@type": "Product"'),
        "PDP must declare Product schema"
      );
      assert(source.includes('priceCurrency: "PKR"'), "PDP must declare PKR currency");
      assert(
        source.includes("https://schema.org/InStock"),
        "PDP must map available variants to InStock"
      );
      assert(
        source.includes("https://schema.org/OutOfStock"),
        "PDP must map unavailable variants to OutOfStock"
      );
      assert(!source.includes("itemCondition"), "PDP must not include unsupported itemCondition");
    }
  );

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Technical SEO Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
