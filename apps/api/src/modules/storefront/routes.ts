import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getPrismaClient } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";

const FIXED_STOREFRONT_ORDER = ["mini-sprouts", "teen-studio", "aura-studio"];

export const publicStorefrontRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // GET /api/v1/storefronts
  app.get("/", async (_request, reply) => {
    const records = await prisma.storefront.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        ageLabel: true,
      },
    });

    // Deterministic display ordering: Mini Sprouts -> Teen Studio -> Aura Studio
    const sorted = [...records].sort((a, b) => {
      const indexA = FIXED_STOREFRONT_ORDER.indexOf(a.slug);
      const indexB = FIXED_STOREFRONT_ORDER.indexOf(b.slug);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });

    reply.status(200).send({
      success: true,
      data: {
        storefronts: sorted,
      },
    });
  });

  // GET /api/v1/storefronts/:storefrontSlug
  app.get<{ Params: { storefrontSlug: string } }>("/:storefrontSlug", async (request, reply) => {
    const { storefrontSlug } = request.params;

    const storefront = await prisma.storefront.findUnique({
      where: { slug: storefrontSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        ageLabel: true,
      },
    });

    if (!storefront) {
      throw new NotFoundError("Storefront not found", "STOREFRONT_NOT_FOUND");
    }

    // Fetch active hero slides ordered by sortOrder ASC, then createdAt ASC
    const slides = await prisma.heroSlide.findMany({
      where: {
        storefrontId: storefront.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        desktopImageAsset: {
          select: {
            id: true,
            secureUrl: true,
            width: true,
            height: true,
            format: true,
          },
        },
        mobileImageAsset: {
          select: {
            id: true,
            secureUrl: true,
            width: true,
            height: true,
            format: true,
          },
        },
      },
    });

    reply.status(200).send({
      success: true,
      data: {
        storefront: {
          ...storefront,
          heroSlides: slides,
        },
      },
    });
  });
};
