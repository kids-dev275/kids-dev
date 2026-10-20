# Kids Wear — System Architecture

## Architecture Flow

```text
Browser / Client
       │
       ▼
Next.js Web (apps/web)
       │
       ▼ [HTTPS REST /api/v1]
Fastify API (apps/api)
       │
       ▼ [Prisma ORM]
PostgreSQL Database (Supabase)
```

## Supporting Services

- **Cloudinary**: Product imagery and media asset storage/CDN.
- **Resend**: Transactional notifications and Admin email alerts.
- **Vercel**: Deployment platform for Next.js frontend (`apps/web`).
- **Belmo**: Deployment platform for Fastify backend (`apps/api`).

## System Authorities & Invariants

- **PostgreSQL / Supabase** is the sole source of truth for all persistent state.
- **Backend (`apps/api`)** strictly enforces all business rules, prices, discounts, delivery calculations, and availability.
- **Frontend (`apps/web`)** is never authoritative for prices, stock status, or calculations. All user inputs are re-validated on the backend.
- **Database Access**: Pooled connection (`DATABASE_URL`) is utilized for runtime API queries; direct connection (`DIRECT_URL`) is reserved for migration workflows.
- **Relational Invariants**: `ProductVariant` size and color ownership is strictly enforced at the database level using composite foreign keys `(productId, productSizeId)` and `(productId, productColorId)`. Media assignment exclusivity is enforced via partial unique indexes. Business bounds (ratings, quantities, positive financials) are enforced via PostgreSQL `CHECK` constraints.

## Admin Authentication & Session Security

- **Single Admin Model**: Strictly one Admin account in V1 (`sk.fabrica@gmail.com`), provisioned via secure operations CLI (`pnpm admin:provision`). No public signup or registration routes exist.
- **Password Security**: Passwords are hashed and verified server-side using Argon2id (`@node-rs/argon2`). Timing-safe dummy Argon2id verification is executed on unknown accounts to mitigate credential enumeration attacks.
- **Session Tokens**: 256-bit cryptographically secure random bearer tokens generated via `crypto.randomBytes(32)`. Only the SHA-256 hash (`tokenHash`) is stored in PostgreSQL (`AdminSession`); raw tokens are never persisted in the database.
- **Cookie Security**: Session token is delivered in a dedicated `kw_admin_session` cookie configured as `HttpOnly`, `Path=/`, `SameSite=Lax` (or `None` with `Secure`), and `Secure` in production.
- **Brute-Force Protection**: Dedicated in-process Fastify rate limiting on `POST /api/v1/admin/auth/login` (5 attempts per 15 minutes per IP).

## Customer Authentication & Profile Architecture

