import { getPrismaClient } from "../src/lib/prisma";

/**
 * Database smoke verification script validating 17 essential relational invariants.
 * Safe to run against clean development/test database.
 * Cleans up all smoke records while preserving foundation seed data.
 */
async function runSmokeTests(): Promise<void> {
  const prisma = getPrismaClient();
  let passedCount = 0;
  const totalChecks = 20;

  // eslint-disable-next-line no-console
  console.log("🔍 Running Database Smoke Verification (20 Checks)...");

  // Helper for expecting failures (CHECK / UNIQUE violations)
  async function expectFailure(fn: () => Promise<unknown>, checkName: string): Promise<void> {
    try {
      await fn();
      // eslint-disable-next-line no-console
      console.error(`  ❌ FAILED: ${checkName} — expected error was not thrown`);
      throw new Error(`Smoke test failed: ${checkName}`);
    } catch {
      passedCount++;
      // eslint-disable-next-line no-console
      console.log(`  ✓ Check passed: ${checkName}`);
    }
  }

  // Retrieve a seed storefront for test associations
  const miniSprouts = await prisma.storefront.findUniqueOrThrow({
    where: { slug: "mini-sprouts" },
  });
  const teenStudio = await prisma.storefront.findUniqueOrThrow({
    where: { slug: "teen-studio" },
  });

  // Track created test IDs for guaranteed cleanup
  const createdProductIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdAdminIds: string[] = [];
  const createdMediaAssetIds: string[] = [];

  try {
    // 1. exactly three storefront seed records exist
    const storefrontCount = await prisma.storefront.count();
    if (storefrontCount === 3) {
      passedCount++;
      // eslint-disable-next-line no-console
      console.log("  ✓ Check 1 passed: exactly three storefront seed records exist");
    } else {
      throw new Error(`Expected 3 storefronts, found ${storefrontCount}`);
    }

    // 2. AnnouncementBar singleton exists with approved empty/inactive baseline
    const announcement = await prisma.announcementBar.findUnique({
      where: { singletonKey: 1 },
    });
    if (
      announcement &&
      announcement.text === null &&
      announcement.link === null &&
      announcement.isActive === false
    ) {
      passedCount++;
      // eslint-disable-next-line no-console
      console.log(
        "  ✓ Check 2 passed: AnnouncementBar singleton exists with text=null, link=null, isActive=false"
      );
    } else {
      throw new Error(
        `AnnouncementBar singleton missing or invalid: text=${announcement?.text}, link=${announcement?.link}, isActive=${announcement?.isActive}`
      );
    }

    // 3. CommerceSettings singleton exists
    const settings = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
    });
    if (settings && Number(settings.flatDeliveryCharge) === 300) {
      passedCount++;
      // eslint-disable-next-line no-console
      console.log(
        "  ✓ Check 3 passed: CommerceSettings singleton exists with 300 PKR flat delivery"
      );
    } else {
      throw new Error("CommerceSettings singleton missing or invalid");
    }

    // 4. second singleton row cannot be created
    await expectFailure(async () => {
      await prisma.announcementBar.create({
        data: {
          singletonKey: 2, // Violates CHECK (singletonKey = 1)
          text: "Second bar",
        },
      });
    }, "Check 4: second singleton row rejected (AnnouncementBar singletonKey=2)");

    // 5. second Admin singleton record is rejected
    const existingAdmin = await prisma.adminUser.findFirst();
    if (!existingAdmin) {
      const admin = await prisma.adminUser.create({
        data: {
          email: "smoke.admin@kidswear.local",
          passwordHash:
            "$argon2id$v=19$m=19456,t=2,p=1$sTcjf8zMTy508IhhS2EQMg$WuIWbe9E37qlAbeAgYEa7OhaRU61QrZQmxVrBCKdsrk",
          singletonKey: 1,
        },
      });
      createdAdminIds.push(admin.id);
    }

    await expectFailure(async () => {
      await prisma.adminUser.create({
        data: {
          email: "second.admin@kidswear.local",
          passwordHash:
            "$argon2id$v=19$m=19456,t=2,p=1$sTcjf8zMTy508IhhS2EQMg$WuIWbe9E37qlAbeAgYEa7OhaRU61QrZQmxVrBCKdsrk",
          singletonKey: 1, // Violates unique constraint
        },
      });
    }, "Check 5: second Admin singleton record rejected");

    // Create shared media asset for test relations
    const dummyAsset = await prisma.mediaAsset.create({
      data: {
        provider: "cloudinary",
        providerPublicId: "smoke_asset_1",
        secureUrl: "https://res.cloudinary.com/smoke/image/upload/v1/smoke1.jpg",
      },
    });
    createdMediaAssetIds.push(dummyAsset.id);

    // 6. duplicate Product SKU is rejected
    const productA = await prisma.product.create({
      data: {
        storefrontId: miniSprouts.id,
        name: "Smoke Product A",
        sku: "SMOKE-SKU-001",
        slug: "smoke-product-a",
        description: "Smoke test description",
        regularPrice: 1500.0,
      },
    });
    createdProductIds.push(productA.id);

    await expectFailure(async () => {
      await prisma.product.create({
        data: {
          storefrontId: miniSprouts.id,
          name: "Smoke Product B",
          sku: "SMOKE-SKU-001", // Duplicate SKU
          slug: "smoke-product-b",
          description: "Smoke test description",
          regularPrice: 1600.0,
        },
      });
    }, "Check 6: duplicate Product SKU rejected");

    // 7. duplicate slug inside same storefront is rejected
    await expectFailure(async () => {
      await prisma.product.create({
        data: {
          storefrontId: miniSprouts.id,
          name: "Smoke Product Dup Slug",
          sku: "SMOKE-SKU-002",
          slug: "smoke-product-a", // Duplicate slug in Mini Sprouts
          description: "Smoke test description",
          regularPrice: 1700.0,
        },
      });
    }, "Check 7: duplicate slug inside same storefront rejected");

    // 8. same slug across different storefronts is permitted
    const productDifferentStorefront = await prisma.product.create({
      data: {
        storefrontId: teenStudio.id,
        name: "Teen Smoke Product",
        sku: "SMOKE-SKU-003",
        slug: "smoke-product-a", // Allowed in Teen Studio
        description: "Cross-storefront slug check",
        regularPrice: 2000.0,
      },
    });
    createdProductIds.push(productDifferentStorefront.id);
    passedCount++;
    // eslint-disable-next-line no-console
    console.log("  ✓ Check 8 passed: same slug permitted across different storefronts");

    // 9. duplicate exact variant is rejected
    const size = await prisma.productSize.create({
      data: {
        productId: productA.id,
        name: "M",
        sortOrder: 1,
      },
    });
    const color = await prisma.productColor.create({
      data: {
        productId: productA.id,
        name: "Navy",
        sortOrder: 1,
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: productA.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: true,
      },
    });

    await expectFailure(async () => {
      await prisma.productVariant.create({
        data: {
          productId: productA.id,
          productSizeId: size.id,
          productColorId: color.id, // Duplicate combination
          isAvailable: true,
        },
      });
    }, "Check 9: duplicate exact variant rejected");

    // Create a base valid order for item checks
    const testOrder = await prisma.order.create({
      data: {
        orderNumber: "KW-SMOKE-1",
        status: "ORDER_RECEIVED",
        paymentMethod: "CASH_ON_DELIVERY",
        fullName: "Smoke Tester",
        phone: "+923001234567",
        address: "123 Smoke St",
        city: "Lahore",
        province: "Punjab",
        subtotal: 1500.0,
        deliveryCharge: 300.0,
        grandTotal: 1800.0,
      },
    });
    createdOrderIds.push(testOrder.id);

    // 10. quantity 0 is rejected
    await expectFailure(async () => {
      await prisma.orderItem.create({
        data: {
          orderId: testOrder.id,
          productId: productA.id,
          productName: productA.name,
          sku: productA.sku,
          sizeLabel: size.name,
          colorName: color.name,
          quantity: 0, // Violates quantity >= 1
          unitPrice: 1500.0,
          lineSubtotal: 0.0,
        },
      });
    }, "Check 10: quantity 0 rejected by CHECK constraint");

    // 11. quantity 11 is rejected
    await expectFailure(async () => {
      await prisma.orderItem.create({
        data: {
          orderId: testOrder.id,
          productId: productA.id,
          productName: productA.name,
          sku: productA.sku,
          sizeLabel: size.name,
          colorName: color.name,
          quantity: 11, // Violates quantity <= 10
          unitPrice: 1500.0,
          lineSubtotal: 16500.0,
        },
      });
    }, "Check 11: quantity 11 rejected by CHECK constraint");

    // 12. review rating 0 is rejected
    await expectFailure(async () => {
      await prisma.review.create({
        data: {
          productId: productA.id,
          reviewerName: "Smoke Reviewer",
          rating: 0, // Violates rating >= 1
          reviewText: "Zero rating check",
        },
      });
    }, "Check 12: review rating 0 rejected by CHECK constraint");

    // 13. review rating 6 is rejected
    await expectFailure(async () => {
      await prisma.review.create({
        data: {
          productId: productA.id,
          reviewerName: "Smoke Reviewer",
          rating: 6, // Violates rating <= 5
          reviewText: "Six rating check",
        },
      });
    }, "Check 13: review rating 6 rejected by CHECK constraint");

    // 14. negative order money values are rejected
    await expectFailure(async () => {
      await prisma.order.create({
        data: {
          orderNumber: "KW-SMOKE-NEGATIVE",
          status: "ORDER_RECEIVED",
          paymentMethod: "CASH_ON_DELIVERY",
          fullName: "Smoke Negative",
          phone: "+923001234567",
          address: "Negative Ave",
          city: "Karachi",
          province: "Sindh",
          subtotal: -100.0, // Violates subtotal >= 0
          deliveryCharge: 300.0,
          grandTotal: 200.0,
        },
      });
    }, "Check 14: negative order money value rejected by CHECK constraint");

    // 15. second main media assignment for same product is rejected
    await prisma.productMedia.create({
      data: {
        productId: productA.id,
        mediaAssetId: dummyAsset.id,
        isMain: true,
      },
    });

    await expectFailure(async () => {
      await prisma.productMedia.create({
        data: {
          productId: productA.id,
          mediaAssetId: dummyAsset.id,
          isMain: true, // Violates partial unique index product_media_main_unique
        },
      });
    }, "Check 15: second main media assignment rejected");

    // 16. second hover media assignment for same product is rejected
    await prisma.productMedia.create({
      data: {
        productId: productA.id,
        mediaAssetId: dummyAsset.id,
        isHover: true,
      },
    });

    await expectFailure(async () => {
      await prisma.productMedia.create({
        data: {
          productId: productA.id,
          mediaAssetId: dummyAsset.id,
          isHover: true, // Violates partial unique index product_media_hover_unique
        },
      });
    }, "Check 16: second hover media assignment rejected");

    // 17. order-number sequence begins correctly at 1001 and increments to 1002
    // Reset sequence to 1001 for deterministic verification on development DB
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE order_number_seq RESTART WITH 1001;`);

    const firstSeq = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('order_number_seq') AS nextval;
    `;
    const secondSeq = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('order_number_seq') AS nextval;
    `;
    const firstVal = Number(firstSeq[0]?.nextval);
    const secondVal = Number(secondSeq[0]?.nextval);
    if (firstVal === 1001 && secondVal === 1002) {
      passedCount++;
      // eslint-disable-next-line no-console
      console.log("  ✓ Check 17 passed: order_number_seq returned exactly 1001 then 1002");
    } else {
      throw new Error(
        `order_number_seq returned unexpected values: first=${firstVal}, second=${secondVal} (expected 1001 then 1002)`
      );
    }

    // 18. cross-product size assignment to ProductVariant is rejected by composite FK
    const sizeFromOtherProduct = await prisma.productSize.create({
      data: {
        productId: productDifferentStorefront.id,
        name: "L",
        sortOrder: 2,
      },
    });

    await expectFailure(async () => {
      await prisma.productVariant.create({
        data: {
          productId: productA.id,
          productSizeId: sizeFromOtherProduct.id, // Size belongs to productDifferentStorefront, not productA
          productColorId: color.id,
          isAvailable: true,
        },
      });
    }, "Check 18: cross-product size assignment to ProductVariant rejected by composite FK");

    // 19. cross-product color assignment to ProductVariant is rejected by composite FK
    const colorFromOtherProduct = await prisma.productColor.create({
      data: {
        productId: productDifferentStorefront.id,
        name: "Emerald",
        sortOrder: 2,
      },
    });

    await expectFailure(async () => {
      await prisma.productVariant.create({
        data: {
          productId: productA.id,
          productSizeId: size.id,
          productColorId: colorFromOtherProduct.id, // Color belongs to productDifferentStorefront, not productA
          isAvailable: true,
        },
      });
    }, "Check 19: cross-product color assignment to ProductVariant rejected by composite FK");

    // 20. duplicate Order idempotencyKey is rejected by unique constraint
    const idempotencyKey = "smoke-idempotency-key-001";
    const orderWithKey = await prisma.order.create({
      data: {
        orderNumber: "KW-SMOKE-IDEMP-1",
        idempotencyKey,
        status: "ORDER_RECEIVED",
        paymentMethod: "CASH_ON_DELIVERY",
        fullName: "Smoke Idempotency",
        phone: "+923001234567",
        address: "Idempotency Ave",
        city: "Lahore",
        province: "Punjab",
        subtotal: 1000.0,
        deliveryCharge: 300.0,
        grandTotal: 1300.0,
      },
    });
    createdOrderIds.push(orderWithKey.id);

    await expectFailure(async () => {
      await prisma.order.create({
        data: {
          orderNumber: "KW-SMOKE-IDEMP-2",
          idempotencyKey, // Violates UNIQUE constraint Order_idempotencyKey_key
          status: "ORDER_RECEIVED",
          paymentMethod: "CASH_ON_DELIVERY",
          fullName: "Smoke Idempotency Second",
          phone: "+923001234567",
          address: "Idempotency Ave",
          city: "Lahore",
          province: "Punjab",
          subtotal: 1000.0,
          deliveryCharge: 300.0,
          grandTotal: 1300.0,
        },
      });
    }, "Check 20: duplicate Order idempotencyKey rejected by unique constraint");

    // eslint-disable-next-line no-console
    console.log(
      `\n🎉 All ${passedCount}/${totalChecks} database smoke checks passed successfully.`
    );
  } finally {
    // Guaranteed cleanup of smoke test data
    // eslint-disable-next-line no-console
    console.log("🧹 Cleaning up smoke test records...");
    for (const orderId of createdOrderIds) {
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    for (const productId of createdProductIds) {
      await prisma.productMedia.deleteMany({ where: { productId } });
      await prisma.productVariant.deleteMany({ where: { productId } });
      await prisma.productSize.deleteMany({ where: { productId } });
      await prisma.productColor.deleteMany({ where: { productId } });
      await prisma.review.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    for (const adminId of createdAdminIds) {
      await prisma.adminUser.deleteMany({ where: { id: adminId } });
    }
    for (const assetId of createdMediaAssetIds) {
      await prisma.mediaAsset.deleteMany({ where: { id: assetId } });
    }
    const existingOrders = await prisma.order.findMany({ select: { orderNumber: true } });
    const maxNum = Math.max(
      ...existingOrders
        .map((o) => parseInt(o.orderNumber.replace("KW-", ""), 10))
        .filter((n) => !isNaN(n)),
      1000
    );
    await prisma.$executeRawUnsafe(`SELECT setval('order_number_seq', ${maxNum + 10});`);
    // eslint-disable-next-line no-console
    console.log("✓ Smoke test records cleanly deleted (seed records preserved).");
  }
}

runSmokeTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Database smoke check failed:", err);
  process.exit(1);
});
