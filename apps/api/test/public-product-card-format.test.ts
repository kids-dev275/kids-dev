import assert from "node:assert/strict";
import { formatPublicProductCard } from "../src/modules/product/public-visibility";

const card = formatPublicProductCard({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Garden Bloom Romper",
  slug: "garden-bloom-romper",
  regularPrice: "2950.00",
  compareAtPrice: null,
  isNewArrival: true,
  media: [
    {
      isMain: true,
      isHover: false,
      altText: "Romper front",
      mediaAsset: { secureUrl: "https://example.test/main.webp" },
    },
  ],
  colors: [
    { id: "pink", name: "Pink", sortOrder: 3 },
    { id: "cream", name: "Cream", sortOrder: 1 },
    { id: "navy", name: "Navy", sortOrder: 2 },
  ],
  sizes: [
    { id: "large", name: "6–7Y", sortOrder: 3 },
    { id: "small", name: "2–3Y", sortOrder: 1 },
    { id: "medium", name: "4–5Y", sortOrder: 2 },
  ],
  variants: [
    { id: "variant-cream-small", productColorId: "cream", productSizeId: "small" },
    { id: "variant-navy-medium", productColorId: "navy", productSizeId: "medium" },
  ],
});

assert.deepEqual(card.quickAdd.colors.map((color) => color.name), ["Cream", "Navy"]);
assert.deepEqual(card.quickAdd.sizes.map((size) => size.name), ["2–3Y", "4–5Y", "6–7Y"]);
assert.equal(card.quickAdd.variants.length, 2);
assert.equal(card.mainImage?.url, "https://example.test/main.webp");
assert.equal(card.regularPrice, "2950.00");
assert(!("status" in card));

console.log("Public product card formatter: 6 passed, 0 failed");
