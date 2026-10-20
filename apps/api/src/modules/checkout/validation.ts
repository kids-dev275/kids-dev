import { z } from "zod";
import { cartItemValidateSchema } from "../cart/validation";

/**
 * Customer information schema with restrained bounds suitable for Pakistan commerce data.
 * Normalizes empty/whitespace-only optional strings to null.
 * Rejects unknown or overposted fields (.strict()).
 */
const optionalNormalizedString = (maxLen: number) =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed === "" ? null : trimmed;
      }
      return val;
    },
    z
      .string({ invalid_type_error: "Must be a string" })
      .max(maxLen, `Field cannot exceed ${maxLen} characters`)
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? null : val))
  );

const optionalNormalizedEmail = (maxLen: number) =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed === "" ? null : trimmed;
      }
      return val;
    },
    z
      .string({ invalid_type_error: "Must be a string" })
      .max(maxLen, `Email cannot exceed ${maxLen} characters`)
      .email("Please provide a valid email address")
      .nullable()
      .optional()
      .transform((val) => (val === undefined ? null : val))
  );

export const checkoutCustomerSchema = z
  .object({
    fullName: z
      .string({ required_error: "Full Name is required" })
      .trim()
      .min(2, "Full Name must be at least 2 characters")
      .max(120, "Full Name cannot exceed 120 characters"),
    phone: z
      .string({ required_error: "Phone number is required" })
      .trim()
      .min(7, "Phone number must be at least 7 characters")
      .max(20, "Phone number cannot exceed 20 characters"),
    email: optionalNormalizedEmail(150),
    address: z
      .string({ required_error: "Address is required" })
      .trim()
      .min(5, "Address must be at least 5 characters")
      .max(500, "Address cannot exceed 500 characters"),
    city: z
      .string({ required_error: "City is required" })
      .trim()
      .min(2, "City must be at least 2 characters")
      .max(100, "City cannot exceed 100 characters"),
    province: z
      .string({ required_error: "Province is required" })
      .trim()
      .min(2, "Province must be at least 2 characters")
      .max(100, "Province cannot exceed 100 characters"),
    postalCode: optionalNormalizedString(20),
    orderNotes: optionalNormalizedString(1000),
  })
  .strict();

export const checkoutValidateBodySchema = z
  .object({
    items: z
      .array(cartItemValidateSchema, { required_error: "Cart items are required" })
      .min(1, "Cart cannot be empty for checkout")
      .max(50, "Cart cannot exceed 50 distinct items"),
    customer: checkoutCustomerSchema,
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER"], {
      errorMap: () => ({ message: "Unsupported payment method" }),
    }),
  })
  .strict();

export type CheckoutCustomerValidatedInput = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutValidateBodyInput = z.infer<typeof checkoutValidateBodySchema>;
