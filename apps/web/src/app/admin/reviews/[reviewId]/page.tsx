"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminReview, updateAdminReviewStatus, deleteAdminReview } from "@/lib/admin-api";
import { useTransientFeedback } from "@/lib/use-transient-feedback";
import type { AdminReviewDetailData, ReviewStatusType } from "@kids-wear/shared";
import {
  ArrowLeft,
  Star,
  CheckCircle,
  AlertCircle,
  EyeOff,
  Trash2,
  Image as ImageIcon,
  Calendar,
  Package,
} from "lucide-react";

export default function AdminReviewDetailPage() {
  const params = useParams<{ reviewId: string }>();
  const router = useRouter();
  const reviewId = params.reviewId;

  const [review, setReview] = useState<AdminReviewDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage, successFading] = useTransientFeedback<string>();

  const fetchReview = useCallback(async () => {
    if (!reviewId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getAdminReview(reviewId);
      if (res.success && res.data) {
        setReview(res.data);
      } else {
        setErrorMessage(res.error?.message || "Review not found");
      }
    } catch {
      setErrorMessage("Network error while loading review details.");
    } finally {
      setIsLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchReview();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchReview]);

  const handleStatusChange = async (targetStatus: ReviewStatusType) => {
    if (!review) return;
    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateAdminReviewStatus(review.id, targetStatus);
      if (res.success && res.data) {
        setSuccessMessage(`Review status updated to ${res.data.statusLabel}.`);
        setReview({
          ...review,
          status: res.data.status,
          statusLabel: res.data.statusLabel,
        });
      } else {
        setErrorMessage(res.error?.message || `Failed to transition review to ${targetStatus}.`);
      }
    } catch {
      setErrorMessage("Network error updating review status.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!review) return;
    const confirmed = confirm(
      `Are you sure you want to permanently delete this review from "${review.reviewerName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsMutating(true);
    try {
      const res = await deleteAdminReview(review.id);
      if (res.success) {
        router.push("/admin/reviews");
      } else {
        setErrorMessage(res.error?.message || "Failed to delete review.");
        setIsMutating(false);
      }
    } catch {
      setErrorMessage("Network error deleting review.");
      setIsMutating(false);
    }
  };

  const getStatusBadge = (revStatus: string) => {
    switch (revStatus) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "HIDDEN":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
            Loading review details...
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  if (!review) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h2 className="font-heading text-lg font-bold uppercase text-brand-ink">
              Review Not Found
            </h2>
            <p className="text-xs text-brand-muted mt-1">
              The requested review does not exist or has been deleted.
            </p>
            <Link
              href="/admin/reviews"
              className="inline-flex items-center space-x-1.5 mt-4 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-brand-primary border border-brand-sand rounded-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Reviews</span>
            </Link>
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/admin/reviews"
                className="p-1.5 text-brand-muted hover:text-brand-ink rounded-sm border border-brand-sand bg-white"
                aria-label="Back to Reviews"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-ink">
                    Review by {review.reviewerName}
                  </h1>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                      review.status
                    )}`}
                  >
                    {review.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Submitted on{" "}
                  {new Date(review.createdAt).toLocaleDateString("en-PK", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
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

          {/* Action Bar */}
          <div className="bg-white p-4 border border-brand-sand rounded-sm shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-ink">
                Moderation Actions:
              </span>
              {review.status !== "APPROVED" && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("APPROVED")}
                  disabled={isMutating}
                  className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm disabled:opacity-50 transition-colors"
                >
                  Approve Review
                </button>
              )}
              {review.status !== "HIDDEN" && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("HIDDEN")}
                  disabled={isMutating}
                  className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm disabled:opacity-50 transition-colors"
                >
                  Hide Review
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isMutating}
              className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-sm disabled:opacity-50 transition-colors inline-flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>
          </div>

          {/* Review Details Card */}
          <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-6">
            {/* Product Connection */}
            <div className="p-4 bg-brand-canvas/30 border border-brand-sand rounded-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold block">
                  Reviewed Product
                </span>
                <span className="font-semibold text-sm text-brand-ink">{review.product.name}</span>
                <span className="font-mono text-xs text-brand-muted block mt-0.5">
                  SKU: {review.product.sku}
                </span>
              </div>
              <Link
                href={`/admin/products/${review.product.id}`}
                className="px-2.5 py-1 text-xs uppercase tracking-wider font-semibold text-brand-ink border border-brand-border rounded-sm hover:bg-brand-surface-soft transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
              >
                Inspect Product
              </Link>
            </div>

            {/* Rating */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold block mb-1">
                Customer Rating
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="font-heading text-lg font-bold text-amber-600">
                  {review.rating} / 5
                </span>
                <div className="flex text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < review.rating ? "fill-amber-500 text-amber-500" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Review Content */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold block mb-1.5">
                Review Text
              </span>
              <div className="p-4 bg-brand-canvas/20 border border-brand-sand rounded-sm text-xs text-brand-ink whitespace-pre-wrap leading-relaxed">
                {/* Render strictly as plain React text to guarantee zero HTML execution */}
                {review.reviewText}
              </div>
            </div>

            {/* Attached Images */}
            {review.images && review.images.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold block mb-2">
                  Customer Uploaded Images ({review.images.length} / max 3)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {review.images.map((img) => (
                    <div
                      key={img.id}
                      className="aspect-square border border-brand-sand rounded-sm overflow-hidden bg-brand-canvas/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.secureUrl}
                        alt="Customer review attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
