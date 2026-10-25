import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminGuard } from "../src/components/admin/admin-guard";
import { AdminShell } from "../src/components/admin/admin-shell";
import { ProductVideoFrameDialog } from "../src/components/admin/product-video-frame-dialog";
import { AdminAuthProvider, useAdminAuth } from "../src/lib/admin-auth-context";
import * as AdminApi from "../src/lib/admin-api";
import {
  ORDER_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  PAYMENT_METHODS,
  type OrderStatusType,
  type PaymentMethodType,
  type ReviewStatusType,
} from "@kids-wear/shared";

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    console.error(`  ❌ ${name}: ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Fixtures
// ---------------------------------------------------------------------------

const MOCK_ADMIN_USER: AdminApi.AdminUser = {
  id: "a1111111-1111-4111-8111-111111111111",
  email: "admin@kidswear.local",
};

const MOCK_DASHBOARD_DATA = {
  totalProducts: 42,
  totalOrders: 150,
  activeOrders: 18,
  unavailableVariants: 7,
  recentOrders: [
    {
      orderNumber: "KW-1045",
      createdAt: "2026-10-18T10:00:00.000Z",
      customerName: "Zainab Bibi",
      status: "ORDER_RECEIVED" as OrderStatusType,
      statusLabel: "Order Received",
      paymentMethod: "CASH_ON_DELIVERY" as PaymentMethodType,
      grandTotal: "3200.00",
    },
    {
      orderNumber: "KW-1044",
      createdAt: "2026-10-18T09:30:00.000Z",
      customerName: "Hamza Khan",
      status: "AWAITING_PAYMENT" as OrderStatusType,
      statusLabel: "Awaiting Payment",
      paymentMethod: "BANK_TRANSFER" as PaymentMethodType,
      grandTotal: "5400.00",
    },
  ],
};

const MOCK_PRODUCT: AdminApi.AdminProductDetail = {
  id: "prod-1234",
  name: "Embroidered Cotton Kurta",
  sku: "ECK-001",
  slug: "embroidered-cotton-kurta",
  storefrontId: "sf-mini-sprouts",
  regularPrice: "2950.00",
  compareAtPrice: "3500.00",
  status: "DRAFT",
  isNewArrival: true,
  description: "Finely stitched premium cotton kurta for festive wear.",
  shortDescription: "Premium cotton kurta.",
  productType: "Kurta",
  gender: "Boys",
  fabric: "100% Breathable Lawn Cotton",
  includedPieces: "1-Piece Kurta",
  fit: "Regular Fit",
  patternDesign: "Subtle Floral Embroidery",
  occasion: "Festive & Eid",
  season: "Summer",
  careInstructions: "Machine wash cold, dry in shade",
  seoTitle: "Embroidered Cotton Kurta | Kids Wear",
  seoDescription: "Handcrafted children kurta set in Pakistan.",
  createdAt: "2026-10-18T08:00:00.000Z",
  updatedAt: "2026-10-18T08:00:00.000Z",
  storefront: {
    id: "sf-mini-sprouts",
    name: "Mini Sprouts",
    slug: "mini-sprouts",
  },
};

const MOCK_ORDER_DETAIL = {
  orderNumber: "KW-1045",
  createdAt: "2026-10-18T10:00:00.000Z",
  status: "ORDER_RECEIVED" as OrderStatusType,
  statusLabel: "Order Received",
  paymentMethod: "CASH_ON_DELIVERY" as PaymentMethodType,
  customer: {
    fullName: "Zainab Bibi",
    phone: "03001234567",
    email: "zainab@example.com",
    address: "House 45, Street 10, Sector F-7",
    city: "Islamabad",
    province: "Islamabad Capital Territory",
    postalCode: "44000",
    orderNotes: "Please deliver before Friday.",
  },
  items: [
    {
      productName: "Embroidered Cotton Kurta",
      productSku: "ECK-001",
      productSlug: "embroidered-cotton-kurta",
      storefrontSlug: "mini-sprouts",
      sizeLabel: "3-4Y",
      colorName: "Assorted",
      quantity: 2,
      unitPrice: "1500.00",
      lineSubtotal: "3000.00",
      thumbnailUrl: "https://res.cloudinary.com/sample/thumb.jpg",
    },
  ],
  statusHistory: [
    {
      id: "hist-1",
      status: "ORDER_RECEIVED" as OrderStatusType,
      statusLabel: "Order Received",
      changedAt: "2026-10-18T10:00:00.000Z",
      changedByAdminId: null,
      changedByAdminEmail: null,
    },
  ],
  subtotal: "3000.00",
  deliveryCharge: "200.00",
  grandTotal: "3200.00",
};

const MOCK_REVIEW_DETAIL = {
  id: "rev-1234",
  reviewerName: "Amna Tariq",
  rating: 5,
  reviewText: "I like <this> fabric & colors! Amazing craftsmanship.",
  status: "PENDING" as ReviewStatusType,
  statusLabel: "Pending Moderation",
  createdAt: "2026-10-18T11:00:00.000Z",
  updatedAt: "2026-10-18T11:00:00.000Z",
  product: {
    id: "prod-1234",
    name: "Embroidered Cotton Kurta",
    slug: "embroidered-cotton-kurta",
    sku: "ECK-001",
    storefrontSlug: "mini-sprouts",
  },
  images: [
    {
      id: "rimg-1",
      mediaAssetId: "asset-1",
      secureUrl: "https://res.cloudinary.com/sample/review1.jpg",
      providerPublicId: "kids-wear/reviews/asset-1",
      width: 800,
      height: 800,
      format: "jpg",
      bytes: 120000,
      sortOrder: 1,
    },
  ],
};

async function runAdminUiTestSuite(): Promise<void> {
  console.log("\n=======================================================");
  console.log("Kids Wear — Admin Panel UI Test Suite");
  console.log("=======================================================\n");

  // =========================================================================
  // Section 1: Admin Authentication UI & Shell Boundaries (Tests 1–8)
  // =========================================================================
  console.log("--- Section 1: Admin Auth & Shell Boundaries ---");

  await runTest(
    "1. login page renders email, password, and sign-in button without signup link",
    () => {
      const loginFilePath = path.join(__dirname, "../src/app/admin/login/page.tsx");
      const content = fs.readFileSync(loginFilePath, "utf8");

      assert(content.includes('type="email"'), "Must have email input");
      assert(
        content.includes('type={showPassword ? "text" : "password"}'),
        "Must have password input with visibility control"
      );
      assert(content.includes('autoComplete="username"'), "Must have autocomplete username");
      assert(
        content.includes('autoComplete="current-password"'),
        "Must have autocomplete current-password"
      );
      assert(!content.includes("Sign up"), "Must not have public signup link");
      assert(!content.includes("register"), "Must not have public register link");
      assert(!content.includes("localStorage"), "Must not store token in localStorage");
      assert(!content.includes("sessionStorage"), "Must not store token in sessionStorage");
    }
  );

  await runTest("2. AdminShell renders 6 approved navigation areas and Logout button", () => {
    const shellFilePath = path.join(__dirname, "../src/components/admin/admin-shell.tsx");
    const content = fs.readFileSync(shellFilePath, "utf8");

    assert(content.includes("Dashboard"), "Must contain Dashboard navigation");
    assert(content.includes("Products"), "Must contain Products navigation");
    assert(content.includes("Orders"), "Must contain Orders navigation");
    assert(content.includes("Reviews"), "Must contain Reviews navigation");
    assert(content.includes("Storefronts"), "Must contain Storefronts navigation");
    assert(content.includes("Settings"), "Must contain Settings navigation");
    assert(content.includes("Logout"), "Must contain Logout action");

    // Strictly assert absence of unapproved modules
    assert(!content.includes("Customers"), "Must not contain Customers module");
    assert(!content.includes("Analytics"), "Must not contain Analytics module");
    assert(!content.includes("Inventory"), "Must not contain Inventory module");
    assert(!content.includes("Coupons"), "Must not contain Coupons module");
    assert(!content.includes("Marketing"), "Must not contain Marketing module");
    assert(!content.includes("Finance"), "Must not contain Finance module");
    assert(!content.includes("Staff"), "Must not contain Staff module");
    assert(!content.includes("Integrations"), "Must not contain Integrations module");
    assert(!content.includes("AI"), "Must not contain AI module");
  });

  await runTest("3. AdminShell sets aria-current='page' on active navigation link", () => {
    const shellFilePath = path.join(__dirname, "../src/components/admin/admin-shell.tsx");
    const content = fs.readFileSync(shellFilePath, "utf8");
    assert(content.includes("aria-current"), "Must use aria-current for accessibility");
  });

  await runTest(
    "4. AdminGuard renders restrained loading state while session is unresolved",
    () => {
      const guardFilePath = path.join(__dirname, "../src/components/admin/admin-guard.tsx");
      const content = fs.readFileSync(guardFilePath, "utf8");
      assert(content.includes("aria-busy"), "Must expose aria-busy on loading guard");
      assert(
        content.includes("Verifying Admin Authorization"),
        "Must indicate authorization verification"
      );
      assert(
        content.includes('router.push("/admin/login")'),
        "Must redirect unauthenticated visitors to login"
      );
    }
  );

  await runTest("5. AdminAuthProvider requires a non-secret current-tab marker", () => {
    const authContextPath = path.join(__dirname, "../src/lib/admin-auth-context.tsx");
    const content = fs.readFileSync(authContextPath, "utf8");
    assert(!content.includes("localStorage"), "Must not use localStorage");
    assert(content.includes('"kw_admin_tab_authenticated"'), "Must name the tab marker");
    assert(
      content.includes("sessionStorage.getItem(ADMIN_TAB_MARKER)"),
      "Must require tab marker before session restoration"
    );
    assert(
      content.includes('sessionStorage.setItem(ADMIN_TAB_MARKER, "true")'),
      "Must set marker after login"
    );
    assert(
      content.includes("sessionStorage.removeItem(ADMIN_TAB_MARKER)"),
      "Must clear marker on logout or invalid session"
    );
    assert(!content.includes("zustand"), "Must not use zustand persistent store for admin session");
  });

  await runTest(
    "6. Admin API client automatically handles CSRF token acquisition for mutation methods",
    () => {
      const apiPath = path.join(__dirname, "../src/lib/admin-api.ts");
      const content = fs.readFileSync(apiPath, "utf8");
      assert(content.includes('headers.set("x-csrf-token"'), "Must attach x-csrf-token header");
      assert(content.includes('cache: "no-store"'), "Must disable cache for admin operations");
      assert(content.includes('credentials: "include"'), "Must include session cookies");
    }
  );

  await runTest(
    "7. Admin API client handles CSRF retry upon receiving CSRF_INVALID or CSRF_MISSING",
    () => {
      const apiPath = path.join(__dirname, "../src/lib/admin-api.ts");
      const content = fs.readFileSync(apiPath, "utf8");
      assert(content.includes("CSRF_INVALID"), "Must check CSRF_INVALID error code");
      assert(content.includes("CSRF_MISSING"), "Must check CSRF_MISSING error code");
    }
  );

  await runTest(
    "8. Admin layout configures force-dynamic to prevent static caching of operational admin routes",
    () => {
      const layoutPath = path.join(__dirname, "../src/app/admin/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf8");
      assert(content.includes('dynamic = "force-dynamic"'), "Must configure force-dynamic");
    }
  );

  // =========================================================================
  // Section 2: Dashboard UI (Tests 9–14)
  // =========================================================================
  console.log("--- Section 2: Dashboard UI ---");

  await runTest("9. dashboard page renders exact 4 required metric cards", () => {
    const dashPath = path.join(__dirname, "../src/app/admin/page.tsx");
    const content = fs.readFileSync(dashPath, "utf8");

    assert(content.includes("Total Products"), "Must have Total Products card");
    assert(content.includes("Total Orders"), "Must have Total Orders card");
    assert(content.includes("Active Orders"), "Must have Active Orders card");
    assert(content.includes("Unavailable Variants"), "Must have Unavailable Variants card");
  });

  await runTest("10. dashboard page strictly avoids forbidden numeric stock cards", () => {
    const dashPath = path.join(__dirname, "../src/app/admin/page.tsx");
    const content = fs.readFileSync(dashPath, "utf8");

    assert(!content.includes("Low Stock"), "Must not contain Low Stock card");
    assert(!content.includes("Units Remaining"), "Must not contain Units Remaining card");
    assert(!content.includes("Stock Value"), "Must not contain Stock Value card");
    assert(!content.includes("Inventory Quantity"), "Must not contain Inventory Quantity card");
  });

  await runTest(
    "11. dashboard renders Recent Orders operational table with required columns",
    () => {
      const dashPath = path.join(__dirname, "../src/app/admin/page.tsx");
      const content = fs.readFileSync(dashPath, "utf8");

      assert(content.includes("Recent Orders"), "Must contain Recent Orders section");
      assert(content.includes("Order Number"), "Must have Order Number column");
      assert(content.includes("Customer"), "Must have Customer column");
      assert(content.includes("Status"), "Must have Status column");
      assert(content.includes("Payment"), "Must have Payment column");
      assert(content.includes("Total"), "Must have Total column");
    }
  );

  await runTest("12. dashboard links Recent Orders to Admin Order Detail route", () => {
    const dashPath = path.join(__dirname, "../src/app/admin/page.tsx");
    const content = fs.readFileSync(dashPath, "utf8");
    assert(
      content.includes("/admin/orders/${order.orderNumber}"),
      "Must link to admin order detail"
    );
  });

  await runTest(
    "13. dashboard route is mounted at /admin without redundant /admin/dashboard route",
    () => {
      const adminPagePath = path.join(__dirname, "../src/app/admin/page.tsx");
      assert(fs.existsSync(adminPagePath), "Must exist at apps/web/src/app/admin/page.tsx");

      const redundantDashboardPath = path.join(__dirname, "../src/app/admin/dashboard/page.tsx");
      assert(
        !fs.existsSync(redundantDashboardPath),
        "Must NOT create redundant /admin/dashboard route"
      );
    }
  );

  await runTest("14. dashboard consumes authoritative GET /api/v1/admin/dashboard endpoint", () => {
    const dashPath = path.join(__dirname, "../src/app/admin/page.tsx");
    const content = fs.readFileSync(dashPath, "utf8");
    assert(content.includes("getAdminDashboard()"), "Must consume getAdminDashboard API helper");
  });

  // =========================================================================
  // Section 3: Product Admin UI (Tests 15–26)
  // =========================================================================
  console.log("--- Section 3: Product Admin UI ---");

  await runTest(
    "15. products list exposes search, storefront filter, status filter, and pagination",
    () => {
      const prodListPath = path.join(__dirname, "../src/app/admin/products/page.tsx");
      const content = fs.readFileSync(prodListPath, "utf8");

      assert(content.includes("Search by product name or SKU"), "Must have search input");
      assert(content.includes("All Storefronts"), "Must have storefront filter");
      assert(content.includes("All Statuses"), "Must have status filter");
      assert(content.includes("pagination"), "Must have pagination controls");
    }
  );

  await runTest(
    "16. products list strictly avoids Featured, numeric stock, and hex color columns",
    () => {
      const prodListPath = path.join(__dirname, "../src/app/admin/products/page.tsx");
      const content = fs.readFileSync(prodListPath, "utf8");

      assert(!content.includes("Featured"), "Must not display Featured column");
      assert(!content.includes("numeric stock"), "Must not display numeric stock column");
      assert(!content.includes("colorHex"), "Must not display hex colors");
    }
  );

  await runTest(
    "17. create product form enforces default DRAFT status and redirects to editor",
    () => {
      const newProdPath = path.join(__dirname, "../src/app/admin/products/new/page.tsx");
      const content = fs.readFileSync(newProdPath, "utf8");

      assert(content.includes("createAdminProduct"), "Must call createAdminProduct API helper");
      assert(
        content.includes("router.push(`/admin/products/${res.data.product.id}`)"),
        "Must navigate to editor"
      );
      assert(
        content.includes("Initial creation defaults to DRAFT status"),
        "Must indicate DRAFT default"
      );
    }
  );

  await runTest(
    "18. create product form and product editor support all approved core, garment, and SEO fields",
    () => {
      const newProdPath = path.join(__dirname, "../src/app/admin/products/new/page.tsx");
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const newContent = fs.readFileSync(newProdPath, "utf8");
      const editorContent = fs.readFileSync(editorPath, "utf8");

      for (const content of [newContent, editorContent]) {
        assert(content.includes("formData.name"), "Must have name field");
        assert(content.includes("formData.sku"), "Must have sku field");
        assert(content.includes("formData.slug"), "Must have slug field");
        assert(content.includes("formData.regularPrice"), "Must have regularPrice field");
        assert(content.includes("formData.compareAtPrice"), "Must have compareAtPrice field");
        assert(content.includes("formData.description"), "Must have description field");
        assert(content.includes("formData.shortDescription"), "Must have shortDescription field");
        assert(content.includes("formData.productType"), "Must have productType field");
        assert(content.includes("formData.gender"), "Must have gender field");
        assert(content.includes("formData.fabric"), "Must have fabric field");
        assert(content.includes("formData.includedPieces"), "Must have includedPieces field");
        assert(content.includes("formData.fit"), "Must have fit field");
        assert(content.includes("formData.patternDesign"), "Must have patternDesign field");
        assert(content.includes("formData.season"), "Must have season field");
        assert(content.includes("formData.occasion"), "Must have occasion field");
        assert(content.includes("formData.careInstructions"), "Must have careInstructions field");
        assert(content.includes("formData.isNewArrival"), "Must have isNewArrival field");
        assert(content.includes("formData.seoTitle"), "Must have seoTitle field");
        assert(content.includes("formData.seoDescription"), "Must have seoDescription field");

        // Scope exclusions
        assert(!content.includes("isFeatured"), "Must not have isFeatured");
        assert(!content.includes("stockQuantity"), "Must not have stockQuantity");
        assert(!content.includes("colorHex"), "Must not have colorHex");
      }
    }
  );

  await runTest(
    "18b. product SKU and slug normalization in frontend exactly matches authoritative backend contract",
    () => {
      const newProdPath = path.join(__dirname, "../src/app/admin/products/new/page.tsx");
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const backendValidationPath = path.join(
        __dirname,
        "../../api/src/modules/product/validation.ts"
      );

      const newContent = fs.readFileSync(newProdPath, "utf8");
      const editorContent = fs.readFileSync(editorPath, "utf8");
      const backendContent = fs.readFileSync(backendValidationPath, "utf8");

      // Verify backend canonicalizes SKU to uppercase
      assert(
        backendContent.includes(".transform((val) => val.toUpperCase())"),
        "Backend must canonicalize SKU to uppercase"
      );
      // Verify backend canonicalizes slug to lowercase
      assert(
        backendContent.includes(".toLowerCase()"),
        "Backend must canonicalize slug to lowercase"
      );

      // Verify frontend mirrors uppercase SKU and lowercase slug on new product creation
      assert(
        newContent.includes("sku: formData.sku.trim().toUpperCase()"),
        "Frontend create must uppercase SKU"
      );
      assert(
        newContent.includes("slug: formData.slug.trim().toLowerCase()"),
        "Frontend create must lowercase slug"
      );

      // Verify frontend mirrors uppercase SKU and lowercase slug on product editor update
      assert(
        editorContent.includes("sku: formData.sku.trim().toUpperCase()"),
        "Frontend update must uppercase SKU"
      );
      assert(
        editorContent.includes("slug: formData.slug.trim().toLowerCase()"),
        "Frontend update must lowercase slug"
      );
    }
  );

  await runTest(
    "19. product editor organizes into details, options, variants, media, and publication tabs",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");

      assert(content.includes('"details"'), "Must support details tab");
      assert(content.includes('"options"'), "Must support options tab");
      assert(content.includes('"variants"'), "Must support variants tab");
      assert(content.includes('"media"'), "Must support media tab");
      assert(content.includes('"status"'), "Must support status tab");
    }
  );

  await runTest(
    "20. product editor supports product-specific sizes with creation and deletion",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");

      assert(content.includes("createAdminProductSize"), "Must have size creation helper");
      assert(content.includes("deleteAdminProductSize"), "Must have size deletion helper");
    }
  );

  await runTest(
    "21. product editor supports manually entered color names and strictly forbids hex inputs",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");

      assert(content.includes("createAdminProductColor"), "Must have color creation helper");
      assert(
        content.includes("Display names only (No hex / RGB / swatches)"),
        "Must clarify display names only"
      );
      assert(!content.includes('type="color"'), "Must NOT contain HTML5 color picker");
      assert(!content.includes("hexCode"), "Must not contain hexCode input");
      assert(!content.includes("colorHex"), "Must not contain colorHex input");
      assert(content.includes("Assorted"), "Must support Assorted color display");
    }
  );

  await runTest("21a. Color Add follows the controlled color input", () => {
    const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
    const content = fs.readFileSync(editorPath, "utf8");
    const colorForm = content.match(/<form onSubmit=\{handleAddColor\}[\s\S]*?<\/form>/)?.[0];
    assert(colorForm, "Color creation form must exist");
    assert(colorForm.includes("value={newColorName}"), "Visible input must use color state");
    assert(colorForm.includes("setNewColorName(e.target.value)"), "Typing must update color state");

    const disabledExpression = colorForm.match(/disabled=\{([^}]+)\}/)?.[1];
    assert(disabledExpression, "Color Add must have a disabled condition");
    const isDisabled = (name: string, isSaving = false) =>
      runInNewContext(disabledExpression, { newColorName: name, newSizeName: "", isSaving });

    assert.strictEqual(isDisabled(""), true, "Empty color must disable Add");
    assert.strictEqual(isDisabled("   "), true, "Whitespace-only color must disable Add");
    assert.strictEqual(isDisabled("Cream"), false, "Cream must enable Add with Size input empty");
    assert.strictEqual(isDisabled("Cream", true), true, "In-flight mutation must disable Add");

    const colorHandler = content
      .split("const handleAddColor = async")[1]
      ?.split("const handleDeleteColor")[0];
    assert(colorHandler, "Color Add handler must exist");
    assert(colorHandler.includes("createAdminProductColor(productId"), "Must call Color API");
    assert(
      colorHandler.includes("name: newColorName.trim()"),
      "Must submit the trimmed color name"
    );
    assert(
      colorHandler.includes("setColors([...colors, res.data.color])"),
      "Must update Colors from API response"
    );
    assert(colorHandler.includes('setNewColorName("")'), "Must clear input after success");
    assert(colorHandler.includes("setErrorMessage(res.error?.message"), "Must show API rejection");
  });

  await runTest(
    "22. product editor variants matrix manages exact Size + Color combinations with boolean availability",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");

      assert(
        content.includes("bulkCreateAdminProductVariants"),
        "Must support bulk variant creation"
      );
      assert(
        content.includes("Successfully generated ${res.data.variants.length}"),
        "Variant success feedback must count returned combinations"
      );
      assert(
        content.includes("updateAdminProductVariant"),
        "Must support variant availability update"
      );
      assert(content.includes("Available"), "Must support Available state");
      assert(content.includes("Unavailable"), "Must support Unavailable state");
      assert(
        !content.includes("quantity:"),
        "Must NOT contain numeric stock input in variants table"
      );
      assert(!content.includes("stockCount"), "Must NOT contain stockCount");
    }
  );

  await runTest(
    "23. product media interface enforces max 8 images and 1 video with Main/Hover controls",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");

      assert(content.includes("imageMedia.length >= 8"), "Must disable image upload at 8 images");
      assert(content.includes("productVideo ? 1 : 0"), "Must show the one-video count");
      assert(content.includes('accept=".mp4,video/mp4"'), "Must offer a separate MP4 picker");
      assert(
        content.includes('accept="image/jpeg,image/png,image/webp"'),
        "Image picker must stay image-only"
      );
      assert(content.includes("setAdminProductMediaMain"), "Must support setting Main image");
      assert(content.includes("setAdminProductMediaHover"), "Must support setting Hover image");
      assert(content.includes("clearAdminProductMediaHover"), "Must support clearing Hover image");
    }
  );

  await runTest("23a. video selection opens a dedicated 4:5 framing dialog before upload", () => {
    const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
    const content = fs.readFileSync(editorPath, "utf8");
    assert(content.includes("setVideoSource({ file, url:"), "Selection must open framing state");
    assert(content.includes("<ProductVideoFrameDialog"), "Editor must render video framing dialog");
    assert(content.includes("onCancel={closeVideoFrame}"), "Cancel must close without uploading");
    const dialog = renderToStaticMarkup(
      <ProductVideoFrameDialog
        sourceUrl="blob:test-video"
        sourceWidth={512}
        sourceHeight={768}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );
    assert(dialog.includes("aspect-4/5"), "Video frame must be 4:5");
    for (const label of ["Play Preview", "Zoom", "Reset", "Cancel", "Confirm Video"]) {
      assert(dialog.includes(label), `Video framing must offer ${label}`);
    }
  });

  await runTest("24. product media prevents direct deletion of the Main Image", () => {
    const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
    const content = fs.readFileSync(editorPath, "utf8");
    assert(
      content.includes("!media.isMain"),
      "Must guard delete button so Main image cannot be directly deleted"
    );
  });

  await runTest("25. publication tab respects backend publication gate and displays errors", () => {
    const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
    const content = fs.readFileSync(editorPath, "utf8");

    assert(content.includes("Publish Product"), "Must have Publish Product button");
    assert(content.includes("Deactivate Product"), "Must have Deactivate Product button");
    assert(content.includes("Revert to Draft"), "Must have Revert to Draft button");
    assert(
      content.includes("updateAdminProductStatus"),
      "Must call updateAdminProductStatus API helper"
    );
  });

  await runTest(
    "26. product editor strictly avoids destructive Product Delete UI for published/inactive items",
    () => {
      const editorPath = path.join(__dirname, "../src/app/admin/products/[productId]/page.tsx");
      const content = fs.readFileSync(editorPath, "utf8");
      assert(
        !content.includes("Delete Product Permanently"),
        "Must not expose permanent product deletion in editor"
      );
    }
  );

  // =========================================================================
  // Section 4: Order Admin UI (Tests 27–34)
  // =========================================================================
  console.log("--- Section 4: Order Admin UI ---");

  await runTest(
    "27. orders list supports search, status filter, payment filter, and server pagination",
    () => {
      const ordersPath = path.join(__dirname, "../src/app/admin/orders/page.tsx");
      const content = fs.readFileSync(ordersPath, "utf8");

      assert(content.includes("Search by order #, customer name"), "Must have search input");
      assert(content.includes("All Statuses"), "Must have status filter");
      assert(content.includes("All Payment Methods"), "Must have payment filter");
      assert(content.includes("pagination"), "Must support server pagination");
    }
  );

  await runTest("28. orders list never exposes internal idempotency key", () => {
    const ordersPath = path.join(__dirname, "../src/app/admin/orders/page.tsx");
    const content = fs.readFileSync(ordersPath, "utf8");
    assert(!content.includes("idempotencyKey"), "Must not display idempotency key in orders list");
  });

  await runTest("29. order detail displays immutable customer and delivery snapshots", () => {
    const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
    const content = fs.readFileSync(detailPath, "utf8");

    assert(content.includes("order.customer.fullName"), "Must display customer fullName");
    assert(content.includes("order.customer.phone"), "Must display customer phone");
    assert(content.includes("order.customer.address"), "Must display customer address");
    assert(content.includes("order.customer.city"), "Must display customer city");
  });

  await runTest(
    "30. order detail displays item snapshot with SKU visible Admin-only and text-only color",
    () => {
      const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
      const content = fs.readFileSync(detailPath, "utf8");

      assert(content.includes("item.productSku"), "Must display productSku");
      assert(content.includes("item.sizeLabel"), "Must display sizeLabel");
      assert(content.includes("item.colorName"), "Must display colorName text");
      assert(!content.includes("colorHex"), "Must not contain colorHex in order item display");
    }
  );

  await runTest(
    "31. order detail provides Bank Transfer confirmation action (AWAITING_PAYMENT → CONFIRMED)",
    () => {
      const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
      const content = fs.readFileSync(detailPath, "utf8");

      assert(
        content.includes('order.paymentMethod === "BANK_TRANSFER"'),
        "Must check BANK_TRANSFER"
      );
      assert(
        content.includes('order.status === "AWAITING_PAYMENT"'),
        "Must check AWAITING_PAYMENT"
      );
      assert(
        content.includes("Confirm Payment / Confirm Order"),
        "Must provide clear confirmation button"
      );
    }
  );

  await runTest(
    "32. order detail provides COD confirmation action (ORDER_RECEIVED → CONFIRMED)",
    () => {
      const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
      const content = fs.readFileSync(detailPath, "utf8");

      assert(
        content.includes('order.paymentMethod === "CASH_ON_DELIVERY"'),
        "Must check CASH_ON_DELIVERY"
      );
      assert(content.includes('order.status === "ORDER_RECEIVED"'), "Must check ORDER_RECEIVED");
      assert(content.includes("Confirm Order"), "Must provide Confirm Order button");
    }
  );

  await runTest(
    "33. order detail supports controlled production progression and cancellation dialog",
    () => {
      const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
      const content = fs.readFileSync(detailPath, "utf8");

      assert(content.includes("Send to Production"), "Must have Send to Production action");
      assert(content.includes("Mark Ready to Ship"), "Must have Mark Ready to Ship action");
      assert(content.includes("Dispatch / Mark Shipped"), "Must have Mark Shipped action");
      assert(content.includes("Mark Delivered"), "Must have Mark Delivered action");
      assert(content.includes("Cancel Order"), "Must have Cancel Order action");
      assert(content.includes("confirm("), "Must use confirmation dialog before cancellation");
    }
  );

  await runTest(
    "34. order detail disables controls and handles concurrent status conflicts via refresh",
    () => {
      const detailPath = path.join(__dirname, "../src/app/admin/orders/[orderNumber]/page.tsx");
      const content = fs.readFileSync(detailPath, "utf8");

      assert(content.includes("isMutating"), "Must track isMutating state");
      assert(
        content.includes("await fetchOrder()"),
        "Must refresh order after mutation or failure"
      );
    }
  );

  // =========================================================================
  // Section 5: Review Admin UI (Tests 35–40)
  // =========================================================================
  console.log("--- Section 5: Review Admin UI ---");

  await runTest(
    "35. reviews list supports search, status, rating filters, and server pagination",
    () => {
      const revListPath = path.join(__dirname, "../src/app/admin/reviews/page.tsx");
      const content = fs.readFileSync(revListPath, "utf8");

      assert(content.includes("Search by reviewer name"), "Must have search input");
      assert(content.includes("All Moderation Statuses"), "Must have status filter");
      assert(content.includes("All Ratings"), "Must have rating filter");
    }
  );

  await runTest(
    "36. reviews list renders text strictly as plain React text without dangerouslySetInnerHTML",
    () => {
      const revListPath = path.join(__dirname, "../src/app/admin/reviews/page.tsx");
      const content = fs.readFileSync(revListPath, "utf8");
      assert(!content.includes("dangerouslySetInnerHTML"), "Must NOT use dangerouslySetInnerHTML");
    }
  );

  await runTest(
    "37. reviews list strictly avoids ungrounded Verified Purchase or Verified Buyer claims",
    () => {
      const revListPath = path.join(__dirname, "../src/app/admin/reviews/page.tsx");
      const content = fs.readFileSync(revListPath, "utf8");

      assert(!content.includes("Verified Purchase"), "Must not claim Verified Purchase");
      assert(!content.includes("Verified Buyer"), "Must not claim Verified Buyer");
      assert(!content.includes("verifiedReview"), "Must not claim verifiedReview");
    }
  );

  await runTest(
    "38. review moderation provides Approve, Hide, and Delete actions and strictly forbids Pending transition",
    () => {
      const revListPath = path.join(__dirname, "../src/app/admin/reviews/page.tsx");
      const content = fs.readFileSync(revListPath, "utf8");

      assert(content.includes("Approve"), "Must have Approve action");
      assert(content.includes("Hide"), "Must have Hide action");
      assert(content.includes("Trash2"), "Must have Delete action");
      assert(
        !content.includes('handleStatusChange(r.id, "PENDING")'),
        "Must NOT offer transition to PENDING"
      );
    }
  );

  await runTest(
    "39. review detail route renders reviewer name, rating, plain text, and attached images",
    () => {
      const revDetailPath = path.join(__dirname, "../src/app/admin/reviews/[reviewId]/page.tsx");
      const content = fs.readFileSync(revDetailPath, "utf8");

      assert(content.includes("review.reviewerName"), "Must display reviewerName");
      assert(content.includes("review.rating"), "Must display rating");
      assert(content.includes("review.reviewText"), "Must display reviewText");
      assert(content.includes("review.images"), "Must render review images");
      assert(!content.includes("dangerouslySetInnerHTML"), "Must NOT use dangerouslySetInnerHTML");
    }
  );

  await runTest(
    "40. review delete UI uses confirmation dialog before executing permanent deletion",
    () => {
      const revDetailPath = path.join(__dirname, "../src/app/admin/reviews/[reviewId]/page.tsx");
      const content = fs.readFileSync(revDetailPath, "utf8");
      assert(content.includes("confirm("), "Must use confirmation dialog before deleting review");
    }
  );

  // =========================================================================
  // Section 6: Storefronts & Hero Management UI (Tests 41–45)
  // =========================================================================
  console.log("--- Section 6: Storefronts & Hero Management UI ---");

  await runTest(
    "41. storefronts admin represents the 3 fixed storefronts and forbids creating/renaming storefronts",
    () => {
      const sfPath = path.join(__dirname, "../src/app/admin/storefronts/page.tsx");
      const content = fs.readFileSync(sfPath, "utf8");

      assert(
        content.includes("Storefront names and age ranges are fixed."),
        "Must explain that storefront identities are fixed"
      );
      assert(!content.includes("Create Storefront"), "Must not allow storefront creation");
      assert(!content.includes("Delete Storefront"), "Must not allow storefront deletion");
      assert(!content.includes("Edit Theme Colors"), "Must not allow theme color editing");
    }
  );

  await runTest(
    "42. storefronts admin supports Hero slide listing with desktop and mobile image previews",
    () => {
      const sfPath = path.join(__dirname, "../src/app/admin/storefronts/page.tsx");
      const content = fs.readFileSync(sfPath, "utf8");

      assert(content.includes("desktopImageAsset"), "Must support desktop image asset");
      assert(content.includes("mobileImageAsset"), "Must support mobile image asset");
    }
  );

  await runTest(
    "43. storefronts admin supports Hero slide creation and editing via modal form",
    () => {
      const sfPath = path.join(__dirname, "../src/app/admin/storefronts/page.tsx");
      const content = fs.readFileSync(sfPath, "utf8");
      const savePath = path.join(__dirname, "../src/lib/admin-hero-request-state.ts");
      const saveContent = fs.readFileSync(savePath, "utf8");

      assert(content.includes("saveHeroSlideOnce"), "Must use the single save request helper");
      assert(saveContent.includes("createAdminHeroSlide"), "Must support creating a hero slide");
      assert(saveContent.includes("updateAdminHeroSlide"), "Must support editing a hero slide");
    }
  );

  await runTest(
    "44. storefronts admin supports Hero slide reordering with server persistence",
    () => {
      const sfPath = path.join(__dirname, "../src/app/admin/storefronts/page.tsx");
      const content = fs.readFileSync(sfPath, "utf8");
      assert(content.includes("reorderAdminHeroSlides"), "Must call reorderAdminHeroSlides helper");
    }
  );

  await runTest(
    "45. storefronts admin supports Hero slide activation toggle and deletion with confirmation",
    () => {
      const sfPath = path.join(__dirname, "../src/app/admin/storefronts/page.tsx");
      const content = fs.readFileSync(sfPath, "utf8");

      assert(content.includes("deleteAdminHeroSlide"), "Must call deleteAdminHeroSlide helper");
      assert(content.includes("confirm("), "Must use confirmation dialog before deleting slide");
    }
  );

  // =========================================================================
  // Section 7: Settings UI (Tests 46–50)
  // =========================================================================
  console.log("--- Section 7: Settings UI ---");

  await runTest(
    "46. settings page organizes into Announcement, Shipping, Bank Transfer, and Notifications",
    () => {
      const settingsPath = path.join(__dirname, "../src/app/admin/settings/page.tsx");
      const content = fs.readFileSync(settingsPath, "utf8");

      assert(content.includes("Storefront Announcement Bar"), "Must contain Announcement section");
      assert(
        content.includes("Shipping &amp; Delivery Charge") ||
          (content.includes("Shipping") && content.includes("Delivery Charge")),
        "Must contain Shipping section"
      );
      assert(
        content.includes("Manual Bank Transfer Details"),
        "Must contain Bank Transfer section"
      );
      assert(content.includes("Admin Order Notifications"), "Must contain Notifications section");
    }
  );

  await runTest(
    "47. shipping settings exposes flat delivery charge and forbids free-shipping threshold",
    () => {
      const settingsPath = path.join(__dirname, "../src/app/admin/settings/page.tsx");
      const content = fs.readFileSync(settingsPath, "utf8");

      assert(
        content.includes("Flat Delivery Charge (PKR)"),
        "Must have Flat Delivery Charge input"
      );
      assert(
        !content.includes("freeShippingThreshold"),
        "Must NOT contain free shipping threshold"
      );
      assert(!content.includes("Free Shipping"), "Must NOT contain Free Shipping setting");
    }
  );

  await runTest(
    "48. bank transfer settings clarifies checkout availability gate requires all 4 fields",
    () => {
      const settingsPath = path.join(__dirname, "../src/app/admin/settings/page.tsx");
      const content = fs.readFileSync(settingsPath, "utf8");

      assert(content.includes("Checkout Availability Gate"), "Must document availability gate");
      assert(content.includes("bankTransfer.bankName"), "Must have bankName");
      assert(content.includes("bankTransfer.accountTitle"), "Must have accountTitle");
      assert(content.includes("bankTransfer.accountOrIban"), "Must have accountOrIban");
      assert(content.includes("bankTransfer.instructions"), "Must have instructions");
    }
  );

  await runTest(
    "49. notification settings exposes recipient email and strictly protects Resend secrets",
    () => {
      const settingsPath = path.join(__dirname, "../src/app/admin/settings/page.tsx");
      const content = fs.readFileSync(settingsPath, "utf8");

      assert(content.includes("newOrderEmailEnabled"), "Must have newOrderEmailEnabled toggle");
      assert(content.includes("newOrderNotificationRecipient"), "Must have recipient input");
      assert(
        !content.includes("RESEND_API_KEY"),
        "Must NOT expose or provide input for RESEND_API_KEY"
      );
      assert(
        !content.includes("RESEND_FROM_EMAIL"),
        "Must NOT provide input for RESEND_FROM_EMAIL"
      );
      assert(
        content.includes("Security &amp; Deployment Boundary") ||
          (content.includes("Security") && content.includes("Deployment Boundary")),
        "Must explain environment management boundary"
      );
    }
  );

  await runTest(
    "50. each settings section saves independently with independent feedback states",
    () => {
      const settingsPath = path.join(__dirname, "../src/app/admin/settings/page.tsx");
      const content = fs.readFileSync(settingsPath, "utf8");

      assert(
        content.includes("handleSaveAnnouncement"),
        "Must have separate handleSaveAnnouncement"
      );
      assert(content.includes("handleSaveShipping"), "Must have separate handleSaveShipping");
      assert(
        content.includes("handleSaveBankTransfer"),
        "Must have separate handleSaveBankTransfer"
      );
      assert(
        content.includes("handleSaveNotifications"),
        "Must have separate handleSaveNotifications"
      );
    }
  );

  // Print Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(
    `Kids Wear — Admin UI Test Suite Summary: ${passed} passed, ${failed} failed, total ${results.length}`
  );
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

void runAdminUiTestSuite();
