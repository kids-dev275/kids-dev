import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import GatewayPage from "../src/app/page";
import { getActiveGatewayIndex, INITIAL_GATEWAY_INDEX } from "../src/components/gateway/gateway-card-track";
import { AnnouncementBar } from "../src/components/shell/announcement-bar";
import { Header } from "../src/components/shell/header";
import { getMobileNavLinks, MobileNav } from "../src/components/shell/mobile-nav";
import { StorefrontSwitcher } from "../src/components/shell/storefront-switcher";
import { Footer } from "../src/components/shell/footer";
import { StorefrontShell } from "../src/components/shell/storefront-shell";
import { HeroSlider } from "../src/components/home/hero-slider";
import { StorefrontHomeSections } from "../src/components/home/storefront-home-sections";
import { ShopByAge } from "../src/components/home/shop-by-age";
import { NewArrivalsSection } from "../src/components/home/new-arrivals-section";
import { WhyKidsWear } from "../src/components/home/why-kids-wear";
import { ReviewsPreview } from "../src/components/home/reviews-preview";
import { ContactSection } from "../src/components/home/contact-section";
import { EditorialBrandSection } from "../src/components/home/editorial-brand-section";
import { isValidStorefrontSlug, STOREFRONT_THEMES } from "../src/components/theme/storefront-theme";
import type { ApiHeroSlide, ApiProductCard } from "../src/lib/api";

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
  console.log("Starting Kids Wear — Work Unit 11 Storefront Shell & Homepage Test Suite...\n");

  const appDir = path.join(__dirname, "../src/app");
  const componentsDir = path.join(__dirname, "../src/components");

  // Read component source files for scope inspection
  const headerSource = fs.readFileSync(path.join(componentsDir, "shell/header.tsx"), "utf-8");
  const footerSource = fs.readFileSync(path.join(componentsDir, "shell/footer.tsx"), "utf-8");
  const mobileNavSource = fs.readFileSync(
    path.join(componentsDir, "shell/mobile-nav.tsx"),
    "utf-8"
  );
  const whyKidsWearSource = fs.readFileSync(
    path.join(componentsDir, "home/why-kids-wear.tsx"),
    "utf-8"
  );
  const reviewsSource = fs.readFileSync(
    path.join(componentsDir, "home/reviews-preview.tsx"),
    "utf-8"
  );
  const contactSource = fs.readFileSync(
    path.join(componentsDir, "home/contact-section.tsx"),
    "utf-8"
  );
  const storefrontPageSource = fs.readFileSync(path.join(appDir, "[storefront]/page.tsx"), "utf-8");
  const gatewaySource = fs.readFileSync(path.join(appDir, "page.tsx"), "utf-8");
  const editorialSource = fs.readFileSync(
    path.join(componentsDir, "home/editorial-brand-section.tsx"),
    "utf-8"
  );
  const heroSliderSource = fs.readFileSync(
    path.join(componentsDir, "home/hero-slider.tsx"),
    "utf-8"
  );
  const newArrivalsSource = fs.readFileSync(
    path.join(componentsDir, "home/new-arrivals-section.tsx"),
    "utf-8"
  );
  const shopByAgeSource = fs.readFileSync(
    path.join(componentsDir, "home/shop-by-age.tsx"),
    "utf-8"
  );

  // ============================================================================
  // Gateway Tests (1–5)
  // ============================================================================

  await runTest("1. Gateway renders all 3 Storefront identities", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(html.includes("Mini Sprouts"), "Must render Mini Sprouts");
    assert(html.includes("Teen Studio"), "Must render Teen Studio");
    assert(html.includes("Aura Studio"), "Must render Aura Studio");
    assert(html.includes("0–10 Years"), "Must render 0–10 Years age range");
    assert(html.includes("11–16 Years"), "Must render 11–16 Years age range");
    assert(html.includes("17+ Years"), "Must render 17+ Years age range");
  });

  await runTest("2. Mini links to /mini-sprouts", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(html.includes('href="/mini-sprouts"'), "Gateway must link directly to /mini-sprouts");
  });

  await runTest("3. Teen links to /teen-studio", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(html.includes('href="/teen-studio"'), "Gateway must link directly to /teen-studio");
  });

  await runTest("4. Aura links to /aura-studio", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(html.includes('href="/aura-studio"'), "Gateway must link directly to /aura-studio");
  });

  await runTest("5. no fourth Storefront/category introduced", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(!html.includes("Baby"), "No baby category permitted");
    assert(!html.includes("Toddler"), "No toddler category permitted");
    assert(!html.includes("Adult"), "No adult storefront permitted");
    assert(!html.includes("Accessories"), "No accessories gateway permitted");
    assert(!html.includes("Sale"), "No sale gateway permitted");
    assert(!html.includes("Boys"), "No gender gateways permitted");
    assert(!html.includes("Girls"), "No gender gateways permitted");
  });

  await runTest("5a. Gateway header shows centered branding without contact details", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
    assert(header, "Gateway must render a header");
    assert(header.includes('alt="Kids Wear"'), "Header must retain the Kids Wear logo");
    assert(header.includes("Little Styles. Brighter Tomorrows."), "Header must retain the tagline");
    assert(header.includes("items-center justify-center text-center"), "Branding must remain centered");
    assert(!header.includes("Street-05") && !header.includes("Darul Islam Colony") && !header.includes("Attock, Pakistan"), "Header must not show the address");
    assert(!header.includes("0981321") && !header.includes("tel:"), "Header must not show the phone number or link");
    assert(!header.includes("info@thekidswear.com") && !header.includes("mailto:"), "Header must not show the email or link");
    assert(!header.includes("<svg"), "Header must not retain contact icons");
    assert.equal((html.match(/data-storefront=/g) || []).length, 3, "All three storefront cards must remain");
  });

  await runTest("5b. Gateway cards show only identity, age, and outlined collection links", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert.equal((html.match(/data-storefront=/g) || []).length, 3);
    assert.equal((html.match(/Explore collection/g) || []).length, 3);
    assert(!html.includes("Playful Outfits for Their Brightest Days"));
    assert(!html.includes("Trendy Styles for Every Mood"));
    assert(!html.includes("Modern Looks for What’s Next"));
    for (const [slug, name, age] of [
      ["mini-sprouts", "Mini Sprouts", "0–10 Years"],
      ["teen-studio", "Teen Studio", "11–16 Years"],
      ["aura-studio", "Aura Studio", "17+ Years"],
    ]) {
      const card = html.match(new RegExp(`<a[^>]*data-storefront="${slug}"[\\s\\S]*?<\\/a>`))?.[0];
      assert(card, `${slug} card must render`);
      assert(card.includes(`href="/${slug}"`));
      assert(card.includes(name) && card.includes(age), `${slug} identity must remain complete`);
      assert(card.indexOf(name) < card.indexOf(age), `${slug} name must precede age`);
      assert(card.indexOf(age) < card.indexOf("Explore collection"), `${slug} age must precede CTA`);
      assert(card.includes("border bg-transparent"), `${slug} CTA should be outlined`);
      assert(card.includes("group-focus-visible:ring-2"), `${slug} CTA should show focus`);
    }
  });

  await runTest("5c. Mobile Gateway exposes one swipe track and initial progress", () => {
    const html = renderToStaticMarkup(<GatewayPage />);
    assert(html.includes("Choose Your Storefront"));
    assert(html.includes("Explore styles curated by age and stage."));
    assert.equal((html.match(/data-gateway-track=/g) || []).length, 1);
    assert(html.includes('role="region"'));
    assert(html.includes('aria-label="Storefront cards"'));
    assert.equal((html.match(/data-active="true"/g) || []).length, 1);
    assert.equal((html.match(/data-active="false"/g) || []).length, 2);
    assert.equal(INITIAL_GATEWAY_INDEX, 1);
    assert(html.includes("Teen Studio, card 2 of 3"));
    assert(html.indexOf('data-storefront="mini-sprouts"') < html.indexOf('data-storefront="teen-studio"'));
    assert(html.indexOf('data-storefront="teen-studio"') < html.indexOf('data-storefront="aura-studio"'));
  });

  await runTest("5d. Gateway progress selects the most visible card", () => {
    assert.equal(getActiveGatewayIndex([1, 0.1, 0]), 0);
    assert.equal(getActiveGatewayIndex([0.2, 0.95, 0.1]), 1);
    assert.equal(getActiveGatewayIndex([0, 0.2, 1]), 2);
  });

  // ============================================================================
  // Announcement Bar Tests (6–9)
  // ============================================================================

  await runTest("6. active Announcement renders", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar
        announcement={{ text: "Pakistan-Wide Delivery Available", link: null, isActive: true }}
      />
    );
    assert(html.includes("Pakistan-Wide Delivery Available"), "Must render active announcement text");
    assert(html.includes('aria-label="Announcement"'), "Must provide accessible landmark");
  });

  await runTest("7. inactive Announcement does not render", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar announcement={{ text: "Expired Promo", link: null, isActive: false }} />
    );
    assert.strictEqual(html, "", "Inactive announcement must produce empty markup");

    const htmlNull = renderToStaticMarkup(<AnnouncementBar announcement={null} />);
    assert.strictEqual(htmlNull, "", "Null announcement must produce empty markup");
  });

  await runTest("8. linked Announcement renders safe link", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar
        announcement={{ text: "Order Notice", link: "/mini-sprouts/shop", isActive: true }}
      />
    );
    assert(html.includes('href="/mini-sprouts/shop"'), "Must render link href");
    assert(html.includes("Order Notice"), "Must render announcement text");
  });

  await runTest("9. public settings bank data is never rendered", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBar announcement={{ text: "Regular Notice", link: null, isActive: true }} />
    );
    assert(!html.includes("bank"), "Announcement must never mention bank");
    assert(!html.includes("accountNumber"), "Must not expose account number");
    assert(!html.includes("iban"), "Must not expose IBAN");
  });

  // ============================================================================
  // Header & Navigation Tests (10–15)
  // ============================================================================

  await runTest("10. Header renders Kids Wear identity", () => {
    const html = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
    assert(html.includes("Kids Wear"), "Header must render master brand name");
    assert(html.includes("Mini Sprouts"), "Header must render current storefront name");
  });

  await runTest("11. Storefront-specific nav stays in current Storefront", () => {
    const htmlMini = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
    assert(htmlMini.includes('href="/mini-sprouts"'), "Mini must link to /mini-sprouts");
    assert(htmlMini.includes('href="/mini-sprouts/shop"'), "Mini must link to /mini-sprouts/shop");
    assert(
      htmlMini.includes('href="/mini-sprouts/new-arrivals"'),
      "Mini must link to /mini-sprouts/new-arrivals"
    );

    const htmlTeen = renderToStaticMarkup(<Header storefront="teen-studio" />);
    assert(htmlTeen.includes('href="/teen-studio"'), "Teen must link to /teen-studio");
    assert(htmlTeen.includes('href="/teen-studio/shop"'), "Teen must link to /teen-studio/shop");
    assert(!htmlTeen.includes('href="/mini-sprouts/shop"'), "Teen must not link to mini shop");
  });

  await runTest("12. Storefront switcher contains exactly three Storefronts", () => {
    const html = renderToStaticMarkup(<StorefrontSwitcher currentStorefront="mini-sprouts" />);
    assert(html.includes('href="/mini-sprouts"'), "Must include Mini Sprouts link");
    assert(html.includes('href="/teen-studio"'), "Must include Teen Studio link");
    assert(html.includes('href="/aura-studio"'), "Must include Aura Studio link");
    assert(
      html.includes('aria-label="Storefront Switcher"'),
      "Must have accessible switcher label"
    );
  });

  await runTest("12a. Header contains the larger five-link navigation without a switcher", () => {
    const html = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
    assert(!html.includes('aria-label="Storefront Switcher"'));
    assert(html.includes("text-[17px]"));
    for (const label of ["Home", "Shop", "New Arrivals", "Reviews", "Contact"]) {
      assert(html.includes(`>${label}</a>`), `${label} must remain in the header`);
    }
  });

  await runTest("12b. Homepage switcher follows services and selects each active storefront", () => {
    assert(
      storefrontPageSource.indexOf("<HeroSlider") < storefrontPageSource.indexOf("<StorefrontHomeSections"),
      "Hero must precede the services and switcher"
    );
    for (const slug of ["mini-sprouts", "teen-studio", "aura-studio"] as const) {
      const html = renderToStaticMarkup(
        <StorefrontHomeSections storefront={slug} newArrivals={[]} catalog={[]} reviews={[]} />
      );
      const serviceEnd = html.indexOf("Bank Transfer");
      const switcher = html.indexOf('aria-label="Storefront Switcher"');
      const arrivals = html.indexOf("Just arrived");
      assert(serviceEnd >= 0 && serviceEnd < switcher && switcher < arrivals);
      const currentLink = [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)]
        .map(([link]) => link)
        .find((link) => link.includes(`href="/${slug}"`));
      assert(currentLink, `${slug} should be the active link`);
      assert(currentLink.includes("bg-[var(--color-storefront-contrast)]"));
      for (const destination of ["mini-sprouts", "teen-studio", "aura-studio"]) {
        assert(html.includes(`href="/${destination}"`));
        if (destination !== slug) {
          const inactiveLink = [...html.matchAll(/<a\b[^>]*>/g)]
            .map(([link]) => link)
            .find((link) => link.includes(`href="/${destination}"`));
          assert(inactiveLink && !inactiveLink.includes('aria-current="page"'));
          assert(inactiveLink.includes("bg-surface text-ink"));
        }
      }
    }
  });

  await runTest("13. mobile trigger exposes accessible state attributes", () => {
    const html = renderToStaticMarkup(<MobileNav storefront="mini-sprouts" />);
    assert(
      html.includes('aria-expanded="false"'),
      "Initial mobile trigger must have aria-expanded=false"
    );
    assert(
      html.includes('aria-label="Open navigation menu"'),
      "Initial mobile trigger must have open label"
    );
    assert(
      html.includes('aria-controls="mobile-navigation-drawer"'),
      "Must link trigger to drawer id"
    );
  });

  await runTest("13a. phone header keeps store identity and shopping actions without account icon", () => {
    for (const storefront of ["mini-sprouts", "teen-studio", "aura-studio"] as const) {
      const html = renderToStaticMarkup(<Header storefront={storefront} />);
      const mobile = html.slice(
        html.indexOf('data-testid="mobile-storefront-header"'),
        html.indexOf('data-testid="tablet-desktop-storefront-header"')
      );
      assert(mobile.includes(STOREFRONT_THEMES[storefront].name));
      assert(mobile.includes('alt="Kids Wear"'));
      assert(mobile.includes(`aria-label="Search ${STOREFRONT_THEMES[storefront].name}"`));
      assert(mobile.includes('aria-label="Shopping Cart"'));
      assert(mobile.includes('aria-label="Open navigation menu"'));
      assert(!mobile.includes('aria-label="Customer Account"'));
      assert(html.includes('data-testid="tablet-desktop-storefront-header"'));
      assert(html.includes('aria-label="Customer Account"'));
    }
  });

  await runTest("13b. phone menu has six scoped destinations and a single active page", () => {
    const home = getMobileNavLinks("mini-sprouts", "/mini-sprouts");
    assert.deepEqual(home.map(({ label }) => label), ["Home", "Shop", "New Arrivals", "Reviews", "Contact", "My Account"]);
    assert.deepEqual(home.filter(({ active }) => active).map(({ label }) => label), ["Home"]);
    assert.equal(home.find(({ label }) => label === "Shop")?.href, "/mini-sprouts/shop");
    assert.equal(home.find(({ label }) => label === "My Account")?.href, "/account");
    assert.deepEqual(getMobileNavLinks("teen-studio", "/teen-studio/shop").filter(({ active }) => active).map(({ label }) => label), ["Shop"]);
    assert.deepEqual(getMobileNavLinks("aura-studio", "/account/profile").filter(({ active }) => active).map(({ label }) => label), ["My Account"]);
  });

  await runTest("14. no Wishlist navigation exists", () => {
    assert(!headerSource.toLowerCase().includes("wishlist"), "Header must not reference wishlist");
    assert(
      !mobileNavSource.toLowerCase().includes("wishlist"),
      "MobileNav must not reference wishlist"
    );
    assert(!footerSource.toLowerCase().includes("wishlist"), "Footer must not reference wishlist");
  });

  await runTest("15. no global Shop navigation route exists", () => {
    const html = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
    // Check that 'href="/shop"' alone does not exist; only storefront-scoped '/mini-sprouts/shop'
    const hasGlobalShop = /href="\/shop"/i.test(html);
    assert(!hasGlobalShop, "Must not introduce un-scoped global /shop route");
  });

  // ============================================================================
  // Homepage Sections Tests (16–24)
  // ============================================================================

  await runTest("16. Storefront theme scope applied correctly", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storefront="mini-sprouts">
        <div>Content</div>
      </StorefrontShell>
    );
    assert(
      html.includes('data-storefront="mini-sprouts"'),
      "Shell must set data-storefront attribute"
    );
  });

  await runTest("17. Hero data maps correctly", () => {
    const mockSlide: ApiHeroSlide = {
      id: "slide-1",
      storefrontId: "sf-1",
      heading: "Festive Embroidered Silk",
      text: "Crafted exclusively for celebratory gatherings.",
      ctaLabel: "Shop Silk Collection",
      ctaLink: "/mini-sprouts/shop",
      sortOrder: 0,
      isActive: true,
      desktopImageAsset: {
        id: "img-d1",
        secureUrl: "/images/hero-desktop.jpg",
        width: 1920,
        height: 800,
        format: "jpg",
      },
      mobileImageAsset: {
        id: "img-m1",
        secureUrl: "/images/hero-mobile.jpg",
        width: 1080,
        height: 1350,
        format: "jpg",
      },
    };

    const html = renderToStaticMarkup(
      <HeroSlider slides={[mockSlide]} storefront="mini-sprouts" />
    );
    assert(html.includes("Festive Embroidered Silk"), "Hero must render slide heading");
    assert(
      html.includes("Crafted exclusively for celebratory gatherings."),
      "Hero must render slide text"
    );
    assert(html.includes("Shop Silk Collection"), "Hero must render cta label");
    assert(html.includes('href="/mini-sprouts/shop"'), "Hero must render cta link");
    assert(html.includes("0–10 Years"), "Hero must render the storefront age badge");
    const cta = html.match(/<a[^>]*href="\/mini-sprouts\/shop"[^>]*>[\s\S]*?<\/a>/)?.[0];
    assert(cta, "Hero must render the configured CTA");
    assert(cta.includes("Shop Silk Collection"), "Hero CTA must retain the configured label");
    assert(!cta.includes("<svg"), "Hero CTA should omit the trailing arrow");
    assert(cta.includes("border-2") && cta.includes("bg-white/90"), "Hero CTA should be outlined");
    assert(cta.includes("hover:bg-[var(--color-storefront-contrast)]"), "Hero CTA should have a themed hover state");
    assert(cta.includes("focus-visible:ring-2"), "Hero CTA should show keyboard focus");
  });

  await runTest("17a. All Hero badges and configured CTA routes stay storefront-specific", () => {
    for (const [slug, age, label] of [
      ["mini-sprouts", "0–10 Years", "Shop Mini Sprouts"],
      ["teen-studio", "11–16 Years", "Shop Teen Studio"],
      ["aura-studio", "17+ Years", "Shop Aura Studio"],
    ] as const) {
      const html = renderToStaticMarkup(<HeroSlider slides={[]} storefront={slug} />);
      assert(html.includes(age), `${slug} badge must use its age range`);
      assert(html.includes(label), `${slug} CTA must retain its configured label`);
      assert(html.includes(`href="/${slug}/shop"`), `${slug} CTA must retain its route`);
      assert(html.includes('aria-label="Previous slide"') && html.includes('aria-label="Next slide"'));
    }
  });

  await runTest("18. local Hero fallback has valid slides and controls", () => {
    const html = renderToStaticMarkup(<HeroSlider slides={[]} storefront="mini-sprouts" />);
    assert(html.includes("Mini Sprouts"), "Fallback must identify the storefront");
    assert(html.includes("/images/hero/mini-sprouts/mini-sprouts-hero-01-desktop.webp"), "Fallback must use a local hero image");
    assert(html.includes('aria-label="Previous slide"'), "Three fallback slides need previous control");
    assert(html.includes('aria-label="Next slide"'), "Three fallback slides need next control");
    assert(html.includes('aria-label="Go to slide 3 of 3"'), "Fallback indicators must describe all three slides");
  });

  await runTest("19. desktop/mobile Hero media contract supported", () => {
    const mockSlide: ApiHeroSlide = {
      id: "slide-2",
      storefrontId: "sf-1",
      heading: "Festive Kurta",
      text: "Bespoke pret.",
      ctaLabel: "Shop",
      ctaLink: "/mini-sprouts/shop",
      sortOrder: 0,
      isActive: true,
      desktopImageAsset: {
        id: "img-d2",
        secureUrl: "/images/desktop-1920x800.jpg",
        width: 1920,
        height: 800,
        format: "jpg",
      },
      mobileImageAsset: {
        id: "img-m2",
        secureUrl: "/images/mobile-1080x1350.jpg",
        width: 1080,
        height: 1350,
        format: "jpg",
      },
    };

    const html = renderToStaticMarkup(
      <HeroSlider slides={[mockSlide]} storefront="mini-sprouts" />
    );
    assert(html.includes("desktop-1920x800.jpg"), "Must contain desktop image source");
    assert(html.includes("mobile-1080x1350.jpg"), "Must contain mobile image source");
  });

  await runTest("20. New Arrivals uses ProductCard primitive", () => {
    const mockProduct: ApiProductCard = {
      id: "prod-1",
      name: "Chanderi Silk Kurta",
      slug: "chanderi-silk-kurta",
      regularPrice: "2999.00",
      compareAtPrice: "3499.00",
      isNewArrival: true,
      mainImage: {
        url: "/images/main.jpg",
        altText: "Chanderi Silk Kurta Front",
      },
      hoverImage: {
        url: "/images/hover.jpg",
        altText: "Chanderi Silk Kurta Back",
      },
    };

    const html = renderToStaticMarkup(
      <NewArrivalsSection storefront="mini-sprouts" products={[mockProduct]} />
    );
    assert(html.includes("Chanderi Silk Kurta"), "Must render product name");
    assert(html.includes("2,999"), "Must format PKR price");
    assert(html.includes("3,499"), "Must format compare-at price");
    assert(html.includes("New"), "Must render New arrival badge");
    assert(
      html.includes('href="/mini-sprouts/products/chanderi-silk-kurta"'),
      "Must link to storefront PDP"
    );
  });

  await runTest("21. no fake Product fallback rendered", () => {
    const htmlEmpty = renderToStaticMarkup(
      <NewArrivalsSection storefront="mini-sprouts" products={[]} />
    );
    assert.strictEqual(
      htmlEmpty,
      "",
      "Empty new arrivals must produce null/empty markup without fake products"
    );
  });

  await runTest("22. Why Kids Wear contains no free-shipping claim", () => {
    const html = renderToStaticMarkup(<WhyKidsWear flatDeliveryCharge="300.00" />);
    assert(
      !html.toLowerCase().includes("free shipping"),
      "WhyKidsWear must not claim free shipping"
    );
    assert(html.includes("Delivery within 10 days"), "Must state approved 10-day timeframe");
    assert(html.includes("Rs. 300"), "Must state flat delivery charge");
    assert(
      !whyKidsWearSource.toLowerCase().includes("free shipping"),
      "Source code must not mention free shipping"
    );
  });

  await runTest("23. Reviews preview contains no fake testimonials", () => {
    const html = renderToStaticMarkup(<ReviewsPreview />);
    assert(!html.includes("5.0"), "Must not invent 5-star ratings");
    assert(!html.includes("★★★★★"), "Must not invent star graphics");
    assert(!html.includes("Ayesha M."), "Must not invent customer names");
    assert(!html.includes("verified buyer"), "Must not invent fake verification badges");
    assert(!html.toLowerCase().includes("verified review"), "Must not claim verified reviews");
    assert(html.includes("No Customer Reviews Yet"), "Must explain review status honestly");
    assert(!reviewsSource.toLowerCase().includes("5 star"), "Source must not have fake stars");
  });

  await runTest("24. approved contact information rendered correctly", () => {
    const html = renderToStaticMarkup(<ContactSection />);
    assert(html.includes("+92 335 0981 321"), "Must display approved phone/whatsapp");
    assert(html.includes("info@thekidswear.com"), "Must display approved email");
    assert(html.includes("Darul Islam Colony"), "Must display approved address colony");
    assert(html.includes("Attock, Pakistan"), "Must display approved city and country");
  });

  // ============================================================================
  // Footer Tests (25–28)
  // ============================================================================

  await runTest("25. Footer contains policy route links", () => {
    const html = renderToStaticMarkup(<Footer />);
    assert(
      html.includes('href="/shipping-policy"') || html.includes('href="/policies/shipping"'),
      "Footer must link to shipping policy"
    );
    assert(
      html.includes('href="/return-exchange-policy"') || html.includes('href="/policies/returns"'),
      "Footer must link to returns policy"
    );
    assert(
      html.includes('href="/privacy-policy"') || html.includes('href="/policies/privacy"'),
      "Footer must link to privacy policy"
    );
    assert(
      html.includes('href="/terms"') || html.includes('href="/policies/terms"'),
      "Footer must link to terms policy"
    );
    assert(html.includes('href="/about"'), "Footer must link to about page");
    assert(html.includes('href="/contact"'), "Footer must link to contact page");
  });

  await runTest("26. Footer contains all 3 Storefront links", () => {
    const html = renderToStaticMarkup(<Footer />);
    assert(html.includes('href="/mini-sprouts"'), "Footer must link to Mini Sprouts");
    assert(html.includes('href="/teen-studio"'), "Footer must link to Teen Studio");
    assert(html.includes('href="/aura-studio"'), "Footer must link to Aura Studio");
    const hasGlobalShop = /href="\/shop"/i.test(html);
    assert(!hasGlobalShop, "Footer must not contain global /shop link");
  });

  await runTest("27. shared footer renders confirmed contact details", () => {
    const html = renderToStaticMarkup(<Footer />);
    assert.strictEqual((html.match(/<footer\b/g) || []).length, 1, "Must render one shared footer");
    assert(html.includes('href="tel:+923350981321"'), "Must link confirmed phone number");
    assert(html.includes('href="mailto:info@thekidswear.com"'), "Must link confirmed email");
    assert(html.includes("Street-05, Darul Islam Colony, Attock, Pakistan"), "Must show confirmed business address");
  });

  await runTest("28. unapproved social platforms absent", () => {
    const html = renderToStaticMarkup(<Footer />);
    assert(!html.includes("twitter.com"), "No Twitter link");
    assert(!html.includes("x.com"), "No X link");
    assert(!html.includes("youtube.com"), "No YouTube link");
    assert(!html.includes("linkedin.com"), "No LinkedIn link");
  });

  // ============================================================================
  // Scope Discipline Tests (29–33)
  // ============================================================================

  await runTest("29. no cart state implementation", () => {
    assert(!headerSource.includes("useCart"), "Header must not couple to cart hook");
    assert(!headerSource.includes("cartStore"), "Header must not couple to cart store");
  });

  await runTest("30. no checkout implementation", () => {
    assert(!headerSource.toLowerCase().includes("/checkout"), "Header must not link to checkout");
    assert(!footerSource.toLowerCase().includes("/checkout"), "Footer must not link to checkout");
  });

  await runTest("31. Product Detail route correctly placed in storefront scope", () => {
    const pdpExists = fs.existsSync(path.join(appDir, "[storefront]/products/[slug]/page.tsx"));
    assert(pdpExists, "PDP route must exist at [storefront]/products/[slug]");
    const globalPdpExists = fs.existsSync(path.join(appDir, "products/[slug]/page.tsx"));
    assert(!globalPdpExists, "Global un-scoped PDP route must not exist");
  });

  await runTest("32. no Review submission implementation", () => {
    assert(
      !reviewsSource.toLowerCase().includes("<form"),
      "Reviews section must not render submission form"
    );
    assert(
      !reviewsSource.toLowerCase().includes("submit review"),
      "Reviews section must not have submit button"
    );
  });

  await runTest("33. no Admin UI in customer shell", () => {
    const shellSource = fs.readFileSync(
      path.join(__dirname, "../src/components/shell/storefront-shell.tsx"),
      "utf8"
    );
    const headerSource = fs.readFileSync(
      path.join(__dirname, "../src/components/shell/header.tsx"),
      "utf8"
    );
    const footerSource = fs.readFileSync(
      path.join(__dirname, "../src/components/shell/footer.tsx"),
      "utf8"
    );
    assert(!shellSource.includes("/admin"), "Customer shell must not link to Admin UI");
    assert(!headerSource.includes("/admin"), "Customer header must not link to Admin UI");
    assert(!footerSource.includes("/admin"), "Customer footer must not link to Admin UI");
  });

  // ============================================================================
  // Storefront Slug Validation Tests (34–35)
  // ============================================================================

  await runTest("34. unknown storefront slug rejected by validator", () => {
    assert.strictEqual(
      isValidStorefrontSlug("random-slug"),
      false,
      "Unknown slug must be rejected"
    );
    assert.strictEqual(isValidStorefrontSlug("baby-studio"), false, "Unknown category rejected");
    assert.strictEqual(isValidStorefrontSlug("kids"), false, "Generic slug rejected");
  });

  await runTest("35. valid storefront slugs recognized by validator", () => {
    assert.strictEqual(isValidStorefrontSlug("mini-sprouts"), true, "Mini Sprouts must be valid");
    assert.strictEqual(isValidStorefrontSlug("teen-studio"), true, "Teen Studio must be valid");
    assert.strictEqual(isValidStorefrontSlug("aura-studio"), true, "Aura Studio must be valid");
  });

  // ============================================================================
  // Freshness & Content Discipline Tests (36–40)
  // ============================================================================

  await runTest(
    "36. Storefront homepage dynamic rendering explicitly configured (force-dynamic)",
    () => {
      assert(
        storefrontPageSource.includes('export const dynamic = "force-dynamic"'),
        "Must configure export const dynamic = 'force-dynamic' for request-time rendering"
      );
      assert(
        !storefrontPageSource.includes("generateStaticParams"),
        "Must not use generateStaticParams to freeze dynamic content at build time"
      );
    }
  );

  await runTest("37. dynamic shipping charge 425.00 renders as Rs. 425", () => {
    const html = renderToStaticMarkup(<WhyKidsWear flatDeliveryCharge="425.00" />);
    assert(html.includes("Rs. 425"), "Must render Rs. 425 from 425.00 shipping setting");
    assert(!html.includes("Rs. 300"), "Must not render Rs. 300 when shipping charge is 425.00");
  });

  await runTest("38. no customer-facing hardcoded Rs. 300 default in WhyKidsWear", () => {
    const htmlWithoutCharge = renderToStaticMarkup(<WhyKidsWear />);
    assert(
      !htmlWithoutCharge.includes("Rs. 300"),
      "Must not display hardcoded Rs. 300 when no charge is provided"
    );
    assert(
      !whyKidsWearSource.includes('flatDeliveryCharge = "300.00"'),
      "Source must not define 300.00 default prop"
    );
  });

  await runTest(
    "39. no pure fabrics, artisanal tailoring, or unapproved craftsmanship claims",
    () => {
      const combinedSource = [
        editorialSource,
        whyKidsWearSource,
        gatewaySource,
        heroSliderSource,
        footerSource,
      ].join(" ");

      assert(
        !combinedSource.toLowerCase().includes("pure fabric"),
        "No pure fabric claims permitted"
      );
      assert(
        !combinedSource.toLowerCase().includes("artisanal tailoring"),
        "No artisanal tailoring claims permitted"
      );
      assert(
        !combinedSource.toLowerCase().includes("textile craftsmanship"),
        "No unsupported textile craftsmanship claims permitted"
      );
      assert(
        !combinedSource.toLowerCase().includes("heirloom-worthy"),
        "No heirloom-worthy claims permitted"
      );
      assert(
        !combinedSource.toLowerCase().includes("hand-finished"),
        "No hand-finished claims permitted"
      );
    }
  );

  await runTest("40. Hero empty state contains no fabricated promotion or discounts", () => {
    const html = renderToStaticMarkup(<HeroSlider slides={[]} storefront="mini-sprouts" />);
    assert(!html.toLowerCase().includes("discount"), "No discount claims in empty hero state");
    assert(!html.toLowerCase().includes("% off"), "No percent-off claims in empty hero state");
    assert(!html.toLowerCase().includes("sale"), "No sale claims in empty hero state");
    assert(!html.toLowerCase().includes("promo"), "No promo claims in empty hero state");
    assert(html.includes("Playful styles for everyday moments and special days."), "Must render approved Mini fallback copy");
  });

  // ============================================================================
  // Final Content-Scope Discipline Tests (41–46)
  // ============================================================================

  await runTest(
    "41. Gateway renders 3 confirmed Storefront names and age ranges without card descriptions",
    () => {
      const html = renderToStaticMarkup(<GatewayPage />);
      // 3 confirmed Storefront names
      assert(html.includes("Mini Sprouts"), "Must render Mini Sprouts");
      assert(html.includes("Teen Studio"), "Must render Teen Studio");
      assert(html.includes("Aura Studio"), "Must render Aura Studio");

      // 3 confirmed age ranges
      assert(html.includes("0–10 Years"), "Must render 0–10 Years");
      assert(html.includes("11–16 Years"), "Must render 11–16 Years");
      assert(html.includes("17+ Years"), "Must render 17+ Years");

      assert(!html.includes("Explore Kids Wear apparel for ages"), "Card descriptions must be absent");
    }
  );

  await runTest("42. static Gateway copy contains no unconfirmed merchandise categories", () => {
    const forbiddenCategories = [
      "kurta",
      "waistcoat",
      "occasion wear",
      "tailored set",
      "coordinated set",
      "festive pret",
      "kids wear pret",
    ];
    for (const category of forbiddenCategories) {
      assert(
        !gatewaySource.toLowerCase().includes(category),
        `Static Gateway source must not contain speculative category '${category}'`
      );
    }
  });

  await runTest(
    "43. static brand/editorial copy contains no festive pret or Kids Wear Pret",
    () => {
      const html = renderToStaticMarkup(<EditorialBrandSection storefront="mini-sprouts" />);
      assert(
        !html.toLowerCase().includes("festive pret"),
        "Brand section must not contain 'festive pret'"
      );
      assert(!html.includes("Kids Wear Pret"), "Brand section must not contain 'Kids Wear Pret'");
      assert(
        !editorialSource.toLowerCase().includes("festive pret"),
        "Source must not contain 'festive pret'"
      );
      assert(
        !editorialSource.includes("Kids Wear Pret"),
        "Source must not contain 'Kids Wear Pret'"
      );

      // Confirmed neutral brand positioning
      assert(html.includes("Kids Wear"), "Must render confirmed brand name");
      assert(html.includes("Apparel for Each Age Group"), "Must render confirmed neutral heading");
      assert(
        html.includes("delivered across Pakistan within 10 days"),
        "Must render confirmed delivery timeframe"
      );
      assert(
        html.includes("Cash on Delivery and manual bank transfer"),
        "Must render confirmed payment methods"
      );
    }
  );

  await runTest("44. Hero fallback does not invent Product types", () => {
    const miniHtml = renderToStaticMarkup(<HeroSlider slides={[]} storefront="mini-sprouts" />);
    const teenHtml = renderToStaticMarkup(<HeroSlider slides={[]} storefront="teen-studio" />);
    const auraHtml = renderToStaticMarkup(<HeroSlider slides={[]} storefront="aura-studio" />);

    const forbidden = [
      "kurta",
      "waistcoat",
      "occasion wear",
      "tailored set",
      "coordinated set",
      "pret",
      "festive",
    ];
    for (const term of forbidden) {
      assert(!miniHtml.toLowerCase().includes(term), `Hero fallback must not include '${term}'`);
      assert(!teenHtml.toLowerCase().includes(term), `Hero fallback must not include '${term}'`);
      assert(!auraHtml.toLowerCase().includes(term), `Hero fallback must not include '${term}'`);
    }

    assert(miniHtml.includes("Playful styles for everyday moments and special days."), "Mini hero fallback must have approved copy");
    assert(teenHtml.includes("Fresh, expressive styles designed for growing personalities."), "Teen hero fallback must have approved copy");
    assert(auraHtml.includes("Modern silhouettes and versatile styles for every chapter."), "Aura hero fallback must have approved copy");
  });

  await runTest(
    "45. Product-specific merchandise content sourced from API data, not hardcoded shell content",
    () => {
      // Empty API response produces empty markup without hardcoded fake products or category placeholders
      const htmlEmpty = renderToStaticMarkup(
        <NewArrivalsSection storefront="mini-sprouts" products={[]} />
      );
      assert.strictEqual(htmlEmpty, "", "Empty API products must render empty markup");

      // Shell header navigation provides storefront routing without hardcoded merchandise categories
      const headerHtml = renderToStaticMarkup(<Header storefront="mini-sprouts" />);
      assert(headerHtml.includes('href="/mini-sprouts"'), "Header links to storefront root");
      assert(
        headerHtml.includes('href="/mini-sprouts/shop"'),
        "Header links to storefront catalog"
      );
      assert(
        headerHtml.includes('href="/mini-sprouts/new-arrivals"'),
        "Header links to storefront new arrivals"
      );

      const headerForbidden = ["kurtas", "waistcoats", "pret", "shirts", "suits", "festive"];
      for (const term of headerForbidden) {
        assert(
          !headerHtml.toLowerCase().includes(term),
          `Header navigation must not hardcode category '${term}'`
        );
      }
    }
  );

  await runTest(
    "46. customer-facing static copy across all shell/home components contains no unconfirmed categories",
    () => {
      const allCustomerSources = [
        gatewaySource,
        storefrontPageSource,
        editorialSource,
        heroSliderSource,
        whyKidsWearSource,
        reviewsSource,
        contactSource,
        footerSource,
        headerSource,
        mobileNavSource,
        shopByAgeSource,
        newArrivalsSource,
      ].join(" ");

      const forbidden = [
        "festive kurtas",
        "coordinated sets",
        "waistcoats",
        "tailored sets",
        "occasion wear",
        "festive pret",
        "kids wear pret",
      ];

      for (const term of forbidden) {
        assert(
          !allCustomerSources.toLowerCase().includes(term),
          `Component sources must not contain unconfirmed phrase '${term}'`
        );
      }
    }
  );

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Storefront Shell & Homepage Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
