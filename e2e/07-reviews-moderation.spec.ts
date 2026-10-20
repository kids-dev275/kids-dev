import { test, expect } from "@playwright/test";
import { E2E_ADMIN_CREDENTIALS, SEEDED_PRODUCTS } from "./fixtures/test-data";

test.describe("07. Anonymous Review Submission, Admin Moderation & Plain-Text Safety", () => {
  const reviewerName = "Amina K.";
  const rawReviewText = "I like <this> stitched kurta & the fabric.";

  test("24–27. Submit review with markup -> Pending -> Admin Approve -> Public Plain-Text Display -> Admin Hide", async ({
    page,
  }) => {
    // 1. Submit Anonymous Review with markup characters
    await page.goto("/reviews");
    await expect(
      page.getByRole("heading", { name: "Customer Reviews", exact: true })
    ).toBeVisible();

    // Fill Review form
    await page.locator("#review-name").fill(reviewerName);
    await page.locator("#review-product").selectOption({ label: SEEDED_PRODUCTS.kurta.name });
    await page.locator('input[name="review-rating"][value="5"]').check({ force: true });
    await page.locator("#review-text").fill(rawReviewText);

    await page.getByRole("button", { name: /Submit Review/i }).click();

    // 24. Verify submission feedback states it is submitted for moderation
    await expect(page.getByText(/submitted for approval/i)).toBeVisible();

    // Verify it is NOT published on the public reviews page yet
    await expect(page.getByText(rawReviewText)).not.toBeVisible();

    // 25. Admin Moderation: Log in and Approve
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: /Review Moderation/i })).toBeVisible();

    // Search or locate pending review
    await page.getByPlaceholder(/Search by reviewer name/i).fill(reviewerName);
    await page.waitForTimeout(500); // Debounce filter
    await expect(page.getByText(reviewerName).first()).toBeVisible();

    // Click Approve
    const approveBtn = page.getByRole("button", { name: /^Approve$/i }).first();
    await approveBtn.click();
    await expect(page.getByText(/Review marked as Approved/i)).toBeVisible();

    // 27. Public Plain-Text Verification
    // Navigate back to public reviews page
    await page.goto("/reviews");
    await expect(page.getByText(reviewerName).first()).toBeVisible();
    await expect(page.getByText(rawReviewText).first()).toBeVisible();

    // Assert literal text rendering: there must be NO <this> tag in DOM!
    const customTagCount = await page.locator("this").count();
    expect(customTagCount).toBe(0);

    // 26. Admin Moderation: Hide the review
    await page.goto("/admin/reviews");
    await page.getByPlaceholder(/Search by reviewer name/i).fill(reviewerName);
    await page.waitForTimeout(500);
    const hideBtn = page.getByRole("button", { name: /^Hide$/i }).first();
    await hideBtn.click();
    await expect(page.getByText(/Review marked as Hidden/i)).toBeVisible();

    // Verify review is no longer public
    await page.goto("/reviews");
    await expect(page.getByText(rawReviewText)).not.toBeVisible();
  });
});
