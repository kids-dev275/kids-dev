import { z } from "zod";
import { ReviewStatus } from "@prisma/client";

/**
 * Review Media Upload Signature request schema.
 * Enforces submission-scoped binding ID.
 */
export const reviewMediaSignSchema = z
  .object({
    reviewSubmissionId: z.string().uuid("reviewSubmissionId must be a valid UUID"),
  })
  .strict();

export type ReviewMediaSignInput = z.infer<typeof reviewMediaSignSchema>;

/**
 * Public Anonymous Review Submission Schema.
 * Enforces strict boundaries, no login requirement, plain text, and max 3 images.
 */
export const createReviewBodySchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters"),
    productId: z
      .string({ required_error: "Product ID is required" })
      .uuid("Product ID must be a valid UUID"),
    rating: z
      .number({ required_error: "Rating is required" })
      .int("Rating must be an integer")
      .min(1, "Rating must be between 1 and 5")
      .max(5, "Rating must be between 1 and 5"),
    reviewText: z
      .string({ required_error: "Review text is required" })
      .trim()
      .min(10, "Review text must be at least 10 characters")
      .max(2000, "Review text must not exceed 2000 characters"),
    reviewSubmissionId: z
      .string()
      .uuid("reviewSubmissionId must be a valid UUID")
      .optional()
      .nullable(),
    images: z
      .array(
        z
          .object({
            publicId: z
              .string()
              .min(1, "publicId cannot be empty")
              .max(255, "publicId cannot exceed 255 characters"),
          })
          .strict()
      )
      .max(3, "Maximum of 3 images allowed")
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.images && data.images.length > 0) {
        return !!data.reviewSubmissionId;
      }
      return true;
    },
    {
      message: "reviewSubmissionId is required when uploading images",
      path: ["reviewSubmissionId"],
    }
  );

export type CreateReviewBodyInput = z.infer<typeof createReviewBodySchema>;

/**
 * Query schema for public published review retrieval.
 */
export const listPublicReviewsQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().min(1).max(50)),
    productId: z.string().uuid("Invalid Product ID").optional(),
    storefrontSlug: z.string().min(1).max(100).optional(),
  })
  .strict();

export type ListPublicReviewsQueryInput = z.infer<typeof listPublicReviewsQuerySchema>;

/**
 * Schema for route parameters with reviewId.
 */
export const reviewIdParamSchema = z
  .object({
    reviewId: z.string().uuid("Invalid Review ID format"),
  })
  .strict();

export type ReviewIdParamInput = z.infer<typeof reviewIdParamSchema>;

/**
 * Query schema for Admin review list.
 */
export const listAdminReviewsQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
    status: z.nativeEnum(ReviewStatus).optional(),
    productId: z.string().uuid("Invalid Product ID").optional(),
    rating: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().min(1).max(5).optional()),
    q: z.string().max(100).optional(),
  })
  .strict();

export type ListAdminReviewsQueryInput = z.infer<typeof listAdminReviewsQuerySchema>;

/**
 * Body schema for Admin status update.
 * Enforces valid ReviewStatus enum value; exact transition matrix is authoritatively validated in the handler.
 */
export const updateReviewStatusBodySchema = z
  .object({
    status: z.nativeEnum(ReviewStatus, {
      errorMap: () => ({
        message: "Target status must be a valid ReviewStatus (PENDING, APPROVED, HIDDEN)",
      }),
    }),
  })
  .strict();

export type UpdateReviewStatusBodyInput = z.infer<typeof updateReviewStatusBodySchema>;