- **Optional Customer Accounts**: Customer registration is optional. Guest checkout remains supported and does not require account creation.
- **Separate Cookies and Sessions**: Customer sessions use a dedicated `kw_customer_session` cookie (`HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production) completely isolated from `kw_admin_session`. Sessions persist for 30 days (720 hours) and store SHA-256 token hashes in `CustomerSession`.
- **Domain-Separated CSRF**: Customer CSRF tokens are derived using HMAC-SHA256 with the domain prefix `customer-csrf:`, ensuring complete cryptographic separation from Admin CSRF tokens (`admin-csrf:`).
- **Authentication Guard**: Reusable `requireCustomer` guard verifies active customer sessions and attaches safe customer context (`id`, `fullName`, `email`, `phone`). Inactive accounts (`isActive = false`) cannot authenticate.
- **Profile Updates**: `PATCH /api/v1/account/profile` requires `requireCustomer` and `requireCustomerCsrf`. Allows updating `fullName`, `email`, and `phone` only, with strict validation preventing over-posting and collision detection enforcing unique emails.
- **Rate Limiting**: Dedicated rate limits on `POST /api/v1/auth/register` (5 attempts / 15m / IP) and `POST /api/v1/auth/login` (5 attempts / 15m / IP).

## Storefronts & Commerce Settings Architecture

- **Fixed Storefront Identities**: V1 supports exactly three fixed Storefront entities: Mini Sprouts (`mini-sprouts`, 0–10 Years), Teen Studio (`teen-studio`, 11–16 Years), and Aura Studio (`aura-studio`, 17+ Years). There is no Admin capability to create, delete, or re-slug storefronts. Public storefront listings are returned in fixed deterministic display order.
- **Hero Slide Ownership & Media Validation**: Hero slides are strictly owned by their parent Storefront (`storefrontId`). All mutation and reorder operations reject cross-storefront associations. Hero slides reference `MediaAsset` records that must exist and have `mediaType = IMAGE` (video assets are rejected). Deleting a hero slide leaves the underlying media asset intact.
- **Public Settings Exposure Boundary**: `GET /api/v1/public/settings` exposes strictly public, pre-checkout storefront configuration: announcement bar state (`text`, `link`, `isActive`) and flat delivery charge (`flatDeliveryCharge`). It strictly omits Admin notification emails/toggles, bank transfer credentials, singleton keys, database IDs, and timestamps.
- **Admin Settings Management**: Admin settings endpoints (`announcement`, `shipping`, `bank-transfer`, `notifications`) require `requireAdmin` for reads and session-bound `requireAdminCsrf` for writes. Strict Zod schemas reject unapproved fields (e.g., free-shipping thresholds, delivery timeframes, or singleton keys) to prevent over-posting.
- **Money Serialization Convention**: All financial amounts (e.g. `flatDeliveryCharge`) are serialized as fixed 2-decimal-place strings (e.g. `"300.00"`) across both public and Admin endpoints to eliminate JavaScript floating-point conversion issues and set the standard for upcoming product and order pricing APIs.

## Product Core Architecture

- **Product Core Ownership & Storefront Scoping**: Every product strictly belongs to exactly one fixed Storefront (`storefrontId`). Slugs are unique per storefront (`@@unique([storefrontId, slug])`), permitting the same slug across different storefronts while preventing slug collision within the same storefront.
- **Global SKU Uniqueness**: Product SKUs are trimmed, converted to uppercase, and strictly enforced as globally unique across the entire database (`@unique`).
- **Product Lifecycle & Publication Deferral**: Work Unit 6 products are strictly created with `status = DRAFT`. Dedicated lifecycle transitions support only `DRAFT <-> INACTIVE`. Attempts to transition or create products as `PUBLISHED` are rejected with HTTP 400 (`PRODUCT_PUBLICATION_NOT_AVAILABLE`). True publication is deferred until variants, inventory availability, and media are linked in subsequent work units.
- **Hard-Deletion Limitations & Historical Preservation**: Hard delete (`DELETE /api/v1/admin/products/:productId`) is strictly permitted only for unused `DRAFT` products with zero order or review references. Inactive or published products and products with historical references return HTTP 409 (`PRODUCT_DELETE_FORBIDDEN`) to protect order integrity.
- **Fixed Money Serialization**: Prices (`regularPrice`, `compareAtPrice`) are stored as PostgreSQL Decimals and returned in API responses as fixed 2-decimal-place strings (e.g., `"2499.00"`), avoiding binary floating-point precision loss.

## Product Options & Variants Architecture

- **Product-Specific Ownership**: Sizes (`ProductSize`) and Colors (`ProductColor`) are strictly scoped and owned by their parent `Product` (`productId`). There is no global size or color dictionary in V1. Database-level composite foreign keys `(productId, productSizeId)` and `(productId, productColorId)` guarantee that a variant cannot combine options from different products.
- **Exact Size + Color Combinations**: Each `ProductVariant` represents a unique pairing of a product-specific size and a product-specific color, enforced by composite database uniqueness `@@unique([productId, productSizeId, productColorId])`.
- **Boolean Availability Only**: Variant availability is managed strictly via boolean flags (`isAvailable = true/false`). There are no numeric stock counts, quantities, low-stock thresholds, or variant-specific SKUs.
- **No Variant Deletion**: Variants once created cannot be hard-deleted via API (`DELETE /variants/:variantId` does not exist). Variants that are no longer offered are toggled to `isAvailable = false`.
- **Option Deactivation Invariant**: When a `ProductSize` or `ProductColor` is deactivated (`isActive = false`), all referencing variants are atomically set to `isAvailable = false` inside an interactive database transaction (`prisma.$transaction`). Re-activating an option (`isActive = true`) does not automatically re-activate variants; variants must be explicitly and intentionally made available.
- **Variant Activation Invariant**: A variant may be set to `isAvailable = true` only if both its parent size and color are active (`ProductSize.isActive === true` and `ProductColor.isActive === true`). Attempting to activate a variant with inactive options is rejected with HTTP 400 (`VARIANT_PARENT_OPTION_INACTIVE`).
- **Option Hard Deletion Guard**: Hard deleting a size or color (`DELETE /api/v1/admin/products/:productId/sizes/:sizeId` or `colors/:colorId`) is strictly allowed only when the parent product is in `DRAFT` status and zero variants reference the option. Otherwise, deletion is blocked with HTTP 409 (`PRODUCT_SIZE_DELETE_FORBIDDEN` / `PRODUCT_COLOR_DELETE_FORBIDDEN`).
- **Bulk Atomic Creation**: Bulk variant creation (`POST /api/v1/admin/products/:productId/variants/bulk`) operates atomically: all combinations must be valid, active, owned by the product, non-duplicate in payload, and non-conflicting with existing records, or the entire operation fails.
- **Display Names Only for Product Colors**: Product colors are manually entered display names only (e.g., Red, White, Beige, Burgundy, Assorted). V1 strictly excludes machine-renderable color codes, hexadecimal values (`hexCode`), RGB values, color swatches, swatch images, and color families. `Assorted` is fully supported as a valid display name without color representation.

## Product Media & Cloudinary Architecture

- **Cloudinary Infrastructure Boundary**: Cloudinary serves as authoritative remote object storage. Server-side operations are encapsulated in `apps/api/src/lib/cloudinary.ts` using the official Node.js SDK (`cloudinary`). Real API secrets are strictly kept on the server, never exposed in client payloads, and redacted in system logs.
- **Signed Direct-Upload Architecture**: To protect server bandwidth and bypass streaming bottlenecks, the API issues short-lived, product-scoped signed upload signatures (`POST /api/v1/admin/products/:productId/media/upload-signature`). Public IDs and upload folders are server-controlled (`kids-wear/products/<productId>/<fileId>`); client attempts to supply arbitrary folders or IDs are rejected.
- **Server-Side Authoritative Asset Verification**: After direct upload, the client registers the asset (`POST /api/v1/admin/products/:productId/media`). The backend verifies the asset directly with Cloudinary before persisting records: ensuring asset existence, resource type parity (`image` vs `video`), strict product namespace matching, and exact source dimensions (1200×1500 for images, 1080×1350 for videos).
- **MediaAsset vs ProductMedia Responsibility**: `MediaAsset` represents global storage metadata (secure URL, provider public ID, bytes, format, dimensions), allowing future re-use across hero slides or reviews without duplication. `ProductMedia` manages product-specific presentation state (`sortOrder`, `altText`, `isMain`, `isHover`).
- **Product Media Limits & Concurrency Safety**: Each Product allows at most 8 images and at most 1 video. Limit checks are concurrency-safe using PostgreSQL row-level locking (`SELECT ... FOR UPDATE` on the parent `Product`) within interactive transactions, ensuring concurrent uploads cannot bypass limits.
- **Main & Hover Role Independence & Exclusivity**: Each product allows at most one Main image and at most one Hover image, enforced by database partial unique indexes (`product_media_main_unique` and `product_media_hover_unique`). Main and Hover roles are independent: a single image may hold both roles simultaneously. Presentation roles are never assigned implicitly upon registration (defaulting to `isMain = false`, `isHover = false`); Admin must explicitly designate them. Video assets are strictly rejected from Main or Hover roles. Setting a new Main or Hover atomically clears the prior designation for that specific role across the product. Hover designation can be explicitly cleared without deleting media (`DELETE /api/v1/admin/products/:productId/media/hover`).
- **Main Deletion Protection**: A media record designated as Main cannot be directly deleted (`PRODUCT_MAIN_MEDIA_DELETE_FORBIDDEN`). The Admin must first designate another image as Main, preventing accidental destruction of the primary product visual.
- **Safe Media Deletion**: Deleting a product media record deletes only the `ProductMedia` association row, safely leaving the underlying `MediaAsset` intact in PostgreSQL to protect against cross-module data loss.
- **Publication Prerequisite Relationship**: Attaching product media does not automatically publish products; products remain in `DRAFT` or `INACTIVE` status throughout Work Unit 8. True publication in Work Unit 9 validates that exactly one Main Image exists, 1-8 images exist, and 0-1 video exists.
- **Automated Testing & Cloudinary Boundary**: Real Fastify routing, Admin authentication/CSRF, Zod validation, and PostgreSQL database queries/locks are verified in automated test suites. The Cloudinary SDK integration is abstracted behind `ICloudinaryService`, allowing local integration tests to run hermetically with an injected test double (`MockCloudinaryService`). No live Cloudinary network upload or Admin API lookup was executed because real Cloudinary credentials were intentionally not configured for local automated tests.

## Product Publication Gate, Public Catalog & Search Architecture

- **Publication Gate & Status Transitions**: Product publication is controlled exclusively via `PATCH /api/v1/admin/products/:productId/status` and validated by `validateProductForPublication`. Allowed transitions are `DRAFT -> PUBLISHED`, `INACTIVE -> PUBLISHED`, `PUBLISHED -> INACTIVE`, and `DRAFT <-> INACTIVE`. Attempts to demote a published product back to draft (`PUBLISHED -> DRAFT`) are strictly rejected with HTTP 400 (`PRODUCT_INVALID_STATUS_TRANSITION`).
- **Atomic Publication Invariants**: Transitioning to `PUBLISHED` requires that the product satisfies all publication prerequisites concurrently:
  1. Required core fields are present and non-empty: `name`, `slug`, `sku`, `storefrontId`, `description`, and `regularPrice > 0`. Optional merchandising and content fields (`shortDescription`, `productType`, `gender`, `fabric`, `includedPieces`, `fit`, `patternDesign`, `occasion`, `season`, `careInstructions`, `seoTitle`, `seoDescription`) are not mandatory for publication.
  2. Compare-at price: `compareAtPrice` is optional (`null` or `> 0`). There is no relational constraint requiring `compareAtPrice > regularPrice`.
  3. Media satisfies publication constraints: exactly 1 image designated as Main (`isMain = true`), between 1 and 8 total images, and 0 or 1 video.
  4. Variant availability: at least one variant is available (`isAvailable = true`) whose parent `ProductSize` and `ProductColor` are both active (`isActive = true`).
     Publication validation operates within an interactive transaction with row-level locking (`SELECT ... FOR UPDATE`), preventing concurrent modification races.
- **Dynamic Defensive Visibility Predicate**: Across all public catalog routes (`GET /storefronts/:storefrontSlug/products`, `GET /storefronts/:storefrontSlug/products/:productSlug`, and `GET /storefronts/:storefrontSlug/search`), public visibility requires:
  - `status = PUBLISHED`
  - At least 1 variant where `isAvailable = true`, `size.isActive = true`, and `color.isActive = true`
  - At least 1 product media with `isMain = true` and `mediaAsset.mediaType = IMAGE`
    If an operational change causes a published product to lose all available variants or its main image, the defensive predicate dynamically suppresses the product from public listings, PDP, and search without mutating the database `status` column. When conditions become valid again, public visibility is restored automatically.
- **Storefront-Scoped Public Catalog**: All catalog routes are strictly scoped to a valid `:storefrontSlug`. Global un-scoped endpoints (e.g. `/api/v1/products` or `/api/v1/search`) do not exist. Public listing supports deterministic ordering (`createdAt DESC, id DESC`), pagination (`page`, `limit`), and `?new=true` filtering. When `?new=true` is supplied, an authoritative filter `isNewArrival = true` is added to the query; it does not merely alter sorting. When omitted, all publicly visible products are returned. Response payloads contain presentation-safe product cards with `mainImage`, optional `hoverImage`, and 2-decimal money strings.
- **Public Product Detail (PDP) Presentation**: Public PDP returns complete product details while strictly omitting internal operational identifiers such as `sku`. Responses include active sizes (ordered by `sortOrder ASC`), active colors (display names only; no swatches or hex/rgb), variants referencing active options (with boolean `isAvailable`), and presentation-safe media items sorted by `sortOrder ASC`. Products that are drafts, inactive, cross-storefront, or defensively suppressed return HTTP 404 (`PRODUCT_NOT_FOUND`).
- **Storefront Search**: Search executes case-insensitive matching across `name`, `shortDescription`, and `productType`, filtered by the defensive visibility predicate and storefront scope. Empty or whitespace-only search queries are rejected with HTTP 400 (`VALIDATION_ERROR`). Queries with no matching products return a clean 200 OK with an empty array.
- **Zero Excluded V1 Scope**: The public catalog endpoints require no customer authentication, expose no numeric inventory or stock counts, include no swatch or color hex/rgb data, and execute no emails or external notifications during publication.

## Frontend Design System Foundation

- **Design Philosophy**: Premium Editorial Fashion Commerce / Modern Bento aesthetic, balancing warm editorial elegance with crisp modern structure, restrained borders, and clear hierarchy.
- **Master Visual System Tokens**: Built on a warm, organic neutral palette:
  - Canvas: `#FBF7F2` (soft warm background)
  - Surface: `#FFFDFC` (primary elevated card/surface background)
  - Soft: `#F6EFE8` (secondary subtle background)
  - Ink: `#3F2B24` (primary rich deep brown headings and high-contrast text)
  - Text: `#5F4A42` (primary body text)
  - Muted: `#8E7B73` (secondary metadata and muted labels)
  - Border: `#E7DDD5` (warm subtle container borders)
  - Champagne: `#C6A56A` (refined brand accent)
  - White: `#FFFFFF` (pure white accents)
- **Storefront Theme Scoping**: Each of the three fixed storefronts features a dedicated editorial accent color:
  - Mini Sprouts (`mini-sprouts`): `#C7656C` (Rose/Blush)
  - Teen Studio (`teen-studio`): `#875985` (Plum/Berry)
  - Aura Studio (`aura-studio`): `#8B6B50` (Warm Terracotta/Earthy Tan)
    Scoping is implemented cleanly via CSS custom property overrides (`--color-accent-storefront`, `--color-accent-storefront-soft`) attached to `[data-storefront="..."]` attributes, managed seamlessly by the `StorefrontScope` container and `useStorefront` context hook without requiring duplicate Tailwind classes.
- **Typography Scale**: Dual-font typography hierarchy configured via `next/font/google`:
  - Editorial Headings (`font-editorial`): `Prata` serif font applied to Display, H1, H2, H3, and H4 headings.
  - Interface & Body (`font-sans`): `Montserrat` sans-serif font applied to body copy, form labels, buttons, navigation, and captions.
- **Layout & Structure Primitives**:
  - `PageContainer`: Maximum width restricted to 1320px (`max-w-container`) with responsive horizontal padding (`px-4 sm:px-6 lg:px-8`) and centered alignment.
  - `Section` & `SectionHeader`: Structured content blocks supporting kicker, headline, descriptive subtitle, and trailing action slots.
  - `Stack` & `Cluster`: Composable layout primitives for vertical column flows and horizontal wrapping badge/button groups.
- **Form Controls & ARIA Accessibility**:
  - Fully accessible `FormField` context providing unified `id`, label association (`htmlFor`), accessible description (`aria-describedby`), and live region errors (`role="alert"`).
  - Primitives include `Input`, `Textarea`, `Select`, `Checkbox`, and `Radio`, featuring high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2`).
- **Commerce Primitives**:
  - `Price`: Strict Pakistani Rupee (`PKR`) currency formatting (`Rs. 2,499`) with optional compare-at strikethrough styling and accessible `aria-label` screen-reader narration (`Regular price: ...`, `Original price: ...`).
  - `Badge`: Semantic status pills for New Arrivals, Unavailable, Draft, Published, Inactive, and Order statuses.
  - `MediaImage`: Aspect-ratio-locked Next.js image container enforcing the 4:5 fashion ratio with layout stability (CLS prevention).
  - `ProductCard`: Responsive presentational card supporting 4:5 product imagery, safe mobile main image fallback, desktop hover image swap, New badge, and strictly zero excluded features (no wishlist, no quick add, no star ratings, no cart integration).
- **Feedback & System States**:
  - `Alert`, `InlineError`, `SuccessMessage`, and `LoadingSpinner`.
  - Accessible `Skeleton` primitives respecting the user's `@media (prefers-reduced-motion: reduce)` settings.
  - Dedicated contextual system states: `LoadingState`, `ErrorState`, `EmptyState`, `NoResultsState`, `EmptyCartState`, and `OutOfStockState`.
- **Internal Showcase Route**: Available at `/design-system` for interactive verification of color swatches, typography scales, storefront theme switching, buttons, forms, product cards, and state screens.
- **Automated Verification**: Comprehensive 25-case component test suite in `apps/web/test/design-system.test.tsx` verifying typography tokens, theme accent switches, button accessibility, form ARIA linkage, 4:5 image ratio rendering, hover swap logic, PKR formatting, reduced motion rules, responsive breakpoint usability, and strict V1 feature exclusion.

## Gateway, Shared Storefront Shell & Storefront Homepages Architecture

- **Root Three-Storefront Gateway (`/`)**: Serves as the master customer portal directing traffic into one of the three curated age-specific universes: Mini Sprouts (0–10 Years, `#C7656C`), Teen Studio (11–16 Years, `#875985`), and Aura Studio (17+ Years, `#8B6B50`). Implemented in `apps/web/src/app/page.tsx` with a 3-column desktop Bento grid and responsive stacked mobile layout with touch-friendly 44px hit targets.
- **Global Announcement Bar**: Dynamically consumes pre-checkout public configuration from `GET /api/v1/public/settings` via `fetchPublicSettings()`. Renders solely when `isActive === true` and announcement text is non-empty. Never displays bank transfer credentials or internal operational state. Features an accessible `<aside aria-label="Announcement">` landmark with responsive dismiss/display semantics.
- **Shared Header & Scoped Navigation**: Unifies the customer browsing experience across storefronts:
  - Master brand identity ("Kids Wear") linking directly to the root Gateway (`/`).
  - Active storefront indicator displaying current brand label and age badge.
  - Storefront Switcher component providing immediate cross-shopping between Mini Sprouts, Teen Studio, and Aura Studio without returning to the root.
  - Strictly storefront-scoped primary navigation links: Home (`/${storefront}`), Shop (`/${storefront}/shop`), New Arrivals (`/${storefront}/new-arrivals`), Reviews (`/${storefront}/reviews`), and Contact (`/${storefront}/contact`). Global un-scoped `/shop` routes do not exist.
  - Header utility actions: Search (`/${storefront}/search`), Account (`/account/login`), and Cart placeholder icon (`/cart`). Strictly no Wishlist icon or counter.
  - Accessible mobile drawer (`MobileNav`) with hamburger toggle button, `aria-expanded` / `aria-controls` bindings, automatic body scroll lock, Escape key dismissal, backdrop tap dismissal, and automatic closure upon navigation.
- **Shared Storefront Shell & Theme Token Injection**: Master layout wrapper (`StorefrontShell`) integrates `StorefrontScope` from Work Unit 10 to dynamically inject CSS custom property theme tokens (`--color-accent-storefront`, `--color-accent-storefront-soft`) based on the active storefront slug. Encapsulates Announcement Bar, Header, Main content landmark (`<main id="main-content">`), and Unified Footer with an accessible "Skip to content" keyboard navigation bypass.
- **Shared Footer**: Centralizes customer trust pillars, catalog links to all three storefronts, policy routes (`/policies/shipping`, `/policies/returns`, `/policies/privacy`, `/policies/terms`), exact approved studio contact coordinates (`+92 335 0981 321`, `info@thekidswear.com`, `Street-05, Darul Islam Colony, Attock, Pakistan`), and official social channel links (Facebook, Instagram, Pinterest, TikTok, Threads).
- **Storefront Homepage Dynamic Request-Time Rendering (`apps/web/src/app/[storefront]/page.tsx`)**:
  - Validates dynamic `[storefront]` parameter via `isValidStorefrontSlug()`, immediately delegating unknown slugs to Next.js `notFound()`.
  - Configures explicit request-time dynamic rendering (`export const dynamic = "force-dynamic"`) and `{ cache: "no-store" }` on backend fetches. Ensures all Admin-managed state (announcements, hero slides, product new arrivals, and flat delivery charge) updates immediately on customer visits without rebuilding or redeploying the frontend.
  - Dynamic SEO metadata generation via `generateMetadata()`.
  - Resilient parallel server-side data fetching via `Promise.all`: retrieves public settings, storefront details with published hero slides (`GET /api/v1/storefronts/:slug`), and authoritative new arrival products (`GET /api/v1/storefronts/:slug/products?new=true&limit=4`).
  - Production error behavior: missing or invalid backend URL configuration in production is treated as a persistent defect and logs observable server diagnostics while triggering Next.js error boundary (`error.tsx`), presenting customers with a clean `Storefront Unavailable` card without exposing stack traces. Transient single-section outages degrade gracefully.
- **Homepage Curated Sections**:
  - `HeroSlider`: Full-width banner carousel supporting 1920×800 desktop imagery and 1080×1350 mobile portrait imagery via responsive `<picture>` markup. Features keyboard arrow navigation (`ArrowLeft` / `ArrowRight`), touch swipe support, ARIA status announcements, and an elegant neutral fallback card when no hero slides are configured. Zero promotional campaigns, discount percentages, or fake sales claims.
  - `ShopByAge`: Visual cross-discovery section guiding customers across sister storefront collections.
  - `NewArrivalsSection`: Real-time showcase displaying up to 4 new arrival products using Work Unit 10's presentational `ProductCard`. Strictly no fake/mock products; displays an editorial empty state when no products are currently marked as new arrivals.
  - `EditorialBrandSection`: Bento-inspired storytelling module presenting Kids Wear apparel, delivered within 10 days. Strictly excludes coupon codes, discount engines, and unapproved craftsmanship claims.
  - `WhyKidsWear`: Approved trust pillars highlighting Pakistan-wide delivery within 10 days, dynamic flat delivery charge derived live from `publicSettings.shipping.flatDeliveryCharge` via `formatPKR()`, Cash on Delivery, and exact-variant boolean availability. Strictly prohibits hardcoded shipping numbers, false claims of free shipping, fake awards, or unapproved craftsmanship certifications.
  - `ReviewsPreview`: Honest editorial placeholder boundary reserving PDP/customer review presentation for Work Unit 18. Strictly no fabricated 5-star ratings or fake customer names.
  - `ContactSection`: Customer care section providing direct phone, WhatsApp, email, physical studio address in Attock, and social media links.
- **State Boundaries & Verification**:
  - Dynamic loading skeleton (`loading.tsx`) and client error boundary (`error.tsx`) integrating Work Unit 10 `ErrorState` with retry action.
  - Branded 404 page (`not-found.tsx`) with clear navigation back to the root Gateway or individual storefronts.
  - Comprehensive automated test suite in `apps/web/test/storefront-shell.test.tsx` (46 test cases) validating root gateway rendering, dynamic slug routing, 404 rejection of invalid slugs, announcement bar filtering, storefront-scoped navigation links, mobile drawer accessibility, hero slider responsive layout and fallbacks, honest review boundaries, request-time dynamic rendering (`force-dynamic`), dynamic shipping calculation (e.g. Rs. 425), absence of hardcoded Rs. 300 defaults, absence of unapproved marketing claims, storefront-scoped PDP placement, and strict V1 feature exclusion.

## Storefront Shop, New Arrivals, Search & Product Detail Experience Architecture

- **Storefront Shop Page (`/[storefront]/shop`)**:
  - Full catalog browsing route scoped strictly to the active storefront. Unknown storefront slugs immediately invoke Next.js `notFound()`.
  - Request-time dynamic rendering (`export const dynamic = "force-dynamic"`) with `{ cache: "no-store" }` data fetching, guaranteeing instant reflection of product publishing, pricing updates, and catalog changes without redeploying.
  - Server-side query parameter pagination (`?page=1`) utilizing `Pagination` component. Preserves storefront URL paths and renders accessible `<nav aria-label="Pagination Navigation">` with previous, next, and indexed page controls.
  - Displays semantic breadcrumbs (`Storefront -> Shop`), `CatalogHeader` with dynamic product counts, and responsive `CatalogGrid` (2 columns on mobile, 3 columns on tablet, 4 columns on desktop).
  - Resilient empty states (`EmptyState`) and error boundaries (`ErrorState`) when catalog is empty or backend services encounter transient issues.
- **Storefront New Arrivals Page (`/[storefront]/new-arrivals`)**:
  - Dedicated new arrivals catalog browsing route querying `GET /api/v1/storefronts/:slug/products?new=true&page=...`.
  - Leverages shared `CatalogHeader` with contextual theme badge and `CatalogGrid` with Work Unit 10 `ProductCard`.
  - Renders an honest, elegant empty state ("No New Arrivals At This Time") when no products are currently marked with `isNewArrival: true`, avoiding synthetic filler items.
- **Storefront Search Experience (`/[storefront]/search?q=&page=`)**:
  - Storefront-scoped product search querying `GET /api/v1/storefronts/:slug/search?q=...&page=...&limit=...`.
  - Accessible `SearchBar` component with `<form role="search">`, semantic `<input type="search">`, and direct keyboard submission.
  - Guards gracefully against empty or whitespace query strings, rendering a helpful prompt state instead of executing empty API requests.
  - Server-side API search pagination: passes `q`, `page`, and `limit` to the backend search API utility without client-side pagination slicing or query drops.
  - Uses the `Pagination` primitive with `basePath={`/${storefront}/search`}` and `searchParams={{ q: query }}`, rendering accessible previous/next and indexed controls (e.g. `/${storefront}/search?q=shirt&page=2`) while preserving active query and storefront routes.
  - Renders `NoResultsState` for queries yielding 0 matches, with a clear query echo and reset button.
  - Renders `ErrorState` with retry capability on transient search API failures.
- **Product Detail Page (PDP) Architecture (`/[storefront]/products/[slug]`)**:
  - 2-column editorial bento layout: left/top column hosts `ProductMediaGallery`; right/bottom column hosts breadcrumbs, product title, `Price` primitive (regular price and strikethrough compare-at price in PKR), shipping trust pill, `ProductPurchaseConfigurator`, and grouped `ProductMetadataSections`.
  - Defensive visibility enforcement: server-side query invokes `GET /api/v1/storefronts/:slug/products/:productSlug`. Products that are drafts, inactive, nonexistent, or belonging to a different storefront trigger Next.js `notFound()`, preventing unauthorized access.
  - Dynamic SEO metadata generation via `generateMetadata()`: dynamically extracts product title, description, and primary image for OpenGraph and Twitter cards with fallback to storefront defaults.
  - Dynamic Shipping Trust Callout: retrieves flat delivery charge dynamically from `fetchPublicSettings()` (e.g. `Delivery: Rs. 250 Pakistan-wide`), eliminating hardcoded values.
- **Product Media Gallery (`ProductMediaGallery`)**:
  - Locks all product imagery into the brand's approved 4:5 fashion aspect ratio (`aspect-[4/5]`) using Next.js `Image` with responsive object fit and layout shift prevention.
  - Video support: renders responsive HTML5 `<video>` tags with standard native playback controls (`controls`), loop disabled (no looping), strictly customer-initiated playback (no autoplay), and no autoplay sound (`muted` or user initiated).
  - Accessible thumbnail strip: renders interactive thumbnails with high-contrast active borders, keyboard focus rings, and `aria-label` navigation.
  - Fallback resilience: renders neutral fashion silhouette placeholder when no media assets are attached to the product.
- **Exact Variant Availability Matrix & Option Selectors (`ProductPurchaseConfigurator`)**:
  - Strict text-based color presentation: Color options display human-readable names (e.g., "Blush Pink", "Navy Blue") via semantic `<button>` elements. Strictly excludes hex codes, RGB values, circular color chips, or visual swatches.
  - Data-driven size selectors: Size buttons dynamically render values supplied directly by the backend catalog (e.g., "0-3M", "1-2Y", "Small", "Custom"). Strictly prohibits hardcoded standard clothing sizes.
  - Order-independent exact Variant selection algorithm:
    - Calculates available options bidirectionally based on the exact Product Variant combinations (`ProductVariant[]`) and their boolean `isAvailable` flags.
    - An option is enabled only if there exists at least one combination with the current selections that forms a valid variant.
    - If selecting an option invalidates the current selection in another axis, the conflicting selection is automatically cleared.
    - Single-option auto-selection: Automatically pre-selects the choice when an option axis has only 1 value available.
    - Explicit visual differentiation: Disabled options (no combination exists) vs Unavailable options (`isAvailable === false` on selected combination).
    - Purchasability resolution: Renders clear boolean-availability status messaging ("Please select your options", "This combination is currently unavailable.", or purchasable readiness). Strictly eliminates all customer-facing 'out of stock' terminology and numeric inventory counts.
- **Quantity Selector Boundary**:
  - Quantity control bounded strictly between 1 and 10 with accessible decrement (`-`) and increment (`+`) steppers and `aria-live` readout.
  - Maintained in disabled state until an exact, purchasable variant is actively selected.
  - Labeled neutrally as "Quantity" — strictly never labeled as inventory, remaining stock count, or stock availability (consistent with exact-variant boolean availability).
- **Size Guide Presentation Boundary (`SizeGuideModal`)**:
  - Read-only backend extension on `GET /api/v1/storefronts/:slug/products/:productSlug`: securely includes `sizeGuide: { columns, rows } | null` via `public-catalog-routes.ts` and `public-visibility.ts`.
  - Frontend disclosure: Renders an accessible "View Size Guide" modal button with `<dialog>` / modal semantics, backdrop overlay, Esc key dismissal, and responsive horizontal scrolling.
  - Semantic tabular layout: Renders measurements strictly in `<table>` with `<thead>` and `<tbody>`.
  - Conditional display: The modal trigger button and container render strictly when size guide data is non-null and contains at least 1 column and row. Never invents measurements.
- **Cart Integration Boundary**:
  - Preserves strict Work Unit 12 boundaries: strictly NO persistent cart state, localStorage sync, Zustand cart stores, or fake Add to Cart simulations.
- **Automated Verification**:
  - 64 frontend catalog/PDP tests in `apps/web/test/storefront-catalog.test.tsx` verifying Shop route, New Arrivals, Search form and server-side search pagination (`?q=&page=`), PDP rendering, 4:5 media gallery, video controls with no loop and no autoplay, textual color buttons, data-driven sizes, bidirectional variant availability, quantity bounds, size guide modal, dynamic shipping, 404 defensive visibility, and V1 exclusions.
  - 8 backend size guide integration tests in `apps/api/test/public-size-guide.test.ts` verifying size guide response shape, column/row sorting, null fallbacks, and storefront isolation.
  - 46 storefront shell tests in `apps/web/test/storefront-shell.test.tsx`.
  - 27 design system tests in `apps/web/test/design-system.test.tsx`.

---

### Work Unit 13: Persistent Guest Cart Architecture

- **Cart State & Persistence (`useCartStore`, `kids-wear-cart`)**:
  - Persistent guest cart managed via Zustand with `persist` middleware backed by browser `localStorage`.
  - Storage key: `kids-wear-cart`, schema version: `1`.
  - Minimal stored intent: Persists strictly `{ productId, variantId, quantity }` with non-authoritative display cache. Stored client data is NEVER trusted for authoritative checkout, prices, or availability decisions.
  - Robust corruption handling: Malformed, non-array, or corrupted localStorage data is safely sanitized on hydration through `migrate` and `onRehydrateStorage` hooks, discarding invalid records without crashing.
  - Persisted Line Validation (`isValidRawCartItem`, `isValidUuid`): Every retained line must have valid canonical 8-4-4-4-12 hex UUID format (`UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) for both `productId` and `variantId`, strictly rejecting generic identifiers (e.g. `abc`, `product_123`, `not-a-real-uuid`), malformed types, and non-UUID strings. Integer quantity must be strictly between 1 and 10. Discards lines with non-integers, strings, negative quantities, zeroes, or quantities >10 without silently converting dangerous values.
  - Deterministic Duplicate Variant Normalization & Identity Conflict Discard:
    - Same Product + Same Variant: Lines with identical `(productId, variantId)` are merged deterministically by summing their quantities, strictly capped at `MAX_QUANTITY_PER_VARIANT` (10).
    - Conflicting Product Identity: If storage contains entries sharing the same `variantId` but claiming differing `productId`s, the conflicting entry represents corrupted state and is discarded rather than merged into a legitimate cart line.
    - Hydration guarantees zero duplicate variant lines, zero conflicting identity lines, and no quantity >10.
  - Runtime Store Actions Hardening:
    - `addItem()` validates canonical UUIDs for `productId` and `variantId` and checks against conflicting `productId` for existing variants, rejecting invalid calls with `{ success: false, reason: "INVALID_IDENTITY" }`.
    - `updateQuantity()` rejects invalid variant UUIDs and out-of-range quantities as safe no-ops.
    - `removeItem()` safely no-ops on invalid variant UUIDs.
  - Version Incompatibility Safety: When storage contains an unknown or legacy version (`version !== 1`), stored data is safely reset to `{ items: [] }`.
  - Next.js App Router hydration safety: Custom `useCart` hook guards SSR rendering via `useSyncExternalStore`, ensuring zero hydration mismatches, no count flash, and no direct `window` access on the server.
- **Cart Line Identity & Merge Rules**:
  - Exact Variant Identity: Each cart line item is uniquely identified by `(productId, variantId)`. Never duplicates identity using product or option label strings.
  - Quantity Merging: Adding an already existing variant merges the added quantity into the existing line.
  - 1–10 Quantity Semantics: Maximum 10 units per exact variant per order. Adding units that would cause the combined quantity to exceed 10 is explicitly rejected with accessible feedback, preserving the existing quantity.
  - Quantity Update Boundary (`updateQuantity`): Strictly accepts integer quantities 1–10. Any invalid input (0, negative, >10, non-integer, or malformed variantId) is rejected as a no-op without silently converting or clamping unexpected values into valid intent.
  - Minimum 1 unit: Quantity steppers enforce a minimum of 1. Zero (`0`) and negative quantities are rejected. Decrementing below 1 is disabled; removal requires an explicit Remove action.
- **Storefront-Safe Cart & Mixed Storefront Support**:
  - The guest cart is global across Mini Sprouts, Teen Studio, and Aura Studio. Switching storefronts never clears or partitions the cart.
  - Items in the cart retain their authoritative storefront slug, allowing multi-storefront orders.
- **PDP Add to Cart Connection (`ProductPurchaseConfigurator`)**:
  - Add to Cart action enabled only when an exact variant is resolved, `isAvailable === true`, and quantity is between 1 and 10.
  - Accessible live feedback: Announces successful additions ("Added to cart") or clear constraint rejection messages ("Cannot add more than 10 units...") via `role="status"` and `aria-live="polite"`.
- **Header Unit Count Badge (`CartUnitBadge`)**:
  - Connected to persistent cart state across desktop Header and MobileNav drawer.
  - Displays total accumulated units (not distinct line count).
  - Hydration-guarded: Renders `null` during SSR and before client mount, eliminating hydration mismatch warnings.
- **Authoritative Cart Validation Endpoint (`POST /api/v1/cart/validate`)**:
  - Public endpoint requiring no customer authentication or CSRF tokens (read-only validation).
  - Request bounded defensively: Maximum 50 lines, quantity 1–10 per line, UUID validation, duplicate variant entries rejected with `DUPLICATE_VARIANT_ENTRY`.
  - Authoritative database checks: Verifies Product existence, `PUBLISHED` status, defensive public visibility (active Main Image), Variant existence, active Size, active Color, and boolean `isAvailable === true`.
  - Safe Recovery Contract: Returns `items` (validated lines) and `invalidItems` (with structured reasons: `PRODUCT_NOT_FOUND`, `PRODUCT_UNPUBLISHED`, `PRODUCT_UNAVAILABLE`, `PRODUCT_MISMATCH`, `VARIANT_NOT_FOUND`, `VARIANT_UNAVAILABLE`, `SIZE_INACTIVE`, `COLOR_INACTIVE`).
  - Strict data privacy: Never leaks title, description, price, media, or metadata of unpublished or draft products.
  - Money & Decimal Arithmetic: Line subtotals, subtotal, and total are computed server-side using Prisma Decimal arithmetic. Money strings are formatted as fixed 2-decimal strings.
  - Delivery Charge & Totals Boundary:
    - Sourced dynamically from `CommerceSettings.flatDeliveryCharge`.
    - Applied exactly once when `validItems.length > 0`.
    - Invalid lines contribute exactly `0.00` to subtotal, delivery, and total.
    - All-invalid Cart (`validItems.length === 0`) returns `subtotal: "0.00"`, `deliveryCharge: "0.00"`, `total: "0.00"`.
    - Empty Cart (`items.length === 0`) returns `subtotal: "0.00"`, `deliveryCharge: "0.00"`, `total: "0.00"`.
- **Global Cart Page (`/cart`) & Stale Cart Recovery**:
  - Revalidates authoritatively upon load and following quantity modifications.
  - Renders `LoadingState` during validation and `ErrorState` with retry on network failure without erasing the local cart.
  - Renders `EmptyCartState` with navigation to `/` when empty.
  - Line items display validated main image, product title linking to `/${storefrontSlug}/products/${slug}`, storefront badge, selected size, selected color, authoritative unit price, quantity stepper (1–10), line subtotal, and explicit Remove button.
  - Stale / invalid lines render clear recovery cards ("This option is no longer available") with an explicit Remove button; never silently substitutes options.
  - Order Summary renders subtotal, flat delivery, and grand total.
  - Checkout CTA Guard: "Proceed to Checkout" CTA is strictly disabled if `hasInvalidItems === true`, if `validItems.length === 0`, or while validation is in flight.
- **V1 Scope Exclusions**:
  - Strictly no Checkout form, no Order creation, no inventory reservation, no customer-account cart sync, no Wishlist, no online payment gateways, no courier APIs, and no database Cart table.
- **Automated Verification**:
  - 85 frontend cart tests in `apps/web/test/cart.test.tsx` verifying empty cart initialization, add variant, quantity merge, variant identity, cart persistence, storefront switching, guest accessibility, quantity boundaries (1–10, excess additions rejected), exact variant identity, PDP add-to-cart integration, cart page states, authoritative price rendering, cart line removal, quantity updates, header unit badge, dynamic storefront links, checkout CTA guard, stale recovery, V1 scope exclusions, hydration safety, canonical UUID validation, identity conflict discards, deterministic quantity merging, and runtime store action guards.
  - 17 backend cart validation integration tests in `apps/api/test/cart-validation.test.ts` verifying public unauthenticated access, input schema bounds, UUID validation, quantity bounds, duplicate variant detection, mixed storefront validation, product/variant mismatch rejection, draft/inactive product hiding, unavailable variant/size/color identification, missing main image handling, non-existent UUIDs, subtotal/delivery/grand total Decimal computation, and data privacy leak prevention.

### Work Unit 14: Checkout Validation & Checkout UI Architecture

- **Global `/checkout` Route & Guest Accessibility**:
  - Global un-scoped route (`apps/web/src/app/checkout/page.tsx`), outside any single storefront scope (`/mini-sprouts`, `/teen-studio`, `/aura-studio`), enabling seamless multi-storefront checkout.
  - Enforces `export const dynamic = "force-dynamic"`, ensuring fresh public settings and runtime configuration.
  - Supported for unauthenticated guest customers by default; does not require customer login, account creation, or customer authentication tokens.
- **Zero Customer PII Persistence Mandate**:
  - Customer shipping information (`fullName`, `phone`, `email`, `address`, `city`, `province`, `postalCode`, `orderNotes`) is managed strictly in ephemeral React Hook Form component state.
  - Never stored in browser `localStorage`, `sessionStorage`, cookies, Zustand cart store, or URL query parameters.
  - Fastify server logger (`apps/api/src/app.ts`) enforces strict redaction paths for `*.phone` and `*.address` to prevent customer contact information from leaking into application logs.
- **Public Checkout Configuration API (`GET /api/v1/checkout/config`)**:
  - Public, unauthenticated, read-only endpoint returning customer-safe payment method configuration.
  - Cash on Delivery (`CASH_ON_DELIVERY`): Always marked `available: true`.
  - Manual Bank Transfer (`BANK_TRANSFER`): Evaluated dynamically against `CommerceSettings`. Available if and only if all four customer-facing fields (`bankName`, `accountTitle`, `accountOrIban`, and `instructions`) are configured with non-whitespace strings. If any of these four required fields is missing, empty, or whitespace-only, returns `available: false` and sets all bank detail presentation fields to `null` to avoid leaking incomplete configuration. Optional branch fields (`branchCode`, `branchLocation`) are nullable in the schema and do not control Bank Transfer availability.
  - Strictly omits internal IDs, singleton keys, notification emails, admin metadata, and timestamps.
- **Authoritative Checkout Pre-Validation API (`POST /api/v1/checkout/validate`)**:
  - Public pre-validation endpoint executing full authoritative preflight without creating any database records.
  - Strict Request Validation & Normalization: Zod schema enforces trimmed bounds tailored to Pakistan shipping (Full Name: 2–120, Phone: 7–20, Address: 5–500, City: 2–100, Province: 2–100, Postal Code: max 20, Order Notes: max 1000). Optional customer fields (`email`, `postalCode`, `orderNotes`) normalize empty strings and whitespace-only values to `null`, while preserving and trimming non-empty valid inputs. Required fields (`fullName`, `phone`, `address`, `city`, `province`) are trimmed and reject whitespace-only inputs with validation errors. Schema uses `.strict()`, rejecting unrequested or over-posted fields (such as CNIC, DOB, or company name).
  - Live Bank Transfer Completeness Re-check: Re-queries `CommerceSettings` live during pre-validation when `paymentMethod === "BANK_TRANSFER"`. If bank transfer configuration is incomplete (e.g. `instructions` cleared or whitespace), pre-validation rejects the request with HTTP 400 (`PAYMENT_METHOD_UNAVAILABLE`). The system never silently alters the customer's selected payment method.
  - Shared Cart Validation Service: Extracts core validation logic into `apps/api/src/modules/cart/service.ts` (`validateCartLines`), ensuring `/cart/validate` and `/checkout/validate` enforce identical authoritative rules, availability checks, and Decimal pricing math.
  - Availability & Visibility Invariants: Validates product existence, `PUBLISHED` status, defensive public visibility (active Main Image), variant existence, active sizes/colors, and boolean `isAvailable === true`. Any unavailable, missing, or mismatched line rejects checkout with HTTP 400 (`CART_INVALID`).
  - Authoritative Totals & Decimal Math: Line subtotals, subtotal, and total are computed server-side using Prisma Decimal arithmetic. Shipping is evaluated dynamically from `CommerceSettings.flatDeliveryCharge` and applied once to non-empty carts. All monetary amounts are returned as fixed 2-decimal strings.
  - Zero Mutation Invariant: Strictly read-only preflight. Creates zero `Order`, `OrderItem`, or `OrderStatusHistory` rows, leaves cart items unmodified, and mutates no inventory or variant records.
- **Reviewed Checkout State & Instant Invalidation**:
  - Two-Step Checkout Experience: Step 1 (Shipping & Payment form) -> Step 2 (Reviewed Order confirmation).
  - Step 1 Action Button: Strictly labeled `"Review Order"`. Absolutely no fake `"Place Order"` or `"Complete Order"` button exists in Work Unit 14.
  - Reviewed State Presentation (`CheckoutReviewView`): Displays verified customer shipping details, selected payment method with bank details if applicable, authoritative order summary with 4:5 thumbnails, size, color, quantity, unit price, line subtotal, subtotal, delivery, total, and an explicit "Edit Details" button.
  - Automatic Invalidation Semantics: Modifying any customer input, selecting a different payment method, or updating items in the cart immediately resets `reviewedData` to `null`, requiring the user to re-run server validation before order review can be accessed again.
- **Cart Preservation Boundary (Work Unit 15 Reservation)**:
  - Reviewing an order does NOT clear the guest cart.
  - Local cart items in `useCartStore` remain fully populated throughout the checkout review experience. Cart clearing is strictly reserved for successful post-order creation in Work Unit 15.
- **V1 Scope Exclusions**:
  - Strictly no Order creation, no Order Success page, no Order Number generation, no online payment gateways (Stripe/PayPal), no credit/debit card UI, no saved address book, no customer profile sync, and no Wishlist.
- **Automated Verification**:
  - 58 backend integration tests in `apps/api/test/checkout-validation.test.ts` verifying public config endpoint, bank transfer 4-field completeness rules (missing bankName/accountTitle/accountOrIban/instructions or whitespace instructions disable availability; optional branch fields do not control availability), strict customer schema validation, optional field normalization to null, required field whitespace rejection, authoritative product/variant availability, Decimal money calculations, live payment method re-checks, and zero database mutations.
  - 58 frontend integration tests in `apps/web/test/checkout.test.tsx` verifying global route scoping, guest checkout access, empty/stale cart guards, required/optional field validation, blank optional field normalization, whitespace-only required field errors, semantic input types, zero PII persistence, payment selection UI, bank transfer disabled on missing/whitespace instructions, bank transfer enabled without optional branch data, dynamic bank details rendering, order summary line items, review state transitions, review invalidation on edit/payment/cart changes, accessible attributes (`htmlFor`, `aria-invalid`, `aria-describedby`, `<fieldset>`, `<legend>`, `role="alert"`), and strict Work Unit 14 scope boundaries.

### Work Unit 15: Transactional Order Creation & Payment Workflow Architecture

- **Transactional Order Creation & Concurrency Strategy (`POST /api/v1/orders`)**:
  - Global, transactional endpoint executing within an atomic Prisma `$transaction` with guaranteed all-or-nothing consistency across `Order`, `OrderItem`s, and `OrderStatusHistory`.
  - Deterministic Row-Level Exclusive Locking (`SELECT ... FOR UPDATE`):
    - To prevent stale reads or race conditions caused by concurrent Admin mutations, the transaction acquires exclusive row-level locks in deterministic ID order prior to cart validation:
      1. `CommerceSettings` row locked via `SELECT id FROM "CommerceSettings" WHERE "singletonKey" = 1 FOR UPDATE`.
      2. Referenced `Product`, `ProductSize`, and `ProductColor` rows locked via `SELECT id FROM ... FOR UPDATE`.
      3. Referenced `ProductVariant` rows locked via `SELECT id FROM "ProductVariant" WHERE id = ANY(...) FOR UPDATE`.
    - If a concurrent Admin mutation is in flight, the Order transaction waits on the lock, acquires the newly committed row state, re-evaluates authoritative conditions, and fails cleanly with HTTP 400 (`CART_INVALID`) if the variant/product has become unavailable, inactive, or unpublished.
    - If any error or constraint violation occurs within the transaction, PostgreSQL rolls back completely, ensuring no partial Order records survive.
  - Authoritative Live Revalidation: Evaluates live `CommerceSettings`, verifies payment method validity, and revalidates every cart line for product existence, `PUBLISHED` status, defensive visibility (active Main Image), variant existence, active sizes/colors, and boolean `isAvailable === true`. Any stale, unavailable, or mismatched variant immediately aborts the transaction with HTTP 400 (`CART_INVALID`).
  - Money & Decimal Arithmetic: Line subtotals, subtotal, delivery charge, and grand total are calculated server-side using exact Prisma Decimal arithmetic. Shipping is evaluated dynamically from `CommerceSettings.flatDeliveryCharge`.
- **Monotonic Sequential Order Numbering (`KW-1001`)**:
  - Leverages PostgreSQL sequence `order_number_seq` via `SELECT nextval('order_number_seq')`.
  - Generates canonical human-readable order numbers in the format `KW-${seqVal}` (starting at `KW-1001`).
  - Guarantees strict monotonicity and uniqueness across all storefronts without race conditions or guessing.
- **Immutable Purchase-Time Historical Snapshots**:
  - `Order`: Persists immutable snapshot of customer shipping details (`fullName`, `phone`, `email`, `address`, `city`, `province`, `postalCode`, `orderNotes`), payment method (`CASH_ON_DELIVERY` | `BANK_TRANSFER`), subtotal, delivery charge, and total.
  - `OrderItem`: Persists point-in-time snapshots for each line item capturing `productId`, `productTitle`, `productSlug`, `storefrontSlug`, `productSku`, `sizeLabel`, `colorName`, `quantity`, `unitPrice`, and `lineSubtotal`. Color representation is strictly display-name-only (`colorName`); the system introduces no color-hex, swatch, or color-family concepts into schemas, snapshots, or API responses.
  - `OrderStatusHistory`: Creates initial status history record atomically (`fromStatus: null`, `toStatus: initialStatus`, `changedBy: "SYSTEM"`, `notes: "Order placed via online storefront"`).
- **Initial Status Mapping**:
  - Cash on Delivery (`CASH_ON_DELIVERY`): Initialized to `OrderStatus.ORDER_RECEIVED`.
  - Manual Bank Transfer (`BANK_TRANSFER`): Initialized to `OrderStatus.AWAITING_PAYMENT`.
- **Customer Session Association & Guest Privacy**:
  - Resolved exclusively via verified HTTP-only session cookie `kw_customer_session`.
  - If a valid session cookie exists and maps to an active customer, `customerId` is linked to the order.
  - If guest or unauthenticated, `customerId` is stored as `null`. A guest order is **never** linked to a registered customer account based on submitted email address.
- **Idempotency Strategy & Concurrency Safety**:
  - Enforces unique `idempotencyKey String? @unique` on `Order`.
  - First submission: Creates the order and attempts exactly one Admin notification if enabled and configured.
  - Sequential identical replay: Matches existing order pre-transaction and returns HTTP 200 without duplicate creation and without sending a duplicate notification.
  - Concurrent same-key requests: One transaction succeeds in order persistence and sends notification; concurrent duplicate catches Prisma P2002 conflict, verifies payload match, and returns existing order with zero duplicate notification.
  - Conflict detection: Matching key with differing payload or customer rejects with HTTP 409 (`IDEMPOTENCY_CONFLICT`) and sends zero notifications.
- **Post-Commit Resend Admin Email Notification**:
  - Notification is attempted only after the database transaction has committed successfully.
  - Abstracted through `IEmailService` with production implementation `ResendEmailService` (and test seams `getEmailService`, `setEmailService`, `resetEmailService`).
  - Strict Environment Configuration: Email delivery strictly requires both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` environment variables. The codebase contains zero hardcoded sender addresses, domains, or mock fallbacks (such as `orders@kidswear.pk` or `orders@kidswear.local`). Production deployments require explicit manual setup to set `RESEND_FROM_EMAIL` to a Resend-verified sender.
  - Recipient dynamically queried from `CommerceSettings.newOrderNotificationRecipient`. If notifications are disabled (`newOrderEmailEnabled === false`) or recipient is missing/empty, no email is sent, and neither Resend environment variable is required.
  - Non-blocking failure semantics: If new-order email notifications are enabled but either `RESEND_API_KEY` or `RESEND_FROM_EMAIL` is missing/empty, or if Resend delivery fails/throws, no fake sender is substituted, a concise operational warning is logged to Fastify server logs (strictly excluding customer PII or secrets), the Order transaction is **never** rolled back, and the client receives a normal HTTP 201 success response.
  - Zero customer confirmation email sent (strictly excluded from V1).
- **Client Cart Clearing & Order Success (`/order-success`)**:
  - Client generates a cryptographically secure UUID `idempotencyKey` per submission. Reused on retry of failed network submissions; regenerated if review is invalidated or customer edits fields.
  - Cart clearing (`clearCart()`) executes only upon confirmed HTTP 201/200 success from `POST /api/v1/orders`. If submission fails (e.g., stale cart or network failure), cart items remain intact for recovery.
  - Navigation proceeds to `/order-success?orderNumber=KW-XXXX&paymentMethod=...`.
  - Order Success Page displays verified order number, dynamic Bank Transfer instructions (if applicable), and Cash on Delivery guidance.
  - Strict privacy boundary: Order Success performs **zero** public database lookups or order queries. No order details, customer PII, or tracking forms are exposed.
- **V1 Scope Exclusions**:
  - Strictly no Admin Order Management UI, no Admin status updates, no Customer Order History UI, no public order tracking or lookup endpoints, no numeric inventory counting or stock reservations, no customer confirmation emails, no payment gateways (Stripe/PayPal), and no courier API integration.
- **Automated Verification**:
  - 90 backend integration tests in `apps/api/test/order-creation.test.ts` verifying transactional creation, PostgreSQL sequence numbers (`KW-1001`), line snapshots without color-hex, initial status mapping, customer session resolution, row-level `FOR UPDATE` locking, concurrency protection, idempotency replay/conflict/race handling with notification suppression, post-commit Resend admin notification, strict `RESEND_FROM_EMAIL`/`RESEND_API_KEY` environment configuration, zero hardcoded fallback senders, non-blocking email failure, and data exposure minimization.
  - 25 frontend integration tests in `apps/web/test/order-creation.test.tsx` verifying Place Order UI integration, busy state, request payload normalization, cart clearing on confirmed success, cart preservation on failure, `/order-success` rendering, idempotency key generation/reuse, and V1 scope boundaries.
  - 20 database smoke checks in `apps/api/prisma/smoke-check.ts` including Check 20 testing `idempotencyKey` uniqueness on `Order`.

### Work Unit 16: Customer Account & Order History Architecture

- **Customer Authentication & In-Memory State Boundaries**:
  - Customer login UI (`/account/login`), Customer registration UI (`/account/register`) with client-side validation, error handling, and safe internal return path redirection via `getSafeNextUrl(rawNext, "/account")`.
  - Open-Redirect Protection: `getSafeNextUrl` strictly validates that paths start with a single `/`, reject protocol-relative `//`, backslashes, and URI scheme indicators (`:`).
  - In-Memory Auth Context (`CustomerAuthProvider`): Authenticated customer state is held strictly in memory in React state. Passwords, session tokens, and customer identity are never persisted in `localStorage` or `sessionStorage`.
  - Session cookie transport: HttpOnly `kw_customer_session` cookie managed securely by browser with `credentials: "include"`. Transparent to client scripts.
  - Cart Preservation Boundary: Customer login, registration, and logout actions never reset or purge the guest Cart. Guest cart items in `useCartStore` remain intact across authentication boundary transitions.
- **Customer Account Shell & Profile**:
  - Authenticated layout shell (`apps/web/src/components/account/account-shell.tsx`) wrapping `/account`, `/account/orders`, and `/account/profile`.
  - Features customer greeting, contact summary, responsive tab navigation (Overview, Orders, Profile), accessible loading state (`role="status"`, `aria-busy="true"`), and Sign Out button.
  - Unauthenticated access guard: Redirects unauthenticated visitors to `/account/login?next=${pathname}`.
  - Profile UI (`/account/profile`): Displays and edits `fullName`, `email`, and `phone`. Submits via `PATCH /api/v1/account/profile` with CSRF protection (`X-CSRF-Token` header retrieved via `GET /api/v1/auth/csrf`). Updates in-memory customer context upon success.
- **Authenticated Order History API (`GET /api/v1/account/orders`)**:
  - Protected by `requireCustomer` middleware.
  - Strict Ownership Filter: Queries strictly by `customerId = request.customer.id`. Never queries or links orders by customer email or phone.
  - Guest Order Non-Claim Invariant: Guest orders placed with `customerId = null` remain unlinked even if the guest customer subsequently registers or logs in with the matching email/phone.
  - Pagination: Supports `page` (default 1) and `limit` (default 10, max 50). Ordered newest-first (`createdAt DESC, id DESC`).
  - Response Envelope: Returns mapped `orders` list and `pagination` metadata (page, limit, totalOrders, totalPages, hasNextPage, hasPrevPage).
  - Data Minimization: Excludes internal database IDs, `customerId`, `idempotencyKey`, `sku`, and admin identifiers.
- **Authenticated Order Detail API (`GET /api/v1/account/orders/:orderNumber`)**:
  - Protected by `requireCustomer`. Validates `orderNumber` format `^KW-\d+$`.
  - Ownership-scoped query: Enforces `where: { orderNumber, customerId: request.customer.id }`.
  - Hermetic Isolation: Foreign orders and guest orders return HTTP 404 (`ORDER_NOT_FOUND`), identical to nonexistent orders.
  - Point-in-time snapshots: Returns immutable snapshots of product name, size label, color name, quantity, unit price, line subtotal, thumbnail, delivery snapshot (recipient name, phone, email, address, city, province, postal code, delivery notes), and financial totals.
  - Status Progression Timeline: Returns status history ordered oldest-to-newest (`changedAt ASC`), with customer-safe status labels and formatted timestamps. Strictly excludes internal admin audit fields (`changedByAdminId`) and internal admin notes.
- **Order History & Detail UI (`/account/orders` and `/account/orders/[orderNumber]`)**:
  - Orders list renders newest-first with status badge, date, item count, formatted total, pagination controls, and friendly empty state ("No orders yet" with link to browse collections).
  - Order detail page renders back link, header summary, purchased items list, financial breakdown (subtotal, delivery fee, grand total), status history timeline, delivery details, and payment method details with authoritative status (no invented WhatsApp receipt or payment-verification workflow).
  - 404 Error State: Displays accessible "Order Not Found" card with a link back to Order History.
- **V1 Scope Exclusions (Strictly Enforced)**:
  - Strictly no Saved Addresses book / address CRUD.
  - Strictly no Password Reset / forgot password flow (not in V1).
  - Strictly no Customer Order Cancellation button.
  - Strictly no Wishlist or Loyalty system.
  - Strictly no Receipt upload or customer-side payment verification workflow.
  - Strictly no SKU display in customer-facing order views.
  - Strictly no public guest tracking on account routes.
- **Automated Verification**:
  - 40 backend integration tests in `apps/api/test/customer-orders.test.ts` verifying authentication/session guards, strict ownership isolation, guest order non-claim invariant, ordering/pagination, detail snapshots and historical preservation, data exposure minimization (no customerId, idempotencyKey, SKU, admin notification state, internal IDs, or admin identities), and status timeline oldest-to-newest ordering.
  - 66 frontend integration tests in `apps/web/test/account.test.tsx` verifying safe redirect sanitization (`getSafeNextUrl`), in-memory session security, guest cart preservation, account shell navigation and accessibility, customer login form validation/errors/redirects, registration validation and password rules (7–20 phone, 8–128 password, no mandatory letter/digit complexity), profile CSRF updates, order history listing/pagination/empty states, order detail snapshots, oldest-to-newest timeline, absence of WhatsApp receipt workflow, and strict V1 scope boundaries.

### Work Unit 17: Admin Order Management Backend Architecture

- **Security & Authorization Boundaries**:
  - Mount Prefix: `${API_V1_PREFIX}/admin/orders`.
  - Admin Session Authentication: Enforced via `requireAdmin` middleware checking valid `kw_admin_session` cookie against `AdminSession` table.
  - CSRF Protection: Write operations (`PATCH /api/v1/admin/orders/:orderNumber/status`) enforce session-bound `requireAdminCsrf` middleware validating the `X-CSRF-Token` header.
- **Server-Side Order List API (`GET /api/v1/admin/orders`)**:
  - Pagination: Controlled via `page` (integer, min 1, default 1) and `limit` (integer, min 1, max 100, default 20).
  - Search Filter (`q`): Case-insensitive substring matching against snapshot customer delivery fields: `orderNumber`, `fullName`, `phone`, and `email`. Sanitized and bounded to 100 characters max.
  - Status & Payment Method Filters: Controlled via strict native enum filters `status` (`OrderStatus`) and `paymentMethod` (`PaymentMethod`). Invalid values fail schema validation with HTTP 400 (`VALIDATION_ERROR`).
  - Deterministic Ordering: Enforced across all queries as `createdAt DESC, id DESC`.
  - Response Data Envelope: Emits `orders` array containing order summary, item count, formatted monetary totals, and `pagination` object (`page`, `limit`, `totalOrders`, `totalPages`, `hasNextPage`, `hasPrevPage`).
- **Admin Order Detail API (`GET /api/v1/admin/orders/:orderNumber`)**:
  - Validates `orderNumber` format against strict pattern `^KW-\d+$`.
  - Immutable Customer Snapshot: Exposes point-in-time shipping address, contact details, payment method, delivery notes, and monetary totals.
  - Full Line Item Inspection: Exposes line item snapshots including operational `productSku`, product title, variant size label, color name, quantity, unit price, and line subtotal.
  - Chronological Status History: Exposes all historical transitions ordered oldest-to-newest (`changedAt ASC`), including `fromStatus`, `toStatus`, `changedBy`, `changedByAdminId`, `notes`, and formatted timestamp.
- **Controlled Finite State Transition Engine**:
  - Transition Map:
    - `AWAITING_PAYMENT` -> `CONFIRMED`, `CANCELLED`
    - `ORDER_RECEIVED` -> `CONFIRMED`, `CANCELLED`
    - `CONFIRMED` -> `IN_PRODUCTION`, `CANCELLED`
    - `IN_PRODUCTION` -> `READY_TO_SHIP`, `CANCELLED`
    - `READY_TO_SHIP` -> `SHIPPED`, `CANCELLED`
    - `SHIPPED` -> `DELIVERED`
    - `DELIVERED` -> (terminal; no transitions allowed)
    - `CANCELLED` -> (terminal; no transitions allowed)
  - Payment Method Validation: Bank Transfer orders start in `AWAITING_PAYMENT` and transition to `CONFIRMED` upon manual verification. COD orders start in `ORDER_RECEIVED` and transition to `CONFIRMED`. An order can never transition into the initial status of a different payment method.
  - Cancellation Boundary: Admin cancellation is strictly permitted only prior to dispatch (`AWAITING_PAYMENT`, `ORDER_RECEIVED`, `CONFIRMED`, `IN_PRODUCTION`, `READY_TO_SHIP`). Attempting to cancel an order once `SHIPPED` or `DELIVERED` is rejected with HTTP 400 (`ORDER_STATUS_TRANSITION_INVALID`).
  - Disallowed Transitions: Backward movements (e.g. `CONFIRMED -> ORDER_RECEIVED`), skip transitions (e.g. `ORDER_RECEIVED -> SHIPPED`), and mutations on terminal states (`DELIVERED`, `CANCELLED`) are rejected with HTTP 400 (`ORDER_STATUS_TRANSITION_INVALID`).
- **Atomic Order + History Mutation & Concurrency Safety**:
  - Interactive Transaction: Executed inside `prisma.$transaction`.
  - Row-Level Locking: `SELECT id, "orderNumber", status, "paymentMethod" FROM "Order" WHERE "orderNumber" = $1 FOR UPDATE` locks the target order row against concurrent status mutations.
  - Status Re-Evaluation Under Lock: Current database status is re-evaluated after lock acquisition, preventing stale race conditions.
  - Idempotent Same-Status Retry: If the requested status equals current status, the API returns HTTP 200 with `{ "updated": false, "status": currentStatus }` and commits zero duplicate history rows.
  - Server-Side Admin Attribution: Appends `OrderStatusHistory` row recording `fromStatus`, `toStatus`, `changedBy: "ADMIN"`, `changedByAdminId: request.admin.id`, and `notes: "Status updated by admin"`. Client cannot spoof or override attribution.
- **Customer Timeline Synchronization**:
  - Admin status transitions immediately propagate to the authenticated Customer Order Detail API (`GET /api/v1/account/orders/:orderNumber`).
  - Historical records preserve data minimization boundaries: customer timeline exposes public safe status and date, while strictly concealing admin ID and internal notes.
- **Strict V1 Scope Exclusions**:
  - Strictly no Admin frontend UI (deferred to Work Unit 19).
  - Strictly no numeric inventory adjustment or stock restoration upon cancellation (variant availability is strictly boolean: available or out of stock; no numeric inventory counts exist).
  - Strictly no customer notification emails or automated status update emails.
  - Strictly no payment gateway integrations.
  - Strictly no courier tracking APIs.
  - Strictly no claiming of guest orders by customer accounts.
- **Automated Verification**:
  - 84 backend integration tests in `apps/api/test/admin-orders.test.ts` verifying authentication/CSRF boundaries, listing/pagination/filters/search, detail snapshots with SKU inspection, Bank Transfer manual verification, COD lifecycle, production lifecycle, invalid transitions and terminal state guards, cancellation boundaries and zero-inventory-side-effect invariants, same-status idempotency, concurrency row locking, server-side admin attribution, customer timeline propagation with data minimization, and V1 scope boundaries.

### Work Unit 18: Reviews Architecture

- **Anonymous Customer Submission Boundary**:
  - Mount Endpoint: `POST /api/v1/reviews`.
  - No Login / No Account Requirement: Reviews are completely open to all customers. No customer account, session cookie, email address, phone number, password, or proof-of-purchase token is required or accepted.
  - Strict Payload Validation:
    - `name`: string, 2–100 characters, automatically trimmed.
    - `productId`: valid UUID string of an existing, published, active product with available variants and a main image. Reviews on draft, inactive, or defensively invisible products are rejected with HTTP 400 (`PRODUCT_NOT_ELIGIBLE_FOR_REVIEW`).
    - `rating`: integer between 1 and 5 inclusive (fractions, strings, or numbers outside 1–5 are rejected by Zod and constrained by database `CHECK (rating >= 1 AND rating <= 5)`).
    - `reviewText`: string, 10–2000 characters, trimmed (whitespace-only is rejected).
    - `reviewSubmissionId`: optional UUID string required when attaching images, establishing the isolated Cloudinary namespace `kids-wear/reviews/<reviewSubmissionId>`.
    - `images`: optional array of at most 3 `{ publicId: string }` items.
  - Immutable Initial State: Submissions are unconditionally created in `status = PENDING`. Client over-posting of `status`, `customerId`, `orderId`, or admin attribution fields is strictly rejected with HTTP 400 (`VALIDATION_ERROR`).
- **Media Upload Signing & Authoritative Verification Boundary**:
  - Upload Signing Endpoint: `POST /api/v1/reviews/media/sign` issues short-lived, client-usable Cloudinary upload parameters scoped strictly to `kids-wear/reviews/<reviewSubmissionId>`.
  - Allowed Formats: Strictly JPEG, PNG, and WebP. Video assets (`resourceType = video` or `mediaType = VIDEO`) and SVGs are rejected with HTTP 400.
  - Server-Side Cloudinary Verification: When `POST /api/v1/reviews` includes images, the backend queries Cloudinary authoritatively via `fetchResourceMetadata`:
    1. Verifies that the public ID belongs to the submission's folder namespace (`kids-wear/reviews/<reviewSubmissionId>/`).
    2. Verifies that the asset actually exists in Cloudinary.
    3. Verifies that `resourceType === "image"` and format is in `["jpg", "jpeg", "png", "webp"]`.
    4. Automatically records metadata (URL, dimensions, bytes, format) without trusting client-supplied values.
  - Concurrency & Limits: At most 3 images per review. SVGs and videos are blocked.
  - Atomic Persistence & Rollback Cleanup: Review and `ReviewMedia` records are committed atomically inside `prisma.$transaction`. If database insertion fails, any uploaded Cloudinary assets are cleaned up on a best-effort basis.
- **Public Retrieval & Privacy Boundaries**:
  - Public Endpoint: `GET /api/v1/reviews` with optional `productId`, `storefrontSlug`, `page`, and `limit` query parameters.
  - Moderation Isolation: The public query enforces `status: "APPROVED"` unconditionally. Reviews in `PENDING` or `HIDDEN` status are never returned in public endpoints under any circumstances.
  - Data Minimization: Public review items strictly omit internal database IDs, moderation `status`, `customerId`, Admin IDs, and Cloudinary public IDs, returning only reviewer name, rating, review text, created date, product link metadata, and image URLs.
  - HTML Escaping: Frontend components (`ReviewCard`) render review text safely as plain escaped strings with `whitespace-pre-line`. No `dangerouslySetInnerHTML` is used.
- **Storefront & PDP Integration**:
  - Dedicated Reviews Page (`/reviews`): Features customer community header, `<ReviewSubmissionForm />` for immediate submission, approved reviews list with pagination, and an honest empty state ("No Reviews Published Yet") without fabricated ratings.
  - Product Detail Page (`/[storefront]/products/[slug]`): Features `<ProductReviewsSection />` loading approved reviews for the current product. In compliance with storefront catalog test 62, the PDP contains NO `<form>` tag and NO "write a review" text directly on the page, instead linking customers to `/reviews`.
  - Homepage (`/[storefront]`): Features `<ReviewsPreview />` receiving live approved storefront reviews. When approved reviews exist, it displays genuine customer feedback (up to 3). When empty, it displays the honest `"Verified Reviews Arriving Soon"` placeholder. In compliance with storefront shell test 32, it contains NO `<form>` tag.
- **Admin Moderation & Lifecycle Management**:
  - Admin List & Search: `GET /api/v1/admin/reviews` supports pagination, search filter `q` (matching reviewer name, review text, product name, or SKU), status filter (`PENDING`, `APPROVED`, `HIDDEN`), and rating filter.
  - Admin Detail: `GET /api/v1/admin/reviews/:reviewId` returns complete review details including associated media assets, product metadata, and full status history.
  - Status Transitions: `PATCH /api/v1/admin/reviews/:reviewId/status` requires `requireAdmin` and `requireAdminCsrf`. Concurrency-safe row-level lock (`SELECT id, status FROM "Review" WHERE id = $1 FOR UPDATE`) guarantees race-free state transitions between `PENDING`, `APPROVED`, and `HIDDEN`. Retrying with the same status is idempotent.
  - Review Deletion: `DELETE /api/v1/admin/reviews/:reviewId` atomically deletes the review and its `ReviewMedia` associations from PostgreSQL, followed by best-effort Cloudinary asset cleanup. Deletion succeeds even if remote Cloudinary deletion encounters an error.
- **Abuse & Rate Limiting Controls**:
  - `POST /api/v1/reviews`: Dedicated Fastify rate limiting enforcing a maximum of 5 submissions per 15 minutes per IP.
  - `POST /api/v1/reviews/media/sign`: Dedicated Fastify rate limiting enforcing a maximum of 10 signatures per 15 minutes per IP.
- **Strict V1 Scope Exclusions**:
  - Strictly no Admin frontend UI (deferred to Work Unit 19).
  - Strictly no Customer Review Management / edit / delete routes (`/account/reviews` does not exist).
  - Strictly no "Verified Purchase" badges or customer purchase verification requirements.
  - Strictly no review videos or video players.
  - Strictly no helpful votes or review rating voting UI.
- **Automated Verification**:
  - 66 backend integration tests in `apps/api/test/reviews.test.ts` verifying anonymous submission, pending moderation, rating 1–5 bounds, Cloudinary upload signature generation, asset verification, 0–3 image limits, video and SVG rejection, public APPROVED-only retrieval, data minimization, admin list/search/detail, status transitions with row locking, delete with best-effort Cloudinary cleanup, IP rate limiting, and V1 exclusions.
  - 43 frontend integration tests in `apps/web/test/reviews.test.tsx` verifying ReviewCard rendering, plain text escaping, ReviewSubmissionForm validation, max 3 images file input, anonymous form fields (no email/phone/password), `/reviews` page listing, pagination, honest empty states, ProductReviewsSection PDP integration (no `<form>` tag or "write a review" text), homepage ReviewsPreview integration (honest placeholder and live reviews, no `<form>` tag), and V1 scope exclusions.

### Work Unit 19: Admin Panel UI Architecture

- **Admin UI Route Hierarchy**:
  - `/admin`: Primary authenticated dashboard landing page (strictly no redundant `/admin/dashboard` route).
  - `/admin/login`: Admin credentials sign-in form (strictly no public registration or signup links).
  - `/admin/products`: Searchable, filterable catalog of all products across storefronts.
  - `/admin/products/new`: Initial creation workflow for new draft products.
  - `/admin/products/[productId]`: Comprehensive tabbed product editor (Details, Sizes & Colors, Variants Matrix, Media, Publication Gate).
  - `/admin/orders`: Searchable, filterable operational orders list.
  - `/admin/orders/[orderNumber]`: Detailed order inspection, purchase snapshots, customer delivery data, and state transitions.
  - `/admin/reviews`: Review moderation workspace with status and rating filters.
  - `/admin/reviews/[reviewId]`: Full review inspection and moderation actions.
  - `/admin/storefronts`: Storefront hero slider management across the 3 fixed storefronts.
  - `/admin/settings`: Storefront announcement, flat delivery charge, bank transfer details, and order notification settings.

- **Admin Navigation & Shell Boundaries**:
  - Navigation Area: Exactly 6 approved top-level operational areas (`Dashboard`, `Products`, `Orders`, `Reviews`, `Storefronts`, `Settings`) plus `Sign Out`.
  - Active States: Strict accessibility compliance via `aria-current="page"` on current navigation links.
  - Route Guarding: `<AdminGuard />` protects all `/admin/*` routes (except `/admin/login`), displaying a restrained, accessible loading spinner while the session resolves and redirecting unauthenticated visitors to `/admin/login`.
  - Responsive Shell: Desktop persistent sidebar and mobile slide-out drawer with backdrop.

- **Admin Authentication, Session Security & CSRF Boundaries**:
  - In-Memory Session State: In-memory React context (`AdminAuthProvider` and `useAdminAuth`) holding user identity (`id`, `email`, `role`). Strictly zero persistence in `localStorage`, `sessionStorage`, or client-side storage.
  - HttpOnly Cookie Transport: Authentication relies entirely on the browser's native transmission of the `kw_admin_session` cookie with `credentials: "include"`.
  - Automated CSRF Management: Dedicated API client (`apps/web/src/lib/admin-api.ts`) transparently fetches the session-bound CSRF token from `GET /api/v1/admin/auth/csrf` before executing state-changing mutations (`POST`, `PATCH`, `DELETE`, `PUT`). Upon receiving `CSRF_INVALID` or `CSRF_MISSING`, it invalidates the cached token, fetches a fresh token, and automatically retries the mutation once.
  - Cache Isolation: Root admin layout (`apps/web/src/app/admin/layout.tsx`) declares `export const dynamic = "force-dynamic"` to strictly prevent static generation or caching of sensitive operational admin routes.

- **Dashboard Data Source & Metrics Boundary**:
  - Authoritative Backend Endpoint: `GET /api/v1/admin/dashboard` protected by `requireAdmin`.
  - Exactly 4 Required Metric Cards:
    1. **Total Products**: Database count of all products across all storefronts.
    2. **Total Orders**: Database count of all orders created across all statuses.
    3. **Active Orders**: In-progress orders (strictly excludes terminal `DELIVERED` and `CANCELLED` statuses).
    4. **Unavailable Variants**: Count of exact `ProductVariant` rows with `isAvailable = false`.
  - Recent Orders Operational Table: Lists the 5 newest orders displaying order number (linking directly to `/admin/orders/[orderNumber]`), customer name, formatted date, payment method, grand total, and current status badge.
  - Strict V1 Metric Scope: Strictly zero numeric stock counts, inventory levels, or low-stock warning cards.

- **Product Admin UI**:
  - List & Filters: Server-side search (`search`), storefront filter (`storefront`), status filter (`status`), and deterministic pagination (`page`, `limit`). Strictly excludes unapproved columns (Featured toggles, numeric stock, hex swatches).
  - Creation Form: Enforces initial `DRAFT` status and automatically redirects to the editor upon creation. Normalizes SKU to uppercase and generates clean slugs.
  - Tabbed Editor Architecture:
    - _Details_: Edits core fields (name, slug, regularPrice, compareAtPrice, description, merchandising metadata).
    - _Sizes & Colors_: Supports product-specific size creation/deletion and manually entered color names. Hex code inputs, RGB pickers, and color swatches are strictly forbidden.
    - _Variants Matrix_: Manages exact Size + Color combinations with boolean availability toggles (`isAvailable = true/false`). Strictly avoids numeric stock inputs.
    - _Media_: Supports direct Cloudinary signed uploads with progress feedback, enforces maximum 8 images and 1 video, provides explicit controls for Main and Hover designations, and prevents deletion of the Main Image.
    - _Publication Gate_: Validates all publication prerequisites via backend validation, displaying clear diagnostic error messages if requirements are missing. Deletion of published or inactive products is strictly forbidden.

- **Order Admin UI**:
  - List & Filters: Server-side search (`search`), status filter (`status`), payment method filter (`paymentMethod`), and server pagination (`page`, `limit`). Internal idempotency keys are strictly hidden.
  - Detail Inspection: Displays immutable customer snapshot (name, email, phone), delivery address snapshot, item snapshot (with internal SKU visible Admin-only and text-only color), and financial summary.
  - Controlled Status Transitions:
    - Bank Transfer manual payment verification: `AWAITING_PAYMENT -> CONFIRMED`.
    - COD order confirmation: `ORDER_RECEIVED -> CONFIRMED`.
    - Production lifecycle: `CONFIRMED -> IN_PRODUCTION -> READY_TO_SHIP -> SHIPPED -> DELIVERED`.
    - Cancellation: Permitted prior to dispatch via accessible confirmation dialog.
  - Concurrency & Optimistic Handling: Disables transition controls during execution and handles concurrent state conflicts gracefully by refreshing authoritative data from the backend.

- **Review Admin UI**:
  - List & Filters: Server-side search (`q`), status filter (`status`), rating filter (`rating`), and server pagination.
  - Plain Text Rendering: Review text and reviewer names render strictly as plain React text strings with `whitespace-pre-wrap`. Zero `dangerouslySetInnerHTML`, HTML parsers, or Markdown interpreters.
  - Moderation Actions: `Approve` (`PENDING -> APPROVED`, `HIDDEN -> APPROVED`), `Hide` (`PENDING -> HIDDEN`, `APPROVED -> HIDDEN`), and permanent `Delete` with modal confirmation dialog. Transitioning back to `PENDING` is strictly disallowed.
  - Honest Presentation: Strictly avoids ungrounded claims of "Verified Purchase" or "Verified Buyer".

- **Storefronts & Settings Admin UI**:
  - Storefronts: Represents the 3 fixed storefronts (`Mini Sprouts`, `Teen Studio`, `Aura Studio`). Slides management includes modal creation/editing, drag-and-drop or sequential reordering with server persistence, activation toggles, and deletion with confirmation.
  - Settings: Modular management cards:
    - _Storefront Announcement Bar_: Text, link, and active toggle.
    - _Shipping_: Flat delivery charge per order (PKR) with strict prohibition of free-shipping thresholds or delivery timeframe customization.
    - _Manual Bank Transfer_: Bank name, account title, account/IBAN, branch code, branch location, and instructions, explicitly explaining the 4-field availability gate.
    - _Admin Order Notifications_: New order email toggle and operations recipient email address.
    - _Security & Deployment Boundary_: Clearly documents that Resend API keys, sending identities, and Cloudinary secrets are managed strictly through server deployment environment variables and never exposed in the UI.

- **Strict V1 Scope Exclusions**:
  - Strictly no customer directory, multi-admin, staff accounts, or public admin registration.
  - Strictly no analytics charts, CSV import/export, or bulk operations.
  - Strictly no numeric inventory counting, stock quantities, or low-stock alerts.
  - Strictly no hex color pickers, RGB swatches, or swatch image uploads.
  - Strictly no featured product toggles.
  - Strictly no custom delivery timeframe settings (10-day brand promise is fixed).
  - Strictly no online payment gateways, courier tracking integrations, customer cancellation, or receipt upload workflows.

- **Automated Verification**:
  - 10 backend integration tests in `apps/api/test/admin-dashboard.test.ts` verifying authentication/session guards, exact metric counts (totalProducts, totalOrders, activeOrders excluding terminal states, unavailableVariants), recent orders limit and payload shape, and exclusion of numeric stock or featured fields.
  - 51 frontend integration tests in `apps/web/test/admin-ui.test.tsx` verifying login form without signup, AdminShell navigation and active attributes, AdminGuard session resolution, AdminAuthProvider in-memory isolation, CSRF token acquisition and retry, force-dynamic layout configuration, 4 dashboard metric cards and recent orders table, product list/filters/pagination, product creation and tabbed editor, full core/garment/SEO metadata editing, backend SKU/slug normalization contract alignment, manual color names without hex, variant matrix with boolean availability, media management with main/hover controls, publication gate enforcement, order list and detail snapshots, controlled status transitions and cancellation, review moderation and plain text rendering, storefront hero slide management, settings sections and security boundaries, and independent save states.

## Deployment Architecture & Cross-Origin Configuration Boundary

- **Approved Target Platforms**:
  - **Frontend**: Vercel (`apps/web`, Next.js App Router).
  - **Backend**: Belmo (`apps/api`, Fastify REST API).
  - **Database**: PostgreSQL (Supabase).
  - **Media / CDN**: Cloudinary.
  - **Transactional Email**: Resend.

- **Production Hostnames Status**:
  - Final production and staging hostnames remain **Pending Client Input**.
  - No production domain names are hardcoded anywhere in the codebase or application configuration.
  - Any example hostnames previously cited are purely hypothetical.

- **Cookie & CORS Staging/Deployment Verification Requirements**:
  - Final cookie `Domain`, `SameSite`, or origin configurations must not be prescribed before the real production hostnames and network topology are confirmed.
  - Staging/deployment verification on the live Vercel and Belmo instances must specifically verify:
    1. **Vercel frontend origin**: Configured via `FRONTEND_URL` on the backend.
    2. **Belmo backend origin**: Configured via `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` on the frontend.
    3. **Exact credentialed CORS allowlist**: Fastify `@fastify/cors` configured with `credentials: true` and strict allowlisting.
    4. **HttpOnly session cookies**: Session cookies (`kw_admin_session`, `kw_customer_session`) inaccessible to client JavaScript.
    5. **Secure cookies in production**: `COOKIE_SECURE=true` enforced for HTTPS transmission.
    6. **Correct SameSite behavior**: `COOKIE_SAME_SITE` set to `lax` for same-site subdomains, or `none` (with `COOKIE_SECURE=true`) if separate top-level domains are utilized, adhering to the final origin topology.
    7. **CSRF behavior**: Correct verification of session-bound HMAC-SHA256 CSRF tokens across the deployed Vercel ↔ Belmo network boundary.

- **Deployment Verification Limitation**:
  - Production Vercel ↔ Belmo deployment, cross-origin/session-cookie behavior, CORS, and HTTPS environment configuration have not yet been verified on the real production/staging deployment.

## Security Review & Hardening Architecture (Work Unit 22)

- **Authentication & Session Boundary**:
  - **Role Separation**: Completely isolated authentication stacks and session stores for Admin (`AdminSession`) and Customer (`CustomerSession`). Admin credentials cannot authenticate customer routes; customer credentials cannot authenticate admin routes.
  - **Single Admin Model**: Strictly one Admin account in V1, provisioned via secure operations CLI (`pnpm admin:provision`). No public signup or registration routes exist for Admin.
  - **Credential Security**: Passwords are hashed server-side using Argon2id (`@node-rs/argon2`) configured according to OWASP guidelines (`m=65536, t=3, p=4`). Constant-time dummy verification is performed when an unknown account is supplied to eliminate account enumeration via timing attacks.
  - **Cryptographic Token Architecture**: 256-bit cryptographically secure random bearer tokens (`crypto.randomBytes(32)`). Only the SHA-256 hash (`tokenHash`) is persisted in PostgreSQL. Raw bearer tokens are never stored, logged, or returned in API JSON bodies.
  - **Session Cookies**: Dedicated cookies (`kw_admin_session`, `kw_customer_session`) configured with `HttpOnly`, `Path=/`, `SameSite=Lax` (or `None` when cross-origin with `Secure`), and `Secure` in production environments. Expired sessions are rejected server-side and automatically purged.
  - **Server-Side Revocation**: Logout endpoints (`POST /api/v1/admin/auth/logout`, `POST /api/v1/auth/logout`) atomically delete the session row from PostgreSQL, preventing session reuse even if a client retains the cookie.

- **Cross-Site Request Forgery (CSRF) Protection**:
  - **Session-Bound HMAC Tokens**: CSRF tokens are cryptographically derived via HMAC-SHA256 bound to the raw session token and application secret (`SESSION_SECRET`).
  - **Cryptographic Domain Separation**: Admin tokens use domain key `admin-csrf:`, while Customer tokens use domain key `customer-csrf:`. Cross-session or cross-role replay is cryptographically impossible.
  - **Header-Delivered Token Pattern**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require the `x-csrf-token` header, verified server-side against the caller's session token. Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) automatically bypass CSRF validation.

- **Cross-Origin Resource Sharing (CORS) Policy**:
  - Fastify `@fastify/cors` plugin strictly configured with `credentials: true`.
  - Allowed origin is driven by `env.FRONTEND_URL` (with local development regex matching permitted only in `development` mode).
  - Wildcard `*` origins are strictly prohibited when credentials are enabled.
  - Unauthorized origins are rejected by the CORS hook with an explicit policy violation error.

- **Authorization & IDOR / BOLA Prevention**:
  - Reusable Fastify preHandler guards (`requireAdmin`, `requireAdminCsrf`, `requireCustomer`, `requireCustomerCsrf`) enforce role-based access control.
  - **Customer Order Isolation**: `GET /api/v1/account/orders/:orderNumber` strictly scopes queries to `customerId === request.customer.id`. Requests for non-existent orders or orders belonging to another customer return a uniform, ownership-safe HTTP 404 (`ORDER_NOT_FOUND`) without disclosing order existence or buyer metadata.
  - **Public Guest Lookup Suppression**: No unauthenticated guest order inspection endpoint exists in V1.

- **Rate Limiting & Proxy Trust Boundary**:
  - Global Fastify rate limiter (`@fastify/rate-limit`) limits baseline API traffic to 100 requests per minute per IP.
  - Route-specific brute-force and abuse limits:
    - Admin login: 5 requests / 15 minutes.
    - Customer login: 5 requests / 15 minutes.
    - Customer registration: 5 requests / 15 minutes.
    - Review submission: 5 requests / 15 minutes.
    - Order creation: 10 requests / 15 minutes.
  - **Proxy Trust Configuration**: `TRUST_PROXY` in `apps/api/src/config/env.ts` defaults to `false`. When disabled, Fastify relies on the immediate socket connection IP, preventing attackers from bypassing rate limits by spoofing `X-Forwarded-For` headers. Must only be enabled when deployed behind a trusted reverse proxy (Belmo).
  - **Hermetic Testing Safety**: Localhost rate-limit exemptions are strictly constrained to non-production environments with explicit E2E flag (`env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"`), ensuring zero production bypass capability.

- **Media Upload Trust Boundaries & Validation**:
  - **Signed Direct Upload**: Cloudinary uploads use time-limited, server-signed signatures. Public IDs and destination folders are controlled entirely by the server (`kids-wear/products/<productId>/<fileId>` and `kids-wear/reviews/<submissionId>/<imageId>`). Client-supplied folders or public IDs are rejected.
  - **Independent Asset Verification**: Upon registration, the API verifies asset metadata directly with Cloudinary (format, resource type, dimensions, exact namespace matching).
  - **Upload Quotas & Invariants**: Products allow at most 8 images and 1 video (enforced with `SELECT ... FOR UPDATE` row locks). Video assets are strictly rejected from Main or Hover display roles. Reviews allow at most 3 images (JPEG, PNG, WebP only; video rejected).
  - **Secret Redaction**: Cloudinary API secret and signature parameters are never exposed to public endpoints or client settings responses.

- **Input Validation, Injection & Parameter Tampering**:
  - All incoming request bodies, queries, and route parameters are validated using strict Zod schemas (`.strict()` rejecting mass-assignment and over-posting).
  - Parameterized database operations through Prisma ORM prevent SQL injection attacks. Search queries are treated strictly as data literals.
  - Review comments and customer inputs are stored as verbatim plain text without HTML evaluation, preventing server-side template injection and persistent XSS.

- **HTTP Security Headers & Payload Boundaries**:
  - **Next.js (`apps/web/next.config.mjs`)**: Configured with strict security headers including Content Security Policy (`default-src 'self'`, `img-src 'self' data: res.cloudinary.com images.unsplash.com`, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
  - **Fastify (`apps/api/src/plugins/security.ts`)**: Helmet configured with `frameguard: { action: "deny" }` and `referrerPolicy: { policy: "strict-origin-when-cross-origin" }`.
  - **Global Payload Size Limit**: Fastify configured with `bodyLimit: 1048576` (1 MiB), preventing memory exhaustion and DoS via large request payloads.

- **Error Handling & Secret Leakage Prevention**:
  - Unhandled 500 errors return a standardized error envelope `{ "success": false, "error": { "code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred" } }`.
  - Prisma query details, database connection strings, stack traces, and internal server paths are never leaked in client-facing responses.
  - Safe navigation helper `getSafeNextUrl` rejects protocol-relative, absolute, or JavaScript scheme redirects.

- **Commerce & Moderation Integrity**:
  - Order lines, product prices, discounts, and delivery charges are recomputed authoritatively by the backend at checkout. Client-tampered money values or statuses are rejected.
  - Variant availability is re-verified at checkout; maximum line quantity is capped at 10.
  - Order status progression strictly enforces the approved state machine. Out-of-order jumps (e.g. directly to `DELIVERED`) are rejected.
  - Anonymous reviews are held in `PENDING` status. Public catalog queries return strictly `APPROVED` reviews. Moderation status transitions forbid setting a review back to `PENDING`.
  - Permanent review deletion requires Admin session authentication and session-bound CSRF token.

- **Automated Security Verification Suite (`apps/api/test/security.test.ts`)**:
  - 56 automated tests verifying authorization, IDOR/BOLA prevention, session lifecycle, token hashing, CSRF cryptographic domains, Argon2id parameters, input sanitization, SQLi resistance, CORS allowlists, security headers, upload namespaces, rate limiting, error leakage, commerce financial integrity, and review moderation.

## Informational & Policy Architecture (Work Unit 20)

- **Informational & Policy Route Tree**:
  - `/about`: Company overview, three storefront missions (Mini Sprouts 0–10Y, Teen Studio 11–16Y, Aura Studio 17+), business address in Attock, Pakistan, and restrained disclosure of expanding brand story. Strictly zero unconfirmed boutique, handcrafted, environmental, or unconfirmed manufacturing claims.
  - `/contact`: Official contact channels featuring telephone (`+92 335 0981 321`), email (`info@thekidswear.com`), and neutral business address (`Street-05, Darul Islam Colony, Attock, Pakistan`) with semantic `tel:` and `mailto:` links. Strictly zero fake contact forms, unapproved social/WhatsApp links, or physical retail showroom claims.
  - `/shipping-policy`: Comprehensive delivery policy explaining Pakistan-wide delivery, single flat delivery fee per order, request-time dynamic shipping charge retrieval from public Commerce Settings, delivery expected within 10 days commitment, and graceful fallback handling on API unavailability. Zero hardcoded shipping rates, zero invented status progressions (no SUBMITTED/PROCESSING diagrams), and zero unconfirmed manufacturing interpretations.
  - `/return-exchange-policy`: Transparent customer disclosure stating detailed return, exchange, and condition rules are currently being finalized by business leadership (Pending Client Input) and directing customers to direct support channels. Strictly zero invented return windows, refund restrictions, photo/video evidence mandates, damaged-item reporting deadlines, or guaranteed remedies.
  - `/privacy-policy`: Factual V1 data collection and architecture disclosures detailing order data, optional customer accounts, anonymous reviews, server-side Argon2id password hashing, server-managed sessions with secure HttpOnly cookies, client-side guest cart storage (`localStorage`), and infrastructure service providers (Vercel, Belmo, Supabase, Cloudinary, Resend). Strictly zero passwords in cookies, zero hardcoded SameSite values, zero generic card-storage claims, and zero unsupported marketing/profiling claims.
  - `/terms`: Operational terms of service governing storefront browsing, boolean variant availability (Available / Unavailable), cash on delivery (COD), manual bank transfer, customer address accuracy, review moderation, and optional accounts. Strictly zero out-of-stock wording, zero unapproved legal boilerplate, governing-law clauses, or arbitration provisions.
  - Global 404 (`apps/web/src/app/not-found.tsx`): Accessible not-found experience providing clear heading, explanation, link to home gateway, and direct links to all three age storefronts (`/mini-sprouts`, `/teen-studio`, `/aura-studio`) without route or stack leakage.

- **Dynamic vs. Static Policy Behavior**:
  - Shipping rate retrieval is dynamic (`export const dynamic = "force-dynamic"`, `{ cache: "no-store" }`) to ensure rate adjustments made in Admin Commerce Settings propagate immediately to the policy page without redeployment.
  - All other policy and informational pages are rendered cleanly via static React semantic markup without CMS dependencies or runtime HTML/Markdown parsing.
  - Zero `dangerouslySetInnerHTML` across all informational routes to eliminate XSS risks.

- **No CMS or Admin Policy Editor**:
  - Admin settings remain strictly focused on operational parameters (announcement bar, flat shipping rate, bank credentials, notification toggles). Policy content management via CMS is explicitly excluded from V1.

- **Automated Verification**:
  - 51 frontend integration tests in `apps/web/test/content-pages.test.tsx` verifying route presence, factual brand identity, contact markup, dynamic shipping rate fetching and fallbacks, honest disclosure of pending return rules, accurate privacy architecture, operational terms boundaries, custom 404 navigation, footer link resolution, and content security.

## End-to-End Integration Testing Architecture (Work Unit 21)

- **Isolated Testing Topology & Database Safety Guard**:
  - Dedicated local PostgreSQL database `kids_wear_e2e` runs completely isolated from development (`kids_wear_dev`) and production databases.
  - Guarded by `assertSafeE2eDatabaseUrl` in `apps/api/src/scripts/e2e-db-setup.ts`, strictly rejecting connection strings pointing to production hostnames, Supabase remote instances, or `kids_wear_dev`.
  - Global setup (`e2e/helpers/global-setup.ts`) executes idempotent Prisma migration deployment (`prisma migrate deploy`) and deterministic database baseline seeding (`seedE2eBaseline`) before test execution.

- **Dual Live Web Servers & Playwright Execution Model**:
  - Root `playwright.config.ts` launches both servers concurrently:
    - Fastify REST API on port 4000 (`tsx src/e2e-server.ts`) connecting to `kids_wear_e2e`.
    - Next.js Web on port 3000 (`next start --port 3000`) consuming the live Fastify API.
  - Sequential execution model (`workers: 1`) to guarantee deterministic database mutations across multi-step order and moderation flows.

- **External Service Test Doubles (Test Seams)**:
  - **Resend Transactional Email**: Replaced with `E2eMockEmailService` in `apps/api/src/e2e-server.ts`, recording notifications in-memory with diagnostic inspection endpoint `/api/v1/e2e/health`.
  - **Cloudinary Media Storage**: Replaced with `E2eMockCloudinaryService` in `apps/api/src/e2e-server.ts`, providing hermetic upload signatures and fixed Unsplash asset metadata without external network requests or API credentials.

- **Rate Limiting Hermetic Exemption**:
  - Strict login and review rate limiters exempt `127.0.0.1` and `localhost` only during hermetic E2E test runs (`process.env.E2E_TEST === "true"`), preventing artificial 429 throttling across repeated multi-test browser sessions while preserving full rate-limiting enforcement in production and unit tests.

- **Critical V1 User Journeys Coverage (34 Scenarios across 9 Test Files)**:
  1. `01-storefront-catalog.spec.ts`: Storefront gateway navigation, age studio catalog display, cross-storefront isolation, search query matching, and honest no-results state.
  2. `02-cart-and-variants.spec.ts`: Variant selection matrix, boolean availability gates, cart persistence across reload, quantity adjustment, and item removal.
  3. `03-checkout-orders.spec.ts`: End-to-end checkout for Cash on Delivery (COD) and Bank Transfer with dynamic banking details and order confirmation receipt numbers.
  4. `04-customer-account.spec.ts`: Customer registration, login, profile editing, and customer order history navigation.
  5. `05-admin-portal.spec.ts`: Single-admin login, product catalog, tabbed product creation, size/color options, variant matrix toggles, signed media upload, publication gate enforcement, and secure logout.
  6. `06-admin-orders-lifecycle.spec.ts`: COD order progression through full lifecycle (`ORDER_RECEIVED` -> `CONFIRMED` -> `IN_PRODUCTION` -> `READY_TO_SHIP` -> `SHIPPED` -> `DELIVERED`), Bank Transfer payment verification (`AWAITING_PAYMENT` -> `CONFIRMED`), and pre-shipment order cancellation with dialog confirmation.
  7. `07-reviews-moderation.spec.ts`: Anonymous review submission with HTML markup characters, moderation queue, admin approval, public plain-text rendering (verifying zero unescaped HTML tag insertion), and admin hide action.
  8. `08-settings-and-hero.spec.ts`: Dynamic flat shipping fee updates propagating to Checkout while preserving historical order totals, bank details updates propagating to Checkout, and announcement bar toggles reflecting across all storefronts.
  9. `09-mobile-flow.spec.ts`: End-to-end shopping and checkout journey tested under Pixel 7 mobile viewport emulation.

- **Integration Defects Identified & Resolved during E2E Testing**:
  1. _Fastify Prisma DB Caching_: Default `DATABASE_URL` was cached on first read; resolved via dynamic `setPrismaClient` in `e2e-server.ts` to enforce connection to `kids_wear_e2e`.
  2. _Checkout Customer Payload Validation_: Next.js `normalizeCheckoutFormData` attached extraneous `paymentMethod` to the customer object, violating the backend `.strict()` schema; stripped `paymentMethod` from the customer payload.
  3. _Customer Session Cookie Propagation_: Next.js `createOrder` API helper omitted `credentials: "include"`, causing authenticated customer orders to be treated as guest orders; added `credentials: "include"`.
  4. _Hermetic Route Rate Limiting in E2E Runs_: In-process rate limits on admin auth, customer auth, and reviews caused test runs to hit 429 limits after repeated logins; resolved via hermetic `E2E_TEST` localhost exemption.
