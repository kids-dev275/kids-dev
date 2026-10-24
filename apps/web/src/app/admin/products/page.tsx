"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
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
  getProductStatusBadgeVariant,
} from "@/components/admin/admin-ui";
import { getAdminProducts, type AdminProductListItem } from "@/lib/admin-api";
import { Plus, Package } from "lucide-react";

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

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <AdminPageHeader
            title="Products"
            eyebrow="Catalog Management"
            description="Manage catalog, variants, pricing, and publication state"
            action={
              <Link
                href="/admin/products/new"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-brand-ink hover:bg-brand-text active:bg-brand-ink/90 rounded-sm transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Create Product</span>
              </Link>
            }
          />

          {error && <AdminAlert type="error" message={error} onDismiss={() => setError(null)} />}

          {/* Filters Bar */}
          <AdminFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            searchPlaceholder="Search by product name or SKU..."
          >
            {/* Storefront Filter */}
            <div className="w-full md:w-48">
              <select
                aria-label="Filter by storefront"
                value={storefront}
                onChange={(e) => {
                  setStorefront(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
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
                aria-label="Filter by product status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </AdminFilterBar>

          {/* Table / List */}
          <AdminCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading products...
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-rose-800">
                Products could not be loaded. Try the filters again.
              </div>
            ) : products.length === 0 ? (
              <AdminEmptyState
                icon={Package}
                title={search || storefront || status ? "No matching products" : "No products yet"}
                description={
                  search || storefront || status
                    ? "Try adjusting your search or filters."
                    : "Create a product to begin building the catalog."
                }
              />
            ) : (
              <AdminTable>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead>Name / Title</AdminTableHead>
                    <AdminTableHead>SKU</AdminTableHead>
                    <AdminTableHead>Storefront</AdminTableHead>
                    <AdminTableHead>Price</AdminTableHead>
                    <AdminTableHead>Variants</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead>Arrival</AdminTableHead>
                    <AdminTableHead align="center">Action</AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {products.map((p) => (
                    <AdminTableRow key={p.id}>
                      <AdminTableCell className="font-medium text-brand-ink">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-border bg-brand-surface-soft">
                            {p.thumbnailUrl ? (
                              <Image
                                src={p.thumbnailUrl}
                                alt=""
                                width={44}
                                height={44}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-brand-muted" aria-hidden="true" />
                            )}
                          </div>
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="hover:text-brand-text font-semibold hover:underline"
                          >
                            {p.name}
                          </Link>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-brand-ink text-[11px] font-medium">
                        {p.sku}
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted font-medium">
                        {p.storefront?.name || "—"}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap font-sans tabular-nums">
                        <span className="font-semibold text-brand-ink">PKR {p.regularPrice}</span>
                        {p.compareAtPrice && (
                          <span className="text-[10px] text-brand-muted line-through ml-1.5">
                            PKR {p.compareAtPrice}
                          </span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-brand-text">
                        {p.variantCount === undefined
                          ? "—"
                          : `${p.availableVariantCount ?? 0} available / ${p.variantCount}`}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        <AdminBadge variant={getProductStatusBadgeVariant(p.status)}>
                          {p.status}
                        </AdminBadge>
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        {p.isNewArrival ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-ink bg-brand-surface-soft px-1.5 py-0.5 rounded-xs border border-brand-border/60">
                            New
                          </span>
                        ) : (
                          <span className="text-brand-muted text-[10px]">—</span>
                        )}
                      </AdminTableCell>
                      <AdminTableCell align="center" className="whitespace-nowrap">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="inline-flex items-center px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-ink hover:bg-brand-surface-soft border border-brand-border rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
                        >
                          Edit
                        </Link>
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
              totalItems={pagination.total}
              itemName="products"
              onPageChange={handlePageChange}
            />
          </AdminCard>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
