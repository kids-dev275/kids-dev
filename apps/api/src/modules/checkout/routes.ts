import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError } from "../../lib/errors";
import { validateCartLines } from "../cart/service";
import { checkoutValidateBodySchema } from "./validation";
import type { CheckoutConfigData, CheckoutValidationResponseData } from "@kids-wear/shared";

export function isBankTransferConfigured(
  settings:
    | {
        bankName?: string | null;
        accountTitle?: string | null;
        accountOrIban?: string | null;
        instructions?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!settings) return false;
  const bankName = settings.bankName?.trim() || null;
  const accountTitle = settings.accountTitle?.trim() || null;
  const accountOrIban = settings.accountOrIban?.trim() || null;
  const instructions = settings.instructions?.trim() || null;
  return Boolean(bankName && accountTitle && accountOrIban && instructions);
}

export const checkoutRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/checkout/config
  // Public, read-only endpoint returning customer-facing checkout & payment configuration
  app.get("/config", async (_request, reply) => {
    const commerceSettings = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
    });

    const rawBankName = commerceSettings?.bankName?.trim() || null;
    const rawAccountTitle = commerceSettings?.accountTitle?.trim() || null;
    const rawAccountOrIban = commerceSettings?.accountOrIban?.trim() || null;
    const rawInstructions = commerceSettings?.instructions?.trim() || null;

    // Bank transfer is only available if all four customer-facing fields are configured
    const isBankConfigured = isBankTransferConfigured(commerceSettings);

    const configData: CheckoutConfigData = {
      paymentMethods: {
        cashOnDelivery: {
          available: true,
        },
        bankTransfer: {
          available: isBankConfigured,
          bankName: isBankConfigured ? rawBankName : null,
          accountTitle: isBankConfigured ? rawAccountTitle : null,
          accountOrIban: isBankConfigured ? rawAccountOrIban : null,
          branchCode:
            isBankConfigured && commerceSettings?.branchCode?.trim()
              ? commerceSettings.branchCode.trim()
              : null,
          branchLocation:
            isBankConfigured && commerceSettings?.branchLocation?.trim()
              ? commerceSettings.branchLocation.trim()
              : null,
          instructions: isBankConfigured ? rawInstructions : null,
        },
      },
    };

    return reply.status(200).send({
      success: true,
      data: configData,
    });
  });

  // POST /api/v1/checkout/validate
  // Public, state-free authoritative checkout pre-validation endpoint
  app.post("/validate", async (request, reply) => {
    const parseResult = checkoutValidateBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.errors[0]?.message || "Invalid checkout validation request";
      throw new BadRequestError(firstError, "VALIDATION_ERROR");
    }

    const { items, customer, paymentMethod } = parseResult.data;

    // Check payment method availability against current configuration
    if (paymentMethod === "BANK_TRANSFER") {
      const commerceSettings = await prisma.commerceSettings.findUnique({
        where: { singletonKey: 1 },
      });
      const isBankConfigured = isBankTransferConfigured(commerceSettings);

      if (!isBankConfigured) {
        throw new BadRequestError(
          "Manual Bank Transfer is currently unavailable",
          "PAYMENT_METHOD_UNAVAILABLE"
        );
      }
    }

    // Authoritative Cart validation reuse
    const cartResult = await validateCartLines(prisma, items);

    // If any items are invalid or unavailable, fail checkout preflight
    if (cartResult.invalidItems.length > 0) {
      throw new BadRequestError("Cart contains invalid or unavailable items", "CART_INVALID", {
        invalidItems: cartResult.invalidItems,
      });
    }

    if (cartResult.validItems.length === 0) {
      throw new BadRequestError("Cart cannot be empty for checkout", "CART_EMPTY");
    }

    const responseData: CheckoutValidationResponseData = {
      customer: {
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        province: customer.province,
        postalCode: customer.postalCode,
        orderNotes: customer.orderNotes,
      },
      paymentMethod,
      items: cartResult.validItems,
      subtotal: cartResult.subtotal,
      deliveryCharge: cartResult.deliveryCharge,
      total: cartResult.total,
    };

    return reply.status(200).send({
      success: true,
      data: responseData,
    });
  });
};
