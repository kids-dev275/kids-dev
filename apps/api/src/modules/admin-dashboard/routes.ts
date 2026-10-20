import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { OrderStatus } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { requireAdmin } from "../admin-auth/guards";
import {
  ORDER_STATUS_LABELS,
  type OrderStatusType,
  type PaymentMethodType,
  type AdminDashboardData,
  type AdminDashboardRecentOrder,
} from "@kids-wear/shared";

export const adminDashboardRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/admin/dashboard
  app.get(
    "/",
    {
      preHandler: [requireAdmin],
    },
    async (_request, reply) => {
      const [totalProducts, totalOrders, activeOrders, unavailableVariants, recentOrders] =
        await Promise.all([
          prisma.product.count(),
          prisma.order.count(),
          prisma.order.count({
            where: {
              status: {
                notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
              },
            },
          }),
          prisma.productVariant.count({
            where: {
              isAvailable: false,
            },
          }),
          prisma.order.findMany({
            take: 5,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              orderNumber: true,
              fullName: true,
              status: true,
              paymentMethod: true,
              grandTotal: true,
              createdAt: true,
            },
          }),
        ]);

      const mappedRecentOrders: AdminDashboardRecentOrder[] = recentOrders.map((order) => ({
        orderNumber: order.orderNumber,
        customerName: order.fullName,
        status: order.status as OrderStatusType,
        statusLabel: ORDER_STATUS_LABELS[order.status as OrderStatusType] || order.status,
        paymentMethod: order.paymentMethod as PaymentMethodType,
        grandTotal: order.grandTotal.toFixed(2),
        createdAt: order.createdAt.toISOString(),
      }));

      const dashboardData: AdminDashboardData = {
        totalProducts,
        totalOrders,
        activeOrders,
        unavailableVariants,
        recentOrders: mappedRecentOrders,
      };

      return reply.status(200).send({
        success: true,
        data: dashboardData,
      });
    }
  );
};
