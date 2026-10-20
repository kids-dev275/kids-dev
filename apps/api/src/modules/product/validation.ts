import { z } from "zod";

const decimalRegex = /^\d+(\.\d{1,2})?$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const positivePriceSchema = z
  .union([z.number({ invalid_type_error: "Price must be a number or numeric string" }), z.string()])
  .transform((val) => (typeof val === "number" ? val.toString() : val.trim()))
  .refine((val) => decimalRegex.test(val), {
    message: "Price must be a valid decimal amount with up to 2 decimal places",
  })
  .refine((val) => parseFloat(val) > 0, {
    message: "Price must be greater than zero",
  });

export const optionalPositivePriceSchema = z
  .union([
    z.number({ invalid_type_error: "Compare-at price must be a number or numeric string" }),
    z.string(),
  ])
  .transform((val) => (typeof val === "number" ? val.toString() : val.trim()))
  .refine((val) => decimalRegex.test(val), {
    message: "Compare-at price must be a valid decimal amount with up to 2 decimal places",
  })
  .refine((val) => parseFloat(val) > 0, {
    message: "Compare-at price must be greater than zero",
  })
  .nullable()
  .optional();

export const slugSchema = z
  .string({ required_error: "Slug is required" })
  .trim()
  .toLowerCase()
  .min(1, "Slug cannot be empty")
  .max(100, "Slug must not exceed 100 characters")
  .refine((val) => slugRegex.test(val), {
    message: "Slug must be lowercase alphanumeric with hyphens (e.g. classic-tee)",
  });

export const skuSchema = z
  .string({ required_error: "SKU is required" })
  .trim()
  .min(1, "SKU cannot be empty")
  .max(50, "SKU must not exceed 50 characters")
  .transform((val) => val.toUpperCase());

export const createProductSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(1, "Name cannot be empty")
      .max(200, "Name must not exceed 200 characters"),
    sku: skuSchema,
    slug: slugSchema,
    storefrontId: z
      .string({ required_error: "Storefront ID is required" })
      .uuid("Invalid storefront ID"),
    description: z
      .string({ required_error: "Description is required" })
      .trim()
      .min(1, "Description cannot be empty"),
    shortDescription: z
      .string()
      .trim()
      .max(500, "Short description must not exceed 500 characters")
      .nullable()
      .optional(),
    regularPrice: positivePriceSchema,
    compareAtPrice: optionalPositivePriceSchema,
    productType: z
      .string()
      .trim()
      .max(100, "Product type must not exceed 100 characters")
      .nullable()
      .optional(),
    gender: z.string().trim().max(50, "Gender must not exceed 50 characters").nullable().optional(),
    fabric: z
      .string()
      .trim()
      .max(100, "Fabric must not exceed 100 characters")
      .nullable()
      .optional(),
    includedPieces: z
      .string()
      .trim()
      .max(100, "Included pieces must not exceed 100 characters")
      .nullable()
      .optional(),
    fit: z.string().trim().max(100, "Fit must not exceed 100 characters").nullable().optional(),
    patternDesign: z
      .string()
      .trim()
      .max(100, "Pattern design must not exceed 100 characters")
      .nullable()
      .optional(),
    occasion: z
      .string()
      .trim()
      .max(100, "Occasion must not exceed 100 characters")
      .nullable()
      .optional(),
    season: z
      .string()
      .trim()
      .max(100, "Season must not exceed 100 characters")
      .nullable()
      .optional(),
    careInstructions: z
      .string()
      .trim()
      .max(500, "Care instructions must not exceed 500 characters")
      .nullable()
      .optional(),
    isNewArrival: z.boolean().default(false).optional(),
    seoTitle: z
      .string()
      .trim()
      .max(200, "SEO title must not exceed 200 characters")
      .nullable()
      .optional(),
    seoDescription: z
      .string()
      .trim()
      .max(500, "SEO description must not exceed 500 characters")
      .nullable()
      .optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(200, "Name must not exceed 200 characters")
      .optional(),
    sku: skuSchema.optional(),
    slug: slugSchema.optional(),
    storefrontId: z.string().uuid("Invalid storefront ID").optional(),
    description: z.string().trim().min(1, "Description cannot be empty").optional(),
    shortDescription: z
      .string()
      .trim()
      .max(500, "Short description must not exceed 500 characters")
      .nullable()
      .optional(),
    regularPrice: positivePriceSchema.optional(),
    compareAtPrice: optionalPositivePriceSchema,
    productType: z
      .string()
      .trim()
      .max(100, "Product type must not exceed 100 characters")
      .nullable()
      .optional(),
    gender: z.string().trim().max(50, "Gender must not exceed 50 characters").nullable().optional(),
    fabric: z
      .string()
      .trim()
      .max(100, "Fabric must not exceed 100 characters")
      .nullable()
      .optional(),
    includedPieces: z
      .string()
      .trim()
      .max(100, "Included pieces must not exceed 100 characters")
      .nullable()
      .optional(),
    fit: z.string().trim().max(100, "Fit must not exceed 100 characters").nullable().optional(),
    patternDesign: z
      .string()
      .trim()
      .max(100, "Pattern design must not exceed 100 characters")
      .nullable()
      .optional(),
    occasion: z
      .string()
      .trim()
      .max(100, "Occasion must not exceed 100 characters")
      .nullable()
      .optional(),
    season: z
      .string()
      .trim()
      .max(100, "Season must not exceed 100 characters")
      .nullable()
      .optional(),
    careInstructions: z
      .string()
      .trim()
      .max(500, "Care instructions must not exceed 500 characters")
      .nullable()
      .optional(),
    isNewArrival: z.boolean().optional(),
    seoTitle: z
      .string()
      .trim()
      .max(200, "SEO title must not exceed 200 characters")
      .nullable()
      .optional(),
    seoDescription: z
      .string()
      .trim()
      .max(500, "SEO description must not exceed 500 characters")
      .nullable()
      .optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "INACTIVE", "PUBLISHED"], {
      errorMap: () => ({ message: "Status must be DRAFT, INACTIVE, or PUBLISHED" }),
    }),
  })
  .strict("Unapproved fields are not allowed");

export const listProductsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((v) => parseInt(v, 10))
    .refine((v) => !isNaN(v) && v >= 1, "Page must be an integer >= 1"),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((v) => parseInt(v, 10))
    .refine((v) => !isNaN(v) && v >= 1 && v <= 100, "Limit must be between 1 and 100"),
  search: z.string().trim().optional(),
  storefront: z.string().trim().optional(),
  status: z.enum(["DRAFT", "INACTIVE", "PUBLISHED"]).optional(),
});
