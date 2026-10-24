"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  AdminPageHeader,
  AdminCard,
  AdminFilterBar,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminBadge,
  AdminAlert,
  AdminEmptyState,
  AdminPagination,
  getReviewStatusBadgeVariant,
} from "@/components/admin/admin-ui";
import { getAdminReviews, updateAdminReviewStatus, deleteAdminReview } from "@/lib/admin-api";
import { useTransientFeedback } from "@/lib/use-transient-feedback";
import type { AdminReviewListItem, ReviewStatusType } from "@kids-wear/shared";
import { Star, Trash2, Image as ImageIcon, ExternalLink } from "lucide-react";

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
  const [success, setSuccess, successFading] = useTransientFeedback<string>();

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

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <AdminPageHeader
            title="Review Moderation"
            eyebrow="Community & Quality"
            description="Moderate customer reviews, inspect submissions, and manage public visibility"
          />

          {error && <AdminAlert type="error" message={error} onDismiss={() => setError(null)} />}
          {success && (
            <AdminAlert type="success" message={success} fading={successFading} onDismiss={() => setSuccess(null)} />
          )}

          {/* Filters Bar */}
          <AdminFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            searchPlaceholder="Search by reviewer name, text content, or product..."
          >
            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                aria-label="Filter by review status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ReviewStatusType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
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
                aria-label="Filter by rating"
                value={rating}
                onChange={(e) => {
                  setRating(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
              >
                <option value="">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </AdminFilterBar>

          {/* Reviews Table / Cards */}
          <AdminCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading reviews...
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-rose-800">
                Reviews could not be loaded. Try again.
              </div>
            ) : reviews.length === 0 ? (
              <AdminEmptyState
                icon={Star}
                title={search || status || rating ? "No matching reviews" : "No reviews yet"}
                description={
                  search || status || rating
                    ? "Try adjusting your search or filters."
                    : "Customer reviews will appear here when submitted."
                }
              />
            ) : (
              <AdminTable>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead>Reviewer</AdminTableHead>
                    <AdminTableHead>Product</AdminTableHead>
                    <AdminTableHead>Rating</AdminTableHead>
                    <AdminTableHead>Review Content</AdminTableHead>
                    <AdminTableHead align="center">Images</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead>Submitted</AdminTableHead>
                    <AdminTableHead align="right">Moderation Actions</AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {reviews.map((r) => (
                    <AdminTableRow key={r.id}>
                      <AdminTableCell className="font-semibold text-brand-ink whitespace-nowrap">
                        <Link
                          href={`/admin/reviews/${r.id}`}
                          className="hover:text-champagne transition-colors"
                        >
                          {r.reviewerName}
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-xs">
                        <div className="font-medium text-brand-ink truncate">{r.product.name}</div>
                        <div className="font-mono text-[10px] text-brand-muted">
                          {r.product.sku}
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <span className="font-bold text-amber-700">{r.rating}</span>
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="max-w-md">
                        {/* Render strictly as plain React text to guarantee XSS safety */}
                        <p className="text-brand-ink line-clamp-2">{r.reviewText}</p>
                      </AdminTableCell>
                      <AdminTableCell align="center" className="whitespace-nowrap">
                        {r.imageCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-brand-muted">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{r.imageCount}</span>
                          </span>
                        ) : (
                          <span className="text-brand-muted text-[10px]">—</span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        <AdminBadge variant={getReviewStatusBadgeVariant(r.status)}>
                          {r.statusLabel}
                        </AdminBadge>
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </AdminTableCell>
                      <AdminTableCell align="right" className="whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Approve Action */}
                          {r.status !== "APPROVED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(r.id, "APPROVED")}
                              disabled={actionLoadingId === r.id}
                              className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-sm disabled:opacity-50 transition-colors"
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
                              className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm disabled:opacity-50 transition-colors"
                            >
                              Hide
                            </button>
                          )}

                          {/* Delete Action */}
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id, r.reviewerName)}
                            disabled={actionLoadingId === r.id}
                            className="p-1 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-sm disabled:opacity-50 transition-colors"
                            title="Delete review permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* View Detail Link */}
                          <Link
                            href={`/admin/reviews/${r.id}`}
                            className="p-1 text-brand-muted hover:text-brand-ink border border-brand-border rounded-sm hover:bg-brand-surface-soft transition-colors"
                            title="Inspect Review Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}

            {/* Pagination Controls */}
            <AdminPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalReviews}
              itemName="reviews"
              onPageChange={handlePageChange}
            />
          </AdminCard>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
