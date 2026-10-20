import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../lib/prisma";
import { AppError, BadRequestError } from "../../lib/errors";
import { requireAdmin, requireAdminCsrf } from "../admin-auth/guards";
import { normalizeEmail } from "../admin-auth/services/password";
import {
  updateAnnouncementSchema,
  updateBankTransferSchema,
  updateNotificationsSchema,
  updateShippingSchema,
} from "./validation";

export const adminSettingsRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // ==========================================================================
  // Announcement Settings
  // ==========================================================================

  // GET /api/v1/admin/settings/announcement
  app.get("/announcement", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const announcement = await prisma.announcementBar.findUnique({
      where: { singletonKey: 1 },
      select: {
        text: true,
        link: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!announcement) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "AnnouncementBar singleton row is missing");
    }

    reply.status(200).send({
      success: true,
      data: {
        announcement,
      },
    });
  });

  // PATCH /api/v1/admin/settings/announcement
  app.patch(
    "/announcement",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const parseResult = updateAnnouncementSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid announcement settings data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { text, link, isActive } = parseResult.data;

      const updated = await prisma.announcementBar.update({
        where: { singletonKey: 1 },
        data: {
          ...(text !== undefined && { text }),
          ...(link !== undefined && { link }),
          ...(isActive !== undefined && { isActive }),
        },
        select: {
          text: true,
          link: true,
          isActive: true,
          updatedAt: true,
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          announcement: updated,
        },
      });
    }
  );

  // ==========================================================================
  // Shipping Settings
  // ==========================================================================

  // GET /api/v1/admin/settings/shipping
  app.get("/shipping", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const commerce = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
      select: {
        flatDeliveryCharge: true,
        updatedAt: true,
      },
    });

    if (!commerce) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "CommerceSettings singleton row is missing");
    }

    reply.status(200).send({
      success: true,
      data: {
        shipping: {
          flatDeliveryCharge: commerce.flatDeliveryCharge.toFixed(2),
          updatedAt: commerce.updatedAt,
        },
      },
    });
  });

  // PATCH /api/v1/admin/settings/shipping
  app.patch(
    "/shipping",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const parseResult = updateShippingSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid shipping settings data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { flatDeliveryCharge } = parseResult.data;

      const updated = await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          flatDeliveryCharge: new Prisma.Decimal(flatDeliveryCharge),
        },
        select: {
          flatDeliveryCharge: true,
          updatedAt: true,
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          shipping: {
            flatDeliveryCharge: updated.flatDeliveryCharge.toFixed(2),
            updatedAt: updated.updatedAt,
          },
        },
      });
    }
  );

  // ==========================================================================
  // Bank Transfer Settings
  // ==========================================================================

  // GET /api/v1/admin/settings/bank-transfer
  app.get("/bank-transfer", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const commerce = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
      select: {
        bankName: true,
        accountTitle: true,
        accountOrIban: true,
        branchCode: true,
        branchLocation: true,
        instructions: true,
        updatedAt: true,
      },
    });

    if (!commerce) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "CommerceSettings singleton row is missing");
    }

    reply.status(200).send({
      success: true,
      data: {
        bankTransfer: commerce,
      },
    });
  });

  // PATCH /api/v1/admin/settings/bank-transfer
  app.patch(
    "/bank-transfer",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const parseResult = updateBankTransferSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid bank transfer settings data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { bankName, accountTitle, accountOrIban, branchCode, branchLocation, instructions } =
        parseResult.data;

      const updated = await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          ...(bankName !== undefined && { bankName }),
          ...(accountTitle !== undefined && { accountTitle }),
          ...(accountOrIban !== undefined && { accountOrIban }),
          ...(branchCode !== undefined && { branchCode }),
          ...(branchLocation !== undefined && { branchLocation }),
          ...(instructions !== undefined && { instructions }),
        },
        select: {
          bankName: true,
          accountTitle: true,
          accountOrIban: true,
          branchCode: true,
          branchLocation: true,
          instructions: true,
          updatedAt: true,
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          bankTransfer: updated,
        },
      });
    }
  );

  // ==========================================================================
  // Notification Settings
  // ==========================================================================

  // GET /api/v1/admin/settings/notifications
  app.get("/notifications", { preHandler: [requireAdmin] }, async (_request, reply) => {
    const commerce = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
      select: {
        newOrderEmailEnabled: true,
        newOrderNotificationRecipient: true,
        updatedAt: true,
      },
    });

    if (!commerce) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "CommerceSettings singleton row is missing");
    }

    reply.status(200).send({
      success: true,
      data: {
        notifications: {
          newOrderEmailEnabled: commerce.newOrderEmailEnabled,
          newOrderNotificationRecipient: commerce.newOrderNotificationRecipient,
          newOrderRecipientEmail: commerce.newOrderNotificationRecipient,
          updatedAt: commerce.updatedAt,
        },
      },
    });
  });

  // PATCH /api/v1/admin/settings/notifications
  app.patch(
    "/notifications",
    { preHandler: [requireAdmin, requireAdminCsrf] },
    async (request, reply) => {
      const parseResult = updateNotificationsSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError =
          parseResult.error.errors[0]?.message || "Invalid notification settings data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const current = await prisma.commerceSettings.findUnique({
        where: { singletonKey: 1 },
        select: {
          newOrderEmailEnabled: true,
          newOrderNotificationRecipient: true,
        },
      });

      if (!current) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "CommerceSettings singleton row is missing"
        );
      }

      const finalEnabled =
        parseResult.data.newOrderEmailEnabled !== undefined
          ? parseResult.data.newOrderEmailEnabled
          : current.newOrderEmailEnabled;

      const incomingRecipient =
        parseResult.data.newOrderNotificationRecipient !== undefined
          ? parseResult.data.newOrderNotificationRecipient
          : parseResult.data.newOrderRecipientEmail;

      const finalEmail =
        incomingRecipient !== undefined
          ? incomingRecipient
            ? normalizeEmail(incomingRecipient)
            : null
          : current.newOrderNotificationRecipient;

      // When notifications are enabled, require a valid recipient email
      if (finalEnabled && (!finalEmail || finalEmail.trim() === "")) {
        throw new BadRequestError(
          "Recipient email is required when new order notifications are enabled",
          "VALIDATION_ERROR"
        );
      }

      const updated = await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          ...(parseResult.data.newOrderEmailEnabled !== undefined && {
            newOrderEmailEnabled: parseResult.data.newOrderEmailEnabled,
          }),
          ...(incomingRecipient !== undefined && {
            newOrderNotificationRecipient: finalEmail,
          }),
        },
        select: {
          newOrderEmailEnabled: true,
          newOrderNotificationRecipient: true,
          updatedAt: true,
        },
      });

      reply.status(200).send({
        success: true,
        data: {
          notifications: {
            newOrderEmailEnabled: updated.newOrderEmailEnabled,
            newOrderNotificationRecipient: updated.newOrderNotificationRecipient,
            newOrderRecipientEmail: updated.newOrderNotificationRecipient,
            updatedAt: updated.updatedAt,
          },
        },
      });
    }
  );
};
