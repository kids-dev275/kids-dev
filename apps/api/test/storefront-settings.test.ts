import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/admin-auth/services/password";
import {
  generateAdminCsrfToken,
  generateRawSessionToken as generateAdminRawToken,
  hashSessionToken as hashAdminToken,
} from "../src/modules/admin-auth/services/session";
import {
  generateCustomerCsrfToken,
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import { env } from "../src/config/env";
import { setCloudinaryService, resetCloudinaryService, type ICloudinaryService, type CloudinaryResourceMetadata, type UploadSignatureParams, type UploadSignatureResult, type HeroUploadSignatureParams } from "../src/lib/cloudinary";
import crypto from "node:crypto";

const TEST_ADMIN_EMAIL = "sk.fabrica@gmail.com";
const TEST_ADMIN_PASSWORD = "TestAdminSecurePassword123!";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${name}: ${errorMsg}`);
  }
}

async function runSuite(): Promise<void> {
  const app = await buildApp();
  const prisma = getPrismaClient();

  // eslint-disable-next-line no-console
  console.log("Starting Kids Wear — Work Unit 5 Storefront & Commerce Settings Test Suite...\n");

  // 1. Setup Admin User and Session
  let adminUser = await prisma.adminUser.findUnique({
    where: { email: TEST_ADMIN_EMAIL },
  });

  if (!adminUser) {
    const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
    adminUser = await prisma.adminUser.create({
      data: {
        email: TEST_ADMIN_EMAIL,
        passwordHash,
      },
    });
  }

  const adminRawToken = generateAdminRawToken();
  const adminTokenHash = hashAdminToken(adminRawToken);
  const adminSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      tokenHash: adminTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const adminCsrf = generateAdminCsrfToken(adminRawToken);
  const adminCookieHeader = `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`;

  // 2. Fetch seeded Storefronts
  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  const auraStudio = await prisma.storefront.findUnique({ where: { slug: "aura-studio" } });

  assert(miniSprouts !== null, "Mini Sprouts seed record must exist");
  assert(teenStudio !== null, "Teen Studio seed record must exist");
  assert(auraStudio !== null, "Aura Studio seed record must exist");

  const miniSproutsId = miniSprouts.id;
  const teenStudioId = teenStudio.id;

  // 3. Create test MediaAssets
  const desktopAsset = await prisma.mediaAsset.create({
    data: {
      mediaType: "IMAGE",
      provider: "cloudinary",
      providerPublicId: "test/desktop-hero-1",
      secureUrl: "https://res.cloudinary.com/test/image/upload/desktop-1.jpg",
      width: 1920,
      height: 800,
      format: "jpg",
    },
  });

  const mobileAsset = await prisma.mediaAsset.create({
    data: {
      mediaType: "IMAGE",
      provider: "cloudinary",
      providerPublicId: "test/mobile-hero-1",
      secureUrl: "https://res.cloudinary.com/test/image/upload/mobile-1.jpg",
      width: 1080,
      height: 1350,
      format: "jpg",
    },
  });

  const videoAsset = await prisma.mediaAsset.create({
    data: {
      mediaType: "VIDEO",
      provider: "cloudinary",
      providerPublicId: "test/video-hero-1",
      secureUrl: "https://res.cloudinary.com/test/video/upload/video-1.mp4",
      duration: 15.5,
      format: "mp4",
    },
  });

  // Track created HeroSlide IDs for cleanup
  const createdSlideIds: string[] = [];
  const registeredHeroAssetIds: string[] = [];

  // ==========================================================================
  // PART A — PUBLIC STOREFRONTS
  // ==========================================================================

  // 1. public Storefront list returns exactly 3 records
  await runTest("public Storefront list returns exactly 3 records", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts",
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Response success must be true");
    assert(Array.isArray(json.data.storefronts), "storefronts must be an array");
    assert(
      json.data.storefronts.length === 3,
      `Expected 3 storefronts, got ${json.data.storefronts.length}`
    );
  });

  // 2. Storefront ordering is deterministic
  await runTest("Storefront ordering is deterministic", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts",
    });
    const json = JSON.parse(res.body);
    const slugs = json.data.storefronts.map((s: { slug: string }) => s.slug);
    assert(slugs[0] === "mini-sprouts", `Expected first to be mini-sprouts, got ${slugs[0]}`);
    assert(slugs[1] === "teen-studio", `Expected second to be teen-studio, got ${slugs[1]}`);
    assert(slugs[2] === "aura-studio", `Expected third to be aura-studio, got ${slugs[2]}`);
  });

  // 3. Mini Sprouts identity correct
  await runTest("Mini Sprouts identity correct", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts",
    });
    const json = JSON.parse(res.body);
    const ms = json.data.storefronts.find((s: { slug: string }) => s.slug === "mini-sprouts");
    assert(ms !== undefined, "Mini Sprouts must be present");
    assert(ms.name === "Mini Sprouts", `Name mismatch: ${ms.name}`);
    assert(ms.ageLabel === "0–10 Years", `Age label mismatch: ${ms.ageLabel}`);
  });

  // 4. Teen Studio identity correct
  await runTest("Teen Studio identity correct", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts",
    });
    const json = JSON.parse(res.body);
    const ts = json.data.storefronts.find((s: { slug: string }) => s.slug === "teen-studio");
    assert(ts !== undefined, "Teen Studio must be present");
    assert(ts.name === "Teen Studio", `Name mismatch: ${ts.name}`);
    assert(ts.ageLabel === "11–16 Years", `Age label mismatch: ${ts.ageLabel}`);
  });

  // 5. Aura Studio identity correct
  await runTest("Aura Studio identity correct", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts",
    });
    const json = JSON.parse(res.body);
    const as = json.data.storefronts.find((s: { slug: string }) => s.slug === "aura-studio");
    assert(as !== undefined, "Aura Studio must be present");
    assert(as.name === "Aura Studio", `Name mismatch: ${as.name}`);
    assert(as.ageLabel === "17+ Years", `Age label mismatch: ${as.ageLabel}`);
  });

  // 6. unknown slug returns 404
  await runTest("unknown slug returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts/unknown-non-existent-slug",
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === false, "Response success must be false");
    assert(
      json.error.code === "STOREFRONT_NOT_FOUND",
      `Expected STOREFRONT_NOT_FOUND, got ${json.error.code}`
    );
  });

  let activePublicSlideId = "";
  // 7. inactive Hero Slide hidden publicly
  await runTest("inactive Hero Slide hidden publicly", async () => {
    // Create an active slide and an inactive slide
    const activeSlide = await prisma.heroSlide.create({
      data: {
        storefrontId: miniSproutsId,
        heading: "Active Public Slide",
        desktopImageAssetId: desktopAsset.id,
        sortOrder: 1,
        isActive: true,
      },
    });
    createdSlideIds.push(activeSlide.id);
    activePublicSlideId = activeSlide.id;

    const inactiveSlide = await prisma.heroSlide.create({
      data: {
        storefrontId: miniSproutsId,
        heading: "Inactive Hidden Slide",
        desktopImageAssetId: desktopAsset.id,
        sortOrder: 2,
        isActive: false,
      },
    });
    createdSlideIds.push(inactiveSlide.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts/mini-sprouts",
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const slides = json.data.storefront.heroSlides;
    const hasActive = slides.some((s: { id: string }) => s.id === activeSlide.id);
    const hasInactive = slides.some((s: { id: string }) => s.id === inactiveSlide.id);

    assert(hasActive, "Active slide should be returned");
    assert(!hasInactive, "Inactive slide must NOT be returned in public endpoint");
  });

  // 8. active Hero Slides returned in sort order
  await runTest("active Hero Slides returned in sort order", async () => {
    // Create another active slide with sortOrder: 0 (should appear before the sortOrder: 1 slide)
    const firstSlide = await prisma.heroSlide.create({
      data: {
        storefrontId: miniSproutsId,
        heading: "First Sort Slide",
        desktopImageAssetId: desktopAsset.id,
        sortOrder: 0,
        isActive: true,
      },
    });
    createdSlideIds.push(firstSlide.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/storefronts/mini-sprouts",
    });
    const json = JSON.parse(res.body);
    const slides = json.data.storefront.heroSlides;
    assert(slides.length >= 2, "Expected at least 2 active slides");
    const firstIndex = slides.findIndex((s: { id: string }) => s.id === firstSlide.id);
    const activeIndex = slides.findIndex((s: { id: string }) => s.id === activePublicSlideId);
    assert(firstIndex >= 0 && activeIndex > firstIndex, "Slide with sortOrder 0 must precede sortOrder 1");
    assert(
      slides[firstIndex].desktopImageAsset.secureUrl !== undefined,
      "Media asset details should be populated"
    );
  });

  // ==========================================================================
  // PART B — ADMIN HERO SLIDES
  // ==========================================================================

  // 9. unauthenticated Admin Hero list rejected
  await runTest("unauthenticated Admin Hero list rejected", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 10. authenticated Admin Hero list succeeds
  await runTest("authenticated Admin Hero list succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(Array.isArray(json.data.heroSlides), "heroSlides should be an array");
    // Admin list must include both active and inactive slides
    const hasInactive = json.data.heroSlides.some(
      (s: { isActive: boolean }) => s.isActive === false
    );
    assert(hasInactive, "Admin hero list must include inactive slides");
  });

  // 11. Hero creation requires CSRF
  await runTest("Hero creation requires CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: { cookie: adminCookieHeader },
      payload: {
        heading: "CSRF Test Slide",
        desktopImageAssetId: desktopAsset.id,
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 12. valid Hero creation succeeds
  let createdHeroId = "";
  await runTest("valid Hero creation succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        heading: "New Season Collection",
        text: "Special handcrafted outfits for children",
        ctaLabel: "Shop Collection",
        ctaLink: "/shop/mini-sprouts",
        desktopImageAssetId: desktopAsset.id,
        mobileImageAssetId: mobileAsset.id,
        sortOrder: 10,
        isActive: true,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.heroSlide.heading === "New Season Collection", "Heading mismatch");
    assert(json.data.heroSlide.mobileImageAssetId === mobileAsset.id, "Mobile asset ID mismatch");
    assert(
      json.data.heroSlide.desktopImageAsset.secureUrl !== undefined,
      "Desktop media asset populated"
    );
    createdHeroId = json.data.heroSlide.id;
    createdSlideIds.push(createdHeroId);
  });

  // 13. non-image MediaAsset rejected
  await runTest("non-image MediaAsset rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        heading: "Video Slide",
        desktopImageAssetId: videoAsset.id,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "INVALID_MEDIA_TYPE",
      `Expected INVALID_MEDIA_TYPE, got ${json.error.code}`
    );
  });

  // 14. unknown MediaAsset rejected
  await runTest("unknown MediaAsset rejected", async () => {
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        heading: "Unknown Asset Slide",
        desktopImageAssetId: fakeUuid,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_ASSET_NOT_FOUND",
      `Expected MEDIA_ASSET_NOT_FOUND, got ${json.error.code}`
    );
  });

  const heroResources = new Map<string, CloudinaryResourceMetadata>();
  const heroCloudinary: ICloudinaryService = {
    async createUploadSignature(_params: UploadSignatureParams): Promise<UploadSignatureResult> {
      throw new Error("Product upload should not be used for hero images");
    },
    async createHeroUploadSignature({ storefrontId, placement }: HeroUploadSignatureParams) {
      const folder = `kids-wear/storefronts/${storefrontId}/heroes/${placement}`;
      return {
        timestamp: 1,
        signature: "test-signature",
        apiKey: "test-key",
        cloudName: "test-cloud",
        resourceType: "image" as const,
        folder,
        publicId: crypto.randomUUID(),
      };
    },
    async fetchResourceMetadata(publicId: string) {
      const resource = heroResources.get(publicId);
      if (!resource) throw new Error("Cloudinary image lookup failed");
      return resource;
    },
  };
  setCloudinaryService(heroCloudinary);
  const heroHeaders = { cookie: adminCookieHeader, "x-csrf-token": adminCsrf };
  let uploadedAssetId = "";
  let uploadedHeroId = "";

  await runTest("hero upload requires Admin authentication and CSRF", async () => {
    const url = `/api/v1/admin/storefronts/${miniSproutsId}/hero-media/upload-signature`;
    const anonymous = await app.inject({ method: "POST", url, payload: { placement: "desktop" } });
    assert(anonymous.statusCode === 401, `Expected 401, got ${anonymous.statusCode}`);
    const withoutCsrf = await app.inject({ method: "POST", url, headers: { cookie: adminCookieHeader }, payload: { placement: "desktop" } });
    assert(withoutCsrf.statusCode === 403, `Expected 403, got ${withoutCsrf.statusCode}`);
    const register = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`, payload: { placement: "desktop", publicId: "x" } });
    assert(register.statusCode === 401, `Expected 401, got ${register.statusCode}`);
  });

  await runTest("hero image upload registers MediaAsset and saves slide association", async () => {
    const signatureResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media/upload-signature`,
      headers: heroHeaders,
      payload: { placement: "desktop" },
    });
    assert(signatureResponse.statusCode === 200, `Expected 200, got ${signatureResponse.statusCode}`);
    const signature = JSON.parse(signatureResponse.body).data as { folder: string; publicId: string };
    const publicId = `${signature.folder}/${signature.publicId}`;
    heroResources.set(publicId, {
      publicId, secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.webp`,
      resourceType: "image", format: "webp", width: 1920, height: 800, bytes: 100000,
    });
    const registered = await app.inject({
      method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`,
      headers: heroHeaders, payload: { placement: "desktop", publicId },
    });
    assert(registered.statusCode === 201, `Expected 201, got ${registered.statusCode}`);
    uploadedAssetId = JSON.parse(registered.body).data.mediaAsset.id;
    registeredHeroAssetIds.push(uploadedAssetId);
    const asset = await prisma.mediaAsset.findUnique({ where: { id: uploadedAssetId } });
    assert(asset?.providerPublicId === publicId, "Uploaded MediaAsset not persisted");
    const slide = await app.inject({
      method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: heroHeaders, payload: { heading: "Little Styles, Big Smiles", desktopImageAssetId: uploadedAssetId },
    });
    assert(slide.statusCode === 201, `Expected 201, got ${slide.statusCode}`);
    uploadedHeroId = JSON.parse(slide.body).data.heroSlide.id;
    createdSlideIds.push(uploadedHeroId);
    assert(JSON.parse(slide.body).data.heroSlide.desktopImageAssetId === uploadedAssetId, "Slide did not use uploaded asset");
  });

  await runTest("hero slide without desktop image is rejected", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`, headers: heroHeaders, payload: { heading: "Missing image" } });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  });

  await runTest("hero registration rejects wrong media type and foreign namespace", async () => {
    const publicId = `kids-wear/storefronts/${miniSproutsId}/heroes/desktop/${crypto.randomUUID()}`;
    heroResources.set(publicId, {
      publicId, secureUrl: "https://res.cloudinary.com/test/video/upload/invalid.mp4",
      resourceType: "video", format: "mp4", width: 1920, height: 800, bytes: 100000,
    });
    const invalid = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`, headers: heroHeaders, payload: { placement: "desktop", publicId } });
    assert(invalid.statusCode === 400, `Expected 400, got ${invalid.statusCode}`);
    const foreign = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`, headers: heroHeaders, payload: { placement: "desktop", publicId: `kids-wear/storefronts/${teenStudioId}/heroes/desktop/${crypto.randomUUID()}` } });
    assert(foreign.statusCode === 400, `Expected 400, got ${foreign.statusCode}`);
  });

  await runTest("hero registration rejects wrong dimensions and oversized images", async () => {
    const publicId = `kids-wear/storefronts/${miniSproutsId}/heroes/desktop/${crypto.randomUUID()}`;
    const resource: CloudinaryResourceMetadata = {
      publicId, secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.webp`,
      resourceType: "image", format: "webp", width: 1672, height: 941, bytes: 100000,
    };
    heroResources.set(publicId, resource);
    const url = `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`;
    const dimensions = await app.inject({ method: "POST", url, headers: heroHeaders, payload: { placement: "desktop", publicId } });
    assert(dimensions.statusCode === 400, `Expected 400, got ${dimensions.statusCode}`);
    assert(JSON.parse(dimensions.body).error.code === "MEDIA_DIMENSIONS_INVALID", "Expected dimension validation");
    heroResources.set(publicId, { ...resource, width: 1920, height: 800, bytes: 11 * 1024 * 1024 });
    const size = await app.inject({ method: "POST", url, headers: heroHeaders, payload: { placement: "desktop", publicId } });
    assert(size.statusCode === 400, `Expected 400, got ${size.statusCode}`);
    assert(JSON.parse(size.body).error.code === "MEDIA_SIZE_INVALID", "Expected size validation");
  });

  await runTest("optional mobile hero image registers and associates with slide", async () => {
    const publicId = `kids-wear/storefronts/${miniSproutsId}/heroes/mobile/${crypto.randomUUID()}`;
    heroResources.set(publicId, {
      publicId, secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.webp`,
      resourceType: "image", format: "webp", width: 1080, height: 1350, bytes: 100000,
    });
    const registered = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`, headers: heroHeaders, payload: { placement: "mobile", publicId } });
    assert(registered.statusCode === 201, `Expected 201, got ${registered.statusCode}`);
    const mobileId = JSON.parse(registered.body).data.mediaAsset.id as string;
    registeredHeroAssetIds.push(mobileId);
    const updated = await app.inject({ method: "PATCH", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides/${uploadedHeroId}`, headers: heroHeaders, payload: { mobileImageAssetId: mobileId } });
    assert(updated.statusCode === 200, `Expected 200, got ${updated.statusCode}`);
    assert(JSON.parse(updated.body).data.heroSlide.mobileImageAssetId === mobileId, "Mobile image not associated");
  });

  await runTest("failed replacement upload preserves existing hero image", async () => {
    const missingId = `kids-wear/storefronts/${miniSproutsId}/heroes/desktop/${crypto.randomUUID()}`;
    const failed = await app.inject({ method: "POST", url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-media`, headers: heroHeaders, payload: { placement: "desktop", publicId: missingId } });
    assert(failed.statusCode !== 201, "Failed replacement registered unexpectedly");
    const slide = await prisma.heroSlide.findUnique({ where: { id: uploadedHeroId } });
    assert(slide?.desktopImageAssetId === uploadedAssetId, "Existing hero image changed after failed replacement");
  });
  resetCloudinaryService();

  // 15. Hero update succeeds
  await runTest("Hero update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides/${createdHeroId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        heading: "Updated Season Collection",
        sortOrder: 5,
        isActive: false,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.heroSlide.heading === "Updated Season Collection", "Heading not updated");
    assert(json.data.heroSlide.sortOrder === 5, "Sort order not updated");
    assert(json.data.heroSlide.isActive === false, "isActive not updated");
  });

  // 16. cross-Storefront Hero update rejected
  await runTest("cross-Storefront Hero update rejected", async () => {
    // Attempt to update miniSprouts slide using teenStudio storefrontId in route
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/storefronts/${teenStudioId}/hero-slides/${createdHeroId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        heading: "Hacked Heading",
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "HERO_SLIDE_NOT_FOUND",
      `Expected HERO_SLIDE_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 17. Hero deletion succeeds
  let slideToDeleteId = "";
  await runTest("Hero deletion succeeds", async () => {
    // Create a temporary slide to delete
    const tempSlide = await prisma.heroSlide.create({
      data: {
        storefrontId: miniSproutsId,
        heading: "Slide To Delete",
        desktopImageAssetId: desktopAsset.id,
      },
    });
    slideToDeleteId = tempSlide.id;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides/${slideToDeleteId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const inDb = await prisma.heroSlide.findUnique({ where: { id: slideToDeleteId } });
    assert(inDb === null, "Slide should be removed from database");
  });

  // 18. deletion does not delete MediaAsset
  await runTest("deletion does not delete MediaAsset", async () => {
    const assetInDb = await prisma.mediaAsset.findUnique({ where: { id: desktopAsset.id } });
    assert(
      assetInDb !== null,
      "Referenced MediaAsset must NOT be deleted when HeroSlide is deleted"
    );
  });

  // 19. reorder succeeds
  let reorderSlideA = "";
  let reorderSlideB = "";
  await runTest("reorder succeeds", async () => {
    const slideA = await prisma.heroSlide.create({
      data: {
        storefrontId: teenStudioId,
        heading: "Teen Slide A",
        desktopImageAssetId: desktopAsset.id,
        sortOrder: 0,
      },
    });
    const slideB = await prisma.heroSlide.create({
      data: {
        storefrontId: teenStudioId,
        heading: "Teen Slide B",
        desktopImageAssetId: desktopAsset.id,
        sortOrder: 1,
      },
    });
    reorderSlideA = slideA.id;
    reorderSlideB = slideB.id;
    createdSlideIds.push(reorderSlideA, reorderSlideB);

    // Swap order: B first, A second
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/storefronts/${teenStudioId}/hero-slides/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        slideIds: [reorderSlideB, reorderSlideA],
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const updatedA = await prisma.heroSlide.findUnique({ where: { id: reorderSlideA } });
    const updatedB = await prisma.heroSlide.findUnique({ where: { id: reorderSlideB } });
    assert(updatedB?.sortOrder === 0, `Expected B sortOrder 0, got ${updatedB?.sortOrder}`);
    assert(updatedA?.sortOrder === 1, `Expected A sortOrder 1, got ${updatedA?.sortOrder}`);
  });

  // 20. reorder with duplicate IDs rejected
  await runTest("reorder with duplicate IDs rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/storefronts/${teenStudioId}/hero-slides/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        slideIds: [reorderSlideA, reorderSlideA],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 21. reorder containing foreign-Storefront slide rejected
  await runTest("reorder containing foreign-Storefront slide rejected", async () => {
    // Attempt reordering teenStudio while including createdHeroId (which belongs to miniSprouts)
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/storefronts/${teenStudioId}/hero-slides/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        slideIds: [reorderSlideA, createdHeroId],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // PART C — PUBLIC SETTINGS
  // ==========================================================================

  // 22. public settings returns Announcement safe state
  await runTest("public settings returns Announcement safe state", async () => {
    // Ensure initial announcement state
    await prisma.announcementBar.update({
      where: { singletonKey: 1 },
      data: { text: null, link: null, isActive: false },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.announcement.text === null, "Announcement text should be null");
    assert(json.data.announcement.link === null, "Announcement link should be null");
    assert(json.data.announcement.isActive === false, "Announcement isActive should be false");
  });

  // 23. public settings returns flatDeliveryCharge = 300.00
  await runTest("public settings returns flatDeliveryCharge = 300.00", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const json = JSON.parse(res.body);
    assert(
      json.data.shipping.flatDeliveryCharge === "300.00",
      `Expected "300.00", got ${json.data.shipping.flatDeliveryCharge}`
    );
  });

  // 24. public settings does not expose notification recipient
  await runTest("public settings does not expose notification recipient", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("sk.fabrica@gmail.com"), "Public settings leaked notification email");
    assert(!bodyStr.includes("newOrder"), "Public settings leaked notification keys");
  });

  // 25. public settings does not expose bank account details
  await runTest("public settings does not expose bank account details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const json = JSON.parse(res.body);
    assert(json.data.bankTransfer === undefined, "Public settings leaked bankTransfer object");
    assert(json.data.bankName === undefined, "Public settings leaked bankName");
  });

  // 26. public settings does not expose singleton keys
  await runTest("public settings does not expose singleton keys", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("singletonKey"), "Public settings leaked singletonKey");
  });

  // ==========================================================================
  // PART D — ADMIN SETTINGS
  // ==========================================================================

  // 27. Admin announcement GET succeeds
  await runTest("Admin announcement GET succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/settings/announcement",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.announcement !== undefined, "announcement should be returned");
  });

  // 28. mutation requires CSRF
  await runTest("mutation requires CSRF", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/announcement",
      headers: { cookie: adminCookieHeader },
      payload: {
        text: "Attempted change without CSRF",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 29. valid announcement update succeeds
  await runTest("valid announcement update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/announcement",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        text: "Special Ramadan Delivery Notice",
        link: "/announcement",
        isActive: true,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.announcement.text === "Special Ramadan Delivery Notice", "Text not updated");
    assert(json.data.announcement.isActive === true, "isActive not updated");

    // Restore to foundation state
    await prisma.announcementBar.update({
      where: { singletonKey: 1 },
      data: { text: null, link: null, isActive: false },
    });
  });

  // 30. unsafe CTA/link protocol rejected
  await runTest("unsafe CTA/link protocol rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/announcement",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        link: "javascript:alert('xss')",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 31. unapproved fields rejected
  await runTest("unapproved fields rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/announcement",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        text: "Valid text",
        singletonKey: 2,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // Admin Shipping
  // ==========================================================================

  // 32. current delivery charge returned
  await runTest("current delivery charge returned", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/settings/shipping",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.shipping.flatDeliveryCharge === "300.00",
      `Expected "300.00", got ${json.data.shipping.flatDeliveryCharge}`
    );
  });

  // 33. valid delivery charge update succeeds
  await runTest("valid delivery charge update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        flatDeliveryCharge: 350,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.shipping.flatDeliveryCharge === "350.00",
      `Expected "350.00", got ${json.data.shipping.flatDeliveryCharge}`
    );

    // Verify in DB
    const dbCommerce = await prisma.commerceSettings.findUnique({ where: { singletonKey: 1 } });
    assert(dbCommerce?.flatDeliveryCharge.toFixed(2) === "350.00", "DB not updated");

    // Restore to 300.00
    await prisma.commerceSettings.update({
      where: { singletonKey: 1 },
      data: { flatDeliveryCharge: 300.0 },
    });
  });

  // 34. negative delivery charge rejected
  await runTest("negative delivery charge rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        flatDeliveryCharge: -50,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 35. free-shipping-threshold field rejected
  await runTest("free-shipping-threshold field rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        flatDeliveryCharge: 300,
        freeShippingThreshold: 3000,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 36. delivery-timeframe field rejected
  await runTest("delivery-timeframe field rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        deliveryTimeframe: "within 10 days",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );

    // Verify restored state
    const currentShipping = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
    });
    assert(
      currentShipping?.flatDeliveryCharge.toFixed(2) === "300.00",
      "Flat delivery charge should be 300.00"
    );
  });

  // ==========================================================================
  // Bank Transfer Settings
  // ==========================================================================

  // 37. Admin can read bank-transfer settings
  await runTest("Admin can read bank-transfer settings", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/settings/bank-transfer",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.bankTransfer !== undefined, "bankTransfer should be returned");
  });

  // 38. mutation requires CSRF
  await runTest("bank transfer mutation requires CSRF", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/bank-transfer",
      headers: { cookie: adminCookieHeader },
      payload: {
        bankName: "Meezan Bank",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 39. valid bank settings update succeeds
  await runTest("valid bank settings update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/bank-transfer",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        bankName: "Meezan Bank Limited",
        accountTitle: "Kids Wear Test Account",
        accountOrIban: "PK00MEZN0001234567890123",
        branchCode: "0102",
        branchLocation: "Karachi Main Branch",
        instructions: "Please send payment proof via WhatsApp.",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.bankTransfer.bankName === "Meezan Bank Limited", "bankName not updated");
    assert(
      json.data.bankTransfer.accountOrIban === "PK00MEZN0001234567890123",
      "accountOrIban not updated"
    );
  });

  // 40. public settings still does not expose them
  await runTest("public settings still does not expose bank details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("Meezan Bank"), "Public settings leaked bankName");
    assert(!bodyStr.includes("PK00MEZN"), "Public settings leaked accountOrIban");

    // Clean up bank transfer fields back to null
    await prisma.commerceSettings.update({
      where: { singletonKey: 1 },
      data: {
        bankName: null,
        accountTitle: null,
        accountOrIban: null,
        branchCode: null,
        branchLocation: null,
        instructions: null,
      },
    });
  });

  // ==========================================================================
  // Notifications
  // ==========================================================================

  // 41. current notification configuration returned
  await runTest("current notification configuration returned", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/settings/notifications",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.notifications.newOrderEmailEnabled === true,
      "newOrderEmailEnabled should be true"
    );
    assert(
      json.data.notifications.newOrderRecipientEmail === "sk.fabrica@gmail.com",
      "newOrderRecipientEmail mismatch"
    );
  });

  // 42. valid recipient update succeeds
  await runTest("valid recipient update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/notifications",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        newOrderRecipientEmail: "orders@kidswear.pk",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.notifications.newOrderRecipientEmail === "orders@kidswear.pk",
      "Email not updated"
    );
  });

  // 43. invalid email rejected
  await runTest("invalid email rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/notifications",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        newOrderRecipientEmail: "not-an-email-address",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 44. enabled notification without valid recipient rejected
  await runTest("enabled notification without valid recipient rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/notifications",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        newOrderEmailEnabled: true,
        newOrderRecipientEmail: null,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 45. public settings does not expose notification configuration
  await runTest("public settings does not expose notification configuration", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/settings",
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("orders@kidswear.pk"), "Public settings leaked recipient email");
    assert(
      !bodyStr.includes("newOrderEmailEnabled"),
      "Public settings leaked newOrderEmailEnabled"
    );

    // Restore notification configuration to initial values
    await prisma.commerceSettings.update({
      where: { singletonKey: 1 },
      data: {
        newOrderEmailEnabled: true,
        newOrderNotificationRecipient: "sk.fabrica@gmail.com",
      },
    });
  });

  // ==========================================================================
  // Security Boundaries
  // ==========================================================================

  // Create a temporary customer session for boundary testing
  const tempCustomer = await prisma.customer.create({
    data: {
      fullName: "Settings Security Tester",
      email: "settings.security@example.com",
      passwordHash: await hashPassword("CustomerPass123!"),
      isActive: true,
    },
  });

  const custRawToken = generateRawCustomerSessionToken();
  const custTokenHash = hashCustomerSessionToken(custRawToken);
  const custSession = await prisma.customerSession.create({
    data: {
      customerId: tempCustomer.id,
      tokenHash: custTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const customerCookieHeader = `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`;
  const customerCsrf = generateCustomerCsrfToken(custRawToken);

  // 46. Customer cookie cannot access Admin settings
  await runTest("Customer cookie cannot access Admin settings", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/settings/shipping",
      headers: { cookie: customerCookieHeader },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 47. Customer CSRF cannot mutate Admin settings
  await runTest("Customer CSRF cannot mutate Admin settings", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": customerCsrf,
      },
      payload: {
        flatDeliveryCharge: 320,
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 48. Admin GET requires valid Admin session
  await runTest("Admin GET requires valid Admin session", async () => {
    const fakeToken = "invalid-or-expired-admin-token";
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/storefronts/${miniSproutsId}/hero-slides`,
      headers: { cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${fakeToken}` },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 49. Admin PATCH requires matching Admin CSRF
  await runTest("Admin PATCH requires matching Admin CSRF", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/settings/shipping",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": "tampered-admin-csrf-token",
      },
      payload: {
        flatDeliveryCharge: 320,
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  // Clean up created HeroSlides
  if (createdSlideIds.length > 0) {
    await prisma.heroSlide.deleteMany({
      where: { id: { in: createdSlideIds } },
    });
  }

  // Clean up test MediaAssets
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: [desktopAsset.id, mobileAsset.id, videoAsset.id, ...registeredHeroAssetIds] } },
  });

  // Clean up Customer and CustomerSession
  await prisma.customerSession.delete({ where: { id: custSession.id } }).catch(() => {});
  await prisma.customer.delete({ where: { id: tempCustomer.id } }).catch(() => {});

  // Clean up AdminSession
  await prisma.adminSession.delete({ where: { id: adminSession.id } }).catch(() => {});

  // Ensure singleton foundation data integrity
  await prisma.announcementBar.update({
    where: { singletonKey: 1 },
    data: { text: null, link: null, isActive: false },
  });
  await prisma.commerceSettings.update({
    where: { singletonKey: 1 },
    data: {
      flatDeliveryCharge: 300.0,
      bankName: null,
      accountTitle: null,
      accountOrIban: null,
      branchCode: null,
      branchLocation: null,
      instructions: null,
      newOrderEmailEnabled: true,
      newOrderNotificationRecipient: "sk.fabrica@gmail.com",
    },
  });

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Storefront & Commerce Settings Tests Passed.`);
  // eslint-disable-next-line no-console
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
