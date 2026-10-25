import { getAdminHeroUploadSignature, registerAdminHeroImage } from "./admin-api";
import { getImageFormatError, loadImage, uploadSignedProductFile } from "./admin-product-media";

export type HeroPlacement = "desktop" | "mobile";

export function getHeroImageError(
  file: File,
  placement: HeroPlacement,
  width: number,
  height: number
): string | null {
  const formatError = getImageFormatError(file);
  if (formatError) return formatError;
  if (!file.size || file.size > 10 * 1024 * 1024) {
    return "Hero image must be 10 MB or smaller.";
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "This image could not be read. Choose another JPEG, PNG, or WebP image.";
  }
  const minWidth = placement === "desktop" ? 1600 : 900;
  const minHeight = placement === "desktop" ? 700 : 1125;
  if (width < minWidth || height < minHeight) {
    return `${placement === "desktop" ? "Desktop" : "Mobile"} hero image is too small for a clear banner.`;
  }
  return null;
}

export function getHeroCrop(placement: HeroPlacement, width: number, height: number) {
  const targetRatio = placement === "desktop" ? 1920 / 800 : 1080 / 1350;
  const cropWidth = Math.min(width, height * targetRatio);
  const cropHeight = cropWidth / targetRatio;
  return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height: cropHeight };
}

async function prepareHeroImage(file: File, placement: HeroPlacement): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const error = getHeroImageError(file, placement, image.naturalWidth, image.naturalHeight);
    if (error) throw new Error(error);
    const [width, height] = placement === "desktop" ? [1920, 800] : [1080, 1350];
    if (image.naturalWidth === width && image.naturalHeight === height) return file;
    const crop = getHeroCrop(placement, image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Hero image could not be prepared.")), "image/webp", 0.9);
    });
    if (blob.size > 10 * 1024 * 1024) throw new Error("Prepared hero image exceeds 10 MB.");
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-${placement}.${extension}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadHeroImage(
  storefrontId: string,
  placement: HeroPlacement,
  file: File
) {
  const preparedFile = await prepareHeroImage(file, placement);

  const signature = await getAdminHeroUploadSignature(storefrontId, placement);
  if (!signature.success || !signature.data) {
    throw new Error(signature.error?.message || "Could not prepare hero image upload.");
  }
  const publicId = await uploadSignedProductFile(preparedFile, signature.data, "IMAGE");
  if (publicId !== `${signature.data.folder}/${signature.data.publicId}`) {
    throw new Error("The media provider returned an unexpected image ID.");
  }
  const registration = await registerAdminHeroImage(storefrontId, { placement, publicId });
  if (!registration.success || !registration.data) {
    throw new Error(registration.error?.message || "Could not register hero image.");
  }
  return registration.data.mediaAsset;
}
