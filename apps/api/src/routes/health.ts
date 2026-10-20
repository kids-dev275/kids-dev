import type { FastifyPluginAsync } from "fastify";
import type { ApiSuccessResponse, HealthStatus } from "@kids-wear/shared";

export const healthRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get<{ Reply: ApiSuccessResponse<HealthStatus> }>("/health", async (_request, reply) => {
    const response: ApiSuccessResponse<HealthStatus> = {
      success: true,
      data: {
        status: "ok",
      },
    };

    return reply.status(200).send(response);
  });
};
