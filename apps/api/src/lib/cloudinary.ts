import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { BadRequestError, NotFoundError } from "./errors";

export interface CloudinaryResourceMetadata {
  publicId: string;
  secureUrl: string;
  resourceType: "image" | "video";
  format: string;
  width: number;
  height: number;
  bytes: number;
  duration?: number | null;
}

export interface UploadSignatureParams {
  productId: string;
  mediaType: "IMAGE" | "VIDEO";
  videoCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UploadSignatureResult {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  resourceType: "image" | "video";
  folder: string;
  publicId: string;
  transformation?: string;
}

export interface ReviewUploadSignatureParams {
  reviewSubmissionId: string;
}

export interface ReviewUploadSignatureResult {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  resourceType: "image";
  folder: string;
  publicId: string;
}

export interface ICloudinaryService {
  createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult>;
  fetchResourceMetadata(
    publicId: string,
    resourceType: "image" | "video"
  ): Promise<CloudinaryResourceMetadata>;
  createReviewUploadSignature?(
    params: ReviewUploadSignatureParams
  ): Promise<ReviewUploadSignatureResult>;
  deleteResource?(publicId: string, resourceType?: "image" | "video"): Promise<void>;
}

/**
 * Production-ready Cloudinary Service communicating with the official Cloudinary SDK.
 */
export class DefaultCloudinaryService implements ICloudinaryService {
  private configured = false;

  private ensureConfigured(): void {
    if (this.configured) {
      return;
    }

    const cloudName = env.CLOUDINARY_CLOUD_NAME || "development-cloud";
    const apiKey = env.CLOUDINARY_API_KEY || "development-api-key";
    const apiSecret = env.CLOUDINARY_API_SECRET || "development-api-secret";

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.configured = true;
  }

  async createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    this.ensureConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/products/${params.productId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    const resourceType: "image" | "video" = params.mediaType === "IMAGE" ? "image" : "video";
    const crop = params.videoCrop;
    const transformation = crop
      ? `c_crop,h_${crop.height},w_${crop.width},x_${crop.x},y_${crop.y}/c_scale,f_mp4,h_1350,w_1080`
      : undefined;

    const apiSecret = env.CLOUDINARY_API_SECRET || "development-api-secret";
    const apiKey = env.CLOUDINARY_API_KEY || "development-api-key";
    const cloudName = env.CLOUDINARY_CLOUD_NAME || "development-cloud";

    // Parameters to sign (sorted alphabetically by cloudinary)
    const paramsToSign = {
      folder,
      public_id: publicId,
      timestamp,
      ...(transformation && { transformation }),
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      timestamp,
      signature,
      apiKey,
      cloudName,
      resourceType,
      folder,
      publicId,
      ...(transformation && { transformation }),
    };
  }

  async fetchResourceMetadata(
    publicId: string,
    resourceType: "image" | "video"
  ): Promise<CloudinaryResourceMetadata> {
    this.ensureConfigured();

    try {
      // Cloudinary Admin API resource lookup
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        image_metadata: true,
      });

      if (!resource) {
        throw new NotFoundError("Media asset not found in Cloudinary", "MEDIA_ASSET_NOT_FOUND");
      }

      return {
        publicId: resource.public_id,
        secureUrl: resource.secure_url,
        resourceType: resource.resource_type === "video" ? "video" : "image",
        format: resource.format || "",
        width: resource.width || 0,
        height: resource.height || 0,
        bytes: resource.bytes || 0,
        duration: resource.duration ?? null,
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundError) {
        throw err;
      }

      const errorObj = err as {
        http_code?: number;
        message?: string;
        error?: { message?: string; http_code?: number };
      };
      const httpCode = errorObj?.http_code || errorObj?.error?.http_code;
      const message =
        errorObj?.error?.message || errorObj?.message || "Failed to fetch Cloudinary resource";

      if (httpCode === 404) {
        throw new NotFoundError("Media asset not found in Cloudinary", "MEDIA_ASSET_NOT_FOUND");
      }

      throw new BadRequestError(
        `Cloudinary resource verification failed: ${message}`,
        "MEDIA_RESOURCE_LOOKUP_FAILED"
      );
    }
  }

  async createReviewUploadSignature(
    params: ReviewUploadSignatureParams
  ): Promise<ReviewUploadSignatureResult> {
    this.ensureConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/reviews/${params.reviewSubmissionId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    const resourceType: "image" = "image";

    const apiSecret = env.CLOUDINARY_API_SECRET || "development-api-secret";
    const apiKey = env.CLOUDINARY_API_KEY || "development-api-key";
    const cloudName = env.CLOUDINARY_CLOUD_NAME || "development-cloud";

    const paramsToSign = {
      folder,
      public_id: publicId,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      timestamp,
      signature,
      apiKey,
      cloudName,
      resourceType,
      folder,
      publicId,
    };
  }

  async deleteResource(publicId: string, resourceType: "image" | "video" = "image"): Promise<void> {
    this.ensureConfigured();

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (err: unknown) {
      throw err;
    }
  }
}

// Active singleton instance
let activeCloudinaryService: ICloudinaryService = new DefaultCloudinaryService();

export function getCloudinaryService(): ICloudinaryService {
  return activeCloudinaryService;
}

export function setCloudinaryService(service: ICloudinaryService): void {
  activeCloudinaryService = service;
}

export function resetCloudinaryService(): void {
  activeCloudinaryService = new DefaultCloudinaryService();
}
