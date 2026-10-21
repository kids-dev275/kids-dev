import { getPrismaClient } from "../src/lib/prisma";

/**
 * Deterministic and idempotent foundation seed script for Kids Wear.
 *
 * Seeds:
 * 1. Three fixed storefronts (Mini Sprouts, Teen Studio, Aura Studio)
 * 2. AnnouncementBar singleton (inactive initial state)
 * 3. CommerceSettings singleton (300 PKR flat delivery, sk.fabrica@gmail.com recipient)
 */
async function main(): Promise<void> {
  const prisma = getPrismaClient();

  // eslint-disable-next-line no-console
  console.log("🌱 Starting Kids Wear foundation seed...");

  // 1. Storefronts
  const storefronts = [
    {
      name: "Mini Sprouts",
      slug: "mini-sprouts",
      ageLabel: "0–10 Years",
    },
    {
      name: "Teen Studio",
      slug: "teen-studio",
      ageLabel: "11–16 Years",
    },
    {
      name: "Aura Studio",
      slug: "aura-studio",
      ageLabel: "17+ Years",
    },
  ];

  for (const sf of storefronts) {
    const record = await prisma.storefront.upsert({
      where: { slug: sf.slug },
      update: {
        name: sf.name,
        ageLabel: sf.ageLabel,
      },
      create: {
        name: sf.name,
        slug: sf.slug,
        ageLabel: sf.ageLabel,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`  ✓ Storefront: ${record.name} (${record.slug})`);
  }

  // 2. AnnouncementBar Singleton (single record, singletonKey = 1)
  const announcement = await prisma.announcementBar.upsert({
    where: { singletonKey: 1 },
    update: {
      text: null,
      link: null,
      isActive: false,
    },
    create: {
      singletonKey: 1,
      text: null,
      link: null,
      isActive: false,
    },
  });
  // eslint-disable-next-line no-console
  console.log(
    `  ✓ AnnouncementBar singleton verified (id: ${announcement.id}, text: ${announcement.text}, isActive: ${announcement.isActive})`
  );

  // 3. CommerceSettings Singleton (single record, singletonKey = 1)
  const settings = await prisma.commerceSettings.upsert({
    where: { singletonKey: 1 },
    update: {
      flatDeliveryCharge: 300.0,
      newOrderEmailEnabled: true,
      newOrderNotificationRecipient: "sk.fabrica@gmail.com",
    },
    create: {
      singletonKey: 1,
      flatDeliveryCharge: 300.0,
      newOrderEmailEnabled: true,
      newOrderNotificationRecipient: "sk.fabrica@gmail.com",
    },
  });
  // eslint-disable-next-line no-console
  console.log(
    `  ✓ CommerceSettings singleton verified (delivery: ${settings.flatDeliveryCharge} PKR, recipient: ${settings.newOrderNotificationRecipient})`
  );

  // eslint-disable-next-line no-console
  console.log("✅ Foundation seed completed successfully.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
