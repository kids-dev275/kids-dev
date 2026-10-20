/**
 * Kids Wear E2E Integration Test Fixtures & Constants
 */

export const E2E_ADMIN_CREDENTIALS = {
  email: "e2e-admin@thekidswear.com",
  password: "E2EAdminPassword123!",
};

export const STOREFRONTS = {
  miniSprouts: {
    name: "Mini Sprouts",
    slug: "mini-sprouts",
    ageLabel: "0–10 Years",
    path: "/mini-sprouts",
  },
  teenStudio: {
    name: "Teen Studio",
    slug: "teen-studio",
    ageLabel: "11–16 Years",
    path: "/teen-studio",
  },
  auraStudio: {
    name: "Aura Studio",
    slug: "aura-studio",
    ageLabel: "17+ Years",
    path: "/aura-studio",
  },
} as const;

export const SEEDED_PRODUCTS = {
  kurta: {
    name: "E2E Classic Kurta",
    slug: "e2e-classic-kurta",
    sku: "E2E-KRT-01",
    storefront: "mini-sprouts",
    storefrontPath: "/mini-sprouts",
    pdpPath: "/mini-sprouts/products/e2e-classic-kurta",
    availableSize: "2-3 Years",
    availableColor: "Ocean Blue",
    unavailableSize: "2-3 Years",
    unavailableColor: "Crimson Red",
    price: "2490.00",
  },
  polo: {
    name: "E2E Teen Polo",
    slug: "e2e-teen-polo",
    sku: "E2E-POLO-01",
    storefront: "teen-studio",
    storefrontPath: "/teen-studio",
    pdpPath: "/teen-studio/products/e2e-teen-polo",
    availableSize: "11-12 Years",
    availableColor: "Navy Blue",
    price: "1990.00",
  },
} as const;

export function generateTestCustomerEmail(): string {
  return `e2e-customer-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

export const TEST_CUSTOMER_PASSWORD = "CustomerPassword123!";
