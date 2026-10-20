import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import {
  bulkCreateVariantsSchema,
  createColorSchema,
  createSizeSchema,
  updateColorSchema,
  updateSizeSchema,
  updateVariantAvailabilitySchema,
} from "./option-validation";

/**
 * Ensures the target product exists or throws a 404.
 */
async function getProductOrThrow(prisma: PrismaClient, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    throw new NotFoundError("Product not found", "PRODUCT_NOT_FOUND");
  }
  return product;
}

export const adminProductOptionRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // PART A — PRODUCT SIZES
  // ==========================================================================

  // GET /api/v1/admin/products/:productId/sizes
  app.get<{ Params: { productId: string } }>(
    "/:productId/sizes",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const sizes = await prisma.productSize.findMany({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      reply.status(200).send({
        success: true,
        data: {
          sizes,
        },
      });
    }
  );

  // POST /api/v1/admin/products/:productId/sizes
  app.post<{ Params: { productId: string } }>(
    "/:productId/sizes",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = createSizeSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid size data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { name, sortOrder, isActive } = parseResult.data;

      // Check duplicate within same product
      const existing = await prisma.productSize.findUnique({
        where: {
          productId_name: {
            productId,
            name,
          },
        },
      });
      if (existing) {
        throw new ConflictError(
          "A size with this name already exists for this product",
          "PRODUCT_SIZE_EXISTS"
        );
      }

      const size = await prisma.productSize.create({
        data: {
          productId,
          name,
          sortOrder: sortOrder ?? 0,
          isActive: isActive ?? true,
        },
      });

      reply.status(201).send({
        success: true,
        data: {
          size,
        },
      });
    }
  );

  // PATCH /api/v1/admin/products/:productId/sizes/:sizeId
  app.patch<{ Params: { productId: string; sizeId: string } }>(
    "/:productId/sizes/:sizeId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, sizeId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingSize = await prisma.productSize.findUnique({
        where: { id: sizeId },
      });
      if (!existingSize || existingSize.productId !== productId) {
        throw new NotFoundError("Product size not found", "PRODUCT_SIZE_NOT_FOUND");
      }

      const parseResult = updateSizeSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid size update data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { name, sortOrder, isActive } = parseResult.data;

      // Check duplicate name within product if name is changing
      if (name && name !== existingSize.name) {
        const conflict = await prisma.productSize.findUnique({
          where: {
            productId_name: {
              productId,
              name,
            },
          },
        });
        if (conflict && conflict.id !== sizeId) {
          throw new ConflictError(
            "A size with this name already exists for this product",
            "PRODUCT_SIZE_EXISTS"
          );
        }
      }

      // Deactivation rule: changing isActive: true -> false sets associated Variants to isAvailable = false
      if (existingSize.isActive === true && isActive === false) {
        const [updatedSize] = await prisma.$transaction([
          prisma.productSize.update({
            where: { id: sizeId },
            data: {
              ...(name !== undefined && { name }),
              ...(sortOrder !== undefined && { sortOrder }),
              isActive: false,
            },
          }),
          prisma.productVariant.updateMany({
            where: {
              productId,
              productSizeId: sizeId,
            },
            data: {
              isAvailable: false,
            },
          }),
        ]);

        reply.status(200).send({
          success: true,
          data: {
            size: updatedSize,
          },
        });
        return;
      }

      // Reactivation or standard update: reactivating a size does NOT reactivate variants
      const updatedSize = await prisma.productSize.update({
        where: { id: sizeId },
        data: {
          ...(name !== undefined && { name }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          size: updatedSize,
        },
      });
    }
  );

  // DELETE /api/v1/admin/products/:productId/sizes/:sizeId
  app.delete<{ Params: { productId: string; sizeId: string } }>(
    "/:productId/sizes/:sizeId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, sizeId } = request.params;
      const product = await getProductOrThrow(prisma, productId);

      const existingSize = await prisma.productSize.findUnique({
        where: { id: sizeId },
      });
      if (!existingSize || existingSize.productId !== productId) {
        throw new NotFoundError("Product size not found", "PRODUCT_SIZE_NOT_FOUND");
      }

      // Hard delete is only permitted on DRAFT products
      if (product.status !== "DRAFT") {
        throw new ConflictError(
          "Only sizes on draft products can be deleted. Deactivate the size instead.",
          "PRODUCT_SIZE_DELETE_FORBIDDEN"
        );
      }

      // Hard delete is only permitted if no variants reference this size
      const variantCount = await prisma.productVariant.count({
        where: {
          productId,
          productSizeId: sizeId,
        },
      });
      if (variantCount > 0) {
        throw new ConflictError(
          "Cannot delete a size that is referenced by product variants. Deactivate the size instead.",
          "PRODUCT_SIZE_DELETE_FORBIDDEN"
        );
      }

      await prisma.productSize.delete({
        where: { id: sizeId },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Product size deleted successfully",
        },
      });
    }
  );

  // ==========================================================================
  // PART B — PRODUCT COLORS
  // ==========================================================================

  // GET /api/v1/admin/products/:productId/colors
  app.get<{ Params: { productId: string } }>(
    "/:productId/colors",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const colors = await prisma.productColor.findMany({
        where: { productId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      reply.status(200).send({
        success: true,
        data: {
          colors,
        },
      });
    }
  );

  // POST /api/v1/admin/products/:productId/colors
  app.post<{ Params: { productId: string } }>(
    "/:productId/colors",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = createColorSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid color data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { name, sortOrder, isActive } = parseResult.data;

      // Check duplicate within same product
      const existing = await prisma.productColor.findUnique({
        where: {
          productId_name: {
            productId,
            name,
          },
        },
      });
      if (existing) {
        throw new ConflictError(
          "A color with this name already exists for this product",
          "PRODUCT_COLOR_EXISTS"
        );
      }

      const color = await prisma.productColor.create({
        data: {
          productId,
          name,
          sortOrder: sortOrder ?? 0,
          isActive: isActive ?? true,
        },
      });

      reply.status(201).send({
        success: true,
        data: {
          color,
        },
      });
    }
  );

  // PATCH /api/v1/admin/products/:productId/colors/:colorId
  app.patch<{ Params: { productId: string; colorId: string } }>(
    "/:productId/colors/:colorId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, colorId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingColor = await prisma.productColor.findUnique({
        where: { id: colorId },
      });
      if (!existingColor || existingColor.productId !== productId) {
        throw new NotFoundError("Product color not found", "PRODUCT_COLOR_NOT_FOUND");
      }

      const parseResult = updateColorSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid color update data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { name, sortOrder, isActive } = parseResult.data;

      // Check duplicate name within product if name is changing
      if (name && name !== existingColor.name) {
        const conflict = await prisma.productColor.findUnique({
          where: {
            productId_name: {
              productId,
              name,
            },
          },
        });
        if (conflict && conflict.id !== colorId) {
          throw new ConflictError(
            "A color with this name already exists for this product",
            "PRODUCT_COLOR_EXISTS"
          );
        }
      }

      // Deactivation rule: changing isActive: true -> false sets associated Variants to isAvailable = false
      if (existingColor.isActive === true && isActive === false) {
        const [updatedColor] = await prisma.$transaction([
          prisma.productColor.update({
            where: { id: colorId },
            data: {
              ...(name !== undefined && { name }),
              ...(sortOrder !== undefined && { sortOrder }),
              isActive: false,
            },
          }),
          prisma.productVariant.updateMany({
            where: {
              productId,
              productColorId: colorId,
            },
            data: {
              isAvailable: false,
            },
          }),
        ]);

        reply.status(200).send({
          success: true,
          data: {
            color: updatedColor,
          },
        });
        return;
      }

      // Reactivation or standard update: reactivating a color does NOT reactivate variants
      const updatedColor = await prisma.productColor.update({
        where: { id: colorId },
        data: {
          ...(name !== undefined && { name }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          color: updatedColor,
        },
      });
    }
  );

  // DELETE /api/v1/admin/products/:productId/colors/:colorId
  app.delete<{ Params: { productId: string; colorId: string } }>(
    "/:productId/colors/:colorId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, colorId } = request.params;
      const product = await getProductOrThrow(prisma, productId);

      const existingColor = await prisma.productColor.findUnique({
        where: { id: colorId },
      });
      if (!existingColor || existingColor.productId !== productId) {
        throw new NotFoundError("Product color not found", "PRODUCT_COLOR_NOT_FOUND");
      }

      // Hard delete is only permitted on DRAFT products
      if (product.status !== "DRAFT") {
        throw new ConflictError(
          "Only colors on draft products can be deleted. Deactivate the color instead.",
          "PRODUCT_COLOR_DELETE_FORBIDDEN"
        );
      }

      // Hard delete is only permitted if no variants reference this color
      const variantCount = await prisma.productVariant.count({
        where: {
          productId,
          productColorId: colorId,
        },
      });
      if (variantCount > 0) {
        throw new ConflictError(
          "Cannot delete a color that is referenced by product variants. Deactivate the color instead.",
          "PRODUCT_COLOR_DELETE_FORBIDDEN"
        );
      }

      await prisma.productColor.delete({
        where: { id: colorId },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Product color deleted successfully",
        },
      });
    }
  );

  // ==========================================================================
  // PART C — PRODUCT VARIANTS
  // ==========================================================================

  // GET /api/v1/admin/products/:productId/variants
  app.get<{ Params: { productId: string } }>(
    "/:productId/variants",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const variants = await prisma.productVariant.findMany({
        where: { productId },
        include: {
          size: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              isActive: true,
            },
          },
          color: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ size: { sortOrder: "asc" } }, { color: { sortOrder: "asc" } }, { id: "asc" }],
      });

      const formatted = variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        productSizeId: v.productSizeId,
        productColorId: v.productColorId,
        productSize: v.size,
        productColor: v.color,
        isAvailable: v.isAvailable,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));

      reply.status(200).send({
        success: true,
        data: {
          variants: formatted,
        },
      });
    }
  );

  // POST /api/v1/admin/products/:productId/variants/bulk
  app.post<{ Params: { productId: string } }>(
    "/:productId/variants/bulk",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = bulkCreateVariantsSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid variant bulk data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { variants: requestedVariants } = parseResult.data;

      // Check duplicate combinations inside the request
      const seenCombinations = new Set<string>();
      for (const reqVar of requestedVariants) {
        const key = `${reqVar.productSizeId}:${reqVar.productColorId}`;
        if (seenCombinations.has(key)) {
          throw new BadRequestError(
            "Duplicate variant combinations inside request are not allowed",
            "VALIDATION_ERROR"
          );
        }
        seenCombinations.add(key);
      }

      // Fetch all sizes and colors for this product
      const productSizes = await prisma.productSize.findMany({
        where: { productId },
      });
      const productColors = await prisma.productColor.findMany({
        where: { productId },
      });

      const sizeMap = new Map(productSizes.map((s) => [s.id, s]));
      const colorMap = new Map(productColors.map((c) => [c.id, c]));

      // Validate each requested variant
      for (const reqVar of requestedVariants) {
        const size = sizeMap.get(reqVar.productSizeId);
        if (!size) {
          throw new NotFoundError(
            `Size ID ${reqVar.productSizeId} does not belong to this product or does not exist`,
            "PRODUCT_SIZE_NOT_FOUND"
          );
        }
        if (!size.isActive) {
          throw new BadRequestError(
            `Cannot create variant with inactive size: ${size.name}`,
            "PRODUCT_OPTION_INACTIVE"
          );
        }

        const color = colorMap.get(reqVar.productColorId);
        if (!color) {
          throw new NotFoundError(
            `Color ID ${reqVar.productColorId} does not belong to this product or does not exist`,
            "PRODUCT_COLOR_NOT_FOUND"
          );
        }
        if (!color.isActive) {
          throw new BadRequestError(
            `Cannot create variant with inactive color: ${color.name}`,
            "PRODUCT_OPTION_INACTIVE"
          );
        }
      }

      // Check if any requested combination already exists in DB
      const existingVariants = await prisma.productVariant.findMany({
        where: { productId },
      });
      const existingKeySet = new Set(
        existingVariants.map((v) => `${v.productSizeId}:${v.productColorId}`)
      );

      for (const reqVar of requestedVariants) {
        const key = `${reqVar.productSizeId}:${reqVar.productColorId}`;
        if (existingKeySet.has(key)) {
          throw new ConflictError(
            "One or more requested variant combinations already exist",
            "PRODUCT_VARIANT_EXISTS"
          );
        }
      }

      // All-or-nothing atomic creation
      const createdVariants = await prisma.$transaction(
        requestedVariants.map((v) =>
          prisma.productVariant.create({
            data: {
              productId,
              productSizeId: v.productSizeId,
              productColorId: v.productColorId,
              isAvailable: v.isAvailable ?? true,
            },
            include: {
              size: {
                select: {
                  id: true,
                  name: true,
                  sortOrder: true,
                  isActive: true,
                },
              },
              color: {
                select: {
                  id: true,
                  name: true,
                  sortOrder: true,
                  isActive: true,
                },
              },
            },
          })
        )
      );

      const formatted = createdVariants.map((v) => ({
        id: v.id,
        productId: v.productId,
        productSizeId: v.productSizeId,
        productColorId: v.productColorId,
        productSize: v.size,
        productColor: v.color,
        isAvailable: v.isAvailable,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));

      reply.status(201).send({
        success: true,
        data: {
          variants: formatted,
        },
      });
    }
  );

  // PATCH /api/v1/admin/products/:productId/variants/:variantId
  app.patch<{ Params: { productId: string; variantId: string } }>(
    "/:productId/variants/:variantId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, variantId } = request.params;
      await getProductOrThrow(prisma, productId);

      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          size: true,
          color: true,
        },
      });
      if (!variant || variant.productId !== productId) {
        throw new NotFoundError("Product variant not found", "PRODUCT_VARIANT_NOT_FOUND");
      }

      const parseResult = updateVariantAvailabilitySchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid availability data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { isAvailable } = parseResult.data;

      // Availability rule: can only set to available if BOTH size and color are active
      if (isAvailable === true) {
        if (!variant.size.isActive) {
          throw new BadRequestError(
            "Cannot make variant available while its size is inactive",
            "PRODUCT_OPTION_INACTIVE"
          );
        }
        if (!variant.color.isActive) {
          throw new BadRequestError(
            "Cannot make variant available while its color is inactive",
            "PRODUCT_OPTION_INACTIVE"
          );
        }
      }

      const updated = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          isAvailable,
        },
        include: {
          size: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              isActive: true,
            },
          },
          color: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              isActive: true,
            },
          },
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          variant: {
            id: updated.id,
            productId: updated.productId,
            productSizeId: updated.productSizeId,
            productColorId: updated.productColorId,
            productSize: updated.size,
            productColor: updated.color,
            isAvailable: updated.isAvailable,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        },
      });
    }
  );
};
