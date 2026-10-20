import crypto from "crypto";
import { buildApp } from "./app";
import {
  setCloudinaryService,
  ICloudinaryService,
  UploadSignatureParams,
  UploadSignatureResult,
  ReviewUploadSignatureParams,
  ReviewUploadSignatureResult,
  CloudinaryResourceMetadata,
} from "./lib/cloudinary";
import { setEmailService, IEmailService, SendNewOrderNotificationParams } from "./lib/email";
import { setPrismaClient } from "./lib/prisma";
import {
  getE2eDatabaseUrls,
  assertSafeE2eDatabaseUrl,
  createE2ePrismaClient,
} from "./scripts/e2e-db-setup";

// Configure Mock Email Service
export class E2eMockEmailService implements IEmailService {
  public sentEmails: SendNewOrderNotificationParams[] = [];

  async sendNewOrderNotification(
    params: SendNewOrderNotificationParams
  ): Promise<{ success: boolean; error?: string }> {
    this.sentEmails.push(params);
    console.log(
      `[E2E Email Service] Mock notification processed for Order ${params.orderNumber} -> ${params.recipientEmail}`
    );
    return { success: true };
  }
}

// Configure Mock Cloudinary Service
export class E2eMockCloudinaryService implements ICloudinaryService {
  async createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/products/${params.productId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    const resourceType: "image" | "video" = params.mediaType === "IMAGE" ? "image" : "video";

    return {
      timestamp,
      signature: "mock_signature_" + crypto.randomBytes(16).toString("hex"),
      apiKey: "test_cloudinary_api_key",
      cloudName: "test_cloudinary_cloud_name",
      resourceType,
      folder,
      publicId,
    };
  }

  async fetchResourceMetadata(
    publicId: string,
    resourceType: "image" | "video"
  ): Promise<CloudinaryResourceMetadata> {
    return {
      publicId,
      secureUrl: `https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80`,
      resourceType,
      format: resourceType === "video" ? "mp4" : "jpg",
      width: resourceType === "video" ? 1080 : 1200,
      height: resourceType === "video" ? 1350 : 1500,
      bytes: 45000,
      duration: resourceType === "video" ? 15 : null,
    };
  }

  async createReviewUploadSignature(
    params: ReviewUploadSignatureParams
  ): Promise<ReviewUploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/reviews/${params.reviewSubmissionId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;

    return {
      timestamp,
      signature: "mock_signature_" + crypto.randomBytes(16).toString("hex"),
      apiKey: "test_cloudinary_api_key",
      cloudName: "test_cloudinary_cloud_name",
      resourceType: "image",
      folder,
      publicId,
    };
  }

  async deleteResource(): Promise<void> {
    // No-op for hermetic E2E
  }
}

async function startE2eServer(): Promise<void> {
  // 1. Enforce E2E database connection
  const { databaseUrl, directUrl } = getE2eDatabaseUrls();
  assertSafeE2eDatabaseUrl(databaseUrl);

  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = directUrl;
  process.env.NODE_ENV = "test";
  process.env.E2E_TEST = "true";

  // Enforce Fastify routes query the isolated E2E database
  const e2ePrisma = createE2ePrismaClient(databaseUrl);
  setPrismaClient(e2ePrisma);

  // 2. Inject test doubles for external services
  const emailService = new E2eMockEmailService();
  const cloudinaryService = new E2eMockCloudinaryService();

  setEmailService(emailService);
  setCloudinaryService(cloudinaryService);

  // 3. Build real Fastify application
  const app = await buildApp();

  // Add E2E diagnostics endpoint
  app.get("/api/v1/e2e/health", async () => {
    return {
      status: "ready",
      database: "kids_wear_e2e",
      sentEmailsCount: emailService.sentEmails.length,
      lastSentEmail: emailService.sentEmails[emailService.sentEmails.length - 1] || null,
    };
  });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || "0.0.0.0";

  try {
    const address = await app.listen({ host, port });
    console.log(
      `🚀 Kids Wear E2E Fastify API running at ${address} (Connected to isolated kids_wear_e2e DB)`
    );
  } catch (err) {
    console.error("❌ Failed to start E2E Fastify server:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  void startE2eServer();
}
