import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword, normalizeEmail } from "../modules/admin-auth/services/password";

// Ensure environment variables are loaded
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });

export function getE2eDatabaseUrls(): { databaseUrl: string; directUrl: string } {
  const devDbUrl = process.env.DATABASE_URL;
  const devDirectUrl = process.env.DIRECT_URL || devDbUrl;

  if (!devDbUrl) {
    throw new Error("DATABASE_URL is not configured in environment.");
  }

  // Derive isolated E2E database URLs
  const e2eDbUrl =
    process.env.E2E_DATABASE_URL || devDbUrl.replace("kids_wear_dev", "kids_wear_e2e");
  const e2eDirectUrl =
    process.env.E2E_DIRECT_URL ||
    devDirectUrl?.replace("kids_wear_dev", "kids_wear_e2e") ||
    e2eDbUrl;

  assertSafeE2eDatabaseUrl(e2eDbUrl);
  assertSafeE2eDatabaseUrl(e2eDirectUrl);

  return { databaseUrl: e2eDbUrl, directUrl: e2eDirectUrl };
}

export function assertSafeE2eDatabaseUrl(url: string): void {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");

  if (!dbName.includes("e2e") && !dbName.includes("test")) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Database name "${dbName}" does not contain "e2e" or "test". Refusing to run E2E operations against potential production/development database!`
    );
  }
}

export function createE2ePrismaClient(databaseUrl: string): PrismaClient {
  assertSafeE2eDatabaseUrl(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const E2E_ADMIN_EMAIL = "e2e-admin@thekidswear.com";
export const E2E_ADMIN_PASSWORD = "E2EAdminPassword123!";

export async function setupE2eDatabase(): Promise<void> {
  const { databaseUrl, directUrl } = getE2eDatabaseUrls();

  console.log("🔒 E2E Database Safety Guard Verified: targeting isolated database");
  console.log("📦 Deploying Prisma migrations to E2E database...");

  // Execute prisma migrate deploy against isolated E2E database
  const apiDir = path.resolve(__dirname, "../..");
  execSync(`npx prisma migrate deploy`, {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl,
    },
    stdio: "inherit",
  });

  console.log("🌱 Seeding deterministic E2E baseline data...");
  const prisma = createE2ePrismaClient(databaseUrl);

  try {
    // 1. Clean existing records in dependency order
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE 
      "OrderStatusHistory",
      "OrderItem",
      "Order",
      "ReviewMedia",
      "Review",
      "ProductVariant",
      "ProductColor",
      "ProductSize",
      "ProductMedia",
      "HeroSlide",
      "SizeGuideRow",
      "SizeGuide",
      "Product",
      "CustomerSession",
      "Customer",
      "AdminSession",
      "AdminUser",
      "MediaAsset",
      "CommerceSettings",
      "AnnouncementBar",
      "Storefront"
      CASCADE;
    `);

    // 2. Three fixed Storefronts
    const miniSprouts = await prisma.storefront.create({
      data: {
        id: "10000000-0000-0000-0000-000000000001",
        name: "Mini Sprouts",
        slug: "mini-sprouts",
        ageLabel: "0–10 Years",
      },
    });

    const teenStudio = await prisma.storefront.create({
      data: {
        id: "10000000-0000-0000-0000-000000000002",
        name: "Teen Studio",
        slug: "teen-studio",
        ageLabel: "11–16 Years",
      },
    });

    await prisma.storefront.create({
      data: {
        id: "10000000-0000-0000-0000-000000000003",
        name: "Aura Studio",
        slug: "aura-studio",
        ageLabel: "17+ Years",
      },
    });

    // 3. AnnouncementBar singleton (inactive initially)
    await prisma.announcementBar.create({
      data: {
        singletonKey: 1,
        text: null,
        link: null,
        isActive: false,
      },
    });

    // 4. CommerceSettings singleton (300 PKR flat delivery, bank transfer configured)
    await prisma.commerceSettings.create({
      data: {
        singletonKey: 1,
        flatDeliveryCharge: 300,
        newOrderEmailEnabled: true,
        newOrderNotificationRecipient: "sk.fabrica@gmail.com",
        bankName: "Meezan Bank",
        accountTitle: "Kids Wear Test Limited",
        accountOrIban: "PK36MEZN0001234567890102",
        branchCode: "0102",
        branchLocation: "Attock",
        instructions:
          "Please transfer the grand total and keep your receipt for order verification.",
      },
    });

    // 5. Single Admin Account
    const adminPasswordHash = await hashPassword(E2E_ADMIN_PASSWORD);
    await prisma.adminUser.create({
      data: {
        singletonKey: 1,
        email: normalizeEmail(E2E_ADMIN_EMAIL),
        passwordHash: adminPasswordHash,
      },
    });

    // 6. Media Assets for seeded products & hero
    const mainMediaAsset = await prisma.mediaAsset.create({
      data: {
        id: "20000000-0000-0000-0000-000000000001",
        providerPublicId: "kids-wear/e2e/kurta-main",
        secureUrl:
          "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80",
        mediaType: "IMAGE",
        width: 800,
        height: 1000,
        format: "jpg",
        bytes: 45000,
      },
    });

    const hoverMediaAsset = await prisma.mediaAsset.create({
      data: {
        id: "20000000-0000-0000-0000-000000000002",
        providerPublicId: "kids-wear/e2e/kurta-hover",
        secureUrl:
          "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=800&q=80",
        mediaType: "IMAGE",
        width: 800,
        height: 1000,
        format: "jpg",
        bytes: 42000,
      },
    });

    const poloMediaAsset = await prisma.mediaAsset.create({
      data: {
        id: "20000000-0000-0000-0000-000000000003",
        providerPublicId: "kids-wear/e2e/polo-main",
        secureUrl:
          "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=800&q=80",
        mediaType: "IMAGE",
        width: 800,
        height: 1000,
        format: "jpg",
        bytes: 38000,
      },
    });

    // 7. Storefront Hero Slide for Mini Sprouts
    await prisma.heroSlide.create({
      data: {
        storefrontId: miniSprouts.id,
        desktopImageAssetId: mainMediaAsset.id,
        mobileImageAssetId: null,
        heading: "E2E Mini Sprouts Collection",
        text: "Comfortable organic garments for little ones.",
        ctaLabel: "Shop Mini Sprouts",
        ctaLink: "/mini-sprouts/shop",
        sortOrder: 0,
        isActive: true,
      },
    });

    // 8. Published Product in Mini Sprouts: "E2E Classic Kurta"
    const kurtaProduct = await prisma.product.create({
      data: {
        id: "30000000-0000-0000-0000-000000000001",
        storefrontId: miniSprouts.id,
        name: "E2E Classic Kurta",
        slug: "e2e-classic-kurta",
        sku: "E2E-KRT-01",
        description: "Handcrafted cotton kurta with neat stitching and comfortable fit.",
        regularPrice: 2490.0,
        compareAtPrice: 2990.0,
        status: "PUBLISHED",
        isNewArrival: true,
        fabric: "100% Breathable Cotton",
        fit: "Regular relaxed fit suitable for play and celebration.",
      },
    });

    // Sizes for Kurta
    const size23 = await prisma.productSize.create({
      data: {
        productId: kurtaProduct.id,
        name: "2-3 Years",
        sortOrder: 0,
      },
    });

    const size45 = await prisma.productSize.create({
      data: {
        productId: kurtaProduct.id,
        name: "4-5 Years",
        sortOrder: 1,
      },
    });

    // Colors for Kurta
    const colorBlue = await prisma.productColor.create({
      data: {
        productId: kurtaProduct.id,
        name: "Ocean Blue",
        sortOrder: 0,
      },
    });

    const colorRed = await prisma.productColor.create({
      data: {
        productId: kurtaProduct.id,
        name: "Crimson Red",
        sortOrder: 1,
      },
    });

    // Product Variants for Kurta:
    // 2-3Y + Blue (Available)
    await prisma.productVariant.create({
      data: {
        productId: kurtaProduct.id,
        productSizeId: size23.id,
        productColorId: colorBlue.id,
        isAvailable: true,
      },
    });

    // 4-5Y + Blue (Available)
    await prisma.productVariant.create({
      data: {
        productId: kurtaProduct.id,
        productSizeId: size45.id,
        productColorId: colorBlue.id,
        isAvailable: true,
      },
    });

    // 2-3Y + Red (UNAVAILABLE — for testing Unavailable variant flow!)
    await prisma.productVariant.create({
      data: {
        productId: kurtaProduct.id,
        productSizeId: size23.id,
        productColorId: colorRed.id,
        isAvailable: false,
      },
    });

    // 4-5Y + Red (Available)
    await prisma.productVariant.create({
      data: {
        productId: kurtaProduct.id,
        productSizeId: size45.id,
        productColorId: colorRed.id,
        isAvailable: true,
      },
    });

    // Media for Kurta: Main and Hover
    await prisma.productMedia.create({
      data: {
        productId: kurtaProduct.id,
        mediaAssetId: mainMediaAsset.id,
        isMain: true,
        isHover: false,
        sortOrder: 0,
      },
    });

    await prisma.productMedia.create({
      data: {
        productId: kurtaProduct.id,
        mediaAssetId: hoverMediaAsset.id,
        isMain: false,
        isHover: true,
        sortOrder: 1,
      },
    });

    // 9. Published Product in Teen Studio: "E2E Teen Polo"
    const poloProduct = await prisma.product.create({
      data: {
        id: "30000000-0000-0000-0000-000000000002",
        storefrontId: teenStudio.id,
        name: "E2E Teen Polo",
        slug: "e2e-teen-polo",
        sku: "E2E-POLO-01",
        description: "Modern pique polo shirt for teenagers.",
        regularPrice: 1990.0,
        status: "PUBLISHED",
        isNewArrival: false,
      },
    });

    const poloSize = await prisma.productSize.create({
      data: {
        productId: poloProduct.id,
        name: "11-12 Years",
        sortOrder: 0,
      },
    });

    const poloColor = await prisma.productColor.create({
      data: {
        productId: poloProduct.id,
        name: "Navy Blue",
        sortOrder: 0,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: poloProduct.id,
        productSizeId: poloSize.id,
        productColorId: poloColor.id,
        isAvailable: true,
      },
    });

    await prisma.productMedia.create({
      data: {
        productId: poloProduct.id,
        mediaAssetId: poloMediaAsset.id,
        isMain: true,
        isHover: false,
        sortOrder: 0,
      },
    });

    // 10. Published Product in Mini Sprouts: "Garden Bloom Romper"
    const romperProduct = await prisma.product.create({
      data: {
        id: "30000000-0000-0000-0000-000000000004",
        storefrontId: miniSprouts.id,
        name: "Garden Bloom Romper",
        slug: "garden-bloom-romper",
        sku: "E2E-RMP-01",
        description: "Delightful floral romper made with breathable soft cotton fabric.",
        regularPrice: 2190.0,
        status: "PUBLISHED",
        isNewArrival: false,
        fabric: "100% Breathable Cotton",
      },
    });

    const romperSize03 = await prisma.productSize.create({
      data: {
        productId: romperProduct.id,
        name: "0–3M",
        sortOrder: 0,
      },
    });
    const romperSize36 = await prisma.productSize.create({
      data: {
        productId: romperProduct.id,
        name: "3–6M",
        sortOrder: 1,
      },
    });

    const romperColorCream = await prisma.productColor.create({
      data: {
        productId: romperProduct.id,
        name: "Cream",
      },
    });
    const romperColorPink = await prisma.productColor.create({
      data: {
        productId: romperProduct.id,
        name: "Pink",
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: romperProduct.id,
        productSizeId: romperSize03.id,
        productColorId: romperColorCream.id,
        isAvailable: true,
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: romperProduct.id,
        productSizeId: romperSize36.id,
        productColorId: romperColorCream.id,
        isAvailable: true,
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: romperProduct.id,
        productSizeId: romperSize03.id,
        productColorId: romperColorPink.id,
        isAvailable: true,
      },
    });

    await prisma.productMedia.create({
      data: {
        productId: romperProduct.id,
        mediaAssetId: mainMediaAsset.id,
        isMain: true,
        isHover: false,
        sortOrder: 0,
      },
    });

    console.log("✅ E2E Database setup and seeding completed successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  setupE2eDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ E2E database setup failed:", err);
      process.exit(1);
    });
}
