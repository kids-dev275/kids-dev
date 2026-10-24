import type {
  Prisma,
  ProductMedia,
  MediaAsset,
  ProductSize,
  ProductColor,
  ProductVariant,
  SizeGuide,
  SizeGuideRow,
} from "@prisma/client";

/**
 * Common Prisma WHERE clause ensuring a Product satisfies all public visibility requirements
 * regardless of storefront:
 * 1. Product.status = PUBLISHED
 * 2. At least one available variant whose parent size and color are active
 * 3. Exactly one Main Image exists (mediaType = IMAGE)
 */
export function getPublicProductVisibilityWhereClause(): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    variants: {
      some: {
        isAvailable: true,
        size: { isActive: true },
        color: { isActive: true },
      },
    },
    media: {
      some: {
        isMain: true,
        mediaAsset: { mediaType: "IMAGE" },
      },
    },
  };
}

/**
 * Common Prisma WHERE clause ensuring a Product satisfies all public visibility requirements:
 * 1. Product.status = PUBLISHED
 * 2. Belongs to the target storefront
 * 3. At least one available variant whose parent size and color are active
 * 4. Exactly one Main Image exists (mediaType = IMAGE)
 */
export function getPublicProductWhereClause(storefrontId: string): Prisma.ProductWhereInput {
  return {
    storefrontId,
    ...getPublicProductVisibilityWhereClause(),
  };
}

export interface PublicProductCard {
  id: string;
  name: string;
  slug: string;
  regularPrice: string;
  compareAtPrice: string | null;
  isNewArrival: boolean;
  mainImage: {
    url: string;
    altText: string | null;
  } | null;
  hoverImage: {
    url: string;
    altText: string | null;
  } | null;
  quickAdd: {
    colors: Array<{ id: string; name: string }>;
    sizes: Array<{ id: string; name: string }>;
    variants: Array<{ id: string; productSizeId: string; productColorId: string }>;
  };
}

/**
 * Formats a Product row into the safe public Product Card contract.
 */
export function formatPublicProductCard(product: {
  id: string;
  name: string;
  slug: string;
  regularPrice: Prisma.Decimal | string | number;
  compareAtPrice: Prisma.Decimal | string | number | null;
  isNewArrival: boolean;
  media: Array<{
    isMain: boolean;
    isHover: boolean;
    altText: string | null;
    mediaAsset: {
      secureUrl: string;
    };
  }>;
  sizes: Array<{ id: string; name: string; sortOrder: number }>;
  colors: Array<{ id: string; name: string; sortOrder: number }>;
  variants: Array<{ id: string; productSizeId: string; productColorId: string }>;
}): PublicProductCard {
  const mainMedia = product.media.find((m) => m.isMain);
  const hoverMedia = product.media.find((m) => m.isHover);
  const availableColorIds = new Set(product.variants.map((variant) => variant.productColorId));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    regularPrice: Number(product.regularPrice).toFixed(2),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice).toFixed(2) : null,
    isNewArrival: product.isNewArrival,
    mainImage: mainMedia
      ? {
          url: mainMedia.mediaAsset.secureUrl,
          altText: mainMedia.altText,
        }
      : null,
    hoverImage: hoverMedia
      ? {
          url: hoverMedia.mediaAsset.secureUrl,
          altText: hoverMedia.altText,
        }
      : null,
    quickAdd: {
      colors: product.colors
        .filter((color) => availableColorIds.has(color.id))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(({ id, name }) => ({ id, name })),
      sizes: [...product.sizes]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(({ id, name }) => ({ id, name })),
      variants: product.variants,
    },
  };
}

export interface PublicPDPResponse {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  regularPrice: string;
  compareAtPrice: string | null;
  productType: string | null;
  gender: string | null;
  fabric: string | null;
  includedPieces: string | null;
  fit: string | null;
  patternDesign: string | null;
  occasion: string | null;
  season: string | null;
  careInstructions: string | null;
  isNewArrival: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  media: Array<{
    type: "IMAGE" | "VIDEO";
    url: string;
    altText: string | null;
    isMain: boolean;
    isHover: boolean;
    sortOrder: number;
  }>;
  sizes: Array<{
    id: string;
    name: string;
  }>;
  colors: Array<{
    id: string;
    name: string;
  }>;
  variants: Array<{
    id: string;
    productSizeId: string;
    productColorId: string;
    isAvailable: boolean;
  }>;
  sizeGuide: {
    columns: unknown;
    rows: Array<{
      id?: string;
      label: string;
      values: unknown;
      sortOrder: number;
    }>;
  } | null;
}

/**
 * Formats a Product row into the safe public PDP contract.
 */
export function formatPublicPDP(product: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  regularPrice: Prisma.Decimal | string | number;
  compareAtPrice: Prisma.Decimal | string | number | null;
  productType: string | null;
  gender: string | null;
  fabric: string | null;
  includedPieces: string | null;
  fit: string | null;
  patternDesign: string | null;
  occasion: string | null;
  season: string | null;
  careInstructions: string | null;
  isNewArrival: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  media: Array<
    ProductMedia & {
      mediaAsset: MediaAsset;
    }
  >;
  sizes: ProductSize[];
  colors: ProductColor[];
  variants: Array<
    ProductVariant & {
      size: ProductSize;
      color: ProductColor;
    }
  >;
  sizeGuide?: (SizeGuide & { rows: SizeGuideRow[] }) | null;
}): PublicPDPResponse {
  // Sort media deterministically by sortOrder ASC, createdAt ASC
  const sortedMedia = [...product.media].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Filter and sort active sizes by sortOrder ASC, name ASC
  const activeSizes = product.sizes
    .filter((s) => s.isActive)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
    }));

  // Filter and sort active colors by sortOrder ASC, name ASC (display names only)
  const activeColors = product.colors
    .filter((c) => c.isActive)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
    }));

  // Filter variants whose parent size AND color are active
  const activeOptionVariants = product.variants
    .filter((v) => v.size.isActive && v.color.isActive)
    .map((v) => ({
      id: v.id,
      productSizeId: v.productSizeId,
      productColorId: v.productColorId,
      isAvailable: v.isAvailable,
    }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    regularPrice: Number(product.regularPrice).toFixed(2),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice).toFixed(2) : null,
    productType: product.productType,
    gender: product.gender,
    fabric: product.fabric,
    includedPieces: product.includedPieces,
    fit: product.fit,
    patternDesign: product.patternDesign,
    occasion: product.occasion,
    season: product.season,
    careInstructions: product.careInstructions,
    isNewArrival: product.isNewArrival,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    media: sortedMedia.map((m) => ({
      type: m.mediaAsset.mediaType,
      url: m.mediaAsset.secureUrl,
      altText: m.altText,
      isMain: m.isMain,
      isHover: m.isHover,
      sortOrder: m.sortOrder,
    })),
    sizes: activeSizes,
    colors: activeColors,
    variants: activeOptionVariants,
    sizeGuide: product.sizeGuide
      ? {
          columns: product.sizeGuide.columns,
          rows: product.sizeGuide.rows.map((row) => ({
            id: row.id,
            label: row.label,
            values: row.values,
            sortOrder: row.sortOrder,
          })),
        }
      : null,
  };
}
