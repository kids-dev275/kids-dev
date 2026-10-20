import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { MediaAsset, PrismaClient, ProductMedia } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { getCloudinaryService } from "../../lib/cloudinary";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import {
  registerProductMediaSchema,
  reorderProductMediaSchema,
  updateProductMediaSchema,
  uploadSignatureSchema,
} from "./media-validation";

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

/**
 * Formats a ProductMedia row with its joined MediaAsset for safe API responses.
 */
function formatProductMedia(media: ProductMedia & { mediaAsset: MediaAsset }) {
  return {
    id: media.id,
    productId: media.productId,
    mediaAssetId: media.mediaAssetId,
    mediaType: media.mediaAsset.mediaType,
    provider: media.mediaAsset.provider,
    providerPublicId: media.mediaAsset.providerPublicId,
    secureUrl: media.mediaAsset.secureUrl,
    width: media.mediaAsset.width,
    height: media.mediaAsset.height,
    duration: media.mediaAsset.duration,
    format: media.mediaAsset.format,
    bytes: media.mediaAsset.bytes,
    altText: media.altText,
    sortOrder: media.sortOrder,
    isMain: media.isMain,
    isHover: media.isHover,
    createdAt: media.createdAt,
  };
}

export const adminProductMediaRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // 1. UPLOAD SIGNATURE
  // POST /api/v1/admin/products/:productId/media/upload-signature
  // ==========================================================================
  app.post<{ Params: { productId: string } }>(
    "/:productId/media/upload-signature",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = uploadSignatureSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid upload signature request";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { mediaType } = parseResult.data;
      const cloudinaryService = getCloudinaryService();
      const signatureResult = await cloudinaryService.createUploadSignature({
        productId,
        mediaType,
      });

      reply.status(200).send({
        success: true,
        data: signatureResult,
      });
    }
  );

  // ==========================================================================
  // 2. REGISTER UPLOADED MEDIA
  // POST /api/v1/admin/products/:productId/media
  // ==========================================================================
  app.post<{ Params: { productId: string } }>(
    "/:productId/media",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = registerProductMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid media registration data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { publicId, mediaType, altText, sortOrder } = parseResult.data;

      // Namespace validation: publicId must strictly belong to this product's namespace
      const expectedPrefix = `kids-wear/products/${productId}/`;
      if (!publicId.startsWith(expectedPrefix)) {
        throw new BadRequestError(
          "Public ID does not belong to this product upload namespace",
          "PRODUCT_MEDIA_FOREIGN_PRODUCT"
        );
      }

      // Fetch authoritative Cloudinary metadata
      const cloudinaryService = getCloudinaryService();
      const intendedResourceType = mediaType === "IMAGE" ? "image" : "video";
      const metadata = await cloudinaryService.fetchResourceMetadata(
        publicId,
        intendedResourceType
      );

      // Verify resource type matches intended type
      if (metadata.resourceType !== intendedResourceType) {
        throw new BadRequestError(
          `Resource type '${metadata.resourceType}' does not match requested '${intendedResourceType}'`,
          "MEDIA_RESOURCE_TYPE_INVALID"
        );
      }

      // Authoritative dimension enforcement
      if (mediaType === "IMAGE") {
        if (metadata.width !== 1200 || metadata.height !== 1500) {
          throw new BadRequestError(
            `Product image dimensions must be exactly 1200x1500 (4:5). Received ${metadata.width}x${metadata.height}`,
            "MEDIA_DIMENSIONS_INVALID"
          );
        }
      } else if (mediaType === "VIDEO") {
        if (metadata.width !== 1080 || metadata.height !== 1350) {
          throw new BadRequestError(
            `Product video dimensions must be exactly 1080x1350 (4:5). Received ${metadata.width}x${metadata.height}`,
            "MEDIA_DIMENSIONS_INVALID"
          );
        }
      }

      // Concurrency-safe limit enforcement & atomic persistence
      const createdMedia = await prisma.$transaction(async (tx) => {
        // Lock parent product row to prevent concurrent race beyond media limits
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::text FOR UPDATE`;

        // Check image count limit (Max 8 images)
        if (mediaType === "IMAGE") {
          const currentImages = await tx.productMedia.count({
            where: {
              productId,
              mediaAsset: { mediaType: "IMAGE" },
            },
          });
          if (currentImages >= 8) {
            throw new BadRequestError(
              "Product cannot have more than 8 images",
              "PRODUCT_IMAGE_LIMIT_REACHED"
            );
          }
        }

        // Check video count limit (Max 1 video)
        if (mediaType === "VIDEO") {
          const currentVideos = await tx.productMedia.count({
            where: {
              productId,
              mediaAsset: { mediaType: "VIDEO" },
            },
          });
          if (currentVideos >= 1) {
            throw new BadRequestError(
              "Product cannot have more than 1 video",
              "PRODUCT_VIDEO_LIMIT_REACHED"
            );
          }
        }

        // Create MediaAsset record
        const mediaAsset = await tx.mediaAsset.create({
          data: {
            mediaType,
            provider: "cloudinary",
            providerPublicId: metadata.publicId,
            secureUrl: metadata.secureUrl,
            width: metadata.width,
            height: metadata.height,
            duration: metadata.duration ?? null,
            format: metadata.format,
            bytes: metadata.bytes,
          },
        });

        // Create ProductMedia association
        const productMedia = await tx.productMedia.create({
          data: {
            productId,
            mediaAssetId: mediaAsset.id,
            altText: altText ?? null,
            sortOrder: sortOrder ?? 0,
            isMain: false,
            isHover: false,
          },
          include: {
            mediaAsset: true,
          },
        });

        return productMedia;
      });

      reply.status(201).send({
        success: true,
        data: {
          media: formatProductMedia(createdMedia),
        },
      });
    }
  );

  // ==========================================================================
  // 3. LIST PRODUCT MEDIA
  // GET /api/v1/admin/products/:productId/media
  // ==========================================================================
  app.get<{ Params: { productId: string } }>(
    "/:productId/media",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const mediaList = await prisma.productMedia.findMany({
        where: { productId },
        include: { mediaAsset: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      reply.status(200).send({
        success: true,
        data: {
          media: mediaList.map(formatProductMedia),
        },
      });
    }
  );

  // ==========================================================================
  // 4. REORDER PRODUCT MEDIA
  // PATCH /api/v1/admin/products/:productId/media/reorder
  // ==========================================================================
  app.patch<{ Params: { productId: string } }>(
    "/:productId/media/reorder",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      const parseResult = reorderProductMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid reorder data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { mediaIds } = parseResult.data;

      // Reject duplicate IDs
      if (new Set(mediaIds).size !== mediaIds.length) {
        throw new BadRequestError("Duplicate media IDs in reorder request", "VALIDATION_ERROR");
      }

      // Verify all IDs exist and belong to this product
      const existingMedia = await prisma.productMedia.findMany({
        where: { id: { in: mediaIds } },
      });

      if (existingMedia.length !== mediaIds.length) {
        throw new NotFoundError("One or more media IDs do not exist", "PRODUCT_MEDIA_NOT_FOUND");
      }

      for (const m of existingMedia) {
        if (m.productId !== productId) {
          throw new BadRequestError(
            "Cannot reorder media belonging to another product",
            "PRODUCT_MEDIA_FOREIGN_PRODUCT"
          );
        }
      }

      // Atomically update sortOrder
      await prisma.$transaction(
        mediaIds.map((id, index) =>
          prisma.productMedia.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      const updatedList = await prisma.productMedia.findMany({
        where: { productId },
        include: { mediaAsset: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      reply.status(200).send({
        success: true,
        data: {
          media: updatedList.map(formatProductMedia),
        },
      });
    }
  );

  // ==========================================================================
  // 5. CLEAR HOVER IMAGE
  // DELETE /api/v1/admin/products/:productId/media/hover
  // ==========================================================================
  app.delete<{ Params: { productId: string } }>(
    "/:productId/media/hover",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId } = request.params;
      await getProductOrThrow(prisma, productId);

      await prisma.productMedia.updateMany({
        where: { productId, isHover: true },
        data: { isHover: false },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Hover image cleared successfully",
        },
      });
    }
  );

  // ==========================================================================
  // 6. UPDATE PRODUCT MEDIA (altText, sortOrder)
  // PATCH /api/v1/admin/products/:productId/media/:productMediaId
  // ==========================================================================
  app.patch<{ Params: { productId: string; productMediaId: string } }>(
    "/:productId/media/:productMediaId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, productMediaId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingMedia = await prisma.productMedia.findUnique({
        where: { id: productMediaId },
        include: { mediaAsset: true },
      });

      if (!existingMedia || existingMedia.productId !== productId) {
        throw new NotFoundError("Product media not found", "PRODUCT_MEDIA_NOT_FOUND");
      }

      const parseResult = updateProductMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid media update data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { altText, sortOrder } = parseResult.data;

      const updatedMedia = await prisma.productMedia.update({
        where: { id: productMediaId },
        data: {
          ...(altText !== undefined && { altText }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
        include: { mediaAsset: true },
      });

      reply.status(200).send({
        success: true,
        data: {
          media: formatProductMedia(updatedMedia),
        },
      });
    }
  );

  // ==========================================================================
  // 7. SET MAIN IMAGE
  // PATCH /api/v1/admin/products/:productId/media/:productMediaId/main
  // ==========================================================================
  app.patch<{ Params: { productId: string; productMediaId: string } }>(
    "/:productId/media/:productMediaId/main",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, productMediaId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingMedia = await prisma.productMedia.findUnique({
        where: { id: productMediaId },
        include: { mediaAsset: true },
      });

      if (!existingMedia || existingMedia.productId !== productId) {
        throw new NotFoundError("Product media not found", "PRODUCT_MEDIA_NOT_FOUND");
      }

      if (existingMedia.mediaAsset.mediaType !== "IMAGE") {
        throw new BadRequestError(
          "Video cannot be set as main image",
          "MEDIA_RESOURCE_TYPE_INVALID"
        );
      }

      // Atomically unset previous main and set new main
      const [_, updated] = await prisma.$transaction([
        prisma.productMedia.updateMany({
          where: { productId, isMain: true },
          data: { isMain: false },
        }),
        prisma.productMedia.update({
          where: { id: productMediaId },
          data: { isMain: true },
          include: { mediaAsset: true },
        }),
      ]);

      reply.status(200).send({
        success: true,
        data: {
          media: formatProductMedia(updated),
        },
      });
    }
  );

  // ==========================================================================
  // 8. SET HOVER IMAGE
  // PATCH /api/v1/admin/products/:productId/media/:productMediaId/hover
  // ==========================================================================
  app.patch<{ Params: { productId: string; productMediaId: string } }>(
    "/:productId/media/:productMediaId/hover",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, productMediaId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingMedia = await prisma.productMedia.findUnique({
        where: { id: productMediaId },
        include: { mediaAsset: true },
      });

      if (!existingMedia || existingMedia.productId !== productId) {
        throw new NotFoundError("Product media not found", "PRODUCT_MEDIA_NOT_FOUND");
      }

      if (existingMedia.mediaAsset.mediaType !== "IMAGE") {
        throw new BadRequestError(
          "Video cannot be set as hover image",
          "MEDIA_RESOURCE_TYPE_INVALID"
        );
      }

      // Atomically unset previous hover and set new hover
      const [_, updated] = await prisma.$transaction([
        prisma.productMedia.updateMany({
          where: { productId, isHover: true },
          data: { isHover: false },
        }),
        prisma.productMedia.update({
          where: { id: productMediaId },
          data: { isHover: true },
          include: { mediaAsset: true },
        }),
      ]);

      reply.status(200).send({
        success: true,
        data: {
          media: formatProductMedia(updated),
        },
      });
    }
  );

  // ==========================================================================
  // 9. DELETE PRODUCT MEDIA
  // DELETE /api/v1/admin/products/:productId/media/:productMediaId
  // ==========================================================================
  app.delete<{ Params: { productId: string; productMediaId: string } }>(
    "/:productId/media/:productMediaId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { productId, productMediaId } = request.params;
      await getProductOrThrow(prisma, productId);

      const existingMedia = await prisma.productMedia.findUnique({
        where: { id: productMediaId },
      });

      if (!existingMedia || existingMedia.productId !== productId) {
        throw new NotFoundError("Product media not found", "PRODUCT_MEDIA_NOT_FOUND");
      }

      // Main image cannot be deleted directly
      if (existingMedia.isMain) {
        throw new ConflictError(
          "Main image cannot be deleted. Assign another image as main first.",
          "PRODUCT_MAIN_MEDIA_DELETE_FORBIDDEN"
        );
      }

      // Safely delete ProductMedia association only, leaving underlying MediaAsset intact
      await prisma.productMedia.delete({
        where: { id: productMediaId },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Product media deleted successfully",
        },
      });
    }
  );
};
