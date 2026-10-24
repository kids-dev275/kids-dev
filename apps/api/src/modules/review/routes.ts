import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { ReviewStatus, MediaType, type Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { getPrismaClient } from "../../lib/prisma";
import { getCloudinaryService } from "../../lib/cloudinary";
import { BadRequestError } from "../../lib/errors";
import {
  reviewMediaSignSchema,
  createReviewBodySchema,
  listPublicReviewsQuerySchema,
} from "./validation";
import { getPublicProductVisibilityWhereClause } from "../product/public-visibility";
import type {
  PublicReviewItem,
  PublicReviewsResponseData,
  CreateReviewResponseData,
  ReviewMediaSignResponseData,
} from "@kids-wear/shared";

const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);

export const reviewRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // 1. REVIEW MEDIA UPLOAD SIGNATURE
  // POST /api/v1/reviews/media/sign
  // ==========================================================================
  app.post(
    "/media/sign",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
          allowList:
            env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"
              ? ["127.0.0.1", "localhost"]
              : undefined,
        },
      },
    },
    async (request, reply) => {
      const parseResult = reviewMediaSignSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid signature request";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { reviewSubmissionId } = parseResult.data;
      const cloudinaryService = getCloudinaryService();

      if (!cloudinaryService.createReviewUploadSignature) {
        throw new BadRequestError(
          "Review upload signing service is unavailable",
          "SERVICE_UNAVAILABLE"
        );
      }

      const signatureResult = await cloudinaryService.createReviewUploadSignature({
        reviewSubmissionId,
      });

      const response: ReviewMediaSignResponseData = signatureResult;
      reply.status(200).send({
        success: true,
        data: response,
      });
    }
  );

  // ==========================================================================
  // 2. SUBMIT ANONYMOUS REVIEW
  // POST /api/v1/reviews
  // ==========================================================================
  app.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          allowList:
            env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"
              ? ["127.0.0.1", "localhost"]
              : undefined,
        },
      },
    },
    async (request, reply) => {
      const parseResult = createReviewBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid review submission";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { name, productId, rating, reviewText, reviewSubmissionId, images } = parseResult.data;

      // 1. Authoritative Product Eligibility Verification
      const eligibleProduct = await prisma.product.findFirst({
        where: {
          id: productId,
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
              mediaAsset: { mediaType: MediaType.IMAGE },
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!eligibleProduct) {
        throw new BadRequestError(
          "Product does not exist or is not eligible for public reviews",
          "PRODUCT_NOT_ELIGIBLE_FOR_REVIEW"
        );
      }

      // 2. Authoritative Review Media Verification (0-3 images)
      const verifiedAssetMetadata: Array<{
        publicId: string;
        secureUrl: string;
        format: string;
        width: number;
        height: number;
        bytes: number;
      }> = [];

      if (images && images.length > 0) {
        if (!reviewSubmissionId) {
          throw new BadRequestError(
            "reviewSubmissionId is required when attaching images",
            "VALIDATION_ERROR"
          );
        }

        const expectedPrefix = `kids-wear/reviews/${reviewSubmissionId}/`;
        const cloudinaryService = getCloudinaryService();

        for (const img of images) {
          // Namespace isolation check
          if (!img.publicId.startsWith(expectedPrefix)) {
            throw new BadRequestError(
              "Review image public ID does not belong to this submission namespace",
              "REVIEW_MEDIA_NAMESPACE_INVALID"
            );
          }

          // Authoritative Cloudinary metadata verification
          let metadata;
          try {
            metadata = await cloudinaryService.fetchResourceMetadata(img.publicId, "image");
          } catch {
            throw new BadRequestError(
              "Media asset not found in Cloudinary or could not be verified",
              "MEDIA_ASSET_NOT_FOUND"
            );
          }

          if (metadata.resourceType !== "image") {
            throw new BadRequestError(
              "Only image resources are permitted for reviews. Videos are not supported.",
              "MEDIA_RESOURCE_TYPE_INVALID"
            );
          }

          const format = (metadata.format || "").toLowerCase();
          if (!ALLOWED_IMAGE_FORMATS.has(format)) {
            throw new BadRequestError(
              `Image format '${format}' is not supported. Allowed formats: JPEG, PNG, WebP.`,
              "MEDIA_FORMAT_INVALID"
            );
          }

          verifiedAssetMetadata.push({
            publicId: metadata.publicId,
            secureUrl: metadata.secureUrl,
            format,
            width: metadata.width,
            height: metadata.height,
            bytes: metadata.bytes,
          });
        }
      }

      // 3. Atomic Database Persistence
      try {
        await prisma.$transaction(async (tx) => {
          // Create Review starting in PENDING status
          const review = await tx.review.create({
            data: {
              productId,
              customerId: null,
              reviewerName: name,
              rating,
              reviewText,
              status: ReviewStatus.PENDING,
            },
          });

          // Create MediaAsset & ReviewMedia records
          for (let i = 0; i < verifiedAssetMetadata.length; i++) {
            const asset = verifiedAssetMetadata[i];
            const mediaAsset = await tx.mediaAsset.create({
              data: {
                mediaType: MediaType.IMAGE,
                provider: "cloudinary",
                providerPublicId: asset.publicId,
                secureUrl: asset.secureUrl,
                width: asset.width,
                height: asset.height,
                format: asset.format,
                bytes: asset.bytes,
              },
            });

            await tx.reviewMedia.create({
              data: {
                reviewId: review.id,
                mediaAssetId: mediaAsset.id,
                sortOrder: i,
              },
            });
          }
        });
      } catch (err) {
        request.log.error(
          { err, productId },
          "Failed to persist Review and ReviewMedia in transaction"
        );

        // Best-effort cleanup of uploaded Cloudinary assets
        const cloudinaryService = getCloudinaryService();
        if (cloudinaryService.deleteResource) {
          for (const asset of verifiedAssetMetadata) {
            try {
              await cloudinaryService.deleteResource(asset.publicId, "image");
            } catch (cleanupErr) {
              request.log.warn(
                { cleanupErr, publicId: asset.publicId },
                "Failed to clean up uploaded Cloudinary asset on review transaction rollback"
              );
            }
          }
        }

        throw err;
      }

      const response: CreateReviewResponseData = {
        submitted: true,
        message: "Your review has been submitted for approval.",
      };

      reply.status(201).send({
        success: true,
        data: response,
      });
    }
  );

  // ==========================================================================
  // 3. PUBLIC PUBLISHED REVIEWS RETRIEVAL
  // GET /api/v1/reviews
  // ==========================================================================
  app.get("/", async (request, reply) => {
    const queryResult = listPublicReviewsQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      const firstError = queryResult.error.errors[0]?.message || "Invalid query parameters";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { page, limit, productId, storefrontSlug, sort } = queryResult.data;

    // Public API STRICTLY queries APPROVED reviews whose product currently satisfies
    // the authoritative public product visibility contract.
    const publicProductWhere: Prisma.ProductWhereInput = {
      ...getPublicProductVisibilityWhereClause(),
      ...(storefrontSlug ? { storefront: { slug: storefrontSlug } } : {}),
    };

    const where: Prisma.ReviewWhereInput = {
      status: ReviewStatus.APPROVED,
      ...(productId ? { productId } : {}),
      product: publicProductWhere,
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
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            storefront: {
              select: {
                slug: true,
              },
            },
          },
        },
        media: {
          orderBy: { sortOrder: "asc" },
          select: {
            mediaAsset: {
              select: {
                secureUrl: true,
              },
            },
          },
        },
      },
      orderBy: sort === "rating"
        ? [{ rating: "desc" }, { createdAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    });

    const formattedReviews: PublicReviewItem[] = reviews.map((r) => ({
      id: r.id,
      reviewerName: r.reviewerName,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt.toISOString(),
      images: r.media.map((m) => ({
        url: m.mediaAsset.secureUrl,
        altText: `Review image for ${r.product.name}`,
      })),
      product: {
        id: r.product.id,
        name: r.product.name,
        slug: r.product.slug,
        storefrontSlug: r.product.storefront.slug,
      },
    }));

    const responseData: PublicReviewsResponseData = {
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
  });
};
