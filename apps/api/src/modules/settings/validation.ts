import { z } from "zod";
import { isValidCtaLink } from "../storefront/validation";

const decimalRegex = /^\d+(\.\d{1,2})?$/;

export const updateAnnouncementSchema = z
  .object({
    text: z
      .string()
      .trim()
      .max(255, "Announcement text must not exceed 255 characters")
      .nullable()
      .optional(),
    link: z
      .string()
      .trim()
      .max(500, "Announcement link must not exceed 500 characters")
      .refine(isValidCtaLink, "Invalid or unsafe link protocol")
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateShippingSchema = z
  .object({
    flatDeliveryCharge: z
      .union([
        z.number({ invalid_type_error: "Delivery charge must be a number or numeric string" }),
        z.string(),
      ])
      .transform((val) => (typeof val === "number" ? val.toString() : val.trim()))
      .refine((val) => decimalRegex.test(val), {
        message:
          "Delivery charge must be a valid non-negative decimal amount with up to 2 decimal places",
      })
      .refine((val) => parseFloat(val) >= 0, {
        message: "Delivery charge must be non-negative",
      }),
  })
  .strict("Unapproved fields are not allowed");

export const updateBankTransferSchema = z
  .object({
    bankName: z
      .string()
      .trim()
      .max(100, "Bank name must not exceed 100 characters")
      .nullable()
      .optional(),
    accountTitle: z
      .string()
      .trim()
      .max(100, "Account title must not exceed 100 characters")
      .nullable()
      .optional(),
    accountOrIban: z
      .string()
      .trim()
      .max(50, "Account/IBAN must not exceed 50 characters")
      .nullable()
      .optional(),
    branchCode: z
      .string()
      .trim()
      .max(20, "Branch code must not exceed 20 characters")
      .nullable()
      .optional(),
    branchLocation: z
      .string()
      .trim()
      .max(100, "Branch location must not exceed 100 characters")
      .nullable()
      .optional(),
    instructions: z
      .string()
      .trim()
      .max(1000, "Instructions must not exceed 1000 characters")
      .nullable()
      .optional(),
  })
  .strict("Unapproved fields are not allowed");

export const updateNotificationsSchema = z
  .object({
    newOrderEmailEnabled: z.boolean().optional(),
    newOrderNotificationRecipient: z
      .string()
      .trim()
      .email("Invalid email format")
      .nullable()
      .optional(),
    newOrderRecipientEmail: z.string().trim().email("Invalid email format").nullable().optional(),
  })
  .strict("Unapproved fields are not allowed");
