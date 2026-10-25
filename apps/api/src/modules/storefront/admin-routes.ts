import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import { getCloudinaryService } from "../../lib/cloudinary";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import { z } from "zod";
import {
  createHeroSlideSchema,
  reorderHeroSlidesSchema,
  updateHeroSlideSchema,
} from "./validation";

/**
 * Validates that a referenced MediaAsset exists and is of type IMAGE.
 */
async function validateImageAsset(
  prisma: PrismaClient,
  assetId: string,
  label: "Desktop" | "Mobile"
): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });
  if (!asset) {
    throw new NotFoundError(`${label} media asset not found`, "MEDIA_ASSET_NOT_FOUND");
  }
  if (asset.mediaType !== "IMAGE") {
    throw new BadRequestError(`${label} media asset must be an image`, "INVALID_MEDIA_TYPE");
  }
}

export const adminStorefrontRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  const heroUploadSchema = z.object({ placement: z.enum(["desktop", "mobile"]) }).strict();
  const heroRegistrationSchema = z.object({
    placement: z.enum(["desktop", "mobile"]),
    publicId: z.string().min(1),
  }).strict();

  app.post<{ Params: { storefrontId: string } }>(
    "/:storefrontId/hero-media/upload-signature",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId } = request.params;
      if (!(await prisma.storefront.findUnique({ where: { id: storefrontId } }))) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }
      const parsed = heroUploadSchema.safeParse(request.body);
      if (!parsed.success) throw new BadRequestError("Invalid hero image placement", "VALIDATION_ERROR");
      const service = getCloudinaryService();
      if (!service.createHeroUploadSignature) {
        throw new BadRequestError("Hero image upload is unavailable", "MEDIA_UPLOAD_UNAVAILABLE");
      }
      const signature = await service.createHeroUploadSignature({ storefrontId, ...parsed.data });
      reply.status(200).send({ success: true, data: signature });
    }
  );

  app.post<{ Params: { storefrontId: string } }>(
    "/:storefrontId/hero-media",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId } = request.params;
      if (!(await prisma.storefront.findUnique({ where: { id: storefrontId } }))) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }
      const parsed = heroRegistrationSchema.safeParse(request.body);
      if (!parsed.success) throw new BadRequestError("Invalid hero image registration", "VALIDATION_ERROR");
      const { placement, publicId } = parsed.data;
      const prefix = `kids-wear/storefronts/${storefrontId}/heroes/${placement}/`;
      if (!publicId.startsWith(prefix) ||
          !z.string().uuid().safeParse(publicId.slice(prefix.length)).success) {
        throw new BadRequestError("Hero image does not belong to this storefront", "MEDIA_NAMESPACE_INVALID");
      }
      const metadata = await getCloudinaryService().fetchResourceMetadata(publicId, "image");
      const { width, height } = placement === "desktop"
        ? { width: 1920, height: 800 }
        : { width: 1080, height: 1350 };
      if (metadata.publicId !== publicId || metadata.resourceType !== "image") {
        throw new BadRequestError("Hero media must be an image", "INVALID_MEDIA_TYPE");
      }
      if (!["jpg", "jpeg", "png", "webp"].includes(metadata.format.toLowerCase())) {
        throw new BadRequestError("Hero image must be JPEG, PNG, or WebP", "MEDIA_FORMAT_INVALID");
      }
      if (metadata.width !== width || metadata.height !== height) {
        throw new BadRequestError(`Hero ${placement} image must be ${width}×${height}`, "MEDIA_DIMENSIONS_INVALID");
      }
      if (!metadata.bytes || metadata.bytes > 10 * 1024 * 1024) {
        throw new BadRequestError("Hero image must be 10 MB or smaller", "MEDIA_SIZE_INVALID");
      }
      if (await prisma.mediaAsset.findFirst({ where: { providerPublicId: publicId } })) {
        throw new BadRequestError("Hero image is already registered", "MEDIA_ALREADY_REGISTERED");
      }
      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          mediaType: "IMAGE",
          provider: "cloudinary",
          providerPublicId: publicId,
          secureUrl: metadata.secureUrl,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          bytes: metadata.bytes,
        },
      });
      reply.status(201).send({ success: true, data: { mediaAsset: {
        id: mediaAsset.id,
        secureUrl: mediaAsset.secureUrl,
        width: mediaAsset.width,
        height: mediaAsset.height,
        format: mediaAsset.format,
      } } });
    }
  );

  // GET /api/v1/admin/storefronts/:storefrontId/hero-slides
  app.get<{ Params: { storefrontId: string } }>(
    "/:storefrontId/hero-slides",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { storefrontId } = request.params;

      const storefront = await prisma.storefront.findUnique({
        where: { id: storefrontId },
      });
      if (!storefront) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }

      const slides = await prisma.heroSlide.findMany({
        where: { storefrontId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          desktopImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
          mobileImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          heroSlides: slides,
        },
      });
    }
  );

  // POST /api/v1/admin/storefronts/:storefrontId/hero-slides
  app.post<{ Params: { storefrontId: string } }>(
    "/:storefrontId/hero-slides",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId } = request.params;

      const storefront = await prisma.storefront.findUnique({
        where: { id: storefrontId },
      });
      if (!storefront) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }

      const parseResult = createHeroSlideSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid hero slide data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const {
        heading,
        text,
        ctaLabel,
        ctaLink,
        desktopImageAssetId,
        mobileImageAssetId,
        sortOrder,
        isActive,
      } = parseResult.data;

      // Validate desktop media asset
      await validateImageAsset(prisma, desktopImageAssetId, "Desktop");

      // Validate mobile media asset if provided
      if (mobileImageAssetId) {
        await validateImageAsset(prisma, mobileImageAssetId, "Mobile");
      }

      const slide = await prisma.heroSlide.create({
        data: {
          storefrontId,
          heading,
          text: text ?? null,
          ctaLabel: ctaLabel ?? null,
          ctaLink: ctaLink ?? null,
          desktopImageAssetId,
          mobileImageAssetId: mobileImageAssetId ?? null,
          sortOrder: sortOrder ?? 0,
          isActive: isActive ?? true,
        },
        include: {
          desktopImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
          mobileImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
        },
      });

      reply.status(201).send({
        success: true,
        data: {
          heroSlide: slide,
        },
      });
    }
  );

  // PATCH /api/v1/admin/storefronts/:storefrontId/hero-slides/:slideId
  app.patch<{ Params: { storefrontId: string; slideId: string } }>(
    "/:storefrontId/hero-slides/:slideId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId, slideId } = request.params;

      const storefront = await prisma.storefront.findUnique({
        where: { id: storefrontId },
      });
      if (!storefront) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }

      const existingSlide = await prisma.heroSlide.findUnique({
        where: { id: slideId },
      });
      if (!existingSlide || existingSlide.storefrontId !== storefrontId) {
        throw new NotFoundError("Hero slide not found in this storefront", "HERO_SLIDE_NOT_FOUND");
      }

      const parseResult = updateHeroSlideSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid hero slide update data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const {
        heading,
        text,
        ctaLabel,
        ctaLink,
        desktopImageAssetId,
        mobileImageAssetId,
        sortOrder,
        isActive,
      } = parseResult.data;

      // Validate desktop media asset if changing
      if (desktopImageAssetId !== undefined) {
        await validateImageAsset(prisma, desktopImageAssetId, "Desktop");
      }

      // Validate mobile media asset if changing
      if (mobileImageAssetId !== undefined && mobileImageAssetId !== null) {
        await validateImageAsset(prisma, mobileImageAssetId, "Mobile");
      }

      const updatedSlide = await prisma.heroSlide.update({
        where: { id: slideId },
        data: {
          ...(heading !== undefined && { heading }),
          ...(text !== undefined && { text }),
          ...(ctaLabel !== undefined && { ctaLabel }),
          ...(ctaLink !== undefined && { ctaLink }),
          ...(desktopImageAssetId !== undefined && { desktopImageAssetId }),
          ...(mobileImageAssetId !== undefined && { mobileImageAssetId }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          desktopImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
          mobileImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          heroSlide: updatedSlide,
        },
      });
    }
  );

  // DELETE /api/v1/admin/storefronts/:storefrontId/hero-slides/:slideId
  app.delete<{ Params: { storefrontId: string; slideId: string } }>(
    "/:storefrontId/hero-slides/:slideId",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId, slideId } = request.params;

      const storefront = await prisma.storefront.findUnique({
        where: { id: storefrontId },
      });
      if (!storefront) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }

      const existingSlide = await prisma.heroSlide.findUnique({
        where: { id: slideId },
      });
      if (!existingSlide || existingSlide.storefrontId !== storefrontId) {
        throw new NotFoundError("Hero slide not found in this storefront", "HERO_SLIDE_NOT_FOUND");
      }

      await prisma.heroSlide.delete({
        where: { id: slideId },
      });

      reply.status(200).send({
        success: true,
        data: {
          message: "Hero slide deleted successfully",
        },
      });
    }
  );

  // PATCH /api/v1/admin/storefronts/:storefrontId/hero-slides/reorder
  app.patch<{ Params: { storefrontId: string } }>(
    "/:storefrontId/hero-slides/reorder",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const { storefrontId } = request.params;

      const storefront = await prisma.storefront.findUnique({
        where: { id: storefrontId },
      });
      if (!storefront) {
        throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
      }

      const parseResult = reorderHeroSlidesSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid reorder data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { slideIds } = parseResult.data;

      // Reject duplicate IDs
      if (new Set(slideIds).size !== slideIds.length) {
        throw new BadRequestError(
          "Duplicate slide IDs are not allowed in reorder list",
          "VALIDATION_ERROR"
        );
      }

      // Check all slide IDs belong to this storefront
      const existingSlides = await prisma.heroSlide.findMany({
        where: { storefrontId },
      });
      const existingIdSet = new Set(existingSlides.map((s) => s.id));

      for (const id of slideIds) {
        if (!existingIdSet.has(id)) {
          throw new BadRequestError(
            "All slides in reorder list must exist and belong to the specified storefront",
            "VALIDATION_ERROR"
          );
        }
      }

      // Update sortOrder atomically inside a transaction
      await prisma.$transaction(
        slideIds.map((id, index) =>
          prisma.heroSlide.update({
            where: { id },
            data: { sortOrder: index },
          })
        )
      );

      const updatedSlides = await prisma.heroSlide.findMany({
        where: { storefrontId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          desktopImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
          mobileImageAsset: {
            select: {
              id: true,
              secureUrl: true,
              width: true,
              height: true,
              format: true,
            },
          },
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          heroSlides: updatedSlides,
        },
      });
    }
  );
};
