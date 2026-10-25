import assert from "node:assert/strict";
import { getHeroCrop, getHeroImageError } from "../src/lib/admin-hero-media";

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
