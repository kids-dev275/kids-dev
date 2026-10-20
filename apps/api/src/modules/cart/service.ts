import { Prisma, PrismaClient } from "@prisma/client";
import { BadRequestError } from "../../lib/errors";

export interface CartValidatedItemResponse {
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    name: string;
    slug: string;
    storefrontSlug: string;
    mainImage: {
      url: string;
      altText: string | null;
    } | null;
  };
  variant: {
    size: string;
    color: string;
    isAvailable: boolean;
  };
  unitPrice: string;
  lineSubtotal: string;
}

export interface CartInvalidItemResponse {
  productId: string;
  variantId: string;
  reason:
    | "PRODUCT_NOT_FOUND"
    | "PRODUCT_UNPUBLISHED"
    | "PRODUCT_UNAVAILABLE"
    | "PRODUCT_MISMATCH"
    | "VARIANT_NOT_FOUND"
    | "VARIANT_UNAVAILABLE"
    | "SIZE_INACTIVE"
    | "COLOR_INACTIVE";
  message: string;
}

export interface OrderItemSnapshotData {
  productId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  sizeLabel: string;
  colorName: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
}

export interface CartValidateCalculationResult {
  items: CartValidatedItemResponse[];
  validItems: CartValidatedItemResponse[];
  invalidItems: CartInvalidItemResponse[];
  subtotal: string;
  deliveryCharge: string;
  total: string;
  flatDeliveryCharge: Prisma.Decimal;
  accumulatedSubtotal: Prisma.Decimal;
  grandTotalDecimal: Prisma.Decimal;
  orderSnapshots: OrderItemSnapshotData[];
}

/**
 * Authoritative, reusable cart validation service.
 * Used by Cart revalidation (/cart/validate), Checkout preflight (/checkout/validate),
 * and transactional Order placement (/orders).
 * Guarantees zero calculation divergence across commerce stages.
 */
export async function validateCartLines(
  prisma: PrismaClient | Prisma.TransactionClient,
  items: { productId: string; variantId: string; quantity: number }[]
): Promise<CartValidateCalculationResult> {
  // Reject duplicate exact variant IDs in validation payload
  const variantIds = items.map((i) => i.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new BadRequestError(
      "Duplicate variant entries are not permitted in validation payload",
      "DUPLICATE_VARIANT_ENTRY"
    );
  }

  // Authoritative CommerceSettings singleton lookup
  const commerceSettings = await prisma.commerceSettings.findUnique({
    where: { singletonKey: 1 },
  });
  const flatDeliveryCharge = commerceSettings?.flatDeliveryCharge ?? new Prisma.Decimal("300.00");

  // Empty cart optimization
  if (items.length === 0) {
    return {
      items: [],
      validItems: [],
      invalidItems: [],
      subtotal: "0.00",
      deliveryCharge: "0.00",
      total: "0.00",
      flatDeliveryCharge,
      accumulatedSubtotal: new Prisma.Decimal(0),
      grandTotalDecimal: new Prisma.Decimal(0),
      orderSnapshots: [],
    };
  }

  // Query referenced variants and associated models
  const dbVariants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      size: true,
      color: true,
      product: {
        include: {
          storefront: true,
          media: {
            where: {
              isMain: true,
              mediaAsset: { mediaType: "IMAGE" },
            },
            include: {
              mediaAsset: true,
            },
          },
        },
      },
    },
  });

  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

  // Check for missing variant product presence without leaking unpublished data
  const missingVariantItems = items.filter((item) => !variantMap.has(item.variantId));
  const missingProductIds = missingVariantItems.map((item) => item.productId);

  const existingProducts =
    missingProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: missingProductIds } },
          select: { id: true, status: true },
        })
      : [];
  const existingProductIds = new Set(existingProducts.map((p) => p.id));

  const validItems: CartValidatedItemResponse[] = [];
  const invalidItems: CartInvalidItemResponse[] = [];
  const orderSnapshots: OrderItemSnapshotData[] = [];
  let accumulatedSubtotal = new Prisma.Decimal(0);

  for (const item of items) {
    const dbVariant = variantMap.get(item.variantId);

    if (!dbVariant) {
      if (!existingProductIds.has(item.productId)) {
        invalidItems.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "PRODUCT_NOT_FOUND",
          message: "This product is no longer available.",
        });
      } else {
        invalidItems.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "VARIANT_NOT_FOUND",
          message: "This option is no longer available.",
        });
      }
      continue;
    }

    // Check variant belongs to productId submitted
    if (dbVariant.productId !== item.productId) {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "PRODUCT_MISMATCH",
        message: "This option is no longer available.",
      });
      continue;
    }

    // Product must be PUBLISHED
    if (dbVariant.product.status !== "PUBLISHED") {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "PRODUCT_UNPUBLISHED",
        message: "This product is no longer available.",
      });
      continue;
    }

    // Product must satisfy defensive public visibility (has a Main Image)
    if (dbVariant.product.media.length === 0) {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "PRODUCT_UNAVAILABLE",
        message: "This product is no longer available.",
      });
      continue;
    }

    // Variant size must be active
    if (!dbVariant.size.isActive) {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "SIZE_INACTIVE",
        message: "This option is no longer available.",
      });
      continue;
    }

    // Variant color must be active
    if (!dbVariant.color.isActive) {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "COLOR_INACTIVE",
        message: "This option is no longer available.",
      });
      continue;
    }

    // Variant isAvailable must be true
    if (!dbVariant.isAvailable) {
      invalidItems.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "VARIANT_UNAVAILABLE",
        message: "This option is currently unavailable.",
      });
      continue;
    }

    // Line is valid! Compute line subtotal using Decimal arithmetic
    const unitPrice = dbVariant.product.regularPrice;
    const lineSubtotal = unitPrice.mul(item.quantity);
    accumulatedSubtotal = accumulatedSubtotal.add(lineSubtotal);

    const mainMedia = dbVariant.product.media[0];

    validItems.push({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      product: {
        name: dbVariant.product.name,
        slug: dbVariant.product.slug,
        storefrontSlug: dbVariant.product.storefront.slug,
        mainImage: mainMedia
          ? {
              url: mainMedia.mediaAsset.secureUrl,
              altText: mainMedia.altText,
            }
          : null,
      },
      variant: {
        size: dbVariant.size.name,
        color: dbVariant.color.name,
        isAvailable: true,
      },
      unitPrice: unitPrice.toFixed(2),
      lineSubtotal: lineSubtotal.toFixed(2),
    });

    const productSku = dbVariant.product.sku;

    orderSnapshots.push({
      productId: item.productId,
      productVariantId: item.variantId,
      productName: dbVariant.product.name,
      sku: productSku,
      sizeLabel: dbVariant.size.name,
      colorName: dbVariant.color.name,
      quantity: item.quantity,
      unitPrice,
      lineSubtotal,
    });
  }

  const subtotalStr = accumulatedSubtotal.toFixed(2);
  let deliveryChargeStr = "0.00";
  let totalStr = "0.00";
  let grandTotalDecimal = new Prisma.Decimal(0);

  if (validItems.length > 0) {
    deliveryChargeStr = flatDeliveryCharge.toFixed(2);
    grandTotalDecimal = accumulatedSubtotal.add(flatDeliveryCharge);
    totalStr = grandTotalDecimal.toFixed(2);
  }

  return {
    items: validItems,
    validItems,
    invalidItems,
    subtotal: subtotalStr,
    deliveryCharge: deliveryChargeStr,
    total: totalStr,
    flatDeliveryCharge,
    accumulatedSubtotal,
    grandTotalDecimal,
    orderSnapshots,
  };
}
