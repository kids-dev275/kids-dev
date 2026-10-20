"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminReviews, updateAdminReviewStatus, deleteAdminReview } from "@/lib/admin-api";
import type { AdminReviewListItem, ReviewStatusType } from "@kids-wear/shared";
import {
  Search,
  Star,
  CheckCircle,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReviewListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalReviews: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ReviewStatusType | "">("");
  const [rating, setRating] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminReviews({
        page: pagination.page,
        limit: pagination.limit,
        q: debouncedSearch || undefined,
        status: status || undefined,
        rating: rating ? parseInt(rating, 10) : undefined,
      });

      if (res.success && res.data) {
        setReviews(res.data.reviews);
        setPagination(res.data.pagination);
      } else {
        setError(res.error?.message || "Failed to load reviews");
      }
    } catch {
      setError("Network error while loading reviews.");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, status, rating]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchReviews();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchReviews]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleStatusChange = async (reviewId: string, nextStatus: ReviewStatusType) => {
    setActionLoadingId(reviewId);
    setError(null);
    setSuccess(null);

    try {
      const res = await updateAdminReviewStatus(reviewId, nextStatus);
      if (res.success && res.data) {
        setSuccess(`Review marked as ${res.data.statusLabel}.`);
        setReviews(
          reviews.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  status: res.data!.status,
                  statusLabel: res.data!.statusLabel,
                }
              : r
          )
        );
      } else {
        setError(res.error?.message || `Failed to update status to ${nextStatus}.`);
      }
    } catch {
      setError("Network error updating review status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (reviewId: string, reviewerName: string) => {
    const confirmed = confirm(
      `Are you sure you want to permanently delete the review from "${reviewerName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setActionLoadingId(reviewId);
    setError(null);
    setSuccess(null);

    try {
      const res = await deleteAdminReview(reviewId);
      if (res.success) {
        setSuccess("Review deleted successfully.");
        setReviews(reviews.filter((r) => r.id !== reviewId));
      } else {
        setError(res.error?.message || "Failed to delete review.");
      }
    } catch {
      setError("Network error deleting review.");
    } finally {
      setActionLoadingId(null);
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

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-ink uppercase">
                Review Moderation
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Moderate customer reviews, inspect submissions, and manage public visibility
              </p>
            </div>
          </div>

          {error && (
            <div
              className="p-4 bg-rose-50 border border-rose-200 rounded-sm flex items-start space-x-2 text-rose-800 text-xs"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start space-x-2 text-emerald-800 text-xs"
              role="status"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 border border-brand-sand rounded-sm shadow-xs flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                placeholder="Search by reviewer name, text content, or product..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ReviewStatusType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Moderation Statuses</option>
                <option value="PENDING">Pending Moderation</option>
                <option value="APPROVED">Approved / Published</option>
                <option value="HIDDEN">Hidden</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div className="w-full md:w-36">
              <select
                value={rating}
                onChange={(e) => {
                  setRating(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          {/* Reviews Table / Cards */}
          <div className="bg-white border border-brand-sand rounded-sm shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-12 text-center">
                <Star className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider text-brand-muted font-semibold">
                  No reviews found
                </p>
                <p className="text-[11px] text-brand-muted mt-1">
                  Try adjusting your search criteria or filter options.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand-canvas/50 border-b border-brand-sand text-[11px] uppercase tracking-wider text-brand-muted font-semibold">
                      <th className="py-3 px-4">Reviewer</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Rating</th>
                      <th className="py-3 px-4">Review Content</th>
                      <th className="py-3 px-4 text-center">Images</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/60">
                    {reviews.map((r) => (
                      <tr key={r.id} className="hover:bg-brand-sand/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-brand-ink whitespace-nowrap">
                          <Link
                            href={`/admin/reviews/${r.id}`}
                            className="hover:text-brand-primary"
                          >
                            {r.reviewerName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-brand-ink truncate">
                            {r.product.name}
                          </div>
                          <div className="font-mono text-[10px] text-brand-muted">
                            {r.product.sku}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-amber-600">{r.rating}</span>
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          {/* Render strictly as plain React text to guarantee XSS safety */}
                          <p className="text-brand-ink line-clamp-2">{r.reviewText}</p>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {r.imageCount > 0 ? (
                            <span className="inline-flex items-center space-x-1 text-[11px] text-brand-muted">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{r.imageCount}</span>
                            </span>
                          ) : (
                            <span className="text-brand-muted text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                              r.status
                            )}`}
                          >
                            {r.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString("en-PK", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5">
                            {/* Approve Action */}
                            {r.status !== "APPROVED" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(r.id, "APPROVED")}
                                disabled={actionLoadingId === r.id}
                                className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-sm disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}

                            {/* Hide Action */}
                            {r.status !== "HIDDEN" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(r.id, "HIDDEN")}
                                disabled={actionLoadingId === r.id}
                                className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm disabled:opacity-50"
                              >
                                Hide
                              </button>
                            )}

                            {/* Delete Action */}
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id, r.reviewerName)}
                              disabled={actionLoadingId === r.id}
                              className="p-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-sm disabled:opacity-50"
                              title="Delete review permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* View Detail Link */}
                            <Link
                              href={`/admin/reviews/${r.id}`}
                              className="p-1 text-brand-muted hover:text-brand-ink border border-brand-sand rounded-sm"
                              title="Inspect Review Details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t border-brand-sand flex items-center justify-between text-xs text-brand-muted">
                <span>
                  Showing Page {pagination.page} of {pagination.totalPages} (
                  {pagination.totalReviews} total reviews)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="p-1 border border-brand-sand rounded-sm hover:bg-brand-sand/30 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className="p-1 border border-brand-sand rounded-sm hover:bg-brand-sand/30 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
