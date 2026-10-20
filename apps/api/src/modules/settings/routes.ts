import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getPrismaClient } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export const publicSettingsRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/public/settings
  app.get("/", async (_request, reply) => {
    const announcement = await prisma.announcementBar.findUnique({
      where: { singletonKey: 1 },
      select: {
        text: true,
        link: true,
        isActive: true,
      },
    });

    const commerce = await prisma.commerceSettings.findUnique({
      where: { singletonKey: 1 },
      select: {
        flatDeliveryCharge: true,
      },
    });

    if (!announcement || !commerce) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Required system settings singleton rows are missing"
      );
    }

    reply.status(200).send({
      success: true,
      data: {
        announcement: {
          text: announcement.text,
          link: announcement.link,
          isActive: announcement.isActive,
        },
        shipping: {
          flatDeliveryCharge: commerce.flatDeliveryCharge.toFixed(2),
        },
      },
    });
  });
};
