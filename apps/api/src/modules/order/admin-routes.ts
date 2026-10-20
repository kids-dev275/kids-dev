import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma, OrderStatus, PaymentMethod } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import {
  orderNumberParamSchema,
  listAdminOrdersQuerySchema,
  updateOrderStatusBodySchema,
} from "./admin-validation";
import {
  ORDER_STATUS_LABELS,
  type OrderStatusType,
  type PaymentMethodType,
  type AdminOrderListItem,
  type AdminOrdersResponseData,
  type AdminOrderDetailData,
  type AdminOrderStatusUpdateResponseData,
} from "@kids-wear/shared";

export interface AdminOrderStatusTestHooks {
  beforeStatusUpdate?: (tx: Prisma.TransactionClient) => Promise<void> | void;
  beforeHistoryInsert?: (tx: Prisma.TransactionClient) => Promise<void> | void;
  beforeStatusCommit?: (tx: Prisma.TransactionClient) => Promise<void> | void;
}

let activeAdminOrderStatusTestHooks: AdminOrderStatusTestHooks | null = null;

export function setAdminOrderStatusTestHooks(hooks: AdminOrderStatusTestHooks | null): void {
  activeAdminOrderStatusTestHooks = hooks;
}

/**
 * Strict finite state transition matrix for Kids Wear Order lifecycle.
 * - Backward transitions and state skipping are strictly forbidden.
 * - Cancellation is only permitted prior to dispatch (SHIPPED/DELIVERED cannot be cancelled).
 * - DELIVERED and CANCELLED are terminal states.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.ORDER_RECEIVED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY_TO_SHIP, OrderStatus.CANCELLED],
  [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Validates requested status transitions defensively against business lifecycle rules
 * and payment method coherence.
 */
export function validateStatusTransition(
  currentStatus: OrderStatus,
  requestedStatus: OrderStatus,
  paymentMethod: PaymentMethod
): void {
  // Defensive payment method coherence checks
  if (
    currentStatus === OrderStatus.AWAITING_PAYMENT &&
    paymentMethod !== PaymentMethod.BANK_TRANSFER
  ) {
    throw new BadRequestError(
      "Awaiting Payment status is only valid for Bank Transfer orders",
      "INVALID_STATUS_TRANSITION"
    );
  }

  if (
    currentStatus === OrderStatus.ORDER_RECEIVED &&
    paymentMethod !== PaymentMethod.CASH_ON_DELIVERY
  ) {
    throw new BadRequestError(
      "Order Received status is only valid for Cash on Delivery orders",
      "INVALID_STATUS_TRANSITION"
    );
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(requestedStatus)) {
    throw new BadRequestError(
      `Cannot transition order status from ${currentStatus} to ${requestedStatus}`,
      "INVALID_STATUS_TRANSITION"
    );
  }
}

