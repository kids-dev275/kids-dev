import { z } from "zod";

/**
 * Client-side Zod validation schema for Checkout customer form.
 * Enforces restrained bounds matching backend expectations for Pakistan customer data.
 * Normalizes empty strings to null for optional fields.
 */
export const checkoutFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full Name must be at least 2 characters")
    .max(120, "Full Name cannot exceed 120 characters"),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 characters")
    .max(20, "Phone number cannot exceed 20 characters"),
  email: z
    .string()
    .trim()
    .max(150, "Email cannot exceed 150 characters")
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Please enter a valid email address",
    })
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(500, "Address cannot exceed 500 characters"),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City cannot exceed 100 characters"),
  province: z
    .string()
    .trim()
    .min(2, "Province must be at least 2 characters")
    .max(100, "Province cannot exceed 100 characters"),
  postalCode: z
    .string()
    .trim()
    .max(20, "Postal code cannot exceed 20 characters")
    .optional()
    .nullable(),
  orderNotes: z
    .string()
    .trim()
    .max(1000, "Order notes cannot exceed 1000 characters")
    .optional()
    .nullable(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER"], {
    errorMap: () => ({ message: "Please select a payment method" }),
  }),
});

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

/**
 * Normalizes optional form values (empty strings become null).
 */
export function normalizeCheckoutFormData(data: CheckoutFormData) {
  return {
    fullName: data.fullName.trim(),
    phone: data.phone.trim(),
    email: data.email && data.email.trim() !== "" ? data.email.trim() : null,
    address: data.address.trim(),
    city: data.city.trim(),
    province: data.province.trim(),
    postalCode: data.postalCode && data.postalCode.trim() !== "" ? data.postalCode.trim() : null,
    orderNotes: data.orderNotes && data.orderNotes.trim() !== "" ? data.orderNotes.trim() : null,
  };
}
