import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { ReviewStatus, type Prisma } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { getCloudinaryService } from "../../lib/cloudinary";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import {
  reviewIdParamSchema,
  listAdminReviewsQuerySchema,
  updateReviewStatusBodySchema,
} from "./validation";
import {
  REVIEW_STATUS_LABELS,
  type ReviewStatusType,
  type AdminReviewListItem,
  type AdminReviewsResponseData,
  type AdminReviewDetailData,
  type AdminReviewStatusUpdateResponseData,
} from "@kids-wear/shared";

const ALLOWED_STATUS_TRANSITIONS: Record<ReviewStatus, Set<ReviewStatus>> = {
  [ReviewStatus.PENDING]: new Set([
    ReviewStatus.PENDING,
    ReviewStatus.APPROVED,
    ReviewStatus.HIDDEN,
  ]),
  [ReviewStatus.APPROVED]: new Set([ReviewStatus.APPROVED, ReviewStatus.HIDDEN]),
  [ReviewStatus.HIDDEN]: new Set([ReviewStatus.HIDDEN, ReviewStatus.APPROVED]),
};

export const adminReviewRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // 1. ADMIN LIST REVIEWS
  // GET /api/v1/admin/reviews
  // ==========================================================================
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      productId?: string;
      rating?: string;
      q?: string;
    };
  }>(
    "/",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const queryResult = listAdminReviewsQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        const firstError = queryResult.error.errors[0]?.message || "Invalid query parameters";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { page, limit, status, productId, rating, q } = queryResult.data;

      const where: Prisma.ReviewWhereInput = {
        ...(status ? { status } : {}),
        ...(productId ? { productId } : {}),
        ...(rating !== undefined ? { rating } : {}),
        ...(q
          ? {
              OR: [
                { reviewerName: { contains: q, mode: "insensitive" } },
                { reviewText: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      };

      const totalReviews = await prisma.review.count({ where });
      const totalPages = Math.ceil(totalReviews / limit);

      const reviews = await prisma.review.findMany({
        where,
        select: {
          id: true,
          reviewerName: true,
          rating: true,
          reviewText: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { media: true },
          },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              storefront: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      });

      const formattedReviews: AdminReviewListItem[] = reviews.map((r) => ({
        id: r.id,
        reviewerName: r.reviewerName,
        rating: r.rating,
        reviewText: r.reviewText,
        status: r.status as ReviewStatusType,
        statusLabel: REVIEW_STATUS_LABELS[r.status as ReviewStatusType] || r.status,
        imageCount: r._count.media,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        product: {
          id: r.product.id,
          name: r.product.name,
          slug: r.product.slug,
          sku: r.product.sku,
          storefrontSlug: r.product.storefront.slug,
        },
      }));

      const responseData: AdminReviewsResponseData = {
        reviews: formattedReviews,
        pagination: {
          page,
          limit,
          totalReviews,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      reply.status(200).send({
        success: true,
        data: responseData,
      });
    }
  );

  // ==========================================================================
  // 2. ADMIN GET REVIEW DETAIL
  // GET /api/v1/admin/reviews/:reviewId
  // ==========================================================================
  app.get<{ Params: { reviewId: string } }>(
    "/:reviewId",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const paramResult = reviewIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new BadRequestError("Invalid review ID format", "VALIDATION_ERROR");
      }

      const { reviewId } = paramResult.data;

      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              storefront: {
                select: {
                  slug: true,
                },
              },
            },
          },
          media: {
            include: {
              mediaAsset: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!review) {
        throw new NotFoundError("Review not found", "REVIEW_NOT_FOUND");
      }

      const responseData: AdminReviewDetailData = {
        id: review.id,
        reviewerName: review.reviewerName,
        rating: review.rating,
        reviewText: review.reviewText,
        status: review.status as ReviewStatusType,
        statusLabel: REVIEW_STATUS_LABELS[review.status as ReviewStatusType] || review.status,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        product: {
          id: review.product.id,
          name: review.product.name,
          slug: review.product.slug,
          sku: review.product.sku,
          storefrontSlug: review.product.storefront.slug,
        },
        images: review.media.map((m) => ({
          id: m.id,
          mediaAssetId: m.mediaAssetId,
          secureUrl: m.mediaAsset.secureUrl,
          providerPublicId: m.mediaAsset.providerPublicId,
          width: m.mediaAsset.width,
          height: m.mediaAsset.height,
          format: m.mediaAsset.format,
          bytes: m.mediaAsset.bytes,
          sortOrder: m.sortOrder,
        })),
      };

      reply.status(200).send({
        success: true,
        data: responseData,
      });
    }
  );

  // ==========================================================================
  // 3. ADMIN UPDATE REVIEW STATUS (APPROVE / HIDE)
  // PATCH /api/v1/admin/reviews/:reviewId/status
  // ==========================================================================
  app.patch<{ Params: { reviewId: string } }>(
    "/:reviewId/status",
    {
      preHandler: [requireAdmin, requireAdminCsrf],
    },
    async (request, reply) => {
      const paramResult = reviewIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new BadRequestError("Invalid review ID format", "VALIDATION_ERROR");
      }

      const bodyResult = updateReviewStatusBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        const firstError = bodyResult.error.errors[0]?.message || "Invalid status update payload";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { reviewId } = paramResult.data;
      const { status: targetStatus } = bodyResult.data;

      const result = await prisma.$transaction(async (tx) => {
        // Concurrency-safe row-level lock
        const lockedRows: Array<{ id: string; status: ReviewStatus }> = await tx.$queryRaw`
          SELECT id, status FROM "Review" WHERE id = ${reviewId}::text FOR UPDATE
        `;

        if (!lockedRows || lockedRows.length === 0) {
          throw new NotFoundError("Review not found", "REVIEW_NOT_FOUND");
        }

        const currentStatus = lockedRows[0].status;

        // Idempotent retry: same status returns immediately with updated: false
        if (currentStatus === targetStatus) {
          return {
            updated: false,
            status: currentStatus as ReviewStatusType,
            statusLabel: REVIEW_STATUS_LABELS[currentStatus as ReviewStatusType] || currentStatus,
          };
        }

        // Enforce exact moderation transition matrix
        if (!ALLOWED_STATUS_TRANSITIONS[currentStatus]?.has(targetStatus)) {
          throw new BadRequestError(
            `Cannot transition review status from ${currentStatus} to ${targetStatus}`,
            "INVALID_STATUS_TRANSITION"
          );
        }

        // Apply mutation
        await tx.review.update({
          where: { id: reviewId },
          data: {
            status: targetStatus,
          },
        });

        return {
          updated: true,
          status: targetStatus as ReviewStatusType,
          statusLabel: REVIEW_STATUS_LABELS[targetStatus as ReviewStatusType] || targetStatus,
        };
      });

      const responseData: AdminReviewStatusUpdateResponseData = result;

      reply.status(200).send({
        success: true,
        data: responseData,
      });
    }
  );

  // ==========================================================================
  // 4. ADMIN DELETE REVIEW
  // DELETE /api/v1/admin/reviews/:reviewId
  // ==========================================================================
  app.delete<{ Params: { reviewId: string } }>(
    "/:reviewId",
    {
      preHandler: [requireAdmin, requireAdminCsrf],
    },
    async (request, reply) => {
      const paramResult = reviewIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new BadRequestError("Invalid review ID format", "VALIDATION_ERROR");
      }

      const { reviewId } = paramResult.data;

      // 1. Fetch review and associated media assets before deletion
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          media: {
            include: {
              mediaAsset: true,
            },
          },
        },
      });

      if (!review) {
        throw new NotFoundError("Review not found", "REVIEW_NOT_FOUND");
      }

      const assetsToCleanup = review.media.map((m) => m.mediaAsset.providerPublicId);

      // 2. Delete database record atomically
      await prisma.review.delete({
        where: { id: reviewId },
      });

      // 3. Best-effort Cloudinary asset cleanup
      const cloudinaryService = getCloudinaryService();
      if (cloudinaryService.deleteResource) {
        for (const publicId of assetsToCleanup) {
          try {
            await cloudinaryService.deleteResource(publicId, "image");
          } catch (cleanupErr) {
            request.log.warn(
              { cleanupErr, publicId },
              "Failed to clean up Cloudinary asset during review deletion (review DB deletion succeeded)"
            );
          }
        }
      }

      reply.status(200).send({
        success: true,
        data: {
          deleted: true,
        },
      });
    }
  );
};
