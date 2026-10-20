import React from "react";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewCard } from "../src/components/reviews/review-card";
import {
  ReviewSubmissionForm,
  type ReviewProductOption,
} from "../src/components/reviews/review-submission-form";
import { ProductReviewsSection } from "../src/components/pdp/product-reviews-section";
import { ReviewsPreview } from "../src/components/home/reviews-preview";
import ReviewsPage from "../src/app/reviews/page";
import type {
  PublicReviewItem,
  PublicReviewsResponseData,
  ApiPublicSettings,
} from "../src/lib/api";

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
    console.error(`  ✗ ${name}`);
    console.error(`    ${errorMsg}`);
  }
}

// ---------------------------------------------------------------------------
// Mock Fixtures
// ---------------------------------------------------------------------------

const MOCK_PRODUCTS: ReviewProductOption[] = [
  {
    id: "prod-1111-aaaa",
    name: "Festive Embroidered Kurta",
    slug: "festive-embroidered-kurta",
    storefrontSlug: "mini-sprouts",
  },
  {
    id: "prod-2222-bbbb",
    name: "Classic Linen Shalwar Set",
    slug: "classic-linen-shalwar-set",
    storefrontSlug: "mini-sprouts",
  },
];

const MOCK_APPROVED_REVIEW_1: PublicReviewItem = {
  id: "rev-1111",
  reviewerName: "Ayesha Malik",
  rating: 5,
  reviewText: "Exceptional quality fabric and the stitching is perfect for eid.",
  createdAt: "2026-10-15T10:00:00.000Z",
  product: {
    id: "prod-1111-aaaa",
    name: "Festive Embroidered Kurta",
    slug: "festive-embroidered-kurta",
    storefrontSlug: "mini-sprouts",
  },
  images: [
    {
      url: "https://res.cloudinary.com/kids-wear/image/upload/v1/reviews/sub1/img1.jpg",
      altText: "Customer photo 1",
    },
    {
      url: "https://res.cloudinary.com/kids-wear/image/upload/v1/reviews/sub1/img2.jpg",
      altText: "Customer photo 2",
    },
  ],
};

const MOCK_APPROVED_REVIEW_2: PublicReviewItem = {
  id: "rev-2222",
  reviewerName: "Usman Tariq",
  rating: 4,
  reviewText: "True to size and very comfortable for daily wear.",
  createdAt: "2026-10-16T12:30:00.000Z",
  product: {
    id: "prod-2222-bbbb",
    name: "Classic Linen Shalwar Set",
    slug: "classic-linen-shalwar-set",
    storefrontSlug: "mini-sprouts",
  },
  images: [],
};

