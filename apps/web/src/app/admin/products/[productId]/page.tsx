"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  getAdminProduct,
  updateAdminProduct,
  updateAdminProductStatus,
  getAdminProductSizes,
  createAdminProductSize,
  deleteAdminProductSize,
  getAdminProductColors,
  createAdminProductColor,
  deleteAdminProductColor,
  getAdminProductVariants,
  bulkCreateAdminProductVariants,
  updateAdminProductVariant,
  getAdminProductMedia,
  getAdminProductMediaUploadSignature,
  registerAdminProductMedia,
  replaceAdminProductVideo,
  setAdminProductMediaMain,
  setAdminProductMediaHover,
  clearAdminProductMediaHover,
  deleteAdminProductMedia,
  reorderAdminProductMedia,
  updateAdminProductMediaAlt,
  type AdminProductDetail,
  type AdminProductSize,
  type AdminProductColor,
  type AdminProductVariant,
  type AdminProductMedia,
} from "@/lib/admin-api";
import { ProductImageCropDialog } from "@/components/admin/product-image-crop-dialog";
import { ProductVideoFrameDialog } from "@/components/admin/product-video-frame-dialog";
import { useTransientFeedback } from "@/lib/use-transient-feedback";
import {
  getImageFormatError,
  getImageSourceError,
  getVideoFileError,
  getVideoSourceError,
  loadImage,
  readVideoDimensions,
  uploadSignedProductFile,
  type VideoCrop,
} from "@/lib/admin-product-media";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Star,
  Eye,
  RefreshCw,
  Video,
} from "lucide-react";

type ActiveTab = "details" | "options" | "variants" | "media" | "status";

