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
  getOrderStatusBadgeVariant,
} from "@/components/admin/admin-ui";
import { getAdminOrders } from "@/lib/admin-api";
import type { AdminOrderListItem, OrderStatusType, PaymentMethodType } from "@kids-wear/shared";
import { ShoppingBag } from "lucide-react";

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

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <AdminPageHeader
            title="Orders Management"
            eyebrow="Fulfillment Lifecycle"
            description="Inspect customer orders, verify payments, and manage fulfillment lifecycle"
          />

          {error && <AdminAlert type="error" message={error} onDismiss={() => setError(null)} />}

          {/* Filters Bar */}
          <AdminFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            searchPlaceholder="Search by order #, customer name, phone, or email..."
          >
            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                aria-label="Filter by order status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as OrderStatusType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
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
                aria-label="Filter by payment method"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethodType | "");
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-1.5 text-xs bg-brand-canvas/30 border border-brand-border rounded-sm text-brand-ink focus:outline-none focus:ring-1 focus:ring-brand-ink transition-colors"
              >
                <option value="">All Payment Methods</option>
                <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </AdminFilterBar>

          {/* Orders Table */}
          <AdminCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading orders...
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-rose-800">
                Orders could not be loaded. Try again.
              </div>
            ) : orders.length === 0 ? (
              <AdminEmptyState
                icon={ShoppingBag}
                title={search || status || paymentMethod ? "No matching orders" : "No orders yet"}
                description={
                  search || status || paymentMethod
                    ? "Try adjusting your search or filters."
                    : "Customer orders will appear here when they are placed."
                }
              />
            ) : (
              <AdminTable>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead>Order #</AdminTableHead>
                    <AdminTableHead>Date</AdminTableHead>
                    <AdminTableHead>Customer</AdminTableHead>
                    <AdminTableHead>Contact</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead>Payment</AdminTableHead>
                    <AdminTableHead align="center">Items</AdminTableHead>
                    <AdminTableHead align="right">Total</AdminTableHead>
                    <AdminTableHead align="center">Action</AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {orders.map((o) => (
                    <AdminTableRow key={o.orderNumber}>
                      <AdminTableCell className="font-mono font-bold text-brand-ink">
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="hover:text-brand-text font-bold hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </AdminTableCell>
                      <AdminTableCell className="font-medium text-brand-ink">
                        {o.customerName}
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted">
                        <div>{o.phone}</div>
                        {o.email && <div className="text-[10px] truncate max-w-xs">{o.email}</div>}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        <AdminBadge variant={getOrderStatusBadgeVariant(o.status)}>
                          {o.statusLabel}
                        </AdminBadge>
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted whitespace-nowrap">
                        {o.paymentMethod === "CASH_ON_DELIVERY" ? "COD" : "Bank Transfer"}
                      </AdminTableCell>
                      <AdminTableCell align="center" className="font-medium text-brand-ink">
                        {o.itemCount}
                      </AdminTableCell>
                      <AdminTableCell
                        align="right"
                        className="font-semibold text-brand-ink whitespace-nowrap"
                      >
                        PKR {o.grandTotal}
                      </AdminTableCell>
                      <AdminTableCell align="center" className="whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="inline-flex items-center px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-ink hover:bg-brand-surface-soft border border-brand-border rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
                        >
                          Manage
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
              totalItems={pagination.totalOrders}
              itemName="orders"
              onPageChange={handlePageChange}
            />
          </AdminCard>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
