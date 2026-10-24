import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import {
  formatPublicPDP,
  formatPublicProductCard,
  getPublicProductWhereClause,
} from "./public-visibility";
import {
  publicListProductsQuerySchema,
  publicSearchQuerySchema,
} from "./public-catalog-validation";

export const publicCatalogRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // 1. PUBLIC PRODUCT LISTING (with optional ?new=true filter)
  // GET /api/v1/storefronts/:storefrontSlug/products
  // ==========================================================================
  app.get<{
    Params: { storefrontSlug: string };
    Querystring: { page?: string; limit?: string; new?: string };
  }>("/:storefrontSlug/products", async (request, reply) => {
    const { storefrontSlug } = request.params;

    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: { id: true },
    });

    if (!storefront) {
      throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
    }

    const queryResult = publicListProductsQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      const firstError = queryResult.error.errors[0]?.message || "Invalid query parameters";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { page, limit, new: isNewArrival } = queryResult.data;

    const where: Prisma.ProductWhereInput = {
      ...getPublicProductWhereClause(storefront.id),
      ...(isNewArrival === true && { isNewArrival: true }),
    };

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          regularPrice: true,
          compareAtPrice: true,
          isNewArrival: true,
          sizes: {
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true },
          },
          colors: {
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true },
          },
          variants: {
            where: {
              isAvailable: true,
              size: { isActive: true },
              color: { isActive: true },
            },
            select: { id: true, productSizeId: true, productColorId: true },
          },
          media: {
            where: {
              OR: [{ isMain: true }, { isHover: true }],
            },
            select: {
              isMain: true,
              isHover: true,
              altText: true,
              mediaAsset: {
                select: {
                  secureUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    reply.status(200).send({
      success: true,
      data: {
        items: products.map(formatPublicProductCard),
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  });

  // ==========================================================================
  // 2. STOREFRONT-SPECIFIC SEARCH
  // GET /api/v1/storefronts/:storefrontSlug/search?q=
  // ==========================================================================
  app.get<{
    Params: { storefrontSlug: string };
    Querystring: { q?: string; page?: string; limit?: string };
  }>("/:storefrontSlug/search", async (request, reply) => {
    const { storefrontSlug } = request.params;

    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: { id: true },
    });

    if (!storefront) {
      throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
    }

    const queryResult = publicSearchQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      const firstError = queryResult.error.errors[0]?.message || "Invalid search query";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { q, page, limit } = queryResult.data;

    const where: Prisma.ProductWhereInput = {
      ...getPublicProductWhereClause(storefront.id),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { productType: { contains: q, mode: "insensitive" } },
      ],
    };

    const [totalItems, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          regularPrice: true,
          compareAtPrice: true,
          isNewArrival: true,
          sizes: {
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true },
          },
          colors: {
            where: { isActive: true },
            select: { id: true, name: true, sortOrder: true },
          },
          variants: {
            where: {
              isAvailable: true,
              size: { isActive: true },
              color: { isActive: true },
            },
            select: { id: true, productSizeId: true, productColorId: true },
          },
          media: {
            where: {
              OR: [{ isMain: true }, { isHover: true }],
            },
            select: {
              isMain: true,
              isHover: true,
              altText: true,
              mediaAsset: {
                select: {
                  secureUrl: true,
                },
              },
            },
          },
        },
        orderBy: [{ isNewArrival: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    reply.status(200).send({
      success: true,
      data: {
        items: products.map(formatPublicProductCard),
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        query: q,
      },
    });
  });

  // ==========================================================================
  // 3. PUBLIC PRODUCT DETAIL (PDP)
  // GET /api/v1/storefronts/:storefrontSlug/products/:productSlug
  // ==========================================================================
  app.get<{
    Params: { storefrontSlug: string; productSlug: string };
  }>("/:storefrontSlug/products/:productSlug", async (request, reply) => {
    const { storefrontSlug, productSlug } = request.params;

    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: { id: true },
    });

    if (!storefront) {
      throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
    }

    const product = await prisma.product.findFirst({
      where: {
        ...getPublicProductWhereClause(storefront.id),
        slug: productSlug,
      },
      include: {
        media: {
          include: {
            mediaAsset: true,
          },
        },
        sizes: true,
        colors: true,
        variants: {
          where: {
            size: { isActive: true },
            color: { isActive: true },
          },
          include: {
            size: true,
            color: true,
          },
        },
        sizeGuide: {
          include: {
            rows: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
    }

    const pdpFormatted = formatPublicPDP(product);

    reply.status(200).send({
      success: true,
      data: {
        product: pdpFormatted,
        ...pdpFormatted,
      },
    });
  });
};
