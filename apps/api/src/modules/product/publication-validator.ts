import type { Prisma, PrismaClient } from "@prisma/client";

export interface PublicationValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates whether a product meets all requirements for publication:
 * 1. Product Core: name, sku, slug, storefrontId, description, and regularPrice > 0.
 * 2. Variant: at least 1 variant that is available AND has an active size AND an active color.
 * 3. Media: exactly 1 Main Image (mediaType = IMAGE), 1-8 total images, 0-1 total videos.
 */
export async function validateProductForPublication(
  prisma: PrismaClient | Prisma.TransactionClient,
  productId: string
): Promise<PublicationValidationResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      media: {
        include: { mediaAsset: true },
      },
      variants: {
        include: {
          size: true,
          color: true,
        },
      },
    },
  });

  if (!product) {
    return {
      isValid: false,
      errors: ["PRODUCT_NOT_FOUND"],
    };
  }

  const errors: string[] = [];

  // Core field checks
  if (!product.name || !product.name.trim()) {
    errors.push("NAME_REQUIRED");
  }
  if (!product.sku || !product.sku.trim()) {
    errors.push("SKU_REQUIRED");
  }
  if (!product.slug || !product.slug.trim()) {
    errors.push("SLUG_REQUIRED");
  }
  if (!product.storefrontId) {
    errors.push("STOREFRONT_REQUIRED");
  }
  if (!product.description || !product.description.trim()) {
    errors.push("DESCRIPTION_REQUIRED");
  }
  if (!product.regularPrice || Number(product.regularPrice) <= 0) {
    errors.push("REGULAR_PRICE_INVALID");
  }

  // Media checks
  const imageMedia = product.media.filter((m) => m.mediaAsset.mediaType === "IMAGE");
  const videoMedia = product.media.filter((m) => m.mediaAsset.mediaType === "VIDEO");
  const mainImages = product.media.filter((m) => m.isMain && m.mediaAsset.mediaType === "IMAGE");

  if (mainImages.length !== 1) {
    errors.push("MAIN_IMAGE_REQUIRED");
  }
  if (imageMedia.length < 1 || imageMedia.length > 8) {
    errors.push("IMAGE_COUNT_INVALID");
  }
  if (videoMedia.length > 1) {
    errors.push("VIDEO_COUNT_INVALID");
  }

  // Variant requirement: at least 1 available variant whose parent size and color are active
  const hasValidAvailableVariant = product.variants.some(
    (v) => v.isAvailable && v.size.isActive && v.color.isActive
  );
  if (!hasValidAvailableVariant) {
    errors.push("AVAILABLE_VARIANT_REQUIRED");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
