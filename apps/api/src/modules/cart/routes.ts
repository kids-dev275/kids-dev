import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError } from "../../lib/errors";
import { cartValidateBodySchema } from "./validation";
import {
  validateCartLines,
  CartValidatedItemResponse,
  CartInvalidItemResponse,
  CartValidateCalculationResult,
} from "./service";

export type { CartValidatedItemResponse, CartInvalidItemResponse, CartValidateCalculationResult };

export interface CartValidateResponseData {
  items: CartValidatedItemResponse[];
  validItems: CartValidatedItemResponse[];
  invalidItems: CartInvalidItemResponse[];
  subtotal: string;
  deliveryCharge: string;
  total: string;
}

export const cartRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // POST /api/v1/cart/validate
  // Public, read-only cart revalidation endpoint
  app.post("/validate", async (request, reply) => {
    const parseResult = cartValidateBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Invalid cart validation request";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { items } = parseResult.data;

    const result = await validateCartLines(prisma, items);

    return reply.status(200).send({
      success: true,
      data: {
        items: result.validItems,
        validItems: result.validItems,
        invalidItems: result.invalidItems,
        subtotal: result.subtotal,
        deliveryCharge: result.deliveryCharge,
        total: result.total,
      },
    });
  });
};
