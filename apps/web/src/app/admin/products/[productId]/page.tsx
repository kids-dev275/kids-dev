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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setSuccessMessage(`Successfully generated ${res.data.count} new variant(s).`);
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
    if (!confirm("Are you sure you want to delete this media asset?")) return;
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Request signed upload parameters
      const signRes = await getAdminProductMediaUploadSignature(productId, "IMAGE");
      if (!signRes.success || !signRes.data) {
        setErrorMessage(signRes.error?.message || "Failed to obtain upload signature.");
        setIsSaving(false);
        return;
      }

      const signData = signRes.data;

      // 2. Direct upload to Cloudinary (or mock provider in test)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", String(signData.timestamp));
      formData.append("signature", signData.signature);
      formData.append("folder", signData.folder);
      formData.append("public_id", signData.publicId);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image to media provider.");
      }

      const uploadJson = await uploadRes.json();
      const publicId = uploadJson.public_id || signData.publicId;

      // 3. Register uploaded media asset with backend
      const regRes = await registerAdminProductMedia(productId, {
        publicId,
        mediaType: "IMAGE",
        altText: `${product?.name || "Product"} image`,
      });

      if (regRes.success && regRes.data) {
        const newMedia = regRes.data.media;
        setMediaList((prev) => [...prev, newMedia]);
        setSuccessMessage("Product image uploaded successfully.");
      } else {
        setErrorMessage(regRes.error?.message || "Failed to register uploaded media.");
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Network error uploading image.");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  const handleMoveMedia = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;

    const copy = [...mediaList];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reorderPayload = copy.map((m, idx) => ({
      productMediaId: m.id,
      sortOrder: idx + 1,
    }));

    try {
      const res = await reorderAdminProductMedia(productId, reorderPayload);
      if (res.success) {
        setMediaList(copy);
        setSuccessMessage("Media order updated.");
      } else {
        setErrorMessage(res.error?.message || "Failed to reorder media.");
      }
    } catch {
      setErrorMessage("Network error reordering media.");
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
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start space-x-2 text-emerald-800 text-xs"
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
              Media ({mediaList.length}/8)
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
                  className="inline-flex items-center space-x-2 px-5 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Save className="w-4 h-4" />
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
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary rounded-sm disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary rounded-sm disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
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
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <div className="border-b border-brand-sand pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                    Product Media
                  </h2>
                  <p className="text-[11px] text-brand-muted uppercase tracking-wider mt-0.5">
                    Max 8 images (4:5 ratio) • Max 1 product video • One explicit Main Image
                    required for publication
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm cursor-pointer disabled:opacity-50 transition-colors shadow-xs">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      id="product-media-upload-input"
                      accept="image/*"
                      className="hidden"
                      disabled={
                        isSaving || mediaList.filter((m) => m.mediaType === "IMAGE").length >= 8
                      }
                      onChange={handleImageUpload}
                    />
                  </label>
                  {mediaList.some((m) => m.isHover) && (
                    <button
                      type="button"
                      onClick={handleClearHoverMedia}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-brand-muted hover:text-brand-ink border border-brand-sand rounded-sm"
                    >
                      Clear Hover Image
                    </button>
                  )}
                </div>
              </div>

              {mediaList.length === 0 ? (
                <div className="p-8 text-center text-brand-muted text-xs">
                  <ImageIcon className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                  <p className="font-semibold uppercase tracking-wider">No media uploaded yet</p>
                  <p className="text-[11px] mt-1 mb-4">
                    Upload images using the Cloudinary signed media service.
                  </p>
                  <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm cursor-pointer disabled:opacity-50 transition-colors shadow-xs">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Choose Image to Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isSaving}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaList.map((media, idx) => (
                    <div
                      key={media.id}
                      className="border border-brand-sand rounded-sm overflow-hidden bg-brand-canvas/30 flex flex-col"
                    >
                      <div className="aspect-4/5 relative bg-brand-sand/30 overflow-hidden">
                        {media.mediaType === "IMAGE" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.secureUrl}
                            alt={media.altText || "Product media"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                            <Video className="w-8 h-8 mb-2" />
                            <span className="text-[10px] uppercase font-semibold">
                              Product Video
                            </span>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {media.isMain && (
                            <span className="bg-brand-primary text-white text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-xs shadow-xs">
                              Main Image
                            </span>
                          )}
                          {media.isHover && (
                            <span className="bg-blue-600 text-white text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-xs shadow-xs">
                              Hover Image
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[11px] text-brand-muted">
                          <span>Order: #{idx + 1}</span>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMoveMedia(idx, "up")}
                              disabled={idx === 0}
                              className="p-1 hover:bg-brand-sand rounded disabled:opacity-30"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveMedia(idx, "down")}
                              disabled={idx === mediaList.length - 1}
                              className="p-1 hover:bg-brand-sand rounded disabled:opacity-30"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1 border-t border-brand-sand/60">
                          {media.mediaType === "IMAGE" && !media.isMain && (
                            <button
                              type="button"
                              onClick={() => handleSetMainMedia(media.id)}
                              disabled={isSaving}
                              className="w-full py-1 text-[10px] uppercase tracking-wider font-semibold border border-brand-sand rounded-sm hover:bg-brand-sand/40 text-brand-ink"
                            >
                              Set as Main
                            </button>
                          )}
                          {media.mediaType === "IMAGE" && !media.isHover && (
                            <button
                              type="button"
                              onClick={() => handleSetHoverMedia(media.id)}
                              disabled={isSaving}
                              className="w-full py-1 text-[10px] uppercase tracking-wider font-semibold border border-brand-sand rounded-sm hover:bg-brand-sand/40 text-brand-ink"
                            >
                              Set as Hover
                            </button>
                          )}
                          {!media.isMain && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMedia(media.id)}
                              disabled={isSaving}
                              className="w-full py-1 text-[10px] uppercase tracking-wider font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
