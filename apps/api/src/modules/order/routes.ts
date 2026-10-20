import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { Prisma, PrismaClient, OrderStatus, PaymentMethod } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { env } from "../../config/env";
import { BadRequestError, ConflictError } from "../../lib/errors";
import { orderCreateBodySchema, OrderCreateBodyInput } from "./validation";
import { validateCartLines } from "../cart/service";
import { isBankTransferConfigured } from "../checkout/routes";
import { hashCustomerSessionToken } from "../customer-auth/services/session";
import { getEmailService } from "../../lib/email";
import type { OrderCreateResponseData } from "@kids-wear/shared";

export interface OrderCreationTestHooks {
  beforeOrderCreate?: (tx: Prisma.TransactionClient) => Promise<void> | void;
  beforeItemCreate?: (tx: Prisma.TransactionClient) => Promise<void> | void;
  beforeHistoryCreate?: (tx: Prisma.TransactionClient) => Promise<void> | void;
  beforeCommit?: (tx: Prisma.TransactionClient) => Promise<void> | void;
}

let activeTestHooks: OrderCreationTestHooks | null = null;

export function setOrderCreationTestHooks(hooks: OrderCreationTestHooks | null): void {
  activeTestHooks = hooks;
}

/**
 * Resolves customerId from the active customer session cookie if valid and unexpired.
 * Returns null if not authenticated, expired, inactive, or invalid.
 * Never associates customer purely based on email input.
 */
async function resolveOptionalCustomer(
  request: FastifyRequest,
  prisma: PrismaClient
): Promise<string | null> {
  const rawToken = request.cookies[env.CUSTOMER_SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  try {
    const tokenHash = hashCustomerSessionToken(rawToken);
    const session = await prisma.customerSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });

    if (!session) return null;
    if (session.expiresAt <= new Date()) return null;
    if (!session.customer || !session.customer.isActive) return null;

    return session.customer.id;
  } catch {
    return null;
  }
}

/**
 * Compares an existing order and its items against the requested payload to verify idempotency.
 */
function isSameOrderPayload(
  existing: {
    customerId: string | null;
    paymentMethod: PaymentMethod;
    fullName: string;
    phone: string;
    email: string | null;
    address: string;
    city: string;
    province: string;
    postalCode: string | null;
    orderNotes: string | null;
    items: {
      productId: string | null;
      productVariantId: string | null;
      quantity: number;
    }[];
  },
  payload: OrderCreateBodyInput,
  customerId: string | null
): boolean {
  if (existing.customerId !== customerId) return false;
  if (existing.paymentMethod !== payload.paymentMethod) return false;
  if (existing.fullName !== payload.customer.fullName) return false;
  if (existing.phone !== payload.customer.phone) return false;
  if ((existing.email ?? null) !== (payload.customer.email ?? null)) return false;
  if (existing.address !== payload.customer.address) return false;
  if (existing.city !== payload.customer.city) return false;
  if (existing.province !== payload.customer.province) return false;
  if ((existing.postalCode ?? null) !== (payload.customer.postalCode ?? null)) return false;
  if ((existing.orderNotes ?? null) !== (payload.customer.orderNotes ?? null)) return false;

  if (existing.items.length !== payload.items.length) return false;

  for (const reqItem of payload.items) {
    const match = existing.items.find(
      (exItem) =>
        exItem.productId === reqItem.productId &&
        exItem.productVariantId === reqItem.variantId &&
        exItem.quantity === reqItem.quantity
    );
    if (!match) return false;
  }

  return true;
}

/**
 * Strict E2E-only rate-limit bypass evaluator.
 *
 * Invariant:
 * - Production server: never bypassed under any circumstance.
 * - Normal development/test server (without explicit E2E_TEST=true): never bypassed.
 * - Dedicated E2E test server (non-production + explicit E2E_TEST=true + localhost address): bypassed.
 * - Non-local/remote addresses under E2E_TEST=true: never bypassed.
 */
export function isE2ERateLimitExempt(req: any, key: string): boolean {
  if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.E2E_TEST !== "true") {
    return false;
  }
  const ip = key || req?.ip;
  return (
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    (typeof ip === "string" && ip.startsWith("127."))
  );
}

