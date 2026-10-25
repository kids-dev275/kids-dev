import assert from "node:assert/strict";
import type { AdminHeroSlide } from "../src/lib/admin-api";
import { isAbortedAdminRequest, saveHeroSlideOnce, upsertHeroSlide } from "../src/lib/admin-hero-request-state";

const slide: AdminHeroSlide = {
  id: "slide-1",
  storefrontId: "store-1",
  heading: "A hero slide",
  text: null,
  ctaLabel: null,
  ctaLink: null,
  sortOrder: 0,
  isActive: true,
  desktopImageAsset: { id: "asset-1", secureUrl: "https://example.test/hero.webp", width: 1920, height: 800, format: "webp" },
  mobileImageAsset: null,
};

const payload = { heading: "A hero slide", desktopImageAssetId: "asset-1" };

async function main() {
  let creates = 0;
  let updates = 0;
  const api = {
    create: async () => { creates += 1; return { success: true as const, data: { heroSlide: slide } }; },
    update: async () => { updates += 1; return { success: true as const, data: { heroSlide: slide } }; },
  };

  const created = await saveHeroSlideOnce("store-1", null, payload, api);
  assert.equal(created.success, true);
  assert.equal(creates, 1);
  assert.equal(updates, 0);
  assert.deepEqual(upsertHeroSlide([], slide), [slide]);
  console.log("PASS: create calls one mutation and inserts the returned slide without a read request");

  const updated = await saveHeroSlideOnce("store-1", slide.id, payload, api);
  assert.equal(updated.success, true);
  assert.equal(creates, 1);
  assert.equal(updates, 1);
  assert.deepEqual(upsertHeroSlide([slide], { ...slide, heading: "Updated" }).map((item) => item.heading), ["Updated"]);
  console.log("PASS: update calls one mutation and replaces the returned slide without duplication");

  assert.equal(upsertHeroSlide([slide], slide).length, 1);
  console.log("PASS: reapplying a saved slide does not duplicate it in the list");

  let failedCreates = 0;
  const failed = await saveHeroSlideOnce("store-1", null, payload, {
    ...api,
    create: async () => { failedCreates += 1; return { success: false as const, error: { code: "NETWORK_ERROR", message: "Failed to fetch" } }; },
  });
  assert.equal(failed.success, false);
  assert.equal(failedCreates, 1);
  console.log("PASS: an uncertain save response is returned without a blind retry");

  assert.equal(isAbortedAdminRequest({ name: "AbortError" }), true);
  assert.equal(isAbortedAdminRequest({ code: "REQUEST_ABORTED" }), true);
  assert.equal(isAbortedAdminRequest({ code: "NETWORK_ERROR" }), false);
  console.log("PASS: intentional aborts are distinct from network failures");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
