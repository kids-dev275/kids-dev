"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
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
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Edit,
  Save,
  X,
} from "lucide-react";

export default function AdminStorefrontsPage() {
  const [storefronts, setStorefronts] = useState<AdminStorefrontItem[]>([]);
  const [selectedStorefrontId, setSelectedStorefrontId] = useState<string>("");
  const [slides, setSlides] = useState<AdminHeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getAdminStorefrontHeroSlides(selectedStorefrontId);
      if (res.success && res.data) {
        setSlides(res.data.heroSlides);
      } else {
        setErrorMessage(res.error?.message || "Failed to load hero slides.");
      }
    } catch {
      setErrorMessage("Network error loading hero slides.");
    } finally {
      setIsLoading(false);
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
        const res = await createAdminHeroSlide(selectedStorefrontId, {
          ...payload,
          sortOrder: slides.length + 1,
        });
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
    if (!confirm("Are you sure you want to permanently delete this hero slide?")) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await deleteAdminHeroSlide(selectedStorefrontId, slideId);
      if (res.success) {
        setSuccessMessage("Hero slide deleted.");
        setSlides(slides.filter((s) => s.id !== slideId));
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
        setSlides(slides.map((s) => (s.id === slide.id ? { ...s, isActive: !s.isActive } : s)));
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
        setSlides(copy);
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-ink uppercase">
                Storefronts & Hero Management
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Manage hero slides and promotional banners across the 3 fixed storefronts
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              disabled={!selectedStorefrontId}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm transition-colors shadow-xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Hero Slide</span>
            </button>
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

          {/* Fixed Storefronts Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {storefronts.map((sf) => {
              const isSelected = sf.id === selectedStorefrontId;
              return (
                <button
                  key={sf.id}
                  type="button"
                  onClick={() => setSelectedStorefrontId(sf.id)}
                  className={`p-4 border text-left rounded-sm transition-colors ${
                    isSelected
                      ? "border-brand-primary bg-white shadow-xs ring-1 ring-brand-primary"
                      : "border-brand-sand bg-white/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Store
                      className={`w-4 h-4 ${isSelected ? "text-brand-primary" : "text-brand-muted"}`}
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
          <div className="p-3 bg-brand-sand/20 border border-brand-sand rounded-sm text-[11px] text-brand-muted">
            <strong>Architecture Invariant:</strong> Storefront names, slugs, age ranges, and color
            palettes are fixed application configurations and cannot be created, modified, or
            deleted in the admin interface.
          </div>

          {/* Hero Slides List for Selected Storefront */}
          <div className="bg-white border border-brand-sand rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-brand-sand flex items-center justify-between">
              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink">
                  {currentStorefront?.name} Hero Slides
                </h2>
                <p className="text-[11px] text-brand-muted uppercase tracking-wider mt-0.5">
                  Ordered sequential slides (Desktop 1920×800 • Mobile 1080×1350)
                </p>
              </div>
              <span className="text-xs text-brand-muted font-medium">{slides.length} slide(s)</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading hero slides...
              </div>
            ) : slides.length === 0 ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted">
                No hero slides created for this storefront yet.
              </div>
            ) : (
              <div className="divide-y divide-brand-sand/60">
                {slides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-14 bg-brand-sand/40 border border-brand-sand rounded-xs overflow-hidden shrink-0">
                      {slide.desktopImageAsset?.secureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.desktopImageAsset.secureUrl}
                          alt="Hero slide thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-muted">
                          <ImageIcon className="w-4 h-4 opacity-50" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-brand-muted">#{idx + 1}</span>
                        <h3 className="font-semibold text-xs text-brand-ink truncate">
                          {slide.heading || "Untitled Slide"}
                        </h3>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-semibold border ${
                            slide.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {slide.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {slide.text && (
                        <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5">
                          {slide.text}
                        </p>
                      )}
                      {slide.ctaLabel && (
                        <span className="text-[10px] text-brand-primary font-medium mt-1 inline-block">
                          CTA: &quot;{slide.ctaLabel}&quot; → {slide.ctaLink || "#"}
                        </span>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 border border-brand-sand rounded-sm hover:bg-brand-sand/30 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(idx, "down")}
                        disabled={idx === slides.length - 1}
                        className="p-1.5 border border-brand-sand rounded-sm hover:bg-brand-sand/30 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(slide)}
                        disabled={isSaving}
                        className={`px-2 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-sm border ${
                          slide.isActive
                            ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                            : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        }`}
                      >
                        {slide.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(slide)}
                        className="p-1.5 border border-brand-sand rounded-sm hover:bg-brand-sand/30 text-brand-ink"
                        title="Edit Slide"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        disabled={isSaving}
                        className="p-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-sm disabled:opacity-50"
                        title="Delete Slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slide Modal (Create / Edit) */}
          {isSlideModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="slide-modal-title"
            >
              <div className="bg-white rounded-sm shadow-xl border border-brand-sand max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-brand-sand pb-3">
                  <h3
                    id="slide-modal-title"
                    className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink"
                  >
                    {editingSlideId ? "Edit Hero Slide" : "New Hero Slide"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsSlideModalOpen(false)}
                    className="p-1 text-brand-muted hover:text-brand-ink"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveSlide} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Heading *
                    </label>
                    <input
                      type="text"
                      required
                      value={slideForm.heading}
                      onChange={(e) => setSlideForm({ ...slideForm, heading: e.target.value })}
                      placeholder="e.g. Pure Linen Summer Magic"
                      className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Subtext / Supporting Text
                    </label>
                    <textarea
                      rows={2}
                      value={slideForm.text}
                      onChange={(e) => setSlideForm({ ...slideForm, text: e.target.value })}
                      placeholder="e.g. Handcrafted festive wear designed for comfort"
                      className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                        CTA Button Label
                      </label>
                      <input
                        type="text"
                        value={slideForm.ctaLabel}
                        onChange={(e) => setSlideForm({ ...slideForm, ctaLabel: e.target.value })}
                        placeholder="e.g. Shop Collection"
                        className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                        CTA Link Path
                      </label>
                      <input
                        type="text"
                        value={slideForm.ctaLink}
                        onChange={(e) => setSlideForm({ ...slideForm, ctaLink: e.target.value })}
                        placeholder="e.g. /mini-sprouts/products"
                        className="w-full px-3 py-1.5 bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Desktop Media Asset ID (UUID) *
                    </label>
                    <input
                      type="text"
                      required
                      value={slideForm.desktopImageAssetId}
                      onChange={(e) =>
                        setSlideForm({ ...slideForm, desktopImageAssetId: e.target.value })
                      }
                      placeholder="e.g. c3923f03-62be-4977-b8db-4e78ea6e979f"
                      className="w-full px-3 py-1.5 font-mono text-[11px] bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                    <span className="text-[10px] text-brand-muted mt-0.5 block">
                      Target 1920×800 image uploaded via media service
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                      Mobile Media Asset ID (UUID, Optional)
                    </label>
                    <input
                      type="text"
                      value={slideForm.mobileImageAssetId}
                      onChange={(e) =>
                        setSlideForm({ ...slideForm, mobileImageAssetId: e.target.value })
                      }
                      placeholder="Optional target 1080×1350 mobile crop"
                      className="w-full px-3 py-1.5 font-mono text-[11px] bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="inline-flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slideForm.isActive}
                        onChange={(e) => setSlideForm({ ...slideForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-brand-sand"
                      />
                      <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                        Active &amp; Visible on Storefront
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-brand-sand">
                    <button
                      type="button"
                      onClick={() => setIsSlideModalOpen(false)}
                      className="px-3 py-1.5 border border-brand-sand rounded-sm text-brand-muted hover:text-brand-ink font-semibold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center space-x-1 px-4 py-1.5 bg-brand-primary text-white rounded-sm font-semibold uppercase tracking-wider shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? "Saving..." : "Save Slide"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
