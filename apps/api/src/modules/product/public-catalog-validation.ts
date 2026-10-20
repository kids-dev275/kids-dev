import { z } from "zod";

export const publicListProductsQuerySchema = z.object({
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
  new: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const publicSearchQuerySchema = z.object({
  q: z
    .string({ required_error: "Search query is required" })
    .trim()
    .min(1, "Search query must not be empty")
    .max(100, "Search query must not exceed 100 characters"),
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
});
