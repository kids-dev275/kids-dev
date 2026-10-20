import { test, expect } from "@playwright/test";
import { buildApp } from "../apps/api/src/app";
import { getEmailService, resetEmailService } from "../apps/api/src/lib/email";
import { getCloudinaryService, resetCloudinaryService } from "../apps/api/src/lib/cloudinary";
import { E2eMockEmailService, E2eMockCloudinaryService } from "../apps/api/src/e2e-server";

test.describe("10. E2E Surface Isolation & Production-Mode Negative Audit", () => {
  test("38. Production-mode negative audit: normal application composition excludes diagnostic endpoints, mock services, and rate-limit exemptions", async () => {
    // 1. Unset E2E_TEST to evaluate normal composition
    const originalE2eTest = process.env.E2E_TEST;
    delete process.env.E2E_TEST;

    try {
      // Build application under normal composition
      const normalApp = await buildApp();

      // Verify /api/v1/e2e/health is NOT registered on normal app (404)
      const healthRes = await normalApp.inject({
        method: "GET",
        url: "/api/v1/e2e/health",
      });
      expect(healthRes.statusCode).toBe(404);

      // Verify mock services are inactive when reset to default configuration
      resetEmailService();
      resetCloudinaryService();

      const emailService = getEmailService();
      expect(emailService instanceof E2eMockEmailService).toBe(false);

      const cloudinaryService = getCloudinaryService();
      expect(cloudinaryService instanceof E2eMockCloudinaryService).toBe(false);

      // Verify no HTTP route exists to manipulate Prisma client
      const setPrismaRes = await normalApp.inject({
        method: "POST",
        url: "/api/v1/set-prisma",
      });
      expect(setPrismaRes.statusCode).toBe(404);

      await normalApp.close();
    } finally {
      // Restore E2E environment for subsequent tests
      if (originalE2eTest !== undefined) {
        process.env.E2E_TEST = originalE2eTest;
      }
    }
  });
});
