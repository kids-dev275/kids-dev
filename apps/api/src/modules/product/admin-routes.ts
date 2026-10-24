import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma, type Product } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
  updateStatusSchema,
} from "./validation";
import { validateProductForPublication } from "./publication-validator";

interface FormattedProduct extends Omit<Product, "regularPrice" | "compareAtPrice"> {
  regularPrice: string;
  compareAtPrice: string | null;
  storefront?: {
    id: string;
    name: string;
    slug: string;
  };
}

function formatProduct(
  product: Product & {
    storefront?: {
      id: string;
      name: string;
      slug: string;
    };
  }
): FormattedProduct {
  return {
    ...product,
    regularPrice: product.regularPrice.toFixed(2),
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toFixed(2) : null,
  };
}

export const adminProductRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/admin/products
  app.get("/", { preHandler: [requireAdmin] }, async (request, reply) => {
    const parseResult = listProductsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Invalid query parameters";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { page, limit, search, storefront, status } = parseResult.data;

    const where: Prisma.ProductWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
      ];
    }

    if (storefront && storefront.trim() !== "") {
      const sf = storefront.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sf);
      if (isUuid) {
        where.storefrontId = sf;
      } else {
        where.storefront = { slug: sf };
      }
    }

    const total = await prisma.product.count({ where });

    const items = await prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        storefront: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        media: {
          where: { isMain: true },
          take: 1,
          select: { mediaAsset: { select: { secureUrl: true } } },
        },
        variants: { select: { isAvailable: true } },
      },
    });

    const formattedItems = items.map(({ media, variants, ...product }) => ({
      ...formatProduct(product),
      thumbnailUrl: media[0]?.mediaAsset.secureUrl ?? null,
      variantCount: variants.length,
      availableVariantCount: variants.filter((variant) => variant.isAvailable).length,
    }));

    reply.status(200).send({
      success: true,
      data: {
        items: formattedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  // POST /api/v1/admin/products
  app.post("/", { preHandler: [requireAdmin, requireAdminCsrf] }, async (request, reply) => {
    const parseResult = createProductSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Invalid product data";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const {
      name,
      sku,
      slug,
      storefrontId,
      description,
      shortDescription,
      regularPrice,
      compareAtPrice,
      productType,
      gender,
      fabric,
      includedPieces,
      fit,
      patternDesign,
      occasion,
      season,
      careInstructions,
      isNewArrival,
      seoTitle,
      seoDescription,
    } = parseResult.data;

    // Verify Storefront exists
    const storefront = await prisma.storefront.findUnique({
      where: { id: storefrontId },
    });
    if (!storefront) {
      throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
    }

    // Check global SKU uniqueness
    const existingSku = await prisma.product.findUnique({
      where: { sku },
    });
    if (existingSku) {
      throw new ConflictError("A product with this SKU already exists", "PRODUCT_SKU_EXISTS");
    }

    // Check Storefront-scoped slug uniqueness
    const existingSlug = await prisma.product.findUnique({
      where: {
        storefrontId_slug: {
          storefrontId,
          slug,
        },
      },
    });
    if (existingSlug) {
      throw new ConflictError(
        "A product with this slug already exists in this storefront",
        "PRODUCT_SLUG_EXISTS"
      );
    }

    // Products are always created in DRAFT status
    const product = await prisma.product.create({
      data: {
        name,
        sku,
        slug,
        storefrontId,
        description,
        shortDescription: shortDescription ?? null,
        regularPrice: new Prisma.Decimal(regularPrice),
        compareAtPrice: compareAtPrice ? new Prisma.Decimal(compareAtPrice) : null,
        productType: productType ?? null,
        gender: gender ?? null,
        fabric: fabric ?? null,
        includedPieces: includedPieces ?? null,
        fit: fit ?? null,
        patternDesign: patternDesign ?? null,
        occasion: occasion ?? null,
        season: season ?? null,
        careInstructions: careInstructions ?? null,
        isNewArrival: isNewArrival ?? false,
        seoTitle: seoTitle ?? null,
        seoDescription: seoDescription ?? null,
        status: "DRAFT",
      },
      include: {
        storefront: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    reply.status(201).send({
      success: true,
      data: {
        product: formatProduct(product),
      },
    });
  });

  // GET /api/v1/admin/products/:productId
  app.get<{ Params: { productId: string } }>(
    "/:productId",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { productId } = request.params;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          storefront: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
      }

      reply.status(200).send({
        success: true,
        data: {
          product: formatProduct(product),
        },
      });
    }
  );

  // PATCH /api/v1/admin/products/:productId
  app.patch<{ Params: { productId: string } }>(
    "/:productId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!existingProduct) {
        throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
      }

      const parseResult = updateProductSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid update data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const data = parseResult.data;

      // Check SKU uniqueness if changing
      if (data.sku && data.sku !== existingProduct.sku) {
        const skuConflict = await prisma.product.findUnique({
          where: { sku: data.sku },
        });
        if (skuConflict && skuConflict.id !== productId) {
          throw new ConflictError("A product with this SKU already exists", "PRODUCT_SKU_EXISTS");
        }
      }

      // Check Storefront existence and slug collision if changing storefrontId or slug
      const targetStorefrontId = data.storefrontId ?? existingProduct.storefrontId;
      const targetSlug = data.slug ?? existingProduct.slug;

      if (data.storefrontId && data.storefrontId !== existingProduct.storefrontId) {
        const sf = await prisma.storefront.findUnique({
          where: { id: data.storefrontId },
        });
        if (!sf) {
          throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
        }
      }

      if (data.storefrontId || data.slug) {
        const slugConflict = await prisma.product.findUnique({
          where: {
            storefrontId_slug: {
              storefrontId: targetStorefrontId,
              slug: targetSlug,
            },
          },
        });
        if (slugConflict && slugConflict.id !== productId) {
          throw new ConflictError(
            "A product with this slug already exists in this storefront",
            "PRODUCT_SLUG_EXISTS"
          );
        }
      }

      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sku !== undefined && { sku: data.sku }),
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.storefrontId !== undefined && { storefrontId: data.storefrontId }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
          ...(data.regularPrice !== undefined && {
            regularPrice: new Prisma.Decimal(data.regularPrice),
          }),
          ...(data.compareAtPrice !== undefined && {
            compareAtPrice: data.compareAtPrice ? new Prisma.Decimal(data.compareAtPrice) : null,
          }),
          ...(data.productType !== undefined && { productType: data.productType }),
          ...(data.gender !== undefined && { gender: data.gender }),
          ...(data.fabric !== undefined && { fabric: data.fabric }),
          ...(data.includedPieces !== undefined && { includedPieces: data.includedPieces }),
          ...(data.fit !== undefined && { fit: data.fit }),
          ...(data.patternDesign !== undefined && { patternDesign: data.patternDesign }),
          ...(data.occasion !== undefined && { occasion: data.occasion }),
          ...(data.season !== undefined && { season: data.season }),
          ...(data.careInstructions !== undefined && { careInstructions: data.careInstructions }),
          ...(data.isNewArrival !== undefined && { isNewArrival: data.isNewArrival }),
          ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
          ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
        },
        include: {
          storefront: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          product: formatProduct(updated),
        },
      });
    }
  );

  // DELETE /api/v1/admin/products/:productId
  app.delete<{ Params: { productId: string } }>(
    "/:productId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
      }

      // Hard delete is only permitted for DRAFT products
      if (product.status !== "DRAFT") {
        throw new ConflictError(
          "Only draft products can be deleted. Inactive or published products must be retained for historical preservation.",
          "PRODUCT_DELETE_FORBIDDEN"
        );
      }

      // Prevent deletion if referenced by historical commerce records (orders, reviews)
      const orderItemCount = await prisma.orderItem.count({ where: { productId } });
      const reviewCount = await prisma.review.count({ where: { productId } });

      if (orderItemCount > 0 || reviewCount > 0) {
        throw new ConflictError(
          "Cannot delete product with existing order or review records.",
          "PRODUCT_DELETE_FORBIDDEN"
        );
      }

      await prisma.product.delete({
        where: { id: productId },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Product deleted successfully",
        },
      });
    }
  );

  // PATCH /api/v1/admin/products/:productId/status
  app.patch<{ Params: { productId: string } }>(
    "/:productId/status",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;

      const parseResult = updateStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid status data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const requestedStatus = parseResult.data.status;

      const updated = await prisma.$transaction(async (tx) => {
        // Concurrency-safe lock on the target product row
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::text FOR UPDATE`;

        const existing = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!existing) {
          throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
        }

        // Idempotent: if already at target status, return cleanly
        if (existing.status === requestedStatus) {
          const current = await tx.product.findUnique({
            where: { id: productId },
            include: {
              storefront: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          });
          return current!;
        }

        // PUBLISHED -> DRAFT is strictly forbidden
        if (existing.status === "PUBLISHED" && requestedStatus === "DRAFT") {
          throw new BadRequestError(
            "Published products cannot transition directly to DRAFT. Withdraw to INACTIVE instead.",
            "PRODUCT_INVALID_STATUS_TRANSITION"
          );
        }

        // If transitioning to PUBLISHED, run authoritative publication validation
        if (requestedStatus === "PUBLISHED") {
          const validation = await validateProductForPublication(tx, productId);
          if (!validation.isValid) {
            throw new BadRequestError(
              "Product does not meet publication requirements",
              "PRODUCT_NOT_PUBLISHABLE",
              validation.errors
            );
          }
        }

        return tx.product.update({
          where: { id: productId },
          data: {
            status: requestedStatus,
          },
          include: {
            storefront: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });
      });

      reply.status(200).send({
        success: true,
        data: {
          product: formatProduct(updated),
        },
      });
    }
  );
};
