import { z } from "zod";
import { OrderStatus, PaymentMethod } from "@prisma/client";

export const orderNumberParamSchema = z
  .object({
    orderNumber: z.string().regex(/^KW-\d+$/, "Invalid order number format"),
  })
  .strict();

export const listAdminOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, "Limit must be at least 1")
      .max(100, "Limit cannot exceed 100")
      .default(20),
    q: z.string().trim().max(100, "Search query must not exceed 100 characters").optional(),
    status: z
      .nativeEnum(OrderStatus, {
        errorMap: () => ({ message: "Invalid order status filter" }),
      })
      .optional(),
    paymentMethod: z
      .nativeEnum(PaymentMethod, {
        errorMap: () => ({ message: "Invalid payment method filter" }),
      })
      .optional(),
  })
  .strict();

export const updateOrderStatusBodySchema = z
  .object({
    status: z.nativeEnum(OrderStatus, {
      errorMap: () => ({ message: "Invalid order status value" }),
    }),
  })
  .strict();

export type ListAdminOrdersQueryInput = z.infer<typeof listAdminOrdersQuerySchema>;
export type UpdateOrderStatusBodyInput = z.infer<typeof updateOrderStatusBodySchema>;
