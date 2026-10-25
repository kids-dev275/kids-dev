import assert from "node:assert/strict";
import { getHeroCrop, getHeroImageError, registerPreparedHeroImage } from "../src/lib/admin-hero-media";

const source = new File([new Uint8Array(100)], "mini-sprouts-hero-01-desktop.webp", { type: "image/webp" });

assert.equal(getHeroImageError(source, "desktop", 1672, 941), null);
console.log("PASS: repository desktop hero source is accepted for normalization");

const crop = getHeroCrop("desktop", 1672, 941);
assert.equal(crop.x, 0);
assert.equal(crop.y, 0);
assert.equal(crop.width, 1672);
assert.ok(crop.height < 941 && crop.height > 690);
console.log("PASS: desktop normalization preserves the top of the source image");

assert.match(getHeroImageError(new File(["x"], "hero.gif", { type: "image/gif" }), "desktop", 1920, 800) || "", /Unsupported image format/);
console.log("PASS: unsupported source formats are rejected");

assert.match(getHeroImageError(source, "desktop", 1000, 600) || "", /too small/);
assert.match(getHeroImageError(source, "mobile", 600, 900) || "", /too small/);
console.log("PASS: undersized desktop and mobile sources are rejected");

async function testUploadPipeline() {
  const signature = {
    success: true as const,
    data: {
      timestamp: 1,
      signature: "signature",
      apiKey: "key",
      cloudName: "cloud",
      folder: "heroes",
      publicId: "image",
      resourceType: "image" as const,
    },
  };
  const asset = { id: "asset-1", secureUrl: "https://example.test/hero.webp", width: 1920, height: 800, format: "webp" };
  let signatureCalls = 0;
  let uploadCalls = 0;
  let registrationCalls = 0;
  const dependencies = {
    getSignature: async () => { signatureCalls += 1; return signature; },
    uploadSigned: async () => { uploadCalls += 1; return "heroes/image"; },
    register: async () => { registrationCalls += 1; return { success: true as const, data: { mediaAsset: asset } }; },
  };

  assert.deepEqual(await registerPreparedHeroImage("store-1", "desktop", source, dependencies), asset);
  assert.equal(signatureCalls, 1);
  assert.equal(uploadCalls, 1);
  assert.equal(registrationCalls, 1);
  console.log("PASS: successful hero upload registers once and returns the preview asset");

  await assert.rejects(
    registerPreparedHeroImage("store-1", "desktop", source, {
      ...dependencies,
      getSignature: async () => ({ success: false as const, error: { code: "NETWORK_ERROR", message: "Failed to fetch" } }),
    }),
    /Could not request the hero image upload/
  );
  assert.equal(uploadCalls, 1);
  assert.equal(registrationCalls, 1);
  console.log("PASS: signature failure is contextual and does not upload or register");

  await assert.rejects(
    registerPreparedHeroImage("store-1", "desktop", source, {
      ...dependencies,
      uploadSigned: async () => { throw new TypeError("Failed to fetch"); },
    }),
    /media provider failed/
  );
  assert.equal(registrationCalls, 1);
  console.log("PASS: media-provider network failure does not register an asset");

  await assert.rejects(
    registerPreparedHeroImage("store-1", "desktop", source, {
      ...dependencies,
      register: async () => {
        registrationCalls += 1;
        return { success: false as const, error: { code: "NETWORK_ERROR", message: "Failed to fetch" } };
      },
    }),
    /Could not confirm hero image registration/
  );
  assert.equal(registrationCalls, 2);
  console.log("PASS: registration failure is reported once without an automatic retry");
}

void testUploadPipeline().catch((error) => { console.error(error); process.exitCode = 1; });