export const adminOrderRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // GET /api/v1/admin/orders
  // Paginated list with server-side search and filters
  // ==========================================================================
  app.get(
    "/",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const parseResult = listAdminOrdersQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid order list query parameters";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { page, limit, q, status, paymentMethod } = parseResult.data;

      const trimmedQ = q?.trim();
      const searchFilter: Prisma.OrderWhereInput = trimmedQ
        ? {
            OR: [
              { orderNumber: { contains: trimmedQ, mode: "insensitive" } },
              { fullName: { contains: trimmedQ, mode: "insensitive" } },
              { phone: { contains: trimmedQ } },
              { email: { contains: trimmedQ, mode: "insensitive" } },
            ],
          }
        : {};

      const where: Prisma.OrderWhereInput = {
        ...searchFilter,
        ...(status ? { status } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
      };

      const totalOrders = await prisma.order.count({ where });

      const orders = await prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                include: {
                  media: {
                    where: { isMain: true },
                    include: { mediaAsset: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      const totalPages = Math.ceil(totalOrders / limit) || 1;
      const mappedOrders: AdminOrderListItem[] = orders.map((order) => {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const firstItemThumbnail = order.items[0]?.product?.media[0]?.mediaAsset?.secureUrl ?? null;

        return {
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          customerName: order.fullName,
          phone: order.phone,
          email: order.email,
          status: order.status as OrderStatusType,
          statusLabel: ORDER_STATUS_LABELS[order.status as OrderStatusType] || order.status,
          paymentMethod: order.paymentMethod as PaymentMethodType,
          itemCount,
          grandTotal: order.grandTotal.toFixed(2),
          firstItemThumbnail,
        };
      });

      const responseData: AdminOrdersResponseData = {
        orders: mappedOrders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      return reply.status(200).send({
        success: true,
        data: responseData,
      });
    }
  );

  // ==========================================================================
  // GET /api/v1/admin/orders/:orderNumber
  // Historical snapshot inspection for admin
  // ==========================================================================
  app.get(
    "/:orderNumber",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const parseResult = orderNumberParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new BadRequestError("Invalid order number format", "VALIDATION_ERROR");
      }

      const { orderNumber } = parseResult.data;

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          items: {
            include: {
              product: {
                include: {
                  storefront: true,
                  media: {
                    where: { isMain: true },
                    include: { mediaAsset: true },
                    take: 1,
                  },
                },
              },
            },
          },
          statusHistory: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: {
              changedByAdmin: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
      }

      const mappedDetail: AdminOrderDetailData = {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        status: order.status as OrderStatusType,
        statusLabel: ORDER_STATUS_LABELS[order.status as OrderStatusType] || order.status,
        paymentMethod: order.paymentMethod as PaymentMethodType,
        customer: {
          fullName: order.fullName,
          phone: order.phone,
          email: order.email,
          address: order.address,
          city: order.city,
          province: order.province,
          postalCode: order.postalCode,
          orderNotes: order.orderNotes,
        },
        items: order.items.map((item) => ({
          productName: item.productName,
          productSku: item.sku,
          productSlug: item.product?.slug ?? null,
          storefrontSlug: item.product?.storefront?.slug ?? null,
          sizeLabel: item.sizeLabel,
          colorName: item.colorName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          lineSubtotal: item.lineSubtotal.toFixed(2),
          thumbnailUrl: item.product?.media[0]?.mediaAsset?.secureUrl ?? null,
        })),
        statusHistory: order.statusHistory.map((h) => ({
          id: h.id,
          status: h.status as OrderStatusType,
          statusLabel: ORDER_STATUS_LABELS[h.status as OrderStatusType] || h.status,
          changedAt: h.createdAt.toISOString(),
          changedByAdminId: h.changedByAdminId,
          changedByAdminEmail: h.changedByAdmin?.email ?? null,
        })),
        subtotal: order.subtotal.toFixed(2),
        deliveryCharge: order.deliveryCharge.toFixed(2),
        grandTotal: order.grandTotal.toFixed(2),
      };

      return reply.status(200).send({
        success: true,
        data: mappedDetail,
      });
    }
  );

  // ==========================================================================
  // PATCH /api/v1/admin/orders/:orderNumber/status
  // Concurrency-safe, atomic status transition with row-level locking
  // ==========================================================================
  app.patch(
    "/:orderNumber/status",
    {
      preHandler: [requireAdmin, requireAdminCsrf],
    },
    async (request, reply) => {
      const paramResult = orderNumberParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new BadRequestError("Invalid order number format", "VALIDATION_ERROR");
      }

      const bodyResult = updateOrderStatusBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        const firstError =
          bodyResult.error.errors[0]?.message || "Invalid order status transition payload";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { orderNumber } = paramResult.data;
      const { status: requestedStatus } = bodyResult.data;

      const result: AdminOrderStatusUpdateResponseData = await prisma.$transaction(async (tx) => {
        // 1. Acquire exclusive row-level lock on the target Order
        const lockedRows = await tx.$queryRaw<
          { id: string; status: OrderStatus; paymentMethod: PaymentMethod }[]
        >(
          Prisma.sql`SELECT id, status, "paymentMethod" FROM "Order" WHERE "orderNumber" = ${orderNumber} FOR UPDATE`
        );

        if (!lockedRows || lockedRows.length === 0) {
          throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
        }

        const currentOrder = lockedRows[0];
        const currentStatus = currentOrder.status;

        // 2. Same-status retry idempotency: return current status without creating duplicate history
        if (currentStatus === requestedStatus) {
          return {
            orderNumber,
            status: currentStatus as OrderStatusType,
            statusLabel: ORDER_STATUS_LABELS[currentStatus as OrderStatusType] || currentStatus,
            updated: false,
          };
        }

        // 3. Validate requested status transition against finite state matrix and payment coherence
        validateStatusTransition(currentStatus, requestedStatus, currentOrder.paymentMethod);

        if (activeAdminOrderStatusTestHooks?.beforeStatusUpdate) {
          await activeAdminOrderStatusTestHooks.beforeStatusUpdate(tx);
        }

        // 4. Update Order status
        const updatedOrder = await tx.order.update({
          where: { id: currentOrder.id },
          data: { status: requestedStatus },
        });

        if (activeAdminOrderStatusTestHooks?.beforeHistoryInsert) {
          await activeAdminOrderStatusTestHooks.beforeHistoryInsert(tx);
        }

        // 5. Create OrderStatusHistory entry attributed server-side to the authenticated Admin
        await tx.orderStatusHistory.create({
          data: {
            orderId: currentOrder.id,
            status: requestedStatus,
            changedByAdminId: request.admin!.id,
          },
        });

        if (activeAdminOrderStatusTestHooks?.beforeStatusCommit) {
          await activeAdminOrderStatusTestHooks.beforeStatusCommit(tx);
        }

        return {
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status as OrderStatusType,
          statusLabel:
            ORDER_STATUS_LABELS[updatedOrder.status as OrderStatusType] || updatedOrder.status,
          updated: true,
        };
      });

      request.log.info(
        { orderNumber, status: result.status, updated: result.updated },
        "Admin updated order status"
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );
};
