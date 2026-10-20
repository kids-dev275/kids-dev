# Kids Wear — Work Unit 24: Accessibility & SEO Review Report

## Executive Summary

Work Unit 24 executed a comprehensive, pre-staging accessibility and technical search engine optimization (SEO) audit and remediation across the Kids Wear monorepo (`apps/web`, `apps/api`, `packages/shared`).

The objective was to align the customer storefront and operational Admin portal with modern web quality baselines—specifically **WCAG 2.2 AA orientation** and **standards-compliant technical SEO**—without adding runtime third-party dependencies, without altering database schemas, adhering to the V1 boolean variant availability model (Available / Unavailable without numeric inventory counting), and strictly preserving all Work Unit 22 security controls and Work Unit 23 performance optimizations.

Dedicated automated test suites were authored and integrated:

- `pnpm test:accessibility`: **20 automated structural & semantic accessibility tests** (100% passing).
- `pnpm test:accessibility:axe`: **7 automated route-level axe-core accessibility scans** (100% passing).
- **Total Accessibility Verifications**: **27 / 27 PASS**.
- `pnpm test:seo`: **18 automated crawl boundary, canonical, metadata & JSON-LD tests** (100% passing).

---

## Scope, Legal & Compliance Disclaimers

> [!IMPORTANT]
> **Strict Scope Exclusions & Truthful Reporting**:
>
> - **No Legal Compliance Claim**: This audit and remediation do not constitute legal advice, nor do they claim formal legal compliance under the Americans with Disabilities Act (ADA), the European Accessibility Act (EAA), or any national statutory accessibility standard.
> - **No WCAG Certification**: No formal third-party WCAG certification is claimed. Remediations are oriented toward WCAG 2.2 Level AA engineering best practices.
> - **No SEO Ranking Guarantee**: Technical SEO implementations ensure proper crawling, indexing boundaries, canonical declaration, and valid structured data representation. No search engine position, page rank, or organic traffic claims are made.
> - **Screen-Reader Session Disclaimer**: **No real screen-reader session was performed in WU24.** Assistive semantics, ARIA bindings, and keyboard focus behaviors were verified via automated DOM assertion suites, automated Axe-core engine scans, and keyboard navigation testing.
> - **No V1 Scope Expansion**: No analytics trackers, cookie consent banners, translation/i18n subsystems, marketing landing pages, or CMS integrations were introduced.

---

## 1. Accessibility Target & Review (WCAG 2.2 AA Alignment)

### 1.1 Semantic Landmarks & Document Structure

- **HTML Language Declaration**: Confirmed `<html lang="en">` in `apps/web/src/app/layout.tsx` with proper subset declarations for Google fonts (`Prata` and `Montserrat`).
- **Semantic Landmarks**: Every page structure was verified to supply standard landmark roles: `<header>`, `<nav>`, `<main id="main-content">`, and `<footer>`.
- **Admin Shell Landmarks**: `AdminShell` renders `<header className="lg:hidden">`, `<aside aria-label="Admin Sidebar">`, `<nav>`, and `<main id="main-content">`.
- **Policy Content Structure**: `PolicyContainer` wraps legal, fulfillment, and informational content within `<article>`, providing a single `<h1>` title block and sequential `<h2>` sections.
- **Heading Hierarchy**: Enforced single `<h1>` per route with strict hierarchical progression (`<h1>` $\to$ `<h2>` $\to$ `<h3>`). Removed skipped levels across storefronts, catalog, PDP, cart, checkout, account, and admin views.

### 1.2 Skip Navigation & Focus Management

- **Skip to Main Content Links**:
  - `StorefrontShell`: Visible on keyboard focus (`sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50`), directing users directly to `<main id="main-content">`.
  - `GatewayPage` (`apps/web/src/app/page.tsx`): Visible-on-focus skip link targeting `#main-content`.
  - `AdminShell` (`apps/web/src/components/admin/admin-shell.tsx`): Visible-on-focus skip link targeting `#main-content`.
