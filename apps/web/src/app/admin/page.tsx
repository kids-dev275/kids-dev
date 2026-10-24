"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  AdminPageHeader,
  AdminMetricCard,
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
  AdminCardDescription,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminBadge,
  AdminAlert,
  AdminButton,
  getOrderStatusBadgeVariant,
} from "@/components/admin/admin-ui";
import { getAdminDashboard } from "@/lib/admin-api";
import type { AdminDashboardData } from "@kids-wear/shared";
import { Package, ShoppingBag, Clock, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminDashboard();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || "Failed to load dashboard metrics");
      }
    } catch {
      setError("An unexpected network error occurred while loading dashboard metrics.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchDashboard();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchDashboard]);

  const getPaymentLabel = (method: string) => {
    return method === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "Bank Transfer";
  };

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <AdminPageHeader
            title="Dashboard Overview"
            eyebrow="Operations"
            description="Current commerce metrics and active orders"
            action={
              <AdminButton
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchDashboard}
                disabled={isLoading}
                isLoading={isLoading}
                leftIcon={!isLoading ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
              >
                Refresh
              </AdminButton>
            }
          />

          {error && <AdminAlert type="error" message={error} onDismiss={() => setError(null)} />}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Products */}
            <AdminMetricCard
              title="Total Products"
              value={data?.totalProducts ?? "—"}
              icon={Package}
              tone="default"
              testId="metric-total-products"
              isLoading={isLoading}
            />

            {/* 2. Total Orders */}
            <AdminMetricCard
              title="Total Orders"
              value={data?.totalOrders ?? "—"}
              icon={ShoppingBag}
              tone="blue"
              testId="metric-total-orders"
              isLoading={isLoading}
            />

            {/* 3. Active Orders */}
            <AdminMetricCard
              title="Active Orders"
              value={data?.activeOrders ?? "—"}
              icon={Clock}
              tone="emerald"
              testId="metric-active-orders"
              isLoading={isLoading}
            />

            {/* 4. Unavailable Variants */}
            <AdminMetricCard
              title="Unavailable Variants"
              value={data?.unavailableVariants ?? "—"}
              icon={AlertTriangle}
              tone="amber"
              testId="metric-unavailable-variants"
              isLoading={isLoading}
            />
          </div>

          {/* Operational Section: Recent Orders */}
          <AdminCard className="overflow-hidden">
            <AdminCardHeader>
              <div>
                <AdminCardTitle>Recent Orders</AdminCardTitle>
                <AdminCardDescription>
                  Latest customer orders requiring fulfillment or review
                </AdminCardDescription>
              </div>
              <Link
                href="/admin/orders"
                className="inline-flex items-center space-x-1.5 text-xs uppercase tracking-wider font-semibold text-brand-ink hover:text-brand-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </AdminCardHeader>

            {isLoading ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading recent orders...
              </div>
            ) : error || !data ? (
              <div className="p-8 text-center text-sm text-rose-800">
                Dashboard data could not be loaded.
              </div>
            ) : data.recentOrders.length === 0 ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                No orders recorded yet.
              </div>
            ) : (
              <AdminTable>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead>Order Number</AdminTableHead>
                    <AdminTableHead>Customer</AdminTableHead>
                    <AdminTableHead>Date</AdminTableHead>
                    <AdminTableHead>Status</AdminTableHead>
                    <AdminTableHead>Payment</AdminTableHead>
                    <AdminTableHead align="right">Total</AdminTableHead>
                    <AdminTableHead align="center">Action</AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {data.recentOrders.map((order) => (
                    <AdminTableRow key={order.orderNumber}>
                      <AdminTableCell className="font-mono font-semibold text-brand-ink">
                        {order.orderNumber}
                      </AdminTableCell>
                      <AdminTableCell className="font-medium text-brand-ink">
                        {order.customerName}
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap">
                        <AdminBadge variant={getOrderStatusBadgeVariant(order.status)}>
                          {order.statusLabel}
                        </AdminBadge>
                      </AdminTableCell>
                      <AdminTableCell className="text-brand-muted whitespace-nowrap">
                        {getPaymentLabel(order.paymentMethod)}
                      </AdminTableCell>
                      <AdminTableCell
                        align="right"
                        className="font-semibold text-brand-ink whitespace-nowrap"
                      >
                        PKR {order.grandTotal}
                      </AdminTableCell>
                      <AdminTableCell align="center" className="whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="inline-flex items-center px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-ink hover:bg-brand-surface-soft border border-brand-border rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
                        >
                          Details
                        </Link>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </AdminCard>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