const MOCK_SETTINGS: ApiPublicSettings = {
  announcement: {
    text: "Free nationwide delivery on orders above Rs. 5000",
    link: null,
    isActive: true,
  },
  shipping: {
    flatDeliveryCharge: "300.00",
  },
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

async function runSuite() {
  console.log("\n=======================================================");
  console.log("Kids Wear — Reviews Frontend Test Suite");
  console.log("=======================================================\n");

  // Save original fetch
  const originalFetch = global.fetch;

  try {
    // ========================================================================
    // Section 1: Review Card Rendering (Tests 1–8)
    // ========================================================================
    console.log("Section 1: Review Card Component (Tests 1–8)");

    await runTest("1. ReviewCard renders reviewer name and rating", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(html.includes("Ayesha Malik"), "Reviewer name must be rendered");
      assert(html.includes("5 out of 5 stars"), "5-star aria label must be rendered");
    });

    await runTest("2. ReviewCard renders formatted date", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(html.includes("time"), "Time element must be rendered");
      assert(html.includes("2026"), "Year 2026 must be present");
    });

    await runTest("3. ReviewCard renders linked product name when showProductLink is true", () => {
      const html = renderToStaticMarkup(
        <ReviewCard review={MOCK_APPROVED_REVIEW_1} showProductLink={true} />
      );
      assert(html.includes("Festive Embroidered Kurta"), "Product name must be rendered");
      assert(
        html.includes("/mini-sprouts/products/festive-embroidered-kurta"),
        "Product link href must point to storefront product"
      );
    });

    await runTest("4. ReviewCard omits product link when showProductLink is false", () => {
      const html = renderToStaticMarkup(
        <ReviewCard review={MOCK_APPROVED_REVIEW_1} showProductLink={false} />
      );
      assert(
        !html.includes("/mini-sprouts/products/festive-embroidered-kurta"),
        "Product link href must be omitted when showProductLink is false"
      );
    });

    await runTest(
      "5. ReviewCard renders markup-like review text and reviewer name as literal text, not HTML",
      () => {
        const reviewWithMarkup: PublicReviewItem = {
          ...MOCK_APPROVED_REVIEW_1,
          reviewerName: "Amna <Parent>",
          reviewText: "I like <this> outfit & the fabric. Testing <script>alert('xss')</script>",
        };
        const html = renderToStaticMarkup(<ReviewCard review={reviewWithMarkup} />);

        // Must render as safe text entities in HTML output
        assert(html.includes("&lt;this&gt;"), "Markup <this> must be escaped to &lt;this&gt;");
        assert(
          html.includes("&lt;Parent&gt;"),
          "Reviewer name markup must be escaped to &lt;Parent&gt;"
        );
        assert(
          html.includes("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;") ||
            html.includes("&lt;script&gt;alert('xss')&lt;/script&gt;"),
          "Script tag must be escaped"
        );

        // Raw executable/custom tags must never exist in the rendered output
        assert(!html.includes("<this>"), "Raw <this> tag must never render");
        assert(!html.includes("<Parent>"), "Raw <Parent> tag must never render");
        assert(!html.includes("<script>"), "Raw script tag must never render");
      }
    );

    await runTest("6. ReviewCard renders attached images when present", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(
        html.includes("https://res.cloudinary.com/kids-wear/image/upload/v1/reviews/sub1/img1.jpg"),
        "Image 1 URL must render"
      );
      assert(
        html.includes("https://res.cloudinary.com/kids-wear/image/upload/v1/reviews/sub1/img2.jpg"),
        "Image 2 URL must render"
      );
    });

    await runTest("7. ReviewCard renders cleanly with zero images", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_2} />);
      assert(html.includes("Usman Tariq"), "Reviewer name rendered");
      assert(
        !html.includes("https://res.cloudinary.com"),
        "No image URL when zero images attached"
      );
    });

    await runTest("8. ReviewCard contains no internal moderation status", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(!html.includes("APPROVED"), "Status enum value must not leak into markup");
      assert(!html.includes("PENDING"), "Pending status must not exist");
      assert(!html.includes("HIDDEN"), "Hidden status must not exist");
    });

    // ========================================================================
    // Section 2: Review Submission Form UI & Validations (Tests 9–19)
    // ========================================================================
    console.log("\nSection 2: Review Submission Form Component (Tests 9–19)");

    await runTest("9. ReviewSubmissionForm renders name, product, rating, and text fields", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(html.includes("Your Name"), "Name label must render");
      assert(html.includes('id="review-name"'), "Name input must render");
      assert(html.includes('id="review-product"'), "Product select must render");
      assert(html.includes("Rating"), "Rating section must render");
      assert(html.includes('id="review-text"'), "Review text textarea must render");
    });

    await runTest("10. ReviewSubmissionForm renders 1–5 star radio options", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      for (let star = 1; star <= 5; star++) {
        assert(html.includes(`value="${star}"`), `Star ${star} radio input must exist`);
      }
    });

    await runTest("11. ReviewSubmissionForm populates product options dropdown", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(html.includes("Festive Embroidered Kurta"), "Product 1 option must render");
      assert(html.includes("Classic Linen Shalwar Set"), "Product 2 option must render");
    });

    await runTest(
      "12. ReviewSubmissionForm preselects product when preselectedProductId is provided",
      () => {
        const html = renderToStaticMarkup(
          <ReviewSubmissionForm products={MOCK_PRODUCTS} preselectedProductId="prod-1111-aaaa" />
        );
        assert(html.includes('value="prod-1111-aaaa"'), "Preselected product option must exist");
      }
    );

    await runTest("13. ReviewSubmissionForm renders max 3 images file upload input", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(html.includes('type="file"'), "File input must render");
      assert(
        html.includes('accept="image/jpeg,image/png,image/webp"'),
        "Allowed image accept attribute must be set"
      );
      assert(
        html.includes("Maximum 3") || html.includes("of 3 selected"),
        "Max 3 images note must be displayed"
      );
    });

    await runTest(
      "14. ReviewSubmissionForm submission button has proper text and accessible state",
      () => {
        const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
        assert(html.includes("Submit Review"), "Submit button text must render");
        assert(html.includes('type="submit"'), "Button type must be submit");
      }
    );

    await runTest("15. ReviewSubmissionForm has moderation disclosure notice", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(
        html.includes("moderated prior to publication") ||
          html.includes("reviewed prior to publication") ||
          html.includes("moderation"),
        "Moderation disclosure notice must be present"
      );
    });

    await runTest(
      "16. ReviewSubmissionForm requires NO email or phone field (strictly anonymous)",
      () => {
        const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
        assert(!html.includes('type="email"'), "No email input on review submission form");
        assert(!html.includes('type="tel"'), "No phone input on review submission form");
        assert(!html.includes('name="phone"'), "No phone field on review submission form");
        assert(!html.includes('name="email"'), "No email field on review submission form");
      }
    );

    await runTest("17. ReviewSubmissionForm requires NO password or login prompt", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(!html.includes('type="password"'), "No password input on review submission form");
      assert(!html.includes("Log in to leave a review"), "Login must not be required");
    });

    await runTest("18. ReviewSubmissionForm image input excludes video types", () => {
      const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
      assert(!html.includes("video/*"), "Video input must not be accepted in file input");
      assert(!html.includes("video/mp4"), "MP4 video must not be accepted in file input");
    });

    await runTest(
      "19. ReviewSubmissionForm file input has multiple attribute for batch selection",
      () => {
        const html = renderToStaticMarkup(<ReviewSubmissionForm products={MOCK_PRODUCTS} />);
        assert(html.includes("multiple"), "File input must allow multiple selection up to 3");
      }
    );

    // ========================================================================
    // Section 3: Public Reviews Page (/reviews) (Tests 20–27)
    // ========================================================================
    console.log("\nSection 3: Public Reviews Page /reviews (Tests 20–27)");

    await runTest("20. ReviewsPage renders with approved reviews and submission form", async () => {
      // Mock global.fetch for ReviewsPage
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1, MOCK_APPROVED_REVIEW_2],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 1,
              totalReviews: 2,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(pageElement);

      assert(html.includes("Customer Reviews"), "Header title must render");
      assert(html.includes("Ayesha Malik"), "Review 1 must render");
      assert(html.includes("Usman Tariq"), "Review 2 must render");
      assert(html.includes("Write a Review"), "Review submission form must render on /reviews");
    });

    await runTest(
      "21. ReviewsPage renders honest empty state when zero reviews are published",
      async () => {
        global.fetch = (async (url: string | URL | Request) => {
          const urlStr = url.toString();
          if (urlStr.includes("/api/v1/public/settings")) {
            return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
              status: 200,
            });
          }
          if (urlStr.includes("/api/v1/reviews")) {
            const data: PublicReviewsResponseData = {
              reviews: [],
              pagination: {
                page: 1,
                limit: 10,
                totalPages: 0,
                totalReviews: 0,
                hasNextPage: false,
                hasPrevPage: false,
              },
            };
            return new Response(JSON.stringify({ success: true, data }), { status: 200 });
          }
          if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
            return new Response(
              JSON.stringify({
                success: true,
                data: { products: MOCK_PRODUCTS },
              }),
              { status: 200 }
            );
          }
          return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
        }) as typeof fetch;

        const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(pageElement);

        assert(html.includes("No Reviews Published Yet"), "Honest empty state heading must render");
        assert(
          html.includes("Be the first to share your experience with our collection!"),
          "Honest invitation text must render"
        );
        assert(!html.includes("5.0 (0 reviews)"), "No fabricated star rating when empty");
      }
    );

    await runTest("22. ReviewsPage pagination controls render when totalPages > 1", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 3,
              totalReviews: 25,
              hasNextPage: true,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({ page: "1" }) });
      const html = renderToStaticMarkup(pageElement);

      assert(html.includes("Review pagination"), "Pagination container must render");
      assert(html.includes("Page 1 of 3"), "Page count indicator must render");
      assert(html.includes("/reviews?page=2"), "Next page link must be rendered");
    });

    await runTest("23. ReviewsPage pagination previous link disabled on page 1", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 2,
              totalReviews: 15,
              hasNextPage: true,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({ page: "1" }) });
      const html = renderToStaticMarkup(pageElement);

      assert(!html.includes("/reviews?page=0"), "No page 0 link on page 1");
      assert(html.includes("cursor-not-allowed"), "Previous button must be disabled on page 1");
    });

    await runTest("24. ReviewsPage pagination next link disabled on last page", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 2,
              limit: 10,
              totalPages: 2,
              totalReviews: 15,
              hasNextPage: false,
              hasPrevPage: true,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({ page: "2" }) });
      const html = renderToStaticMarkup(pageElement);

      assert(html.includes("/reviews?page=1"), "Previous page link must be active");
      assert(html.includes("Page 2 of 2"), "Page 2 of 2 indicator must render");
      assert(!html.includes("/reviews?page=3"), "No page 3 link on last page");
    });

    await runTest("25. ReviewsPage omits pagination when totalPages is 1", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 1,
              totalReviews: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(pageElement);

      assert(
        !html.includes('aria-label="Review pagination"'),
        "Pagination element must not render when only 1 page exists"
      );
    });

    await runTest("26. ReviewsPage never displays pending reviews", async () => {
      // API strictly returns only approved reviews
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          // Public endpoint returns only approved
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 1,
              totalReviews: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(pageElement);

      assert(
        !html.includes("Pending moderation"),
        "No pending moderation indicator in public reviews"
      );
      assert(!html.includes("PENDING"), "No PENDING string in public reviews");
    });

    await runTest("27. ReviewsPage never displays hidden reviews", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/public/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        if (urlStr.includes("/api/v1/reviews")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 10,
              totalPages: 1,
              totalReviews: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        if (urlStr.includes("/api/v1/storefronts/mini-sprouts/products")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { products: MOCK_PRODUCTS },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(pageElement);

      assert(!html.includes("HIDDEN"), "No HIDDEN string in public reviews");
    });

    // ========================================================================
    // Section 4: Product Detail Page (PDP) Integration (Tests 28–34)
    // ========================================================================
    console.log("\nSection 4: Product Detail Page Integration (Tests 28–34)");

    await runTest("28. ProductReviewsSection renders product-filtered reviews", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("productId=prod-1111-aaaa")) {
          const data: PublicReviewsResponseData = {
            reviews: [MOCK_APPROVED_REVIEW_1],
            pagination: {
              page: 1,
              limit: 5,
              totalPages: 1,
              totalReviews: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true, data: { reviews: [] } }), {
          status: 200,
        });
      }) as typeof fetch;

      const element = await ProductReviewsSection({
        productId: "prod-1111-aaaa",
        productName: "Festive Embroidered Kurta",
      });
      const html = renderToStaticMarkup(element);

      assert(html.includes("Customer Reviews"), "Section heading must render");
      assert(html.includes("Ayesha Malik"), "Matching product review must render");
      assert(html.includes("Exceptional quality fabric"), "Review content must render");
    });

    await runTest(
      "29. ProductReviewsSection renders honest empty state when no reviews exist",
      async () => {
        global.fetch = (async () => {
          const data: PublicReviewsResponseData = {
            reviews: [],
            pagination: {
              page: 1,
              limit: 5,
              totalPages: 0,
              totalReviews: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
          return new Response(JSON.stringify({ success: true, data }), { status: 200 });
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-empty",
          productName: "Classic Linen Shalwar Set",
        });
        const html = renderToStaticMarkup(element);

        assert(html.includes("No Reviews Yet"), "Honest empty heading must render");
        assert(
          html.includes("There are no published reviews for this product yet."),
          "Honest empty message must render"
        );
      }
    );

    await runTest("30. ProductReviewsSection links to community review submission", async () => {
      global.fetch = (async () => {
        return new Response(JSON.stringify({ success: true, data: { reviews: [] } }), {
          status: 200,
        });
      }) as typeof fetch;

      const element = await ProductReviewsSection({
        productId: "prod-1111-aaaa",
        productName: "Festive Embroidered Kurta",
      });
      const html = renderToStaticMarkup(element);

      assert(html.includes('href="/reviews"'), "Must link to /reviews");
      assert(html.includes("Community Reviews"), "Link anchor text must be present");
    });

    await runTest(
      "31. ProductReviewsSection omits product link in cards to avoid circular navigation",
      async () => {
        global.fetch = (async () => {
          return new Response(
            JSON.stringify({ success: true, data: { reviews: [MOCK_APPROVED_REVIEW_1] } }),
            { status: 200 }
          );
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-1111-aaaa",
          productName: "Festive Embroidered Kurta",
        });
        const html = renderToStaticMarkup(element);

        assert(
          !html.includes('href="/mini-sprouts/products/festive-embroidered-kurta"'),
          "Product link inside card must be omitted on product's own PDP"
        );
      }
    );

    await runTest(
      "32. ProductReviewsSection contains NO <form> tag (Strict Storefront Test 62 Compliance)",
      async () => {
        global.fetch = (async () => {
          return new Response(
            JSON.stringify({ success: true, data: { reviews: [MOCK_APPROVED_REVIEW_1] } }),
            { status: 200 }
          );
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-1111-aaaa",
          productName: "Festive Embroidered Kurta",
        });
        const html = renderToStaticMarkup(element);

        assert(
          !html.includes("<form"),
          "ProductReviewsSection must not render a form element on PDP"
        );
      }
    );

    await runTest(
      "33. ProductReviewsSection contains NO 'write a review' text (Strict Storefront Test 62 Compliance)",
      async () => {
        global.fetch = (async () => {
          return new Response(JSON.stringify({ success: true, data: { reviews: [] } }), {
            status: 200,
          });
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-1111-aaaa",
          productName: "Festive Embroidered Kurta",
        });
        const html = renderToStaticMarkup(element);

        assert(
          !html.toLowerCase().includes("write a review"),
          "ProductReviewsSection must not contain 'write a review' text directly on PDP"
        );
      }
    );

    await runTest(
      "34. ProductReviewsSection does not fabricate star ratings when empty",
      async () => {
        global.fetch = (async () => {
          return new Response(JSON.stringify({ success: true, data: { reviews: [] } }), {
            status: 200,
          });
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-empty",
          productName: "Empty Kurta",
        });
        const html = renderToStaticMarkup(element);

        assert(!html.includes("★"), "No fake star symbols when empty");
        assert(!html.includes("5.0 out of 5"), "No fake 5.0 score when empty");
      }
    );

    // ========================================================================
    // Section 5: Homepage Reviews Preview Component (Tests 35–38)
    // ========================================================================
    console.log("\nSection 5: Homepage Reviews Preview Component (Tests 35–38)");

    await runTest(
      "35. ReviewsPreview renders genuine customer feedback when reviews prop has items",
      () => {
        const html = renderToStaticMarkup(
          <ReviewsPreview reviews={[MOCK_APPROVED_REVIEW_1, MOCK_APPROVED_REVIEW_2]} />
        );

        assert(html.includes("Customer Feedback"), "Section title must render");
        assert(html.includes("Ayesha Malik"), "Reviewer 1 must render");
        assert(html.includes("Usman Tariq"), "Reviewer 2 must render");
        assert(html.includes('href="/reviews"'), "Link to community reviews must render");
      }
    );

    await runTest(
      "36. ReviewsPreview renders honest placeholder when reviews prop is empty without Verified Reviews claim",
      () => {
        const html = renderToStaticMarkup(<ReviewsPreview reviews={[]} />);

        assert(html.includes("No Customer Reviews Yet"), "Honest placeholder heading must render");
        assert(
          html.includes("Customer reviews and celebration snapshots will be published here"),
          "Honest placeholder description must render"
        );
        assert(
          !html.toLowerCase().includes("verified review"),
          "Homepage must not claim verified reviews"
        );
        assert(
          !html.toLowerCase().includes("verified buyer"),
          "Homepage must not claim verified buyer"
        );
      }
    );

    await runTest(
      "37. ReviewsPreview contains NO <form> tag (Strict Storefront Shell Test 32 Compliance)",
      () => {
        const htmlWithReviews = renderToStaticMarkup(
          <ReviewsPreview reviews={[MOCK_APPROVED_REVIEW_1]} />
        );
        assert(!htmlWithReviews.includes("<form"), "ReviewsPreview must not render a form element");

        const htmlEmpty = renderToStaticMarkup(<ReviewsPreview reviews={[]} />);
        assert(
          !htmlEmpty.includes("<form"),
          "ReviewsPreview empty placeholder must not render a form element"
        );
      }
    );

    await runTest("38. ReviewsPreview limits displayed reviews to maximum 3", () => {
      const reviews = [
        MOCK_APPROVED_REVIEW_1,
        MOCK_APPROVED_REVIEW_2,
        { ...MOCK_APPROVED_REVIEW_1, id: "rev-3333", reviewerName: "Third Reviewer" },
        { ...MOCK_APPROVED_REVIEW_1, id: "rev-4444", reviewerName: "Fourth Reviewer" },
      ];
      const html = renderToStaticMarkup(<ReviewsPreview reviews={reviews} />);

      assert(html.includes("Ayesha Malik"), "Review 1 must render");
      assert(html.includes("Usman Tariq"), "Review 2 must render");
      assert(html.includes("Third Reviewer"), "Review 3 must render");
      assert(!html.includes("Fourth Reviewer"), "Review 4 must be excluded on homepage preview");
    });

    // ========================================================================
    // Section 6: Scope Boundaries & Exclusions (Tests 39–43)
    // ========================================================================
    console.log("\nSection 6: Scope Boundaries & Exclusions (Tests 39–43)");

    await runTest("39. no 'Verified Purchase' badge in rendered review cards", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(!html.includes("Verified Purchase"), "Verified Purchase badge must not exist in V1");
      assert(!html.includes("verified-badge"), "Verified badge class must not exist");
    });

    await runTest("40. no helpful votes or review rating voting buttons", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(!html.includes("Helpful"), "Helpful voting button must not exist in V1");
      assert(!html.includes("Was this review helpful?"), "Helpful voting question must not exist");
      assert(!html.includes("thumbs-up"), "Thumbs up icon must not exist");
    });

    await runTest("41. no review video player in rendered reviews", () => {
      const html = renderToStaticMarkup(<ReviewCard review={MOCK_APPROVED_REVIEW_1} />);
      assert(!html.includes("<video"), "Video element must not be rendered in reviews");
      assert(!html.includes("video/mp4"), "Video mime type must not appear in review markup");
    });

    await runTest("42. no customer 'My Reviews' or review edit route files exist", () => {
      const baseDir = fs.existsSync(path.join(process.cwd(), "src"))
        ? path.join(process.cwd(), "src/app/account")
        : path.join(process.cwd(), "apps/web/src/app/account");
      const myReviewsPath1 = path.join(baseDir, "reviews");
      const myReviewsPath2 = path.join(baseDir, "my-reviews");
      assert(!fs.existsSync(myReviewsPath1), "Customer reviews account route must not exist");
      assert(!fs.existsSync(myReviewsPath2), "Customer my-reviews account route must not exist");
    });

    await runTest("43. no Cloudinary API secret in web bundle or source code", () => {
      const apiFile = fs.existsSync(path.join(process.cwd(), "src/lib/api.ts"))
        ? path.join(process.cwd(), "src/lib/api.ts")
        : path.join(process.cwd(), "apps/web/src/lib/api.ts");
      const apiFileContent = fs.readFileSync(apiFile, "utf-8");
      assert(
        !apiFileContent.includes("api_secret"),
        "api_secret must never appear in client api code"
      );
      assert(
        !apiFileContent.includes("CLOUDINARY_API_SECRET"),
        "CLOUDINARY_API_SECRET must never appear in web bundle"
      );
    });

    await runTest("44. no dangerouslySetInnerHTML is used for Review content", () => {
      const componentPaths = [
        "apps/web/src/components/reviews/review-card.tsx",
        "apps/web/src/components/reviews/review-submission-form.tsx",
        "apps/web/src/app/reviews/page.tsx",
        "apps/web/src/components/pdp/product-reviews-section.tsx",
        "apps/web/src/components/home/reviews-preview.tsx",
      ];
      for (const relPath of componentPaths) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          assert(
            !content.includes("dangerouslySetInnerHTML"),
            `dangerouslySetInnerHTML must never exist in ${relPath}`
          );
        }
      }
    });

    await runTest(
      "45. /reviews contains no Verified Purchase or Verified Buyer claim",
      async () => {
        global.fetch = (async (url: string | URL | Request) => {
          const urlStr = url.toString();
          if (urlStr.includes("/api/v1/storefronts/settings")) {
            return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
              status: 200,
            });
          }
          if (urlStr.includes("/api/v1/reviews")) {
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  reviews: [MOCK_APPROVED_REVIEW_1],
                  pagination: { page: 1, limit: 10, totalPages: 1, totalReviews: 1 },
                },
              }),
              { status: 200 }
            );
          }
          return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
        }) as typeof fetch;

        const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(pageElement);
        assert(
          !html.toLowerCase().includes("verified purchase"),
          "Must not claim verified purchase"
        );
        assert(!html.toLowerCase().includes("verified buyer"), "Must not claim verified buyer");
      }
    );

    await runTest("46. PDP contains no verified-purchase claim", async () => {
      global.fetch = (async () => {
        return new Response(
          JSON.stringify({ success: true, data: { reviews: [MOCK_APPROVED_REVIEW_1] } }),
          { status: 200 }
        );
      }) as typeof fetch;

      const element = await ProductReviewsSection({
        productId: "prod-1111-aaaa",
        productName: "Festive Embroidered Kurta",
      });
      const html = renderToStaticMarkup(element);
      assert(!html.toLowerCase().includes("verified purchase"), "Must not claim verified purchase");
      assert(!html.toLowerCase().includes("verified buyer"), "Must not claim verified buyer");
    });

    await runTest(
      "47. approved Review for non-public Product is not rendered from public API results",
      async () => {
        // Backend filters out reviews of non-public products; simulate empty response returned to client
        global.fetch = (async () => {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                reviews: [],
                pagination: { page: 1, limit: 5, totalPages: 0, totalReviews: 0 },
              },
            }),
            { status: 200 }
          );
        }) as typeof fetch;

        const element = await ProductReviewsSection({
          productId: "prod-draft-hidden",
          productName: "Hidden Product",
        });
        const html = renderToStaticMarkup(element);

        // Disappears into honest empty state
        assert(html.includes("No Reviews Yet"), "Honest empty state must render");
        assert(!html.includes("Hidden Product review"), "No review content rendered");
      }
    );

    await runTest("48. empty Review state remains honest", async () => {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/v1/storefronts/settings")) {
          return new Response(JSON.stringify({ success: true, data: MOCK_SETTINGS }), {
            status: 200,
          });
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              reviews: [],
              pagination: { page: 1, limit: 10, totalPages: 0, totalReviews: 0 },
            },
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const pageElement = await ReviewsPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(pageElement);

      assert(html.includes("No Reviews Published Yet"), "Honest empty title");
      assert(!html.includes("5.0"), "Must not fabricate 5.0 rating");
      assert(!html.includes("★★★★★"), "Must not fabricate stars");
    });
  } finally {
    global.fetch = originalFetch;
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log("Kids Wear — Reviews Frontend Test Suite Results:");
  console.log(`Total:  ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
