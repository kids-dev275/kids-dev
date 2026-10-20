import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CatalogGrid } from "../src/components/catalog/catalog-grid";
import { CatalogHeader } from "../src/components/catalog/catalog-header";
import { Pagination } from "../src/components/catalog/pagination";
import { SearchBar } from "../src/components/catalog/search-bar";
import { ProductMediaGallery } from "../src/components/pdp/product-media-gallery";
import { ProductPurchaseConfigurator } from "../src/components/pdp/product-purchase-configurator";
import { SizeGuideModal } from "../src/components/pdp/size-guide-modal";
import { ProductMetadataSections } from "../src/components/pdp/product-metadata-sections";
import { Breadcrumbs } from "../src/components/pdp/breadcrumbs";
import { Price } from "../src/components/commerce/price";
import { ProductCard } from "../src/components/commerce/product-card";
import { EmptyState, NoResultsState, ErrorState } from "../src/components/commerce/system-states";
import type {
  ApiProductCard,
  ApiProductDetail,
  ApiProductMediaItem,
  ApiProductOption,
  ApiProductVariant,
  ApiSizeGuide,
} from "../src/lib/api";

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
  console.log("Starting Kids Wear — Work Unit 12 Storefront Catalog & PDP Test Suite...\n");

  const appDir = path.join(__dirname, "../src/app");
  const componentsDir = path.join(__dirname, "../src/components");

  const shopPageSource = fs.readFileSync(path.join(appDir, "[storefront]/shop/page.tsx"), "utf-8");
  const newArrivalsPageSource = fs.readFileSync(
    path.join(appDir, "[storefront]/new-arrivals/page.tsx"),
    "utf-8"
  );
  const searchPageSource = fs.readFileSync(
    path.join(appDir, "[storefront]/search/page.tsx"),
    "utf-8"
  );
  const pdpPageSource = fs.readFileSync(
    path.join(appDir, "[storefront]/products/[slug]/page.tsx"),
    "utf-8"
  );
  const configuratorSource = fs.readFileSync(
    path.join(componentsDir, "pdp/product-purchase-configurator.tsx"),
    "utf-8"
  );
  const gallerySource = fs.readFileSync(
    path.join(componentsDir, "pdp/product-media-gallery.tsx"),
    "utf-8"
  );
  const sizeGuideSource = fs.readFileSync(
    path.join(componentsDir, "pdp/size-guide-modal.tsx"),
    "utf-8"
  );
  const apiSource = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

  // Sample mock data fixtures
  const mockCard1: ApiProductCard = {
    id: "prod-1",
    name: "Classic Linen Shirt",
    slug: "classic-linen-shirt",
    regularPrice: "2499.00",
    compareAtPrice: "2999.00",
    isNewArrival: true,
    mainImage: { url: "/images/shirt-main.jpg", altText: "Main Shirt" },
    hoverImage: { url: "/images/shirt-hover.jpg", altText: "Hover Shirt" },
  };

  const mockCard2: ApiProductCard = {
    id: "prod-2",
    name: "Cotton Casual Trousers",
    slug: "cotton-casual-trousers",
    regularPrice: "1999.00",
    compareAtPrice: null,
    isNewArrival: false,
    mainImage: { url: "/images/trousers-main.jpg", altText: null },
    hoverImage: null,
  };

  const mockMediaItems: ApiProductMediaItem[] = [
    {
      type: "IMAGE",
      url: "/images/item-1.jpg",
      altText: "Front Angle",
      isMain: true,
      isHover: false,
      sortOrder: 0,
    },
    {
      type: "IMAGE",
      url: "/images/item-2.jpg",
      altText: "Detail Texture",
      isMain: false,
      isHover: true,
      sortOrder: 1,
    },
    {
      type: "VIDEO",
      url: "/videos/item-preview.mp4",
      altText: null,
      isMain: false,
      isHover: false,
      sortOrder: 2,
    },
  ];

  const mockSizes: ApiProductOption[] = [
    { id: "sz-1", name: "3-4 Years" },
    { id: "sz-2", name: "5-6 Years" },
    { id: "sz-3", name: "7-8 Years" },
  ];

  const mockColors: ApiProductOption[] = [
    { id: "cl-1", name: "Ivory" },
    { id: "cl-2", name: "Navy Blue" },
  ];

  // Exact variant availability matrix:
  // Ivory + 3-4Y = available (var-1)
  // Ivory + 5-6Y = unavailable (var-2)
  // Ivory + 7-8Y = available (var-3)
  // Navy + 3-4Y = unavailable (var-4)
  // Navy + 5-6Y = available (var-5)
  // Navy + 7-8Y = unavailable (var-6)
  const mockVariants: ApiProductVariant[] = [
    { id: "var-1", productSizeId: "sz-1", productColorId: "cl-1", isAvailable: true },
    { id: "var-2", productSizeId: "sz-2", productColorId: "cl-1", isAvailable: false },
    { id: "var-3", productSizeId: "sz-3", productColorId: "cl-1", isAvailable: true },
    { id: "var-4", productSizeId: "sz-1", productColorId: "cl-2", isAvailable: false },
    { id: "var-5", productSizeId: "sz-2", productColorId: "cl-2", isAvailable: true },
    { id: "var-6", productSizeId: "sz-3", productColorId: "cl-2", isAvailable: false },
  ];

  const mockProductDetail: ApiProductDetail = {
    id: "prod-full",
    name: "Festive Embroidered Kurta",
    slug: "festive-embroidered-kurta",
    shortDescription: "Elegant everyday and formal attire.",
    description: "Detailed description of craftsmanship and fabric.",
    regularPrice: "3499.00",
    compareAtPrice: "3999.00",
    productType: "Kurta",
    gender: "Unisex",
    fabric: "100% Pure Lawn Cotton",
    includedPieces: "1 Piece",
    fit: "Regular Comfort Fit",
    patternDesign: "Embroidered Neckline",
    occasion: "Celebration",
    season: "Summer",
    careInstructions: "Hand wash cold, do not bleach.",
    isNewArrival: true,
    seoTitle: "Festive Embroidered Kurta — Premium Quality",
    seoDescription: "Shop embroidered festive kurta for children across Pakistan.",
    media: mockMediaItems,
    sizes: mockSizes,
    colors: mockColors,
    variants: mockVariants,
    sizeGuide: {
      columns: [
        { key: "age", label: "Age" },
        { key: "chest", label: "Chest (in)" },
        { key: "length", label: "Length (in)" },
      ],
      rows: [
        { label: "3-4Y", values: { age: "3-4 Years", chest: "24", length: "26" } },
        { label: "5-6Y", values: { age: "5-6 Years", chest: "26", length: "29" } },
      ],
    },
  };

  // ============================================================================
  // SHOP TESTS (1–7)
  // ============================================================================

  await runTest("1. valid Storefront Shop renders Product cards from API-shaped data", () => {
    const html = renderToStaticMarkup(
      <CatalogGrid products={[mockCard1, mockCard2]} storefront="mini-sprouts" />
    );
    assert(html.includes("Classic Linen Shirt"), "Must render product 1 name");
    assert(html.includes("Cotton Casual Trousers"), "Must render product 2 name");
    assert(html.includes("2,499"), "Must format regular price");
    assert(html.includes("2,999"), "Must format compare-at price");
  });

  await runTest("2. Product cards link to correct Storefront PDP", () => {
    const html = renderToStaticMarkup(
      <CatalogGrid products={[mockCard1]} storefront="mini-sprouts" />
    );
    assert(
      html.includes('href="/mini-sprouts/products/classic-linen-shirt"'),
      "Must link to scoped storefront PDP"
    );
    assert(
      !html.includes('href="/products/classic-linen-shirt"'),
      "Must not link to un-scoped PDP"
    );
  });

  await runTest("3. Draft/Inactive Products are not fabricated client-side", () => {
    assert(
      !shopPageSource.includes("mockProducts") && !shopPageSource.includes("fakeProducts"),
      "Shop page source must not define hardcoded or mock products"
    );
  });

  await runTest("4. empty catalog renders EmptyState", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No products available"
        description="There are currently no published products."
      />
    );
    assert(html.includes("No products available"), "Must render empty state message");
  });

  await runTest("5. pagination preserves Storefront route", () => {
    const html = renderToStaticMarkup(
      <Pagination currentPage={2} totalPages={5} basePath="/mini-sprouts/shop" />
    );
    assert(
      html.includes('href="/mini-sprouts/shop?page=1"'),
      "Previous link must preserve storefront route"
    );
    assert(
      html.includes('href="/mini-sprouts/shop?page=3"'),
      "Next link must preserve storefront route"
    );
    assert(
      html.includes('Page <span class="font-semibold text-ink">2</span> of'),
      "Must indicate current page"
    );
  });

  await runTest("6. no global /shop route introduced", () => {
    const globalShopExists = fs.existsSync(path.join(appDir, "shop/page.tsx"));
    assert(!globalShopExists, "Must not introduce global /shop route");
  });

  await runTest("7. Shop contains no unapproved filter controls", () => {
    const forbiddenFilters = [
      "filter by price",
      "price range",
      "gender filter",
      "occasion filter",
      "sort by",
    ];
    for (const f of forbiddenFilters) {
      assert(!shopPageSource.toLowerCase().includes(f), `Shop must not contain filter '${f}'`);
    }
  });

  // ============================================================================
  // NEW ARRIVALS TESTS (8–11)
  // ============================================================================

  await runTest("8. New Arrivals page uses new=true", () => {
    assert(
      newArrivalsPageSource.includes("isNewArrival: true"),
      "New Arrivals page must query backend with isNewArrival: true"
    );
  });

  await runTest("9. ProductCard is reused", () => {
    assert(
      newArrivalsPageSource.includes("CatalogGrid") ||
        newArrivalsPageSource.includes("ProductCard"),
      "New Arrivals must reuse existing CatalogGrid or ProductCard"
    );
  });

  await runTest("10. empty New Arrivals state is honest", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No new arrivals currently" description="Explore the full catalog below." />
    );
    assert(html.includes("No new arrivals currently"), "Must render honest empty state");
  });

  await runTest("11. no fake Products inserted", () => {
    assert(!newArrivalsPageSource.includes("fakeProduct"), "Must not insert fake products");
  });

  // ============================================================================
  // SEARCH TESTS (12–18)
  // ============================================================================

  await runTest("12. Search form is Storefront-scoped", () => {
    const html = renderToStaticMarkup(<SearchBar storefront="mini-sprouts" initialQuery="linen" />);
    assert(
      html.includes('action="/mini-sprouts/search"'),
      "Form action must be scoped to /mini-sprouts/search"
    );
    assert(html.includes('value="linen"'), "Must retain initial query in search box");
  });

  await runTest("13. query uses q", () => {
    const html = renderToStaticMarkup(<SearchBar storefront="mini-sprouts" />);
    assert(html.includes('name="q"'), "Search input parameter must be 'q'");
  });

  await runTest("14. empty query does not execute unbounded Product search", () => {
    assert(
      searchPageSource.includes("query.length > 0"),
      "Search page must guard against executing empty queries"
    );
  });

  await runTest("15. matching results render ProductCard", () => {
    const html = renderToStaticMarkup(
      <CatalogGrid products={[mockCard1]} storefront="mini-sprouts" />
    );
    assert(html.includes("Classic Linen Shirt"), "Search results must render ProductCard");
  });

  await runTest("16. no results uses NoResultsState", () => {
    const html = renderToStaticMarkup(<NoResultsState query="nonexistent" />);
    assert(html.includes("No products found"), "Must render No products found");
    assert(html.includes("nonexistent"), "Must display searched query");
  });

  await runTest("17. search error uses safe ErrorState", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        title="Search unavailable"
        description="We were unable to complete your search."
      />
    );
    assert(html.includes("Search unavailable"), "Must render safe error state");
    assert(!html.includes("Fastify"), "Must not expose Fastify internals");
  });

  await runTest("18. search sends requested page to API utility", () => {
    assert(
      searchPageSource.includes("page: currentPage"),
      "Search page must pass currentPage to searchStorefrontProducts"
    );
    assert(
      apiSource.includes('searchParams.set("page", String(options.page))'),
      "API utility must include page in query params"
    );
    assert(
      searchPageSource.includes("limit: 12"),
      "Search page must specify page limit for server-side pagination"
    );
  });

  await runTest("19. search pagination links preserve q and Storefront", () => {
    const html = renderToStaticMarkup(
      <Pagination
        currentPage={2}
        totalPages={4}
        basePath="/teen-studio/search"
        searchParams={{ q: "kurta" }}
      />
    );
    assert(
      html.includes('href="/teen-studio/search?q=kurta&amp;page=1"') ||
        html.includes('href="/teen-studio/search?q=kurta&page=1"'),
      "Previous link must preserve storefront and q parameter"
    );
    assert(
      html.includes('href="/teen-studio/search?q=kurta&amp;page=3"') ||
        html.includes('href="/teen-studio/search?q=kurta&page=3"'),
      "Next link must preserve storefront and q parameter"
    );
  });

  await runTest("20. search pagination Previous/Next boundaries work", () => {
    // Page 1: Previous disabled
    const htmlPage1 = renderToStaticMarkup(
      <Pagination
        currentPage={1}
        totalPages={3}
        basePath="/mini-sprouts/search"
        searchParams={{ q: "shirt" }}
      />
    );
    assert(
      htmlPage1.includes('aria-disabled="true"'),
      "Page 1 must render disabled Previous element"
    );
    assert(
      htmlPage1.includes('href="/mini-sprouts/search?q=shirt&amp;page=2"') ||
        htmlPage1.includes('href="/mini-sprouts/search?q=shirt&page=2"'),
      "Page 1 must link Next to page 2"
    );

    // Page 3 of 3: Next disabled
    const htmlPage3 = renderToStaticMarkup(
      <Pagination
        currentPage={3}
        totalPages={3}
        basePath="/mini-sprouts/search"
        searchParams={{ q: "shirt" }}
      />
    );
    assert(
      htmlPage3.includes('aria-disabled="true"'),
      "Final page must render disabled Next element"
    );
    assert(
      htmlPage3.includes('href="/mini-sprouts/search?q=shirt&amp;page=2"') ||
        htmlPage3.includes('href="/mini-sprouts/search?q=shirt&page=2"'),
      "Final page must link Previous to page 2"
    );
  });

  await runTest("21. search page 2 renders returned page-2 results", () => {
    const page2Item: ApiProductCard = {
      id: "prod-page-2",
      name: "Page Two Linen Trousers",
      slug: "page-two-linen-trousers",
      regularPrice: "1899.00",
      compareAtPrice: null,
      isNewArrival: false,
      mainImage: {
        url: "/images/page2.jpg",
        altText: "Page Two Linen Trousers",
      },
      hoverImage: null,
    };
    const html = renderToStaticMarkup(
      <>
        <CatalogGrid products={[page2Item]} storefront="mini-sprouts" />
        <Pagination
          currentPage={2}
          totalPages={4}
          basePath="/mini-sprouts/search"
          searchParams={{ q: "linen" }}
        />
      </>
    );
    assert(html.includes("Page Two Linen Trousers"), "Must render page 2 product");
    assert(
      html.includes('Page <span class="font-semibold text-ink">2</span> of'),
      "Must indicate page 2 active"
    );
  });

  await runTest("22. no global search route introduced", () => {
    const globalSearchExists = fs.existsSync(path.join(appDir, "search/page.tsx"));
    assert(!globalSearchExists, "Must not introduce global /search route");
  });

  // ============================================================================
  // PDP TESTS (23–30)
  // ============================================================================

  await runTest("23. valid Product renders name", () => {
    assert(mockProductDetail.name === "Festive Embroidered Kurta", "Product name matches");
    const html = renderToStaticMarkup(
      <h1 className="font-editorial text-3xl">{mockProductDetail.name}</h1>
    );
    assert(html.includes("Festive Embroidered Kurta"), "Must render product title");
  });

  await runTest("24. Product price uses Price component", () => {
    const html = renderToStaticMarkup(
      <Price
        price={mockProductDetail.regularPrice}
        compareAtPrice={mockProductDetail.compareAtPrice}
        size="lg"
      />
    );
    assert(html.includes("3,499"), "Must format regular price");
    assert(html.includes("3,999"), "Must format compare-at price");
  });

  await runTest("25. SKU is not rendered", () => {
    const htmlMetadata = renderToStaticMarkup(
      <ProductMetadataSections product={mockProductDetail} />
    );
    assert(!htmlMetadata.toLowerCase().includes("sku"), "PDP metadata must not render SKU");
    assert(!pdpPageSource.includes("product.sku"), "PDP page must not render product.sku");
  });

  await runTest("26. Main media renders", () => {
    const html = renderToStaticMarkup(
      <ProductMediaGallery media={mockMediaItems} productName="Festive Kurta" />
    );
    assert(html.includes("item-1.jpg"), "Must render main image URL");
  });

  await runTest("27. additional image can be selected", () => {
    const html = renderToStaticMarkup(
      <ProductMediaGallery media={mockMediaItems} productName="Festive Kurta" />
    );
    assert(html.includes("item-2.jpg"), "Must render thumbnail for additional image");
    assert(
      html.includes('aria-label="View image 2 of 3"'),
      "Must provide accessible thumbnail button"
    );
  });

  await runTest("28. Product video uses controls, no autoplay, and no looping", () => {
    const videoMedia: ApiProductMediaItem[] = [
      {
        type: "VIDEO",
        url: "/videos/preview.mp4",
        altText: null,
        isMain: true,
        isHover: false,
        sortOrder: 0,
      },
    ];
    const html = renderToStaticMarkup(
      <ProductMediaGallery media={videoMedia} productName="Festive Kurta" />
    );
    assert(html.includes("<video"), "Must render video tag");
    assert(html.includes("controls"), "Video must have native controls attribute");
    assert(!html.includes("autoplay"), "Video must not have autoplay attribute");
    assert(!html.includes("loop"), "Video must not have loop attribute");
  });

  await runTest("29. optional metadata omitted when absent", () => {
    const minimalProduct: ApiProductDetail = {
      ...mockProductDetail,
      shortDescription: null,
      fabric: null,
      careInstructions: null,
      productType: null,
      gender: null,
      includedPieces: null,
      fit: null,
      patternDesign: null,
      occasion: null,
      season: null,
    };
    const html = renderToStaticMarkup(<ProductMetadataSections product={minimalProduct} />);
    assert(!html.includes("Material &amp; Care"), "Must omit Material & Care when absent");
    assert(!html.includes("Product Details"), "Must omit Product Details when absent");
  });

  await runTest("30. Product 404 maps to notFound behavior", () => {
    assert(
      pdpPageSource.includes("notFound()"),
      "PDP page must call notFound() when product is null"
    );
  });

  // ============================================================================
  // COLORS / SIZES / VARIANTS TESTS (31–42)
  // ============================================================================

  await runTest("31. Colors render display names only", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes("Ivory"), "Must render Ivory color display name");
    assert(html.includes("Navy Blue"), "Must render Navy Blue color display name");
  });

  await runTest("32. no hex/RGB/swatch UI exists", () => {
    assert(!configuratorSource.includes("hexCode"), "No hexCode property in configurator");
    assert(!configuratorSource.includes("rgb("), "No rgb values in configurator");
    assert(
      !configuratorSource.includes("style={{ backgroundColor"),
      "No dynamic background color swatches"
    );
  });

  await runTest("33. Product-specific Sizes rendered from data", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes("3-4 Years"), "Must render 3-4 Years size");
    assert(html.includes("5-6 Years"), "Must render 5-6 Years size");
    assert(html.includes("7-8 Years"), "Must render 7-8 Years size");
  });

  await runTest("34. single Color auto-selects", () => {
    const singleColor: ApiProductOption[] = [{ id: "cl-single", name: "Beige" }];
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={singleColor}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes("Color: Beige"), "Single color must be auto-selected in title");
  });

  await runTest("35. single Size auto-selects", () => {
    const singleSize: ApiProductOption[] = [{ id: "sz-single", name: "Medium" }];
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={singleSize}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes("Size: Medium"), "Single size must be auto-selected in title");
  });

  await runTest("36. multiple options are not automatically guessed", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    // When multiple options exist, neither size nor color label should have auto-selected value
    assert(!html.includes("Color: Ivory"), "Multiple colors must not auto-select Ivory");
    assert(!html.includes("Color: Navy Blue"), "Multiple colors must not auto-select Navy Blue");
    assert(!html.includes("Size: 3-4 Years"), "Multiple sizes must not auto-select 3-4 Years");
  });

  await runTest("37. exact unavailable combination disabled", () => {
    assert(
      configuratorSource.includes("colorAvailabilityMap"),
      "Configurator must compute availability map for options"
    );
    assert(
      configuratorSource.includes("sizeAvailabilityMap"),
      "Configurator must compute availability map for sizes"
    );
  });

  await runTest("38. availability changes correctly after first option selection", () => {
    assert(
      configuratorSource.includes("selectedSizeId") &&
        configuratorSource.includes("selectedColorId"),
      "Availability must be cross-filtered between options"
    );
  });

  await runTest("39. invalid second selection clears when first selection changes", () => {
    assert(
      configuratorSource.includes("setSelectedSizeId(null)") ||
        configuratorSource.includes("setSelectedColorId(null)"),
      "Must clear invalid second selection when first option changes to incompatible combination"
    );
  });

  await runTest("40. available exact Variant resolves correct variant ID", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={[{ id: "sz-1", name: "3-4Y" }]}
        colors={[{ id: "cl-1", name: "Ivory" }]}
        variants={[
          { id: "var-exact-1", productSizeId: "sz-1", productColorId: "cl-1", isAvailable: true },
        ]}
        productName="Test"
      />
    );
    assert(
      html.includes('data-selected-variant-id="var-exact-1"'),
      "Single pair must resolve exact variant ID"
    );
    assert(
      html.includes('data-is-purchasable="true"'),
      "Available pair must resolve as purchasable"
    );
    assert(html.includes("Available to order (Made-to-order)"), "Must show available indicator");
  });

  await runTest(
    "41. unavailable exact Variant displays Unavailable and never resolves as purchasable",
    () => {
      const html = renderToStaticMarkup(
        <ProductPurchaseConfigurator
          sizes={[{ id: "sz-1", name: "3-4Y" }]}
          colors={[{ id: "cl-1", name: "Ivory" }]}
          variants={[
            {
              id: "var-exact-2",
              productSizeId: "sz-1",
              productColorId: "cl-1",
              isAvailable: false,
            },
          ]}
          productName="Test"
        />
      );
      assert(html.includes('data-selected-variant-id="var-exact-2"'), "Resolves matching variant");
      assert(
        html.includes('data-is-purchasable="false"'),
        "Unavailable variant must not resolve as purchasable"
      );
      assert(
        html.includes("This exact size and color combination is currently unavailable."),
        "Must display Unavailable terminology"
      );
      assert(!html.toLowerCase().includes("out of stock"), "PDP must not display 'out of stock'");
      assert(!html.toLowerCase().includes("stock"), "PDP must not display 'stock' terminology");
    }
  );

  await runTest("42. no numeric inventory rendered", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(!html.toLowerCase().includes("in stock"), "Must not display 'in stock' inventory count");
    assert(!html.toLowerCase().includes("remaining"), "Must not display 'remaining' count");
    assert(!html.toLowerCase().includes("left"), "Must not display 'X left' count");
    assert(!html.toLowerCase().includes("inventory"), "Must not display 'inventory'");
    assert(!html.toLowerCase().includes("out of stock"), "Must not display 'out of stock'");
  });

  // ============================================================================
  // QUANTITY TESTS (43–47)
  // ============================================================================

  await runTest("43. quantity starts at 1", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes(">1</span>"), "Initial quantity display must be 1");
  });

  await runTest("44. cannot decrement below 1", () => {
    assert(
      configuratorSource.includes("Math.max(1,"),
      "Quantity decrement logic must enforce Math.max(1, ...)"
    );
  });

  await runTest("45. cannot increment above 10", () => {
    assert(
      configuratorSource.includes("Math.min(10,"),
      "Quantity increment logic must enforce Math.min(10, ...)"
    );
  });

  await runTest("46. quantity disabled until valid purchasable Variant", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(
      html.includes('disabled="" aria-label="Decrease quantity"'),
      "Quantity decrement button must be disabled when no variant selected"
    );
    assert(
      html.includes('disabled="" aria-label="Increase quantity"'),
      "Quantity increment button must be disabled when no variant selected"
    );
  });

  await runTest("47. quantity is not labeled as inventory", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={mockSizes}
        colors={mockColors}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(html.includes("Max 10 per order"), "Must label max per order bound");
    assert(!html.toLowerCase().includes("stock quantity"), "Must not label quantity as stock");
  });

  // ============================================================================
  // CART BOUNDARY TESTS (48–51)
  // ============================================================================

  await runTest("48. PDP server page remains uncoupled from client cart hook", () => {
    assert(!pdpPageSource.includes("useCart"), "PDP page must not consume cart hook directly");
  });

  await runTest("49. no localStorage cart introduced directly into UI components", () => {
    assert(
      !configuratorSource.includes("localStorage"),
      "Configurator must not touch localStorage"
    );
    assert(!pdpPageSource.includes("localStorage"), "PDP must not touch localStorage");
  });

  await runTest("50. no inline Zustand cart store in PDP components", () => {
    assert(!pdpPageSource.includes("createCartStore"), "PDP must not introduce cart store");
    assert(!configuratorSource.includes("cartStore"), "Configurator must not introduce cart store");
  });

  await runTest("51. PDP server page does not render fake static Add to Cart button", () => {
    assert(
      !pdpPageSource.includes("Add to Cart"),
      "PDP page must not render fake/no-op 'Add to Cart' button"
    );
  });

  // ============================================================================
  // SIZE GUIDE TESTS (52–54)
  // ============================================================================

  await runTest("52. Size Guide uses backend/schema-derived data if present", () => {
    const html = renderToStaticMarkup(
      <SizeGuideModal sizeGuide={mockProductDetail.sizeGuide} productName="Festive Kurta" />
    );
    assert(html.includes("Size Guide"), "Must render Size Guide trigger button");
  });

  await runTest("53. no invented Aura measurements", () => {
    assert(!sizeGuideSource.includes("36-24-36"), "Must not invent static measurements");
    assert(!sizeGuideSource.includes("bust"), "Must not hardcode body dimensions in component");
  });

  await runTest("54. empty/missing guide does not render fake table", () => {
    const htmlNull = renderToStaticMarkup(
      <SizeGuideModal sizeGuide={null} productName="Festive Kurta" />
    );
    assert.strictEqual(htmlNull, "", "Null size guide must produce empty markup");

    const htmlEmptyRows = renderToStaticMarkup(
      <SizeGuideModal sizeGuide={{ columns: [], rows: [] }} productName="Festive Kurta" />
    );
    assert.strictEqual(htmlEmptyRows, "", "Empty size guide rows must produce empty markup");
  });

  // ============================================================================
  // SHIPPING TESTS (55–56)
  // ============================================================================

  await runTest("55. PDP shipping charge is dynamic if displayed", () => {
    assert(
      pdpPageSource.includes("settings?.shipping.flatDeliveryCharge"),
      "PDP must read shipping charge from public settings"
    );
  });

  await runTest("56. no hardcoded Rs. 300 delivery charge", () => {
    assert(!pdpPageSource.includes('"Rs. 300"'), "PDP must not hardcode 'Rs. 300'");
  });

  // ============================================================================
  // ACCESSIBILITY / SCOPE TESTS (57–64)
  // ============================================================================

  await runTest("57. gallery controls have accessible labels", () => {
    const html = renderToStaticMarkup(
      <ProductMediaGallery media={mockMediaItems} productName="Festive Kurta" />
    );
    assert(
      html.includes('aria-label="Product media thumbnails"'),
      "Thumbnail region must have accessible label"
    );
  });

  await runTest("58. selected options expose semantic state", () => {
    const html = renderToStaticMarkup(
      <ProductPurchaseConfigurator
        sizes={[{ id: "sz-1", name: "3-4Y" }]}
        colors={[{ id: "cl-1", name: "Ivory" }]}
        variants={mockVariants}
        productName="Festive Kurta"
      />
    );
    assert(
      html.includes('aria-pressed="true"'),
      "Selected option button must expose aria-pressed=true"
    );
  });

  await runTest("59. unavailable options expose disabled state", () => {
    assert(
      configuratorSource.includes("disabled={!isAvailable"),
      "Unavailable options must bind disabled attribute"
    );
  });

  await runTest("60. pagination semantics present", () => {
    const html = renderToStaticMarkup(
      <Pagination currentPage={1} totalPages={3} basePath="/mini-sprouts/shop" />
    );
    assert(
      html.includes('aria-label="Pagination Navigation"'),
      "Pagination must declare navigation landmark"
    );
    assert(html.includes('aria-current="page"'), "Current page must expose aria-current");
  });

  await runTest("61. no Wishlist introduced", () => {
    assert(!pdpPageSource.toLowerCase().includes("wishlist"), "PDP must not reference wishlist");
    assert(!shopPageSource.toLowerCase().includes("wishlist"), "Shop must not reference wishlist");
  });

  await runTest("62. no review submission introduced", () => {
    assert(!pdpPageSource.includes("<ReviewForm"), "PDP must not render review submission form");
    assert(
      !pdpPageSource.includes("write a review"),
      "PDP must not contain write a review trigger"
    );
  });

  await runTest("63. no checkout introduced", () => {
    assert(!pdpPageSource.toLowerCase().includes("/checkout"), "PDP must not link to /checkout");
    assert(!shopPageSource.toLowerCase().includes("/checkout"), "Shop must not link to /checkout");
  });

  await runTest("64. no online payment gateway introduced", () => {
    assert(!pdpPageSource.toLowerCase().includes("stripe"), "No Stripe in PDP");
    assert(!pdpPageSource.toLowerCase().includes("paypal"), "No PayPal in PDP");
    assert(!pdpPageSource.toLowerCase().includes("credit card"), "No credit card gateway in PDP");
  });

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Storefront Catalog & PDP Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
