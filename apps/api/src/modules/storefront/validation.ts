import { z } from "zod";

/**
 * Validates that a CTA link or announcement link does not use unsafe protocols.
 * Allows relative paths and safe HTTP / HTTPS URLs.
 */
export function isValidCtaLink(link: string | null | undefined): boolean {
  if (link === null || link === undefined) return true;
  const trimmed = link.trim();
  if (trimmed === "") return true;

  const lower = trimmed.toLowerCase();
  // Reject unsafe schemes immediately
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }

  // Allow application-relative paths e.g. /products, /categories/summer
  if (trimmed.startsWith("/")) {
    return true;
  }

  // If it contains a protocol scheme (like http:, https:, etc.), validate it is strictly http: or https:
  if (trimmed.includes(":")) {
    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Relative path without leading slash
  return true;
}

export const createHeroSlideSchema = z
  .object({
    heading: z
      .string({ required_error: "Heading is required" })
      .trim()
      .min(1, "Heading cannot be empty")
      .max(200, "Heading must not exceed 200 characters"),
    text: z.string().trim().max(500, "Text must not exceed 500 characters").nullable().optional(),
    ctaLabel: z
      .string()
      .trim()
      .max(100, "CTA label must not exceed 100 characters")
      .nullable()
      .optional(),
    ctaLink: z
      .string()
      .trim()
      .max(500, "CTA link must not exceed 500 characters")
      .refine(isValidCtaLink, "Invalid or unsafe CTA link protocol")
      .nullable()
      .optional(),
    desktopImageAssetId: z
      .string({ required_error: "Desktop image asset ID is required" })
      .uuid("Invalid desktop image asset ID"),
    mobileImageAssetId: z.string().uuid("Invalid mobile image asset ID").nullable().optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .min(0, "Sort order must be non-negative")
      .default(0)
      .optional(),
    isActive: z.boolean().default(true).optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateHeroSlideSchema = z
  .object({
    heading: z
      .string()
      .trim()
      .min(1, "Heading cannot be empty")
      .max(200, "Heading must not exceed 200 characters")
      .optional(),
    text: z.string().trim().max(500, "Text must not exceed 500 characters").nullable().optional(),
    ctaLabel: z
      .string()
      .trim()
      .max(100, "CTA label must not exceed 100 characters")
      .nullable()
      .optional(),
    ctaLink: z
      .string()
      .trim()
      .max(500, "CTA link must not exceed 500 characters")
      .refine(isValidCtaLink, "Invalid or unsafe CTA link protocol")
      .nullable()
      .optional(),
    desktopImageAssetId: z.string().uuid("Invalid desktop image asset ID").optional(),
    mobileImageAssetId: z.string().uuid("Invalid mobile image asset ID").nullable().optional(),
    sortOrder: z
      .number({ invalid_type_error: "Sort order must be an integer" })
      .int("Sort order must be an integer")
      .min(0, "Sort order must be non-negative")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict("Unapproved fields are not allowed");

export const reorderHeroSlidesSchema = z
  .object({
    slideIds: z
      .array(z.string().uuid("Each slide ID must be a valid UUID"), {
        required_error: "slideIds array is required",
      })
      .min(1, "At least one slide ID is required"),
  })
  .strict("Unapproved fields are not allowed");
