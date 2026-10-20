import { z } from "zod";

export const cartItemValidateSchema = z.object({
  productId: z.string().uuid("Invalid product ID format"),
  variantId: z.string().uuid("Invalid variant ID format"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10"),
});

export const cartValidateBodySchema = z.object({
  items: z.array(cartItemValidateSchema).max(50, "Cart cannot exceed 50 distinct items"),
});

export type CartItemValidateInput = z.infer<typeof cartItemValidateSchema>;
export type CartValidateBodyInput = z.infer<typeof cartValidateBodySchema>;
