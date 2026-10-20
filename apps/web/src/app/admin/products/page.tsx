"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminProducts, type AdminProductListItem } from "@/lib/admin-api";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Package,
} from "lucide-react";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [storefront, setStorefront] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminProducts({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        storefront: storefront || undefined,
        status: status || undefined,
      });

      if (res.success && res.data) {
        setProducts(res.data.items);
        setPagination(res.data.pagination);
      } else {
        setError(res.error?.message || "Failed to load products");
      }
    } catch {
      setError("An unexpected network error occurred while loading products.");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, storefront, status]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchProducts();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchProducts]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const getStatusBadge = (prodStatus: string) => {
    switch (prodStatus) {
      case "PUBLISHED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "DRAFT":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "INACTIVE":
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
                Products
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Manage catalog, variants, pricing, and publication state
              </p>
            </div>
            <Link
              href="/admin/products/new"
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 rounded-sm transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Product</span>
            </Link>
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
                placeholder="Search by product name or SKU..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Storefront Filter */}
            <div className="w-full md:w-48">
              <select
                value={storefront}
                onChange={(e) => {
                  setStorefront(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Storefronts</option>
                <option value="mini-sprouts">Mini Sprouts</option>
                <option value="teen-studio">Teen Studio</option>
                <option value="aura-studio">Aura Studio</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-40">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Table / List */}
          <div className="bg-white border border-brand-sand rounded-sm shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider text-brand-muted font-semibold">
                  No products found
                </p>
                <p className="text-[11px] text-brand-muted mt-1">
                  Try adjusting your search or filters, or create a new product.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand-canvas/50 border-b border-brand-sand text-[11px] uppercase tracking-wider text-brand-muted font-semibold">
                      <th className="py-3 px-4">Name / Title</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Storefront</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Arrival</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/60">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-brand-sand/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-brand-ink">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="hover:text-brand-primary font-semibold"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-mono text-brand-ink text-[11px]">{p.sku}</td>
                        <td className="py-3 px-4 text-brand-muted">{p.storefront?.name || "—"}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-brand-ink">PKR {p.regularPrice}</span>
                          {p.compareAtPrice && (
                            <span className="text-[10px] text-brand-muted line-through ml-1.5">
                              PKR {p.compareAtPrice}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                              p.status
                            )}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {p.isNewArrival ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-xs">
                              New
                            </span>
                          ) : (
                            <span className="text-brand-muted text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="inline-flex items-center px-2 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-primary hover:bg-brand-sand/40 border border-brand-sand rounded-sm"
                          >
                            Edit
                          </Link>
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
                  Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
                  total products)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-1 border border-brand-sand rounded-sm hover:bg-brand-sand/30 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
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
