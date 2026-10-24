"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { useTransientFeedback } from "@/lib/use-transient-feedback";
import {
  AdminPageHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
  AdminBadge,
  AdminAlert,
  AdminModal,
} from "@/components/admin/admin-ui";
import {
  getAdminStorefronts,
  getAdminStorefrontHeroSlides,
  createAdminHeroSlide,
  updateAdminHeroSlide,
  deleteAdminHeroSlide,
  reorderAdminHeroSlides,
  type AdminStorefrontItem,
  type AdminHeroSlide,
} from "@/lib/admin-api";
import {
  Store,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Image as ImageIcon,
  Edit,
  Save,
} from "lucide-react";

export default function AdminStorefrontsPage() {
  const [storefronts, setStorefronts] = useState<AdminStorefrontItem[]>([]);
  const [selectedStorefrontId, setSelectedStorefrontId] = useState<string>("");
  const [slides, setSlides] = useState<AdminHeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage, successFading] = useTransientFeedback<string>();
  const [slidesLoadFailed, setSlidesLoadFailed] = useState(false);
  const slideRequestId = useRef(0);

  // Modal / Form state for Hero slide
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slideForm, setSlideForm] = useState({
    heading: "",
    text: "",
    ctaLabel: "",
    ctaLink: "",
    desktopImageAssetId: "",
    mobileImageAssetId: "",
    isActive: true,
  });

  // Fetch initial storefronts
  useEffect(() => {
    let isMounted = true;
    async function loadStorefronts() {
      await Promise.resolve();
      if (!isMounted) return;
      setIsLoading(true);
      try {
        const res = await getAdminStorefronts();
        if (res.success && res.data?.storefronts) {
          setStorefronts(res.data.storefronts);
          if (res.data.storefronts.length > 0) {
            setSelectedStorefrontId(res.data.storefronts[0].id);
          }
        } else {
          setErrorMessage(res.error?.message || "Failed to load storefronts.");
        }
      } catch {
        setErrorMessage("Network error loading storefronts.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadStorefronts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Hero slides when selected storefront changes
  const fetchSlides = useCallback(async () => {
    if (!selectedStorefrontId) return;
    const requestId = ++slideRequestId.current;
    setIsLoading(true);
    setErrorMessage(null);
    setSlidesLoadFailed(false);
    setSlides([]);
    try {
      const res = await getAdminStorefrontHeroSlides(selectedStorefrontId);
      if (requestId !== slideRequestId.current) return;
      if (res.success && res.data) {
        setSlides(res.data.heroSlides);
      } else {
        setSlidesLoadFailed(true);
        setErrorMessage(res.error?.message || "Failed to load hero slides.");
      }
    } catch {
      if (requestId === slideRequestId.current) {
        setSlidesLoadFailed(true);
        setErrorMessage("Network error loading hero slides.");
      }
    } finally {
      if (requestId === slideRequestId.current) setIsLoading(false);
    }
  }, [selectedStorefrontId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchSlides();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchSlides]);

  const handleOpenCreateModal = () => {
    setEditingSlideId(null);
    setSlideForm({
      heading: "",
      text: "",
      ctaLabel: "",
      ctaLink: "",
      desktopImageAssetId: "",
      mobileImageAssetId: "",
      isActive: true,
    });
    setIsSlideModalOpen(true);
  };

  const handleOpenEditModal = (slide: AdminHeroSlide) => {
    setEditingSlideId(slide.id);
    setSlideForm({
      heading: slide.heading || "",
      text: slide.text || "",
      ctaLabel: slide.ctaLabel || "",
      ctaLink: slide.ctaLink || "",
      desktopImageAssetId: slide.desktopImageAsset.id,
      mobileImageAssetId: slide.mobileImageAsset?.id || "",
      isActive: slide.isActive,
    });
    setIsSlideModalOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStorefrontId) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        heading: slideForm.heading.trim(),
        text: slideForm.text.trim() || null,
        ctaLabel: slideForm.ctaLabel.trim() || null,
        ctaLink: slideForm.ctaLink.trim() || null,
        desktopImageAssetId: slideForm.desktopImageAssetId.trim(),
        mobileImageAssetId: slideForm.mobileImageAssetId.trim() || null,
        isActive: slideForm.isActive,
      };

      if (editingSlideId) {
        const res = await updateAdminHeroSlide(selectedStorefrontId, editingSlideId, payload);
        if (res.success) {
          setSuccessMessage("Hero slide updated successfully.");
          setIsSlideModalOpen(false);
          await fetchSlides();
        } else {
          setErrorMessage(res.error?.message || "Failed to update hero slide.");
        }
      } else {
        const res = await createAdminHeroSlide(selectedStorefrontId, payload);
        if (res.success) {
          setSuccessMessage("Hero slide created successfully.");
          setIsSlideModalOpen(false);
          await fetchSlides();
        } else {
          setErrorMessage(res.error?.message || "Failed to create hero slide.");
        }
      }
    } catch {
      setErrorMessage("Network error saving hero slide.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    const confirmed = confirm(
      "Are you sure you want to permanently delete this hero slide? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await deleteAdminHeroSlide(selectedStorefrontId, slideId);
      if (res.success) {
        setSuccessMessage("Hero slide deleted successfully.");
        await fetchSlides();
      } else {
        setErrorMessage(res.error?.message || "Failed to delete hero slide.");
      }
    } catch {
      setErrorMessage("Network error deleting hero slide.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (slide: AdminHeroSlide) => {
    setIsSaving(true);
    try {
      const res = await updateAdminHeroSlide(selectedStorefrontId, slide.id, {
        isActive: !slide.isActive,
      });
      if (res.success) {
        await fetchSlides();
        setSuccessMessage(`Slide marked as ${!slide.isActive ? "Active" : "Inactive"}.`);
      } else {
        setErrorMessage(res.error?.message || "Failed to update slide status.");
      }
    } catch {
      setErrorMessage("Network error updating slide status.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveSlide = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const copy = [...slides];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const slideIds = copy.map((s) => s.id);

    try {
      const res = await reorderAdminHeroSlides(selectedStorefrontId, slideIds);
      if (res.success) {
        await fetchSlides();
        setSuccessMessage("Hero slides reordered successfully.");
      } else {
        setErrorMessage(res.error?.message || "Failed to reorder hero slides.");
      }
    } catch {
      setErrorMessage("Network error reordering slides.");
    }
  };

  const currentStorefront = storefronts.find((s) => s.id === selectedStorefrontId);

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-5xl">
          {/* Header */}
          <AdminPageHeader
            title="Storefronts & Hero Management"
            eyebrow="Visual Merchandising"
            description="Manage hero slides and promotional banners across the 3 fixed storefronts"
            action={
              <button
                type="button"
                onClick={handleOpenCreateModal}
                disabled={!selectedStorefrontId}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Hero Slide</span>
              </button>
            }
          />

          {/* Feedback Messages */}
          {errorMessage && (
            <AdminAlert
              type="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          )}
          {successMessage && (
            <AdminAlert
              type="success"
              message={successMessage}
              fading={successFading}
              onDismiss={() => setSuccessMessage(null)}
            />
          )}

          {/* Fixed Storefronts Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {storefronts.map((sf) => {
              const isSelected = sf.id === selectedStorefrontId;
              return (
                <button
                  key={sf.id}
                  type="button"
                  onClick={() => {
                    setSelectedStorefrontId(sf.id);
                    setSlides([]);
                    setIsLoading(true);
                  }}
                  className={`p-4 border text-left rounded-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
                    isSelected
                      ? "border-champagne bg-brand-surface-soft/80 shadow-xs ring-1 ring-champagne"
                      : "border-brand-border bg-white hover:bg-brand-surface-soft/40"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Store
                      className={`w-4 h-4 ${isSelected ? "text-brand-ink" : "text-brand-muted"}`}
                    />
                    <span className="font-heading text-sm font-semibold uppercase text-brand-ink">
                      {sf.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-brand-muted mt-1 block">
                    Age: {sf.ageLabel} • Slug: /{sf.slug}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notice: Fixed Storefronts */}
          <div className="p-3.5 bg-brand-surface-soft border border-brand-border rounded-sm text-[11px] text-brand-muted">
            Storefront names and age ranges are fixed. Manage each storefront&apos;s promotional
            slides below.
          </div>

          {/* Hero Slides List for Selected Storefront */}
          <AdminCard className="overflow-hidden">
            <AdminCardHeader>
              <div>
                <AdminCardTitle>{currentStorefront?.name} Hero Slides</AdminCardTitle>
                <AdminCardDescription>
                  Ordered sequential slides (Desktop 1920×800 • Mobile 1080×1350)
                </AdminCardDescription>
              </div>
              <span className="text-xs text-brand-muted font-semibold uppercase tracking-wider">
                {slides.length} stored slide(s)
              </span>
            </AdminCardHeader>

            {isLoading ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading hero slides...
              </div>
            ) : slidesLoadFailed ? (
              <div className="p-8 text-center text-sm text-rose-800">
                Hero slides could not be loaded. Retry before editing.
              </div>
            ) : slides.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-muted">
                No Admin hero slides configured for this storefront. Development fallback imagery is
                not a stored slide.
              </div>
            ) : (
              <div className="divide-y divide-brand-border/60">
                <div className="bg-brand-canvas/50 px-5 py-2 text-xs text-brand-muted">
                  {slides.filter((slide) => slide.isActive).length} active ·{" "}
                  {slides.filter((slide) => !slide.isActive).length} inactive · shown in stored
                  order
                </div>
                {slides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-brand-surface-soft/30 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="flex shrink-0 gap-2">
                      <div className="w-24 h-14 bg-brand-surface-soft border border-brand-border rounded-md overflow-hidden shrink-0">
                        {slide.desktopImageAsset?.secureUrl ? (
                          <Image
                            src={slide.desktopImageAsset.secureUrl}
                            alt={`Desktop image for slide ${idx + 1}`}
                            width={96}
                            height={56}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-muted">
                            <ImageIcon className="w-4 h-4 opacity-50" />
                          </div>
                        )}
                      </div>
                      {slide.mobileImageAsset?.secureUrl && (
                        <div
                          className="h-14 w-11 overflow-hidden rounded-md border border-brand-border bg-brand-surface-soft"
                          title="Mobile image configured"
                        >
                          <Image
                            src={slide.mobileImageAsset.secureUrl}
                            alt={`Mobile image for slide ${idx + 1}`}
                            width={44}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold text-brand-muted">#{idx + 1}</span>
                        <h3 className="font-semibold text-xs text-brand-ink truncate">
                          {slide.heading || "Untitled Slide"}
                        </h3>
                        <AdminBadge variant={slide.isActive ? "emerald" : "slate"}>
                          {slide.isActive ? "Active" : "Inactive"}
                        </AdminBadge>
                      </div>
                      {slide.text && (
                        <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5">
                          {slide.text}
                        </p>
                      )}
                      {slide.ctaLabel && (
                        <span className="text-[10px] text-brand-text font-medium mt-1 inline-block">
                          CTA: &quot;{slide.ctaLabel}&quot; → {slide.ctaLink || "#"}
                        </span>
                      )}
                      <p className="mt-1 text-[10px] text-brand-muted">
                        Desktop image ·{" "}
                        {slide.mobileImageAsset
                          ? "Mobile image configured"
                          : "Desktop image used on mobile"}{" "}
                        · Stored sort order {slide.sortOrder}
                      </p>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 border border-brand-border rounded-sm hover:bg-brand-surface-soft text-brand-ink disabled:opacity-30 transition-colors"
                        title="Move Up"
                        aria-label="Move slide up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "down")}
                        disabled={idx === slides.length - 1}
                        className="p-1.5 border border-brand-border rounded-sm hover:bg-brand-surface-soft text-brand-ink disabled:opacity-30 transition-colors"
                        title="Move Down"
                        aria-label="Move slide down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(slide)}
                        disabled={isSaving}
                        className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-sm border transition-colors ${
                          slide.isActive
                            ? "border-brand-border text-brand-text hover:bg-brand-surface-soft"
                            : "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        {slide.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(slide)}
                        className="p-1.5 border border-brand-border rounded-sm hover:bg-brand-surface-soft text-brand-ink transition-colors"
                        title="Edit Slide"
                        aria-label="Edit hero slide"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        disabled={isSaving}
                        className="p-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-sm disabled:opacity-50 transition-colors"
                        title="Delete Slide"
                        aria-label="Delete hero slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          {/* Slide Modal (Create / Edit) using AdminModal primitive */}
          <AdminModal
            isOpen={isSlideModalOpen}
            onClose={() => setIsSlideModalOpen(false)}
            title={editingSlideId ? "Edit Hero Slide" : "New Hero Slide"}
            description="Configure promotional hero banner display and asset links"
          >
            <form onSubmit={handleSaveSlide} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="hero-heading"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Heading *
                </label>
                <input
                  id="hero-heading"
                  type="text"
                  required
                  value={slideForm.heading}
                  onChange={(e) => setSlideForm({ ...slideForm, heading: e.target.value })}
                  placeholder="e.g. Pure Linen Summer Magic"
                  className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="hero-text"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Subtext / Supporting Text
                </label>
                <textarea
                  id="hero-text"
                  rows={2}
                  value={slideForm.text}
                  onChange={(e) => setSlideForm({ ...slideForm, text: e.target.value })}
                  placeholder="e.g. Handcrafted festive wear designed for comfort"
                  className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="hero-cta-label"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    CTA Button Label
                  </label>
                  <input
                    id="hero-cta-label"
                    type="text"
                    value={slideForm.ctaLabel}
                    onChange={(e) => setSlideForm({ ...slideForm, ctaLabel: e.target.value })}
                    placeholder="e.g. Shop Collection"
                    className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hero-cta-link"
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                  >
                    CTA Link Path
                  </label>
                  <input
                    id="hero-cta-link"
                    type="text"
                    value={slideForm.ctaLink}
                    onChange={(e) => setSlideForm({ ...slideForm, ctaLink: e.target.value })}
                    placeholder="e.g. /mini-sprouts/products"
                    className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="hero-desktop-asset"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Desktop Media Asset ID (UUID) *
                </label>
                <input
                  id="hero-desktop-asset"
                  type="text"
                  required
                  value={slideForm.desktopImageAssetId}
                  onChange={(e) =>
                    setSlideForm({ ...slideForm, desktopImageAssetId: e.target.value })
                  }
                  placeholder="e.g. c3923f03-62be-4977-b8db-4e78ea6e979f"
                  className="w-full px-3 py-1.5 font-mono text-[11px] bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
                <span className="text-[10px] text-brand-muted mt-0.5 block">
                  Target 1920×800 image uploaded via media service
                </span>
              </div>

              <div>
                <label
                  htmlFor="hero-mobile-asset"
                  className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1"
                >
                  Mobile Media Asset ID (UUID, Optional)
                </label>
                <input
                  id="hero-mobile-asset"
                  type="text"
                  value={slideForm.mobileImageAssetId}
                  onChange={(e) =>
                    setSlideForm({ ...slideForm, mobileImageAssetId: e.target.value })
                  }
                  placeholder="Optional target 1080×1350 mobile crop"
                  className="w-full px-3 py-1.5 font-mono text-[11px] bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
                />
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slideForm.isActive}
                    onChange={(e) => setSlideForm({ ...slideForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-ink focus:ring-brand-ink border-brand-border"
                  />
                  <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                    Active &amp; Visible on Storefront
                  </span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-3 py-1.5 border border-brand-border rounded-sm text-brand-muted hover:text-brand-ink font-semibold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-ink text-white rounded-sm font-semibold uppercase tracking-wider text-xs shadow-xs hover:bg-brand-text active:bg-brand-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSaving ? "Saving..." : "Save Slide"}</span>
                </button>
              </div>
            </form>
          </AdminModal>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
