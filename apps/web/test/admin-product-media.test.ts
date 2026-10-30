import assert from "node:assert/strict";
import {
  getCropError,
  getImageSourceError,
  getVideoCropError,
  getVideoFileError,
  getVideoQualityWarning,
  getVideoSourceError,
  normalizeProductImage,
  normalizeVideoCrop,
  readVideoDimensions,
  uploadSignedProductFile,
} from "../src/lib/admin-product-media";

async function run(): Promise<void> {
  const source = new File(["source"], "romper.png", { type: "image/png" });
  assert.equal(getImageSourceError(source, 1024, 1536), null);
  assert.equal(getImageSourceError(source, 3000, 2000), null);
  assert.match(getImageSourceError(source, 400, 600) || "", /too small/);
  assert.match(
    getImageSourceError(new File(["x"], "file.gif", { type: "image/gif" }), 1200, 1500) || "",
    /Unsupported image format/
  );
  assert.equal(getCropError({ x: 0, y: 0, width: 800, height: 1000 }), null);
  assert.match(getCropError({ x: 0, y: 0, width: 600, height: 750 }) || "", /too small/);

  const drawn: number[][] = [];
  let outputSize: [number, number] = [0, 0];
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  class FakeImage {
    naturalWidth = 1024;
    naturalHeight = 1536;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
  globalThis.document = {
    createElement: (tag: string) => {
      assert.equal(tag, "canvas");
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          fillRect: () => undefined,
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
          drawImage: (_image: unknown, ...args: number[]) => drawn.push(args),
        }),
        toBlob: (callback: (blob: Blob) => void, type: string) => {
          outputSize = [canvas.width, canvas.height];
          assert.equal(type, "image/jpeg");
          callback(new Blob(["normalized pixels"], { type }));
        },
      };
      return canvas;
    },
  } as unknown as Document;

  let normalized: File;
  try {
    normalized = await normalizeProductImage(
      "blob:source",
      { x: 0, y: 100, width: 1024, height: 1280 },
      source.name
    );
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
  }
  assert.deepEqual(outputSize, [1200, 1500]);
  assert.deepEqual(drawn, [[0, 100, 1024, 1280, 0, 0, 1200, 1500]]);
  assert.equal(normalized.type, "image/jpeg");
  assert.equal(normalized.name, "romper-1200x1500.jpg");

  const signData = {
    apiKey: "key",
    timestamp: 123,
    signature: "signature",
    cloudName: "test-cloud",
    folder: "kids-wear/products/product-1",
    publicId: "kids-wear/products/product-1/image-1",
    resourceType: "image" as const,
  };
  const imageId = await uploadSignedProductFile(
    normalized,
    signData,
    "IMAGE",
    async (url, options) => {
      assert.equal(url, "https://api.cloudinary.com/v1_1/test-cloud/image/upload");
      const form = options?.body as FormData;
      const uploadedFile = form.get("file") as File;
      assert.equal(uploadedFile.name, "romper-1200x1500.jpg");
      assert.equal(uploadedFile.type, "image/jpeg");
      assert.equal(form.get("signature"), "signature");
      return Response.json({ public_id: signData.publicId });
    }
  );
  assert.equal(imageId, signData.publicId);
  await assert.rejects(
    uploadSignedProductFile(normalized, signData, "IMAGE", async () => { throw new TypeError("Failed to fetch"); }),
    /Could not connect to the media provider for the image upload/
  );

  const validVideo = new File(["mp4"], "romper.mp4", { type: "video/mp4" });
  assert.equal(getVideoFileError(validVideo), null);
  for (const [width, height] of [[1080, 1350], [512, 768], [1080, 1920], [720, 1280], [1920, 1080], [1200, 1600]]) {
    assert.equal(getVideoSourceError(width, height), null);
  }
  assert.match(getVideoSourceError(200, 300) || "", /too small/);
  assert.match(getVideoSourceError(0, 0) || "", /couldn't read/);
  const portraitCrop = normalizeVideoCrop({ x: 0, y: 64, width: 512, height: 640 }, 512, 768);
  assert.deepEqual(portraitCrop, { x: 0, y: 64, width: 512, height: 640 });
  assert.match(getVideoQualityWarning(portraitCrop) || "", /softer/);
  assert.equal(getVideoCropError(portraitCrop), null);
  const landscapeCrop = normalizeVideoCrop({ x: 534, y: 0, width: 852, height: 1065 }, 1920, 1080);
  assert.deepEqual(landscapeCrop, { x: 534, y: 0, width: 852, height: 1065 });
  assert.equal(landscapeCrop.height * 4, landscapeCrop.width * 5);
  assert.equal(getVideoQualityWarning({ x: 0, y: 0, width: 1080, height: 1350 }), null);
  assert.match(getVideoCropError({ x: 0, y: 0, width: 316, height: 395 }) || "", /too small/);
  assert.match(
    getVideoFileError(new File(["x"], "movie.webm", { type: "video/webm" })) || "",
    /MP4/
  );
  const createObjectUrl = URL.createObjectURL;
  const revokeObjectUrl = URL.revokeObjectURL;
  const originalVideoDocument = globalThis.document;
  let revoked = false;
  URL.createObjectURL = () => "blob:test-video";
  URL.revokeObjectURL = () => {
    revoked = true;
  };
  globalThis.document = {
    createElement: (tag: string) => {
      assert.equal(tag, "video");
      return {
        videoWidth: 1920,
        videoHeight: 1080,
        onloadedmetadata: null as (() => void) | null,
        onerror: null,
        set src(_url: string) {
          queueMicrotask(() => this.onloadedmetadata?.());
        },
        removeAttribute: () => undefined,
        load: () => undefined,
      };
    },
  } as unknown as Document;
  try {
    const dimensions = await readVideoDimensions(validVideo);
    assert.deepEqual(dimensions, { width: 1920, height: 1080 });
    assert.equal(getVideoSourceError(dimensions.width, dimensions.height), null);
    assert.equal(revoked, true);
  } finally {
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    globalThis.document = originalVideoDocument;
  }
  const videoId = await uploadSignedProductFile(
    validVideo,
    { ...signData, resourceType: "video", publicId: "kids-wear/products/product-1/video-1", transformation: "c_crop,h_640,w_512,x_0,y_64/c_scale,f_mp4,h_1350,w_1080" },
    "VIDEO",
    async (url, options) => {
      assert.equal(url, "https://api.cloudinary.com/v1_1/test-cloud/video/upload");
      assert.equal(((options?.body as FormData).get("file") as File).type, "video/mp4");
      assert.equal((options?.body as FormData).get("transformation"), "c_crop,h_640,w_512,x_0,y_64/c_scale,f_mp4,h_1350,w_1080");
      return Response.json({ public_id: "kids-wear/products/product-1/video-1" });
    }
  );
  assert.equal(videoId, "kids-wear/products/product-1/video-1");
  await assert.rejects(uploadSignedProductFile(validVideo, signData, "VIDEO"), /does not match/);
  await assert.rejects(
    uploadSignedProductFile(validVideo, { ...signData, resourceType: "video" }, "VIDEO"),
    /missing its framing transformation/
  );

  console.log(
    "PASS admin product media: source checks, crop export, signed image/video uploads, MP4 validation"
  );
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
