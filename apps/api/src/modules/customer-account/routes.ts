import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ORDER_STATUS_LABELS,
  OrderStatusType,
  PaymentMethodType,
  CustomerOrderListItem,
  CustomerOrderDetailData,
} from "@kids-wear/shared";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { normalizeEmail } from "../admin-auth/services/password";
import { requireCustomer, requireCustomerCsrf } from "../customer-auth/guards";
import "../customer-auth/types";

const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name cannot be empty")
      .max(100, "Full name is too long")
      .optional(),
    email: z.string().trim().email("Invalid email format").optional(),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number is too short")
      .max(20, "Phone number is too long")
      .nullable()
      .optional(),
  })
  .strict(); // Strictly reject unauthorized fields to prevent over-posting

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const orderNumberParamSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^KW-\d+$/, "Invalid order number format"),
});

export const customerAccountRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/account/profile
  app.get(
    "/profile",
    {
      preHandler: [requireCustomer],
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        data: {
          customer: {
            id: request.customer!.id,
            fullName: request.customer!.fullName,
            email: request.customer!.email,
            phone: request.customer!.phone,
          },
        },
      });
    }
  );

  // PATCH /api/v1/account/profile
  app.patch(
    "/profile",
    {
      preHandler: [requireCustomer, requireCustomerCsrf],
    },
    async (request, reply) => {
      const parseResult = updateProfileSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid profile data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { fullName, email, phone } = parseResult.data;
      const customerId = request.customer!.id;
      let normalizedEmail: string | undefined;

      if (email !== undefined) {
        normalizedEmail = normalizeEmail(email);

        // Check uniqueness if email is being updated
        if (normalizedEmail !== request.customer!.email) {
          const conflict = await prisma.customer.findUnique({
            where: { email: normalizedEmail },
          });

          if (conflict && conflict.id !== customerId) {
            throw new ConflictError("Email is already in use by another account", "EMAIL_EXISTS");
          }
        }
      }

      // Perform update with only authorized editable fields
      const updatedCustomer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(fullName !== undefined && { fullName: fullName.trim() }),
          ...(normalizedEmail !== undefined && { email: normalizedEmail }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        },
      });

      request.log.info({ customerId }, "Customer profile updated successfully");

      return reply.status(200).send({
        success: true,
        data: {
          customer: {
            id: updatedCustomer.id,
            fullName: updatedCustomer.fullName,
            email: updatedCustomer.email,
            phone: updatedCustomer.phone,
          },
        },
      });
    }
  );

  // GET /api/v1/account/orders
  app.get(
    "/orders",
    {
      preHandler: [requireCustomer],
    },
    async (request, reply) => {
      const parseResult = listOrdersQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid pagination query";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { page, limit } = parseResult.data;
      const customerId = request.customer!.id;

      // Strict Ownership Rule: query ONLY by customerId. Never query by email or phone.
      const totalOrders = await prisma.order.count({
        where: { customerId },
      });

      const orders = await prisma.order.findMany({
        where: { customerId },
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
      const mappedOrders: CustomerOrderListItem[] = orders.map((order) => {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const firstItemThumbnail = order.items[0]?.product?.media[0]?.mediaAsset?.secureUrl ?? null;

        return {
          orderNumber: order.orderNumber,
          status: order.status as OrderStatusType,
          statusLabel: ORDER_STATUS_LABELS[order.status as OrderStatusType] || order.status,
          paymentMethod: order.paymentMethod as PaymentMethodType,
          createdAt: order.createdAt.toISOString(),
          subtotal: order.subtotal.toFixed(2),
          deliveryCharge: order.deliveryCharge.toFixed(2),
          grandTotal: order.grandTotal.toFixed(2),
          itemCount,
          firstItemThumbnail,
        };
      });

      return reply.status(200).send({
        success: true,
        data: {
          orders: mappedOrders,
          pagination: {
            page,
            limit,
            totalOrders,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      });
    }
  );

  // GET /api/v1/account/orders/:orderNumber
  app.get(
    "/orders/:orderNumber",
    {
      preHandler: [requireCustomer],
    },
    async (request, reply) => {
      const parseResult = orderNumberParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw new BadRequestError("Invalid order number format", "VALIDATION_ERROR");
      }

      const customerId = request.customer!.id;
      const { orderNumber } = parseResult.data;

      // Ownership-scoped query: match both orderNumber AND customerId.
      // If nonexistent, guest order, or owned by another customer, return 404 ORDER_NOT_FOUND.
      const order = await prisma.order.findFirst({
        where: {
          orderNumber,
          customerId,
        },
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
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
      }

      const mappedDetail: CustomerOrderDetailData = {
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
          productSlug: item.product?.slug ?? null,
          storefrontSlug: item.product?.storefront?.slug ?? null,
          sizeLabel: item.sizeLabel,
          colorName: item.colorName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          lineSubtotal: item.lineSubtotal.toFixed(2),
          thumbnailUrl: item.product?.media[0]?.mediaAsset?.secureUrl ?? null,
        })),
        timeline: order.statusHistory.map((h) => ({
          status: h.status as OrderStatusType,
          statusLabel: ORDER_STATUS_LABELS[h.status as OrderStatusType] || h.status,
          changedAt: h.createdAt.toISOString(),
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
};
