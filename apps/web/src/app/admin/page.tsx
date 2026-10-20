"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboard } from "@/lib/admin-api";
import type { AdminDashboardData } from "@kids-wear/shared";
import {
  Package,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ORDER_RECEIVED":
      case "AWAITING_PAYMENT":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "CONFIRMED":
      case "IN_PRODUCTION":
      case "READY_TO_SHIP":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "SHIPPED":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getPaymentLabel = (method: string) => {
    return method === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "Bank Transfer";
  };

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-ink uppercase">
                Dashboard Overview
              </h1>
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                Current commerce metrics and active orders
              </p>
            </div>
            <button
              type="button"
              onClick={fetchDashboard}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold border border-brand-sand bg-white hover:bg-brand-sand/30 rounded-sm text-brand-ink transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
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

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Products */}
            <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
                  Total Products
                </span>
                <span
                  data-testid="metric-total-products"
                  className="font-heading text-2xl font-bold text-brand-ink mt-1 block"
                >
                  {isLoading ? "—" : (data?.totalProducts ?? 0)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-sand/40 flex items-center justify-center text-brand-primary">
                <Package className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            {/* 2. Total Orders */}
            <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
                  Total Orders
                </span>
                <span
                  data-testid="metric-total-orders"
                  className="font-heading text-2xl font-bold text-brand-ink mt-1 block"
                >
                  {isLoading ? "—" : (data?.totalOrders ?? 0)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            {/* 3. Active Orders */}
            <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
                  Active Orders
                </span>
                <span
                  data-testid="metric-active-orders"
                  className="font-heading text-2xl font-bold text-emerald-700 mt-1 block"
                >
                  {isLoading ? "—" : (data?.activeOrders ?? 0)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            {/* 4. Unavailable Variants */}
            <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
                  Unavailable Variants
                </span>
                <span
                  data-testid="metric-unavailable-variants"
                  className="font-heading text-2xl font-bold text-amber-700 mt-1 block"
                >
                  {isLoading ? "—" : (data?.unavailableVariants ?? 0)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Operational Section: Recent Orders */}
          <div className="bg-white border border-brand-sand rounded-sm shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-brand-sand flex items-center justify-between">
              <div>
                <h2 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-ink">
                  Recent Orders
                </h2>
                <p className="text-[11px] uppercase tracking-wider text-brand-muted mt-0.5">
                  Latest customer orders requiring fulfillment or review
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="inline-flex items-center space-x-1 text-xs uppercase tracking-wider font-semibold text-brand-primary hover:text-brand-primary/80"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                Loading recent orders...
              </div>
            ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
              <div className="p-8 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
                No orders recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brand-canvas/50 border-b border-brand-sand text-[11px] uppercase tracking-wider text-brand-muted font-semibold">
                      <th className="py-3 px-4">Order Number</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/60">
                    {data.recentOrders.map((order) => (
                      <tr
                        key={order.orderNumber}
                        className="hover:bg-brand-sand/20 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-brand-ink">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-brand-ink">
                          {order.customerName}
                        </td>
                        <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString("en-PK", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeClass(
                              order.status
                            )}`}
                          >
                            {order.statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-brand-muted whitespace-nowrap">
                          {getPaymentLabel(order.paymentMethod)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-brand-ink whitespace-nowrap">
                          PKR {order.grandTotal}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${order.orderNumber}`}
                            className="inline-flex items-center px-2 py-1 text-[11px] uppercase tracking-wider font-semibold text-brand-primary hover:bg-brand-sand/40 border border-brand-sand rounded-sm"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
