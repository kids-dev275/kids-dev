import { z } from "zod";

export const createSizeSchema = z
  .object({
    name: z
      .string({ required_error: "Size name is required" })
      .trim()
      .min(1, "Size name cannot be empty")
      .max(50, "Size name must not exceed 50 characters"),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .default(0)
      .optional(),
    isActive: z.boolean().default(true).optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateSizeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Size name cannot be empty")
      .max(50, "Size name must not exceed 50 characters")
      .optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict("Unapproved fields are not allowed");

export const createColorSchema = z
  .object({
    name: z
      .string({ required_error: "Color name is required" })
      .trim()
      .min(1, "Color name cannot be empty")
      .max(50, "Color name must not exceed 50 characters"),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .default(0)
      .optional(),
    isActive: z.boolean().default(true).optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateColorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Color name cannot be empty")
      .max(50, "Color name must not exceed 50 characters")
      .optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict("Unapproved fields are not allowed");

export const bulkCreateVariantsSchema = z
  .object({
    variants: z
      .array(
        z
          .object({
            productSizeId: z
              .string({ required_error: "productSizeId is required" })
              .uuid("Invalid size ID"),
            productColorId: z
              .string({ required_error: "productColorId is required" })
              .uuid("Invalid color ID"),
            isAvailable: z.boolean().default(true).optional(),
          })
          .strict("Unapproved fields in variant row are not allowed")
      )
      .min(1, "At least one variant combination is required"),
  })
  .strict("Unapproved fields are not allowed");

export const updateVariantAvailabilitySchema = z
  .object({
    isAvailable: z.boolean({ required_error: "isAvailable is required" }),
  })
  .strict("Unapproved fields are not allowed");