- **Focus Rings & Visual Indicators**:
  - Interactive controls enforce explicit `:focus-visible` styling (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-1` or `ring-brand-primary`).
  - Buttons, links, inputs, and selectors maintain visible keyboard indicators.
- **Focus Trapping Primitives** (`apps/web/src/lib/use-focus-trap.ts`):
  - Created reusable `useFocusTrap` hook implementing full WCAG 2.2 AA focus containment:
    1. Traps focus within modal boundaries (wrapping from last element to first on `Tab`, and first to last on `Shift+Tab`).
    2. Dismisses on `Escape` key press.
    3. Restores focus back to the triggering element upon closure.
    4. Automatically applies background body scroll lock (`overflow: hidden`).
  - Integrated into:
    - `MobileNav` drawer (`apps/web/src/components/shell/mobile-nav.tsx`)
    - `SizeGuideModal` dialog (`apps/web/src/components/pdp/size-guide-modal.tsx`)
    - `AdminShell` mobile navigation drawer (`apps/web/src/components/admin/admin-shell.tsx`)

### 1.3 Form Accessibility & Error Association

- **Form Primitives** (`apps/web/src/components/ui/form/`):
  - `FormField` generates deterministic, linked accessibility IDs using React's `useId` hook.
  - `FieldLabel` renders with `htmlFor` explicitly bound to the control's `id`.
  - Required fields display a visual asterisk styled with `aria-hidden="true"` while retaining the `required` / `isRequired` attributes on the underlying inputs.
  - `Input` and `Textarea` components wire `aria-invalid="true"` when the field state is invalid, and assemble `aria-describedby` linking to both the error element (`[id]-error`) and any hint element (`[id]-hint`).
  - `FieldError` renders with `role="alert"` so assistive technology automatically announces validation failures upon form submission.
- **Feedback & Notification Primitives** (`apps/web/src/components/ui/feedback.tsx`):
  - `Alert` and `InlineError` declare `role="alert"` to ensure critical system feedback is announced immediately.

### 1.4 Product Purchase Configurator & Label-in-Name (WCAG 2.5.3)

- Size and Color option buttons in `ProductPurchaseConfigurator` display visible text labels ("0-3M", "Teal", etc.).
- Removed conflicting `aria-label` attributes to ensure the accessible name exactly matches the visible label, fully satisfying **WCAG 2.2 SC 2.5.3 (Label in Name)** for speech-input and screen-reader users.
- Radio groups wrapped in `<fieldset>` with `<legend>` for clear option context.

### 1.5 Color Contrast Audit & Mathematical Evidence (WCAG 1.4.3 & 1.4.11)

Calculations evaluated using standard relative luminance formula:
$$L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

- **Muted Text Remediation**:
  - Initial `--color-text-muted` value `#8E7B73` on white `#FFFFFF` produced a contrast ratio of $3.76:1$, failing the WCAG AA minimum threshold of $4.5:1$ for normal text.
  - **Remediation**: Darkened `--color-text-muted` to `#705d55` in `apps/web/src/app/globals.css`.
  - Relative luminance of `#705d55`:
    $$R_{sRGB} = 112/255 = 0.439 \implies R = ((0.439 + 0.055) / 1.055)^{2.4} \approx 0.160$$
    $$G_{sRGB} = 93/255 = 0.365 \implies G = ((0.365 + 0.055) / 1.055)^{2.4} \approx 0.106$$
    $$B_{sRGB} = 85/255 = 0.333 \implies B = ((0.333 + 0.055) / 1.055)^{2.4} \approx 0.088$$
    $$L_{\text{muted}} = 0.2126(0.160) + 0.7152(0.106) + 0.0722(0.088) \approx 0.116$$
  - Contrast on white background ($L = 1.0$):
    $$\frac{1.0 + 0.05}{0.116 + 0.05} = \frac{1.05}{0.166} \approx 6.33:1 \ge 4.5:1 \quad (\text{PASS})$$
  - Contrast on warm parchment background `#FAFAF8` ($L \approx 0.853$):
    $$\frac{0.853 + 0.05}{0.116 + 0.05} = \frac{0.903}{0.166} \approx 5.44:1 \ge 4.5:1 \quad (\text{PASS})$$
- **Footer Switch Link**:
  - Updated from muted text to `text-ink hover:text-accent-storefront`, yielding a contrast ratio of $13.09:1$ against `#F2EAE1` background.
- **Brand Accent Boundaries**:
  - Primary text uses high-contrast `#1C1917` ($15.34:1$ on white).
  - Mini Sprouts terracotta brand accent `#C7656C` achieves $3.81:1$ on white and $3.76:1$ on cream, comfortably exceeding the $3.0:1$ requirement for Large Text ($\ge 18\text{pt}$ / $24\text{px}$) and Graphical UI Components / Boundaries (**WCAG 1.4.11**). It is strictly reserved for large decorative titles and non-body accents to maintain brand identity without compromising readability.

### 1.6 Touch Target Sizing (WCAG 2.5.8)

- Interactive buttons and inputs enforce minimum dimensions of $44 \times 44\text{px}$ (`min-h-[44px] min-w-[44px]`) on mobile controls.
- Small inline utility icons (such as footer social icons) enforce minimum bounding boxes of $24 \times 24\text{px}$ with surrounding padding satisfying the WCAG 2.2 SC 2.5.8 Target Size Minimum.

---

## 2. Technical SEO Review & Remediation

### 2.1 Search Engine Crawl Boundaries (`robots.ts`)

Next.js App Router metadata route `apps/web/src/app/robots.ts` governs crawl operations:

- **Default Policy**: Allows public crawling of root `/` and public storefront routes.
- **Search Crawl Conflict Resolution**: Removed `Disallow: /*?*q=` from `robots.ts` so search crawlers can freely reach search pages and read page-level `<meta name="robots" content="noindex, follow">`.
- **Restricted Boundaries**: Explicitly disallows private, transactional, and administrative paths:
  - `/admin`, `/admin/` (Operations portal)
  - `/account`, `/account/` (Customer order history and profile)
  - `/cart` (Dynamic shopping bag)
  - `/checkout` (Checkout transaction workflow)
  - `/order-success` (Post-purchase confirmation)
  - `/design-system` (Internal UI component showcase)
- **Safe Sitemap Linkage**:
  - In production, dynamically appends `${siteUrl}/sitemap.xml` **only** if `NEXT_PUBLIC_SITE_URL` is configured. If unset in production, the sitemap directive is safely omitted to prevent leaking localhost URLs. In development, defaults to `http://localhost:3000/sitemap.xml`.

### 2.2 Dynamic XML Sitemap (`sitemap.xml`)

Next.js App Router metadata route `apps/web/src/app/sitemap.ts` generates a valid `MetadataRoute.Sitemap` XML document:

- **Production Safety Fallback**: If `NEXT_PUBLIC_SITE_URL` is unset in production, `sitemap.ts` returns an empty array `[]` rather than emitting invalid localhost URLs.
- **Static Canonical Public Routes**:
  - `/` (Priority: 1.0, ChangeFrequency: `daily`)
  - `/[storefront]` for Mini Sprouts, Teen Studio, Aura Studio (Priority: 0.9, ChangeFrequency: `daily`)
  - `/[storefront]/shop` for each storefront (Priority: 0.8, ChangeFrequency: `daily`)
  - `/[storefront]/new-arrivals` for each storefront (Priority: 0.8, ChangeFrequency: `daily`)
  - `/about`, `/contact` (Priority: 0.6, ChangeFrequency: `monthly`)
  - `/shipping-policy`, `/return-exchange-policy` (Priority: 0.5, ChangeFrequency: `monthly`)
  - `/privacy-policy`, `/terms` (Priority: 0.4, ChangeFrequency: `monthly`)
  - `/reviews` (Priority: 0.7, ChangeFrequency: `weekly`)
- **Published Product Detail Pages**:
  - Dynamically queries published products across all storefronts using the existing public API client `fetchStorefrontProducts(slug, { limit: 100 })`.
  - Excludes DRAFT and INACTIVE products (enforced at API level).
  - Gracefully handles offline or build-time backend unavailability without breaking static sitemap delivery.
- **Strict Exclusion**: Cart, checkout, order success, customer account, admin, and search endpoints are never included.

### 2.3 Metadata Architecture & Canonical URL Strategy

- **Factual Brand Metadata**:
  - Replaced marketing copy ("Timeless Apparel for Girls & Boys", "handcrafted luxury", "premium quality") with factual, neutral brand copy:
    - Root title: `Kids Wear`
    - Title template: `%s | Kids Wear`
    - Root description: `Kids Wear is an apparel e-commerce store with age-based storefronts for 0–10 Years, 11–16 Years, and 17+ Years.`
- **Canonical URLs (`alternates: { canonical: ... }`)**:
  - Gateway: `/`
  - Storefronts: `/${storefront}`
  - Shop All: `/${storefront}/shop`
  - New Arrivals: `/${storefront}/new-arrivals`
  - PDP: `/${storefront}/products/${slug}`
  - Policy & Informational Pages: `/about`, `/contact`, `/shipping-policy`, `/return-exchange-policy`, `/privacy-policy`, `/terms`, `/reviews`.
  - Search routes have **no canonical tag** with query strings, preserving clean indexation.

### 2.4 Private Route Protection (`robots: { index: false, follow: false }`)

Strict `robots: { index: false, follow: false }` metadata configurations were placed on:

- `apps/web/src/app/cart/page.tsx`
- `apps/web/src/app/checkout/page.tsx`
- `apps/web/src/app/order-success/page.tsx`
- `apps/web/src/app/account/layout.tsx` (protecting all customer account sub-pages)
- `apps/web/src/app/admin/layout.tsx` (protecting all administrative routes)
- `apps/web/src/app/design-system/page.tsx`
- `apps/web/src/app/[storefront]/search/page.tsx`: Configured with `robots: { index: false, follow: true }` so search engines discover products without indexing arbitrary search queries.

### 2.5 Structured Data (JSON-LD)

Schema.org structured technical data scripts (`type="application/ld+json"`) were implemented using confirmed V1 parameters:

- **Organization Representation** (Gateway):
  - Type: `Organization` (corrected from physical `ClothingStore`; removed arbitrary `priceRange` and walk-in store semantics).
  - Confirmed business properties: `name`, `url`, `logo`, `contactPoint` (`telephone`, `email`), `address` (Country: PK), `areaServed` ("Pakistan").
- **Storefront Representation** (Storefront Homepages):
  - Type: `CollectionPage`
  - PartOf: `WebSite` ("Kids Wear").
- **Product Detail Page Representation** (PDP):
  - Type: `Product`
  - Name: Product name
  - Description: Product short description / overview
  - Images: Product media URLs
  - Offers:
    - Type: `Offer`
    - Price: Regular price
    - PriceCurrency: `PKR`
    - Availability: Boolean-derived exact variant availability (`https://schema.org/InStock` or `https://schema.org/OutOfStock`) representing boolean purchasability without numeric inventory counting.
    - Preserved zero: unsupported `itemCondition`, numeric stock, invented brands, ratings, or unconfirmed warranty/return fields.

---

## 3. Automated Verification Matrix & Exact Test Accounting

### 3.1 Reconciled Suite Counts From Actual Test Runner Output

#### Frontend Application Suites (`apps/web`): Exactly 521 Runner Tests

1. `test/design-system.test.tsx`: **27**
2. `test/storefront-shell.test.tsx`: **46**
3. `test/storefront-catalog.test.tsx`: **64**
4. `test/cart.test.tsx`: **85**
5. `test/checkout.test.tsx`: **58**
6. `test/order-creation.test.tsx`: **25**
7. `test/account.test.tsx`: **66**
8. `test/reviews.test.tsx`: **48**
9. `test/admin-ui.test.tsx`: **51**
10. `test/content-pages.test.tsx`: **51**

- **Total Frontend Application Tests**: **521**

#### Backend Application Suites (`apps/api`): Exactly 733 Runner Tests

1. `test/admin-auth.test.ts`: **20**
2. `test/admin-dashboard.test.ts`: **10**
3. `test/admin-orders.test.ts`: **84**
4. `test/cart-validation.test.ts`: **17**
5. `test/checkout-validation.test.ts`: **58**
6. `test/customer-auth.test.ts`: **37**
7. `test/customer-orders.test.ts`: **40**
8. `test/order-creation.test.ts`: **90**
9. `test/product-core.test.ts`: **49**
10. `test/product-media.test.ts`: **63**
11. `test/product-options-variants.test.ts`: **57**
12. `test/product-publication-catalog.test.ts`: **74**
13. `test/public-size-guide.test.ts`: **8**
14. `test/reviews.test.ts`: **77**
15. `test/storefront-settings.test.ts`: **49**

- **Total Backend Application Tests**: **733**

#### Baseline Application Total: $521 + 733 = \mathbf{1,254}$ Tests

---

### 3.2 Authoritative Verification Accounting Table

| Suite / Check                            | Command / Runner              |             Count | Status | Scope / Verification Invariant                             |
| :--------------------------------------- | :---------------------------- | ----------------: | :----: | :--------------------------------------------------------- |
| **Frontend Application Suites (10)**     | `pnpm --filter web test:*`    |               521 | `PASS` | Components, routes, forms, state stores, views             |
| **Backend Application Suites (15)**      | `pnpm --filter api test:*`    |               733 | `PASS` | Endpoints, validation, business rules, models              |
| **Application Baseline Subtotal**        | —                             |             1,254 | `PASS` | Full core application functionality                        |
| **Security Suite (WU22)**                | `pnpm test:security`          |                59 | `PASS` | CSP, CSRF, CORS, session hashing, rate limit isolation     |
| **Performance Suite (WU23)**             | `pnpm test:performance`       |                19 | `PASS` | CLS budgets, image optimization, query bounds              |
| **Accessibility Structural/DOM (WU24)**  | `pnpm test:accessibility`     |                20 | `PASS` | Landmarks, skip links, forms, dialogs, contrast, focus     |
| **Accessibility Route-Level Axe (WU24)** | `pnpm test:accessibility:axe` |                 7 | `PASS` | Axe-core engine scans across 7 representative pages        |
| **Accessibility Suite Total**            | `pnpm test:accessibility*`    |            **27** | `PASS` | Structural DOM assertions (20) + Route-level Axe scans (7) |
| **Technical SEO Suite (WU24)**           | `pnpm test:seo`               |                18 | `PASS` | Robots, sitemap, canonicals, noindex, JSON-LD              |
| **Database Smoke Verification**          | `pnpm db:smoke`               |                20 | `PASS` | Isolated PostgreSQL 17 relational connectivity & checks    |
| **Browser E2E Tests**                    | `pnpm test:e2e`               |                27 | `PASS` | Real Chromium end-to-end integration flows                 |
| **Total Automated Verifications**        | —                             | **1,424 / 1,424** | `PASS` | **Zero regressions across entire application battery**     |

---

### 3.3 Route-Level Axe Audit Results (`playwright.axe.config.ts`)

Executed automated axe-core scans across 7 key system surfaces:

1. `Root Gateway (/)`: **PASS** (0 violations)
2. `Storefront Home (/mini-sprouts)`: **PASS** (0 violations)
3. `Representative PDP (/mini-sprouts/products/e2e-classic-kurta)`: **PASS** (0 violations)
4. `Cart View (/cart)`: **PASS** (0 violations)
5. `Checkout Workflow (/checkout)`: **PASS** (0 violations)
6. `Customer Login (/account/login)`: **PASS** (0 violations)
7. `Admin Login (/admin/login)`: **PASS** (0 violations)

---

## 4. Residual Limitations & Staging Follow-Ups

1. **Production Domain Setting**:
   - In production and staging deployments, set `NEXT_PUBLIC_SITE_URL="https://staging.example.com"` (or authoritative staging origin) in `.env.production` so canonical tags and sitemaps resolve with the public domain.
2. **Screen Reader Live Testing**:
   - As stated in the disclaimer, no real human screen-reader session was conducted in WU24. Performing interactive auditory walkthroughs with NVDA or VoiceOver on staging is recommended.
3. **Hero Image Contrast**:
   - Admin-managed storefront hero banner images should have sufficient contrast or rely on the built-in dark overlay to guarantee text legibility.
