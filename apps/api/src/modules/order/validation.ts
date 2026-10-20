import { z } from "zod";
import { cartItemValidateSchema } from "../cart/validation";
import { checkoutCustomerSchema } from "../checkout/validation";

/**
 * Strict request body schema for POST /api/v1/orders.
 * Requires:
 * - idempotencyKey: valid UUID
 * - items: 1-50 items, quantity 1-10, valid UUIDs, no duplicate variants
 * - customer: reuse normalized checkout customer schema
 * - paymentMethod: CASH_ON_DELIVERY | BANK_TRANSFER
 * Strictly rejects client totals, order numbers, statuses, customerId, or extra fields (.strict()).
 */
export const orderCreateBodySchema = z
  .object({
    idempotencyKey: z
      .string({ required_error: "Idempotency key is required" })
      .uuid("Invalid idempotency key format"),
    items: z
      .array(cartItemValidateSchema, { required_error: "Order items are required" })
      .min(1, "Order items cannot be empty")
      .max(50, "Order cannot exceed 50 distinct items")
      .refine(
        (items) => {
          const variantIds = items.map((i) => i.variantId);
          return new Set(variantIds).size === variantIds.length;
        },
        { message: "Duplicate variant entries are not permitted in order" }
      ),
    customer: checkoutCustomerSchema,
    paymentMethod: z.enum(["CASH_ON_DELIVERY", "BANK_TRANSFER"], {
      errorMap: () => ({ message: "Unsupported payment method" }),
    }),
  })
  .strict();

export type OrderCreateBodyInput = z.infer<typeof orderCreateBodySchema>;
