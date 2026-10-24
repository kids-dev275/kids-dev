import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { DEFAULT_STOREFRONT, resolveStorefrontPreference } from "../src/lib/storefront-preference";
import { STOREFRONT_COOKIE } from "../src/components/theme/storefront-tokens";

for (const slug of ["mini-sprouts", "teen-studio", "aura-studio"] as const) {
  assert.equal(resolveStorefrontPreference(slug), slug);

  const response = proxy(new NextRequest(`http://localhost:3000/${slug}/shop`));
  assert.equal(response.cookies.get(STOREFRONT_COOKIE)?.value, slug);
  assert.equal(response.cookies.get(STOREFRONT_COOKIE)?.path, "/");
}

assert.equal(resolveStorefrontPreference(undefined), DEFAULT_STOREFRONT);
assert.equal(resolveStorefrontPreference("unknown-storefront"), DEFAULT_STOREFRONT);
assert.equal(resolveStorefrontPreference("teen-studio/../../admin"), DEFAULT_STOREFRONT);

const prefetchResponse = proxy(
  new NextRequest("http://localhost:3000/aura-studio", {
    headers: { "next-router-prefetch": "1" },
  })
);
assert.equal(prefetchResponse.cookies.get(STOREFRONT_COOKIE), undefined);

console.log("Storefront preference tests passed.");