export const orderRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // POST /api/v1/orders
  // Public, transactional order creation endpoint
  app.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
          allowList: isE2ERateLimitExempt,
        },
      },
    },
    async (request, reply) => {
      // 1. Validate request payload strictly
      const parseResult = orderCreateBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid order creation request";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const body = parseResult.data;
      const { idempotencyKey, items, customer, paymentMethod } = body;

      // 2. Resolve optional customer session from secure cookie
      const customerId = await resolveOptionalCustomer(request, prisma);

      // 3. Pre-transaction idempotency check
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });

      if (existingOrder) {
        if (isSameOrderPayload(existingOrder, body, customerId)) {
          const responseData: OrderCreateResponseData = {
            orderNumber: existingOrder.orderNumber,
            paymentMethod: existingOrder.paymentMethod,
          };
          return reply.status(200).send({
            success: true,
            data: responseData,
          });
        }
        throw new ConflictError(
          "An order with this idempotency key already exists with different details",
          "IDEMPOTENCY_CONFLICT"
        );
      }

      // 4. Atomic transaction: validation, sequence, order, items, status history
      let transactionResult: {
        createdOrder: {
          id: string;
          orderNumber: string;
          paymentMethod: PaymentMethod;
        };
        cartResult: Awaited<ReturnType<typeof validateCartLines>>;
        settings: {
          newOrderEmailEnabled: boolean;
          newOrderNotificationRecipient: string | null;
        } | null;
      };

      try {
        transactionResult = await prisma.$transaction(async (tx) => {
          // Deterministic ID ordering to prevent deadlocks across concurrent requests
          const sortedProductIds = [...new Set(items.map((i) => i.productId))].sort();
          const sortedVariantIds = [...new Set(items.map((i) => i.variantId))].sort();

          // 1. Explicit exclusive row lock on CommerceSettings
          await tx.$queryRaw`SELECT id FROM "CommerceSettings" WHERE "singletonKey" = 1 FOR UPDATE`;

          // 2. Explicit exclusive row locks on referenced Products, Sizes, and Colors
          if (sortedProductIds.length > 0) {
            await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ANY(${sortedProductIds}::text[]) FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "ProductSize" WHERE "productId" = ANY(${sortedProductIds}::text[]) FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "ProductColor" WHERE "productId" = ANY(${sortedProductIds}::text[]) FOR UPDATE`;
          }

          // 3. Explicit exclusive row locks on referenced ProductVariants
          if (sortedVariantIds.length > 0) {
            await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ANY(${sortedVariantIds}::text[]) FOR UPDATE`;
          }

          // Read authoritative commerce settings
          const settings = await tx.commerceSettings.findUnique({
            where: { singletonKey: 1 },
          });

          // Live payment method check
          if (paymentMethod === "BANK_TRANSFER") {
            const isConfigured = isBankTransferConfigured(settings);
            if (!isConfigured) {
              throw new BadRequestError(
                "Manual Bank Transfer is currently unavailable",
                "PAYMENT_METHOD_UNAVAILABLE"
              );
            }
          }

          // Authoritative cart revalidation within transaction
          const cartResult = await validateCartLines(tx, items);
          if (cartResult.invalidItems.length > 0) {
            throw new BadRequestError(
              "One or more items in your cart are no longer available",
              "CART_INVALID",
              { invalidItems: cartResult.invalidItems }
            );
          }

          if (cartResult.validItems.length === 0) {
            throw new BadRequestError("Cart cannot be empty for order placement", "CART_EMPTY");
          }

          // Allocate sequential order number from PostgreSQL sequence
          const seqResult = await tx.$queryRaw<{ nextval: bigint }[]>(
            Prisma.sql`SELECT nextval('order_number_seq') AS nextval`
          );
          const nextVal = seqResult[0]?.nextval;
          if (!nextVal) {
            throw new Error("Failed to allocate order number from sequence");
          }
          const orderNumber = `KW-${nextVal.toString()}`;

          // Map initial status according to payment method
          const initialStatus: OrderStatus =
            paymentMethod === "CASH_ON_DELIVERY"
              ? OrderStatus.ORDER_RECEIVED
              : OrderStatus.AWAITING_PAYMENT;

          if (activeTestHooks?.beforeOrderCreate) {
            await activeTestHooks.beforeOrderCreate(tx);
          }

          // Create Order snapshot
          const createdOrder = await tx.order.create({
            data: {
              orderNumber,
              idempotencyKey,
              customerId,
              status: initialStatus,
              paymentMethod: paymentMethod as PaymentMethod,
              fullName: customer.fullName,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              city: customer.city,
              province: customer.province,
              postalCode: customer.postalCode,
              orderNotes: customer.orderNotes,
              subtotal: cartResult.accumulatedSubtotal,
              deliveryCharge: cartResult.flatDeliveryCharge,
              grandTotal: cartResult.grandTotalDecimal,
            },
          });

          if (activeTestHooks?.beforeItemCreate) {
            await activeTestHooks.beforeItemCreate(tx);
          }

          // Create OrderItems snapshots
          await tx.orderItem.createMany({
            data: cartResult.orderSnapshots.map((snap) => ({
              orderId: createdOrder.id,
              productId: snap.productId,
              productVariantId: snap.productVariantId,
              productName: snap.productName,
              sku: snap.sku,
              sizeLabel: snap.sizeLabel,
              colorName: snap.colorName,
              quantity: snap.quantity,
              unitPrice: snap.unitPrice,
              lineSubtotal: snap.lineSubtotal,
            })),
          });

          if (activeTestHooks?.beforeHistoryCreate) {
            await activeTestHooks.beforeHistoryCreate(tx);
          }

          // Create initial OrderStatusHistory
          await tx.orderStatusHistory.create({
            data: {
              orderId: createdOrder.id,
              status: initialStatus,
              changedByAdminId: null,
            },
          });

          if (activeTestHooks?.beforeCommit) {
            await activeTestHooks.beforeCommit(tx);
          }

          return {
            createdOrder: {
              id: createdOrder.id,
              orderNumber: createdOrder.orderNumber,
              paymentMethod: createdOrder.paymentMethod,
            },
            cartResult,
            settings: settings
              ? {
                  newOrderEmailEnabled: settings.newOrderEmailEnabled,
                  newOrderNotificationRecipient: settings.newOrderNotificationRecipient,
                }
              : null,
          };
        });
      } catch (err: any) {
        // Handle concurrent same-key insert race condition (P2002 on idempotencyKey)
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const raceOrder = await prisma.order.findUnique({
            where: { idempotencyKey },
            include: { items: true },
          });
          if (raceOrder) {
            if (isSameOrderPayload(raceOrder, body, customerId)) {
              const responseData: OrderCreateResponseData = {
                orderNumber: raceOrder.orderNumber,
                paymentMethod: raceOrder.paymentMethod,
              };
              return reply.status(200).send({
                success: true,
                data: responseData,
              });
            }
            throw new ConflictError(
              "An order with this idempotency key already exists with different details",
              "IDEMPOTENCY_CONFLICT"
            );
          }
        }
        throw err;
      }

      const { createdOrder, cartResult, settings } = transactionResult;

      // 5. Post-commit: send Admin notification email if enabled and configured (never rollback order if email fails)
      if (settings?.newOrderEmailEnabled) {
        const recipientEmail = settings.newOrderNotificationRecipient?.trim();
        if (recipientEmail) {
          const emailService = getEmailService();
          try {
            const sendResult = await emailService.sendNewOrderNotification({
              orderNumber: createdOrder.orderNumber,
              recipientEmail,
              customerName: customer.fullName,
              customerPhone: customer.phone,
              customerEmail: customer.email,
              customerAddress: customer.address,
              customerCity: customer.city,
              customerProvince: customer.province,
              customerPostalCode: customer.postalCode,
              customerOrderNotes: customer.orderNotes,
              paymentMethod: createdOrder.paymentMethod,
              subtotal: cartResult.subtotal,
              deliveryCharge: cartResult.deliveryCharge,
              grandTotal: cartResult.total,
              items: cartResult.orderSnapshots.map((item) => ({
                productName: item.productName,
                sku: item.sku,
                sizeLabel: item.sizeLabel,
                colorName: item.colorName,
                quantity: item.quantity,
                unitPrice: item.unitPrice.toFixed(2),
                lineSubtotal: item.lineSubtotal.toFixed(2),
              })),
            });

            if (!sendResult.success) {
              request.log.warn(
                {
                  orderNumber: createdOrder.orderNumber,
                  reason: sendResult.error,
                },
                "Admin order notification was not dispatched"
              );
            }
          } catch (emailErr: any) {
            request.log.error(
              {
                orderNumber: createdOrder.orderNumber,
                errMessage: emailErr?.message || "Unknown error",
              },
              "Failed to dispatch admin order notification email"
            );
          }
        }
      }

      // 6. Return minimal customer-safe confirmation
      const responseData: OrderCreateResponseData = {
        orderNumber: createdOrder.orderNumber,
        paymentMethod: createdOrder.paymentMethod,
      };

      return reply.status(201).send({
        success: true,
        data: responseData,
      });
    }
  );
};