export default function AdminProductEditorPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const productId = params.productId;

  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [sizes, setSizes] = useState<AdminProductSize[]>([]);
  const [colors, setColors] = useState<AdminProductColor[]>([]);
  const [variants, setVariants] = useState<AdminProductVariant[]>([]);
  const [mediaList, setMediaList] = useState<AdminProductMedia[]>([]);
  const [cropSource, setCropSource] = useState<{ url: string; name: string } | null>(null);
  const [videoSource, setVideoSource] = useState<{
    file: File;
    url: string;
    width: number;
    height: number;
    replace: boolean;
  } | null>(null);
  const imageMedia = mediaList.filter((media) => media.mediaType === "IMAGE");
  const productVideo = mediaList.find((media) => media.mediaType === "VIDEO");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage, successFading] = useTransientFeedback<string>();

  // New Size / Color form states
  const [newSizeName, setNewSizeName] = useState("");
  const [newColorName, setNewColorName] = useState("");

  // Core Form state
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    slug: "",
    description: "",
    shortDescription: "",
    regularPrice: "",
    compareAtPrice: "",
    productType: "",
    gender: "",
    fabric: "",
    includedPieces: "",
    fit: "",
    patternDesign: "",
    occasion: "",
    season: "",
    careInstructions: "",
    isNewArrival: false,
    seoTitle: "",
    seoDescription: "",
  });

  const loadAll = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [prodRes, sizesRes, colorsRes, variantsRes, mediaRes] = await Promise.all([
        getAdminProduct(productId),
        getAdminProductSizes(productId),
        getAdminProductColors(productId),
        getAdminProductVariants(productId),
        getAdminProductMedia(productId),
      ]);

      if (prodRes.success && prodRes.data?.product) {
        const p = prodRes.data.product;
        setProduct(p);
        setFormData({
          name: p.name || "",
          sku: p.sku || "",
          slug: p.slug || "",
          description: p.description || "",
          shortDescription: p.shortDescription || "",
          regularPrice: p.regularPrice || "",
          compareAtPrice: p.compareAtPrice || "",
          productType: p.productType || "",
          gender: p.gender || "",
          fabric: p.fabric || "",
          includedPieces: p.includedPieces || "",
          fit: p.fit || "",
          patternDesign: p.patternDesign || "",
          occasion: p.occasion || "",
          season: p.season || "",
          careInstructions: p.careInstructions || "",
          isNewArrival: p.isNewArrival || false,
          seoTitle: p.seoTitle || "",
          seoDescription: p.seoDescription || "",
        });
      } else {
        setErrorMessage(prodRes.error?.message || "Product not found");
      }

      if (sizesRes.success && sizesRes.data) setSizes(sizesRes.data.sizes);
      if (colorsRes.success && colorsRes.data) setColors(colorsRes.data.colors);
      if (variantsRes.success && variantsRes.data) setVariants(variantsRes.data.variants);
      if (mediaRes.success && mediaRes.data) setMediaList(mediaRes.data.media);
    } catch {
      setErrorMessage("Network error while loading product details.");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await loadAll();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [loadAll]);

  // Clear messages on tab change
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // ==========================================================================
  // Core Details Save
  // ==========================================================================
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        slug: formData.slug.trim().toLowerCase(),
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim() || null,
        regularPrice: formData.regularPrice.trim(),
        compareAtPrice: formData.compareAtPrice.trim() || null,
        productType: formData.productType.trim() || null,
        gender: formData.gender.trim() || null,
        fabric: formData.fabric.trim() || null,
        includedPieces: formData.includedPieces.trim() || null,
        fit: formData.fit.trim() || null,
        patternDesign: formData.patternDesign.trim() || null,
        occasion: formData.occasion.trim() || null,
        season: formData.season.trim() || null,
        careInstructions: formData.careInstructions.trim() || null,
        isNewArrival: formData.isNewArrival,
        seoTitle: formData.seoTitle.trim() || null,
        seoDescription: formData.seoDescription.trim() || null,
      };

      const res = await updateAdminProduct(productId, payload);
      if (res.success && res.data?.product) {
        setProduct(res.data.product);
        setSuccessMessage("Product details saved successfully.");
      } else {
        setErrorMessage(res.error?.message || "Failed to update product.");
      }
    } catch {
      setErrorMessage("Network error while saving product details.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // Sizes & Colors Handlers
  // ==========================================================================
  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSizeName.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await createAdminProductSize(productId, {
        name: newSizeName.trim(),
        sortOrder: sizes.length + 1,
      });
      if (res.success && res.data?.size) {
        setSizes([...sizes, res.data.size]);
        setNewSizeName("");
        setSuccessMessage(`Added size "${res.data.size.name}".`);
      } else {
        setErrorMessage(res.error?.message || "Failed to add size.");
      }
    } catch {
      setErrorMessage("Network error adding size.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSize = async (sizeId: string) => {
    if (!confirm("Are you sure you want to remove this size?")) return;
    setIsSaving(true);
    try {
      const res = await deleteAdminProductSize(productId, sizeId);
      if (res.success) {
        setSizes(sizes.filter((s) => s.id !== sizeId));
        setSuccessMessage("Size removed.");
      } else {
        setErrorMessage(res.error?.message || "Failed to delete size.");
      }
    } catch {
      setErrorMessage("Network error deleting size.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorName.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await createAdminProductColor(productId, {
        name: newColorName.trim(),
        sortOrder: colors.length + 1,
      });
      if (res.success && res.data?.color) {
        setColors([...colors, res.data.color]);
        setNewColorName("");
        setSuccessMessage(`Added color "${res.data.color.name}".`);
      } else {
        setErrorMessage(res.error?.message || "Failed to add color.");
      }
    } catch {
      setErrorMessage("Network error adding color.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteColor = async (colorId: string) => {
    if (!confirm("Are you sure you want to remove this color?")) return;
    setIsSaving(true);
    try {
      const res = await deleteAdminProductColor(productId, colorId);
      if (res.success) {
        setColors(colors.filter((c) => c.id !== colorId));
        setSuccessMessage("Color removed.");
      } else {
        setErrorMessage(res.error?.message || "Failed to delete color.");
      }
    } catch {
      setErrorMessage("Network error deleting color.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // Variants Matrix Handlers
  // ==========================================================================
  const handleGenerateVariants = async () => {
    if (sizes.length === 0 || colors.length === 0) {
      setErrorMessage("You must add at least one Size and one Color before generating variants.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Find combinations that do not exist yet
      const existingCombos = new Set(variants.map((v) => `${v.productSizeId}:${v.productColorId}`));
      const newVariants = [];

      for (const size of sizes) {
        for (const color of colors) {
          const key = `${size.id}:${color.id}`;
          if (!existingCombos.has(key)) {
            newVariants.push({
              productSizeId: size.id,
              productColorId: color.id,
              isAvailable: true,
            });
          }
        }
      }

      if (newVariants.length === 0) {
        setSuccessMessage("All Size + Color combinations already exist in the variants matrix.");
        setIsSaving(false);
        return;
      }

      const res = await bulkCreateAdminProductVariants(productId, newVariants);
      if (res.success && res.data?.variants) {
        // Refresh full variants list
        const refreshed = await getAdminProductVariants(productId);
        if (refreshed.success && refreshed.data) {
          setVariants(refreshed.data.variants);
        }
        setSuccessMessage(`Successfully generated ${res.data.variants.length} new variant(s).`);
      } else {
        setErrorMessage(res.error?.message || "Failed to generate variants.");
      }
    } catch {
      setErrorMessage("Network error generating variants.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVariantAvailability = async (variantId: string, currentAvailable: boolean) => {
    try {
      const nextAvailable = !currentAvailable;
      const res = await updateAdminProductVariant(productId, variantId, nextAvailable);
      if (res.success) {
        setVariants(
          variants.map((v) => (v.id === variantId ? { ...v, isAvailable: nextAvailable } : v))
        );
      } else {
        setErrorMessage(res.error?.message || "Failed to update variant availability.");
      }
    } catch {
      setErrorMessage("Network error updating variant.");
    }
  };

  // ==========================================================================
  // Media Handlers
  // ==========================================================================
  const handleSetMainMedia = async (productMediaId: string) => {
    setIsSaving(true);
    try {
      const res = await setAdminProductMediaMain(productId, productMediaId);
      if (res.success) {
        setMediaList(
          mediaList.map((m) => ({
            ...m,
            isMain: m.id === productMediaId,
          }))
        );
        setSuccessMessage("Main image set.");
      } else {
        setErrorMessage(res.error?.message || "Failed to set main image.");
      }
    } catch {
      setErrorMessage("Network error setting main image.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetHoverMedia = async (productMediaId: string) => {
    setIsSaving(true);
    try {
      const res = await setAdminProductMediaHover(productId, productMediaId);
      if (res.success) {
        setMediaList(
          mediaList.map((m) => ({
            ...m,
            isHover: m.id === productMediaId,
          }))
        );
        setSuccessMessage("Hover image set.");
      } else {
        setErrorMessage(res.error?.message || "Failed to set hover image.");
      }
    } catch {
      setErrorMessage("Network error setting hover image.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHoverMedia = async () => {
    setIsSaving(true);
    try {
      const res = await clearAdminProductMediaHover(productId);
      if (res.success) {
        setMediaList(mediaList.map((m) => ({ ...m, isHover: false })));
        setSuccessMessage("Hover image cleared.");
      } else {
        setErrorMessage(res.error?.message || "Failed to clear hover image.");
      }
    } catch {
      setErrorMessage("Network error clearing hover image.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMedia = async (productMediaId: string) => {
    const target = mediaList.find((media) => media.id === productMediaId);
    if (
      !confirm(
        target?.mediaType === "VIDEO" ? "Delete this product video?" : "Delete this product image?"
      )
    )
      return;
    setIsSaving(true);
    try {
      const res = await deleteAdminProductMedia(productId, productMediaId);
      if (res.success) {
        setMediaList(mediaList.filter((m) => m.id !== productMediaId));
        setSuccessMessage("Media asset deleted.");
      } else {
        setErrorMessage(res.error?.message || "Failed to delete media asset.");
      }
    } catch {
      setErrorMessage("Network error deleting media.");
    } finally {
      setIsSaving(false);
    }
  };

  const closeCrop = () => {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
  };

  const closeVideoFrame = () => {
    if (videoSource) URL.revokeObjectURL(videoSource.url);
    setVideoSource(null);
  };

  const handleImageSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    if (imageMedia.length >= 8) {
      setErrorMessage("This product already has 8 images. Delete an image before adding another.");
      return;
    }
    const formatError = getImageFormatError(file);
    if (formatError) {
      setErrorMessage(formatError);
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const error = getImageSourceError(file, image.naturalWidth, image.naturalHeight);
      if (error) throw new Error(error);
      setCropSource({ url, name: file.name });
    } catch (err) {
      URL.revokeObjectURL(url);
      setErrorMessage(err instanceof Error ? err.message : "Could not read the selected image.");
    }
  };

  const uploadMedia = async (
    file: File,
    mediaType: "IMAGE" | "VIDEO",
    replaceVideo = false,
    videoCrop?: VideoCrop
  ) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const signRes = await getAdminProductMediaUploadSignature(productId, mediaType, videoCrop);
      if (!signRes.success || !signRes.data) {
        throw new Error(signRes.error?.message || "Failed to obtain upload signature.");
      }

      const signData = signRes.data;
      const publicId = await uploadSignedProductFile(file, signData, mediaType);

      const regRes = replaceVideo
        ? await replaceAdminProductVideo(productId, publicId)
        : await registerAdminProductMedia(productId, {
            publicId,
            mediaType,
            ...(mediaType === "IMAGE" && { altText: `${product?.name || "Product"} image` }),
          });

      if (regRes.success && regRes.data) {
        const newMedia = regRes.data.media;
        setMediaList((prev) =>
          replaceVideo
            ? prev.map((media) => (media.id === newMedia.id ? newMedia : media))
            : [...prev, newMedia]
        );
        setSuccessMessage(
          replaceVideo
            ? "Product video replaced successfully."
            : `Product ${mediaType.toLowerCase()} uploaded successfully.`
        );
      } else {
        setErrorMessage(regRes.error?.message || "Failed to register uploaded media.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || `Network error uploading ${mediaType.toLowerCase()}.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleVideoSelection = async (e: React.ChangeEvent<HTMLInputElement>, replace: boolean) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    if (productVideo && !replace) {
      setErrorMessage("This product already has a product video. Replace or delete it first.");
      return;
    }
    const formatError = getVideoFileError(file);
    if (formatError) {
      setErrorMessage(formatError);
      return;
    }
    setIsSaving(true);
    try {
      const { width, height } = await readVideoDimensions(file);
      const sourceError = getVideoSourceError(width, height);
      if (sourceError) {
        setErrorMessage(sourceError);
        return;
      }
      setVideoSource({ file, url: URL.createObjectURL(file), width, height, replace });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not read this MP4 video.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveMedia = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= imageMedia.length) return;

    const copy = [...imageMedia];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    const ordered = [...copy, ...mediaList.filter((media) => media.mediaType === "VIDEO")];

    try {
      const res = await reorderAdminProductMedia(
        productId,
        ordered.map((media) => media.id)
      );
      if (res.success && res.data) {
        setMediaList(res.data.media);
        setSuccessMessage("Media order updated.");
      } else {
        setErrorMessage(res.error?.message || "Failed to reorder media.");
      }
    } catch {
      setErrorMessage("Network error reordering media.");
    }
  };

  const handleSaveMediaAlt = async (mediaId: string, altText: string) => {
    const current = imageMedia.find((media) => media.id === mediaId);
    if (!current || (current.altText || "") === altText.trim()) return;
    try {
      const res = await updateAdminProductMediaAlt(productId, mediaId, altText.trim() || null);
      if (res.success && res.data) {
        const updatedMedia = res.data.media;
        setMediaList((prev) => prev.map((media) => (media.id === mediaId ? updatedMedia : media)));
        setSuccessMessage("Image alt text saved.");
      } else {
        setErrorMessage(res.error?.message || "Failed to save image alt text.");
      }
    } catch {
      setErrorMessage("Network error saving image alt text.");
    }
  };

  // ==========================================================================
  // Status Transition Handler
  // ==========================================================================
  const handleStatusChange = async (targetStatus: "DRAFT" | "PUBLISHED" | "INACTIVE") => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateAdminProductStatus(productId, targetStatus);
      if (res.success && res.data?.product) {
        setProduct(res.data.product);
        setSuccessMessage(`Product status updated to ${targetStatus}.`);
      } else {
        setErrorMessage(
          res.error?.message || `Failed to transition product status to ${targetStatus}.`
        );
      }
    } catch {
      setErrorMessage("Network error while changing status.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
            Loading product editor...
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  if (!product) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h2 className="font-heading text-lg font-bold uppercase text-brand-ink">
              Product Not Found
            </h2>
            <p className="text-xs text-brand-muted mt-1">
              The requested product does not exist or has been removed.
            </p>
            <Link
              href="/admin/products"
              className="inline-flex items-center space-x-1.5 mt-4 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-brand-primary border border-brand-sand rounded-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Products</span>
            </Link>
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/admin/products"
                className="p-1.5 text-brand-muted hover:text-brand-ink rounded-sm border border-brand-sand bg-white"
                aria-label="Back to Products"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-ink">
                    {product.name}
                  </h1>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      product.status === "PUBLISHED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : product.status === "DRAFT"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {product.status}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wider font-mono text-brand-muted mt-0.5">
                  SKU: {product.sku} • Storefront: {product.storefront?.name || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={loadAll}
                className="p-2 border border-brand-sand rounded-sm text-brand-muted hover:text-brand-ink bg-white"
                title="Refresh Product Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div
              className="p-4 bg-rose-50 border border-rose-200 rounded-sm flex items-start space-x-2 text-rose-800 text-xs"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              className={`p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start space-x-2 text-emerald-800 text-xs transition-opacity duration-300 ${successFading ? "opacity-0" : "opacity-100"}`}
              role="status"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="border-b border-brand-sand flex space-x-1 sm:space-x-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange("details")}
              className={`py-2 px-3 border-b-2 text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                activeTab === "details"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-muted hover:text-brand-ink"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("options")}
              className={`py-2 px-3 border-b-2 text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                activeTab === "options"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-muted hover:text-brand-ink"
              }`}
            >
              Sizes & Colors ({sizes.length} / {colors.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("variants")}
              className={`py-2 px-3 border-b-2 text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                activeTab === "variants"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-muted hover:text-brand-ink"
              }`}
            >
              Variants Matrix ({variants.length})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("media")}
              className={`py-2 px-3 border-b-2 text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                activeTab === "media"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-muted hover:text-brand-ink"
              }`}
            >
              Media ({imageMedia.length}/8 images)
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("status")}
              className={`py-2 px-3 border-b-2 text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                activeTab === "status"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-brand-muted hover:text-brand-ink"
              }`}
            >
              Publication State
            </button>
          </div>

          {/* TAB 1: DETAILS */}
          {activeTab === "details" && (
            <form onSubmit={handleSaveDetails} className="space-y-6">
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                  Product Core
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      URL Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink lowercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Regular Price (PKR) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.regularPrice}
                      onChange={(e) => setFormData({ ...formData, regularPrice: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Compare-at Price (PKR)
                    </label>
                    <input
                      type="text"
                      value={formData.compareAtPrice}
                      onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Short Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Product Type
                    </label>
                    <input
                      type="text"
                      value={formData.productType}
                      onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Gender
                    </label>
                    <input
                      type="text"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Fabric
                    </label>
                    <input
                      type="text"
                      value={formData.fabric}
                      onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Included Pieces
                    </label>
                    <input
                      type="text"
                      value={formData.includedPieces}
                      onChange={(e) => setFormData({ ...formData, includedPieces: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Fit
                    </label>
                    <input
                      type="text"
                      value={formData.fit}
                      onChange={(e) => setFormData({ ...formData, fit: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Pattern / Design
                    </label>
                    <input
                      type="text"
                      value={formData.patternDesign}
                      onChange={(e) => setFormData({ ...formData, patternDesign: e.target.value })}
                      placeholder="e.g. Embroidered, Solid, Floral"
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Season
                    </label>
                    <input
                      type="text"
                      value={formData.season}
                      onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                      placeholder="e.g. Summer, Festive"
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Occasion
                    </label>
                    <input
                      type="text"
                      value={formData.occasion}
                      onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                      placeholder="e.g. Eid, Casual, Party"
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Care Instructions
                  </label>
                  <input
                    type="text"
                    value={formData.careInstructions}
                    onChange={(e) => setFormData({ ...formData, careInstructions: e.target.value })}
                    placeholder="e.g. Hand wash cold, wash dark colors separately"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div className="pt-2">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isNewArrival}
                      onChange={(e) => setFormData({ ...formData, isNewArrival: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-brand-sand"
                    />
                    <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                      Mark as New Arrival
                    </span>
                  </label>
                </div>

                {/* SEO Section */}
                <div className="border-t border-brand-sand pt-4 space-y-4">
                  <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-ink">
                    Search Engine Optimization (SEO)
                  </h3>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      SEO Title
                    </label>
                    <input
                      type="text"
                      value={formData.seoTitle}
                      onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                      placeholder="Custom meta title (optional)..."
                      maxLength={200}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      SEO Description
                    </label>
                    <textarea
                      rows={2}
                      value={formData.seoDescription}
                      onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                      placeholder="Custom meta description (optional)..."
                      maxLength={500}
                      className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{isSaving ? "Saving..." : "Save Product Details"}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SIZES & COLORS */}
          {activeTab === "options" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Sizes */}
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
                <div className="border-b border-brand-sand pb-2 flex items-center justify-between">
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                    Sizes
                  </h2>
                  <span className="text-[11px] text-brand-muted">{sizes.length} defined</span>
                </div>

                <form onSubmit={handleAddSize} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    placeholder="e.g. 0-3M, 3-6M, 4Y"
                    className="flex-1 px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !newSizeName.trim()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="divide-y divide-brand-sand/60 max-h-80 overflow-y-auto">
                  {sizes.length === 0 ? (
                    <p className="text-xs text-brand-muted py-4 text-center">
                      No sizes defined yet.
                    </p>
                  ) : (
                    sizes.map((s) => (
                      <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-ink">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSize(s.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete size"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Product Colors */}
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
                <div className="border-b border-brand-sand pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                      Colors
                    </h2>
                    <span className="text-[10px] text-brand-muted uppercase tracking-wider block">
                      Display names only (No hex / RGB / swatches)
                    </span>
                  </div>
                  <span className="text-[11px] text-brand-muted">{colors.length} defined</span>
                </div>

                <form onSubmit={handleAddColor} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="e.g. Assorted, Sky Blue, Navy"
                    className="flex-1 px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !newColorName.trim()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add</span>
                  </button>
                </form>

                <div className="divide-y divide-brand-sand/60 max-h-80 overflow-y-auto">
                  {colors.length === 0 ? (
                    <p className="text-xs text-brand-muted py-4 text-center">
                      No colors defined yet.
                    </p>
                  ) : (
                    colors.map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-ink">{c.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteColor(c.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete color"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VARIANTS MATRIX */}
          {activeTab === "variants" && (
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <div className="border-b border-brand-sand pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                    Variants Matrix
                  </h2>
                  <p className="text-[11px] text-brand-muted uppercase tracking-wider mt-0.5">
                    Exact Size + Color combinations. Availability is boolean (Available /
                    Unavailable).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateVariants}
                  disabled={isSaving || sizes.length === 0 || colors.length === 0}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Generate All Combinations</span>
                </button>
              </div>

              {variants.length === 0 ? (
                <div className="p-8 text-center text-brand-muted text-xs">
                  <p className="font-semibold uppercase tracking-wider mb-1">
                    No variants generated yet.
                  </p>
                  <p className="text-[11px]">
                    Add Sizes and Colors in the previous tab, then click &quot;Generate All
                    Combinations&quot;.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-canvas/50 border-b border-brand-sand text-[11px] uppercase tracking-wider text-brand-muted font-semibold">
                        <th className="py-2.5 px-4">Size</th>
                        <th className="py-2.5 px-4">Color</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Toggle Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-sand/60">
                      {variants.map((v) => {
                        const sizeName = sizes.find((s) => s.id === v.productSizeId)?.name || "—";
                        const colorName =
                          colors.find((c) => c.id === v.productColorId)?.name || "—";
                        return (
                          <tr key={v.id} className="hover:bg-brand-sand/20">
                            <td className="py-2.5 px-4 font-semibold text-brand-ink">{sizeName}</td>
                            <td className="py-2.5 px-4 text-brand-ink">{colorName}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  v.isAvailable
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {v.isAvailable ? "Available" : "Unavailable"}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleVariantAvailability(v.id, v.isAvailable)}
                                className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded-sm border ${
                                  v.isAvailable
                                    ? "border-amber-300 text-amber-800 hover:bg-amber-50"
                                    : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                }`}
                              >
                                Mark {v.isAvailable ? "Unavailable" : "Available"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MEDIA */}
          {activeTab === "media" && (
            <>
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-6">
                <div>
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                    Product Media
                  </h2>
                  <p className="mt-1 text-[11px] text-brand-muted">
                    One explicit Main image is required for publication.
                  </p>
                </div>

                <section aria-labelledby="product-images-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-sand pb-3">
                    <div>
                      <h3
                        id="product-images-heading"
                        className="text-xs font-semibold uppercase tracking-wider text-brand-ink"
                      >
                        Images <span className="text-brand-muted">{imageMedia.length} / 8</span>
                      </h3>
                      <p className="mt-1 text-[11px] text-brand-muted">
                        Final output: 1200 × 1500 · 4:5 · JPEG
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`inline-flex items-center gap-1.5 rounded-sm bg-brand-ink px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white focus-within:ring-2 focus-within:ring-brand-ink focus-within:ring-offset-2 ${isSaving || imageMedia.length >= 8 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-brand-text"}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Upload Image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Upload product image"
                          className="sr-only"
                          disabled={isSaving || imageMedia.length >= 8}
                          onChange={handleImageSelection}
                        />
                      </label>
                      {imageMedia.some((media) => media.isHover) && (
                        <button
                          type="button"
                          onClick={handleClearHoverMedia}
                          disabled={isSaving}
                          className="rounded-sm border border-brand-sand px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50"
                        >
                          Clear Hover Image
                        </button>
                      )}
                    </div>
                  </div>
                  {imageMedia.length === 0 ? (
                    <div className="py-10 text-center text-xs text-brand-muted">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
                      No product images yet. Select a source image to crop.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {imageMedia.map((media, idx) => (
                        <div
                          key={media.id}
                          className="flex flex-col overflow-hidden rounded-sm border border-brand-sand bg-brand-canvas/30"
                        >
                          <div className="relative aspect-4/5 overflow-hidden bg-brand-sand/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={media.secureUrl}
                              alt={media.altText || "Product image"}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute left-2 top-2 flex flex-col gap-1">
                              {media.isMain && (
                                <span className="rounded-xs bg-brand-ink px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                  Main Image
                                </span>
                              )}
                              {media.isHover && (
                                <span className="rounded-xs bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                  Hover Image
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 p-3 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-brand-muted">
                              <span>Order: #{idx + 1}</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveMedia(idx, "up")}
                                  disabled={isSaving || idx === 0}
                                  aria-label={`Move image ${idx + 1} up`}
                                  className="rounded p-1 hover:bg-brand-sand disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveMedia(idx, "down")}
                                  disabled={isSaving || idx === imageMedia.length - 1}
                                  aria-label={`Move image ${idx + 1} down`}
                                  className="rounded p-1 hover:bg-brand-sand disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <label className="block text-[11px] text-brand-muted">
                              Alt text
                              <input
                                type="text"
                                maxLength={200}
                                defaultValue={media.altText || ""}
                                onBlur={(event) =>
                                  void handleSaveMediaAlt(media.id, event.target.value)
                                }
                                className="mt-1 w-full rounded-sm border border-brand-sand bg-white px-2 py-1 text-xs text-brand-ink"
                              />
                            </label>
                            <div className="space-y-1 border-t border-brand-sand/60 pt-2">
                              {!media.isMain && (
                                <button
                                  type="button"
                                  onClick={() => handleSetMainMedia(media.id)}
                                  disabled={isSaving}
                                  className="w-full rounded-sm border border-brand-sand py-1 text-[10px] font-semibold uppercase text-brand-ink disabled:opacity-50"
                                >
                                  Set as Main
                                </button>
                              )}
                              {!media.isHover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetHoverMedia(media.id)}
                                  disabled={isSaving}
                                  className="w-full rounded-sm border border-brand-sand py-1 text-[10px] font-semibold uppercase text-brand-ink disabled:opacity-50"
                                >
                                  Set as Hover
                                </button>
                              )}
                              {!media.isMain && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMedia(media.id)}
                                  disabled={isSaving}
                                  className="w-full rounded-sm border border-rose-200 py-1 text-[10px] font-semibold uppercase text-rose-700 disabled:opacity-50"
                                >
                                  Delete Image
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section
                  aria-labelledby="product-video-heading"
                  className="border-t border-brand-sand pt-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3
                        id="product-video-heading"
                        className="text-xs font-semibold uppercase tracking-wider text-brand-ink"
                      >
                        Product Video{" "}
                        <span className="text-brand-muted">{productVideo ? 1 : 0} / 1</span>
                      </h3>
                      <p className="mt-1 text-[11px] text-brand-muted">
                        Source: MP4 · choose a 4:5 frame · final output: 1080 × 1350
                      </p>
                    </div>
                    <label
                      className={`inline-flex items-center gap-1.5 rounded-sm bg-brand-ink px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white focus-within:ring-2 focus-within:ring-brand-ink focus-within:ring-offset-2 ${isSaving ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-brand-text"}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                      {productVideo ? "Replace Video" : "Upload Video"}
                      <input
                        type="file"
                        accept=".mp4,video/mp4"
                        aria-label={productVideo ? "Replace product video" : "Upload product video"}
                        className="sr-only"
                        disabled={isSaving}
                        onChange={(event) => void handleVideoSelection(event, !!productVideo)}
                      />
                    </label>
                  </div>
                  {productVideo ? (
                    <div className="mt-4 max-w-xs space-y-3">
                      <video
                        src={productVideo.secureUrl}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label="Product video preview"
                        className="aspect-4/5 w-full rounded-sm bg-black object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(productVideo.id)}
                        disabled={isSaving}
                        className="rounded-sm border border-rose-200 px-3 py-2 text-xs font-semibold uppercase text-rose-700 disabled:opacity-50"
                      >
                        Delete Video
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 flex items-center gap-2 text-xs text-brand-muted">
                      <Video className="h-4 w-4" aria-hidden="true" /> No product video uploaded.
                    </p>
                  )}
                </section>
              </div>
              {cropSource && (
                <ProductImageCropDialog
                  sourceUrl={cropSource.url}
                  sourceName={cropSource.name}
                  onCancel={closeCrop}
                  onConfirm={(file) => {
                    closeCrop();
                    void uploadMedia(file, "IMAGE");
                  }}
                />
              )}
              {videoSource && (
                <ProductVideoFrameDialog
                  sourceUrl={videoSource.url}
                  sourceWidth={videoSource.width}
                  sourceHeight={videoSource.height}
                  onCancel={closeVideoFrame}
                  onConfirm={(crop) => {
                    const { file, replace } = videoSource;
                    closeVideoFrame();
                    void uploadMedia(file, "VIDEO", replace, crop);
                  }}
                />
              )}
            </>
          )}

          {/* TAB 5: PUBLICATION STATUS */}
          {activeTab === "status" && (
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-6">
              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                  Publication Status Controls
                </h2>
                <p className="text-xs text-brand-muted mt-2">
                  Kids Wear implements strict backend publication gates. To transition a product to{" "}
                  <strong>PUBLISHED</strong>, it must have: a description, at least one active
                  variant with active size and color, and exactly one Main Image.
                </p>
              </div>

              <div className="p-4 bg-brand-canvas/40 border border-brand-sand rounded-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
                    Current Status
                  </span>
                  <span className="font-heading text-lg font-bold text-brand-ink uppercase">
                    {product.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink block">
                  Available State Transitions
                </span>

                <div className="flex flex-wrap gap-3">
                  {product.status !== "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange("PUBLISHED")}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                    >
                      Publish Product
                    </button>
                  )}

                  {product.status !== "INACTIVE" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange("INACTIVE")}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-sm disabled:opacity-50 transition-colors"
                    >
                      Deactivate Product
                    </button>
                  )}

                  {product.status !== "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange("DRAFT")}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-sm disabled:opacity-50 transition-colors"
                    >
                      Revert to Draft
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
