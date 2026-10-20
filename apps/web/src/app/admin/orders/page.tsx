"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminOrders } from "@/lib/admin-api";
import type { AdminOrderListItem, OrderStatusType, PaymentMethodType } from "@kids-wear/shared";
import { Search, ShoppingBag, ChevronLeft, ChevronRight, AlertCircle, Eye } from "lucide-react";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalOrders: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<OrderStatusType | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminOrders({
        page: pagination.page,
        limit: pagination.limit,
        q: debouncedSearch || undefined,
        status: status || undefined,
        paymentMethod: paymentMethod || undefined,
      });

      if (res.success && res.data) {
        setOrders(res.data.orders);
        setPagination(res.data.pagination);
      } else {
        setError(res.error?.message || "Failed to load orders");
      }
    } catch {
      setError("An unexpected network error occurred while loading orders.");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, status, paymentMethod]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchOrders();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchOrders]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const getStatusBadge = (orderStatus: string) => {
    switch (orderStatus) {
      case "ORDER_RECEIVED":
      case "AWAITING_PAYMENT":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "CONFIRMED":
      case "IN_PRODUCTION":
      case "READY_TO_SHIP":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "SHIPPED":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 border-rose-200";
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
                Orders Management
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Inspect customer orders, verify payments, and manage fulfillment lifecycle
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
                placeholder="Search by order #, customer name, phone, or email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as OrderStatusType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Statuses</option>
                <option value="ORDER_RECEIVED">Order Received (COD)</option>
                <option value="AWAITING_PAYMENT">Awaiting Payment (Bank)</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PRODUCTION">In Production</option>
                <option value="READY_TO_SHIP">Ready to Ship</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Payment Filter */}
            <div className="w-full md:w-44">
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethodType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">All Payment Methods</option>
                <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-brand-sand rounded-sm shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingBag className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider text-brand-muted font-semibold">
                  No orders found
                </p>
                <p className="text-[11px] text-brand-muted mt-1">
                  Try adjusting your search criteria or status filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand-canvas/50 border-b border-brand-sand text-[11px] uppercase tracking-wider text-brand-muted font-semibold">
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/60">
                    {orders.map((o) => (
                      <tr key={o.orderNumber} className="hover:bg-brand-sand/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-brand-ink">
                          <Link
                            href={`/admin/orders/${o.orderNumber}`}
                            className="hover:text-brand-primary"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("en-PK", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 font-medium text-brand-ink">{o.customerName}</td>
                        <td className="py-3 px-4 text-brand-muted">
                          <div>{o.phone}</div>
                          {o.email && (
                            <div className="text-[10px] truncate max-w-xs">{o.email}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                              o.status
                            )}`}
                          >
                            {o.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                          {o.paymentMethod === "CASH_ON_DELIVERY" ? "COD" : "Bank Transfer"}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-brand-ink">
                          {o.itemCount}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-brand-ink whitespace-nowrap">
                          PKR {o.grandTotal}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${o.orderNumber}`}
                            className="inline-flex items-center px-2 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-primary hover:bg-brand-sand/40 border border-brand-sand rounded-sm"
                          >
                            Manage
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
                  Showing Page {pagination.page} of {pagination.totalPages} (
                  {pagination.totalOrders} total orders)
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
