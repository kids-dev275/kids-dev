import type { Area } from "react-easy-crop";

export const PRODUCT_IMAGE_WIDTH = 1200;
export const PRODUCT_IMAGE_HEIGHT = 1500;
export const PRODUCT_VIDEO_WIDTH = 1080;
export const PRODUCT_VIDEO_HEIGHT = 1350;

// A 1024 × 1536 portrait remains usable, while a tiny source cannot be enlarged silently.
const MIN_CROP_WIDTH = 800;
const MIN_CROP_HEIGHT = 1000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getImageFormatError(file: File): string | null {
  return IMAGE_TYPES.has(file.type)
    ? null
    : "Unsupported image format. Choose a JPEG, PNG, or WebP image.";
}

export function getImageSourceError(file: File, width: number, height: number): string | null {
  const formatError = getImageFormatError(file);
  if (formatError) return formatError;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "This image could not be read. Choose another JPEG, PNG, or WebP image.";
  }
  const usableWidth = Math.min(width, height * (PRODUCT_IMAGE_WIDTH / PRODUCT_IMAGE_HEIGHT));
  const usableHeight = usableWidth * (PRODUCT_IMAGE_HEIGHT / PRODUCT_IMAGE_WIDTH);
  if (usableWidth < MIN_CROP_WIDTH || usableHeight < MIN_CROP_HEIGHT) {
    return "The selected image is too small to create a 1200 × 1500 product image. Choose a higher-resolution source.";
  }
  return null;
}

export function getCropError(area: Area): string | null {
  if (area.width < MIN_CROP_WIDTH || area.height < MIN_CROP_HEIGHT) {
    return "This crop is too small for a sharp 1200 × 1500 product image. Zoom out or choose a higher-resolution source.";
  }
  return null;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("This image could not be read. Choose another JPEG, PNG, or WebP image."));
    image.src = url;
  });
}

export async function normalizeProductImage(
  url: string,
  area: Area,
  sourceName: string
): Promise<File> {
  const image = await loadImage(url);
  const cropError = getCropError(area);
  if (cropError) throw new Error(cropError);
  if (
    area.x < 0 ||
    area.y < 0 ||
    area.x + area.width > image.naturalWidth + 1 ||
    area.y + area.height > image.naturalHeight + 1
  ) {
    throw new Error("The selected crop is outside the image. Reset the crop and try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = PRODUCT_IMAGE_WIDTH;
  canvas.height = PRODUCT_IMAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    PRODUCT_IMAGE_WIDTH,
    PRODUCT_IMAGE_HEIGHT
  );
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Could not export the selected crop.")),
      "image/jpeg",
      0.92
    );
  });
  const baseName = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return new File([blob], `${baseName || "product"}-1200x1500.jpg`, { type: "image/jpeg" });
}

export function getVideoFileError(file: File): string | null {
  if (file.type !== "video/mp4" || !/\.mp4$/i.test(file.name)) {
    return "Product video must be an MP4 file.";
  }
  return null;
}

export interface VideoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A 4:5 crop under 320 × 400 needs more than 3.375× enlargement on each axis.
const MIN_VIDEO_CROP_WIDTH = 320;

export function getVideoSourceError(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return "We couldn't read this video's dimensions. Please choose another MP4 file.";
  }
  const maximumCropWidth = Math.min(width, Math.floor((height * 4) / 5));
  if (maximumCropWidth < MIN_VIDEO_CROP_WIDTH) {
    return "This video is too small to produce an acceptable 4:5 product video. Please choose a higher-resolution source.";
  }
  return null;
}

export function normalizeVideoCrop(area: Area, sourceWidth: number, sourceHeight: number): VideoCrop {
  // react-easy-crop rounds each pixel dimension independently. Snap inward to an exact 4:5
  // rectangle so Cloudinary crops without stretching before the final scale.
  const width = Math.floor(Math.min(area.width, (area.height * 4) / 5) / 4) * 4;
  const height = (width / 4) * 5;
  const x = Math.max(0, Math.min(sourceWidth - width, Math.round(area.x + (area.width - width) / 2)));
  const y = Math.max(0, Math.min(sourceHeight - height, Math.round(area.y + (area.height - height) / 2)));
  return { x, y, width, height };
}

export function getVideoCropError(crop: VideoCrop): string | null {
  return crop.width < MIN_VIDEO_CROP_WIDTH || crop.height < (MIN_VIDEO_CROP_WIDTH * 5) / 4
    ? "This crop is too small for an acceptable 4:5 product video. Zoom out or choose a higher-resolution source."
    : null;
}

export function getVideoQualityWarning(crop: VideoCrop): string | null {
  return crop.width < PRODUCT_VIDEO_WIDTH || crop.height < PRODUCT_VIDEO_HEIGHT
    ? `The selected ${crop.width} × ${crop.height} crop is lower resolution than the 1080 × 1350 output. The final video may appear softer; upscaling cannot add detail.`
    : null;
}

export function readVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      finish();
      reject(new Error("This MP4 could not be read. Choose a browser-playable MP4 video."));
    }, 15000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (settled) return;
      settled = true;
      const dimensions = { width: video.videoWidth, height: video.videoHeight };
      finish();
      resolve(dimensions);
    };
    video.onerror = () => {
      if (settled) return;
      settled = true;
      finish();
      reject(new Error("This MP4 could not be read. Choose a browser-playable MP4 video."));
    };
    video.src = url;
  });
}

interface SignedProductUpload {
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  cloudName: string;
  resourceType: "image" | "video";
  transformation?: string;
}

export async function uploadSignedProductFile(
  file: File,
  signData: SignedProductUpload,
  mediaType: "IMAGE" | "VIDEO",
  fetcher: typeof fetch = fetch
): Promise<string> {
  const resourceType = mediaType === "IMAGE" ? "image" : "video";
  if (signData.resourceType !== resourceType) {
    throw new Error("The upload signature does not match the selected media type.");
  }
  if (mediaType === "VIDEO" && !signData.transformation) {
    throw new Error("The video upload signature is missing its framing transformation.");
  }
  if (mediaType === "IMAGE" && signData.transformation) {
    throw new Error("An image upload cannot use a video framing transformation.");
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signData.apiKey);
  formData.append("timestamp", String(signData.timestamp));
  formData.append("signature", signData.signature);
  formData.append("folder", signData.folder);
  formData.append("public_id", signData.publicId);
  if (mediaType === "VIDEO" && signData.transformation) {
    formData.append("transformation", signData.transformation);
  }
  let response: Response;
  try {
    response = await fetcher(
      `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`,
      { method: "POST", body: formData }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`The media provider took too long to respond to the ${resourceType} upload. Please try again.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to the media provider for the ${resourceType} upload. Please try again.`);
    }
    throw error;
  }
  if (!response.ok) throw new Error(`Failed to upload ${resourceType} to media provider.`);
  const result = await response.json();
  if (typeof result.public_id !== "string" || !result.public_id) {
    throw new Error("The media provider did not return an upload ID.");
  }
  return result.public_id;
}
