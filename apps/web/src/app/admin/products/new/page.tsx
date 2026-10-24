"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { createAdminProduct, getAdminStorefronts, type AdminStorefrontItem } from "@/lib/admin-api";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";

export default function AdminNewProductPage() {
  const router = useRouter();
  const [storefronts, setStorefronts] = useState<AdminStorefrontItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    slug: "",
    storefrontId: "",
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

  useEffect(() => {
    async function loadStorefronts() {
      try {
        const res = await getAdminStorefronts();
        if (res.success && res.data?.storefronts) {
          setStorefronts(res.data.storefronts);
          if (res.data.storefronts.length > 0) {
            setFormData((prev) => ({
              ...prev,
              storefrontId: prev.storefrontId || res.data!.storefronts[0].id,
            }));
          }
        }
      } catch {
        // Handled silently
      }
    }
    void loadStorefronts();
  }, []);

  // Helper to auto-generate slug and SKU suggestion from name
  const handleNameChange = (nameVal: string) => {
    const generatedSlug = nameVal
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    setFormData((prev) => ({
      ...prev,
      name: nameVal,
      slug:
        prev.slug === "" ||
        prev.slug ===
          prev.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
          ? generatedSlug
          : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage("Product name is required.");
      return;
    }
    if (!formData.sku.trim()) {
      setErrorMessage("SKU is required.");
      return;
    }
    if (!formData.slug.trim()) {
      setErrorMessage("Slug is required.");
      return;
    }
    if (!formData.storefrontId) {
      setErrorMessage("Please select a Storefront.");
      return;
    }
    if (!formData.regularPrice.trim()) {
      setErrorMessage("Regular price is required.");
      return;
    }
    if (!formData.description.trim()) {
      setErrorMessage("Description is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        slug: formData.slug.trim().toLowerCase(),
        storefrontId: formData.storefrontId,
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim() || undefined,
        regularPrice: formData.regularPrice.trim(),
        compareAtPrice: formData.compareAtPrice.trim() || undefined,
        productType: formData.productType.trim() || undefined,
        gender: formData.gender.trim() || undefined,
        fabric: formData.fabric.trim() || undefined,
        includedPieces: formData.includedPieces.trim() || undefined,
        fit: formData.fit.trim() || undefined,
        patternDesign: formData.patternDesign.trim() || undefined,
        occasion: formData.occasion.trim() || undefined,
        season: formData.season.trim() || undefined,
        careInstructions: formData.careInstructions.trim() || undefined,
        isNewArrival: formData.isNewArrival,
        seoTitle: formData.seoTitle.trim() || undefined,
        seoDescription: formData.seoDescription.trim() || undefined,
      };

      const res = await createAdminProduct(payload);
      if (res.success && res.data?.product) {
        router.push(`/admin/products/${res.data.product.id}`);
      } else {
        setErrorMessage(res.error?.message || "Failed to create product. Please verify inputs.");
      }
    } catch {
      setErrorMessage("A network error occurred while creating the product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-4xl">
          {/* Top Breadcrumb & Title */}
          <div className="flex items-center justify-between border-b border-brand-sand pb-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/admin/products"
                className="p-1.5 text-brand-muted hover:text-brand-ink rounded-sm border border-brand-sand bg-white"
                aria-label="Back to Products"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-ink">
                  Create Product
                </h1>
                <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                  Initial creation defaults to DRAFT status
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div
              className="p-4 bg-rose-50 border border-rose-200 rounded-sm flex items-start space-x-2 text-rose-800 text-xs"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Core Identification */}
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                Basic Information
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
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Classic Embroidered Kurta Set"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    SKU (Stock Keeping Unit) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. CEK-001"
                    className="w-full px-3 py-2 text-xs font-mono bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary uppercase"
                  />
                  <span className="text-[10px] text-brand-muted mt-0.5 block">
                    Must be globally unique across all storefronts
                  </span>
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
                    placeholder="e.g. classic-embroidered-kurta-set"
                    className="w-full px-3 py-2 text-xs font-mono bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary lowercase"
                  />
                  <span className="text-[10px] text-brand-muted mt-0.5 block">
                    Unique within selected storefront
                  </span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Storefront Assignment *
                  </label>
                  <select
                    required
                    value={formData.storefrontId}
                    onChange={(e) => setFormData({ ...formData, storefrontId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  >
                    {storefronts.map((sf) => (
                      <option key={sf.id} value={sf.id}>
                        {sf.name} ({sf.ageLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    placeholder="e.g. Kurta, Dress, Romper"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                Pricing (PKR)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Regular Price (PKR) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.regularPrice}
                    onChange={(e) => setFormData({ ...formData, regularPrice: e.target.value })}
                    placeholder="e.g. 2950.00"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Compare-at Price (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.compareAtPrice}
                    onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                    placeholder="e.g. 3500.00"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>
            </div>

            {/* Descriptions & Details */}
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                Content & Attributes
              </h2>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Full description of product, fabric quality, styling and craftsmanship..."
                  className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
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
                  placeholder="Brief summary for catalog previews (optional)..."
                  className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Gender
                  </label>
                  <input
                    type="text"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    placeholder="e.g. Girls, Boys, Unisex"
                    className="w-full px-3 py-2 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Fabric / Material
                  </label>
                  <input
                    type="text"
                    value={formData.fabric}
                    onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
                    placeholder="e.g. 100% Breathable Cotton"
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
                    placeholder="e.g. 2-Piece (Shirt & Trousers)"
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
                    placeholder="e.g. Regular, Relaxed"
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

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1">
                    Pattern / Design
                  </label>
                  <input
                    type="text"
                    value={formData.patternDesign}
                    onChange={(e) => setFormData({ ...formData, patternDesign: e.target.value })}
                    placeholder="e.g. Embroidered, Floral, Solid"
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

              {/* isNewArrival */}
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
            </div>

            {/* SEO Section */}
            <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                Search Engine Optimization (SEO)
              </h2>

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

            {/* Submit Bar */}
            <div className="flex items-center justify-end space-x-3 border-t border-brand-sand pt-4">
              <Link
                href="/admin/products"
                className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-brand-muted hover:text-brand-ink border border-brand-sand bg-white rounded-sm"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center space-x-2 px-5 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{isSubmitting ? "Creating..." : "Save Draft & Continue to Options"}</span>
              </button>
            </div>
          </form>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
