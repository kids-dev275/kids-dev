import { z } from "zod";

export const uploadSignatureSchema = z
  .object({
    mediaType: z.enum(["IMAGE", "VIDEO"], {
      errorMap: () => ({ message: "mediaType must be IMAGE or VIDEO" }),
    }),
    videoCrop: z
      .object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict("Unapproved fields are not allowed")
  .superRefine(({ mediaType, videoCrop }, context) => {
    if (mediaType === "VIDEO" && !videoCrop) {
      context.addIssue({ code: "custom", message: "Video framing is required" });
      return;
    }
    if (mediaType === "IMAGE" && videoCrop) {
      context.addIssue({ code: "custom", message: "Video framing is only valid for videos" });
      return;
    }
    if (
      videoCrop &&
      (videoCrop.width < 320 ||
        videoCrop.height * 4 !== videoCrop.width * 5)
    ) {
      context.addIssue({ code: "custom", message: "Invalid 4:5 video framing" });
    }
  });

export const registerProductMediaSchema = z
  .object({
    publicId: z
      .string({ required_error: "publicId is required" })
      .trim()
      .min(1, "publicId cannot be empty"),
    mediaType: z.enum(["IMAGE", "VIDEO"], {
      errorMap: () => ({ message: "mediaType must be IMAGE or VIDEO" }),
    }),
    altText: z
      .string()
      .trim()
      .max(200, "Alt text must not exceed 200 characters")
      .nullable()
      .optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .min(0, "Sort order must be non-negative")
      .default(0)
      .optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateProductMediaSchema = z
  .object({
    altText: z
      .string()
      .trim()
      .max(200, "Alt text must not exceed 200 characters")
      .nullable()
      .optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .min(0, "Sort order must be non-negative")
      .optional(),
  })
  .strict("Unapproved fields are not allowed");

export const reorderProductMediaSchema = z
  .object({
    mediaIds: z
      .array(z.string().uuid("Invalid media ID"), {
        required_error: "mediaIds array is required",
      })
      .min(1, "At least one media ID is required"),
  })
  .strict("Unapproved fields are not allowed");
