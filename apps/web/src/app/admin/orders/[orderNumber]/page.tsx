"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminOrder, updateAdminOrderStatus } from "@/lib/admin-api";
import type { AdminOrderDetailData, OrderStatusType } from "@kids-wear/shared";
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Clock,
  Truck,
  User,
  MapPin,
  FileText,
  CreditCard,
  Ban,
  RefreshCw,
} from "lucide-react";

export default function AdminOrderDetailPage() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber;

  const [order, setOrder] = useState<AdminOrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderNumber) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getAdminOrder(orderNumber);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setErrorMessage(res.error?.message || "Order not found");
      }
    } catch {
      setErrorMessage("Network error while loading order details.");
    } finally {
      setIsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await fetchOrder();
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [fetchOrder]);

  const handleStatusTransition = async (targetStatus: OrderStatusType) => {
    if (!order) return;

    if (targetStatus === "CANCELLED") {
      const confirmed = confirm(
        `Are you sure you want to cancel order ${order.orderNumber}? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateAdminOrderStatus(order.orderNumber, targetStatus);
      if (res.success && res.data) {
        setSuccessMessage(`Order status updated to ${res.data.statusLabel}.`);
        await fetchOrder();
      } else {
        setErrorMessage(res.error?.message || `Failed to transition status to ${targetStatus}.`);
        // Refresh detail to reconcile current authoritative state
        await fetchOrder();
      }
    } catch {
      setErrorMessage("Network error while updating order status.");
      await fetchOrder();
    } finally {
      setIsMutating(false);
    }
  };

  const getStatusBadge = (orderStatus: string) => {
    switch (orderStatus) {
      case "ORDER_RECEIVED":
      case "AWAITING_PAYMENT":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "CONFIRMED":
      case "IN_PRODUCTION":
      case "READY_TO_SHIP":
        return "bg-blue-50 text-blue-800 border-blue-300";
      case "SHIPPED":
        return "bg-indigo-50 text-indigo-800 border-indigo-300";
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "CANCELLED":
        return "bg-rose-50 text-rose-800 border-rose-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center text-xs uppercase tracking-wider text-brand-muted font-medium">
            Loading order details...
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  if (!order) {
    return (
      <AdminGuard>
        <AdminShell>
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h2 className="font-heading text-lg font-bold uppercase text-brand-ink">
              Order Not Found
            </h2>
            <p className="text-xs text-brand-muted mt-1">
              Order #{orderNumber} does not exist in the system.
            </p>
            <Link
              href="/admin/orders"
              className="inline-flex items-center space-x-1.5 mt-4 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-brand-primary border border-brand-sand rounded-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Orders</span>
            </Link>
          </div>
        </AdminShell>
      </AdminGuard>
    );
  }

  // Determine allowed operational actions
  const isTerminal = order.status === "DELIVERED" || order.status === "CANCELLED";
  const canCancel = !isTerminal && order.status !== "SHIPPED";

  return (
    <AdminGuard>
      <AdminShell>
        <div className="space-y-6 max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-sand pb-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/admin/orders"
                className="p-1.5 text-brand-muted hover:text-brand-ink rounded-sm border border-brand-sand bg-white"
                aria-label="Back to Orders"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-brand-ink font-mono">
                    {order.orderNumber}
                  </h1>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    {order.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Placed on{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-PK", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchOrder}
              disabled={isMutating}
              className="p-2 border border-brand-sand rounded-sm text-brand-muted hover:text-brand-ink bg-white"
              title="Refresh order"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
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
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-start space-x-2 text-emerald-800 text-xs"
              role="status"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SECTION: STATUS MANAGEMENT ACTION BAR */}
          <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs space-y-3">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-ink">
              Fulfillment & Payment Workflow Actions
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              {/* Bank Transfer Confirmation */}
              {order.paymentMethod === "BANK_TRANSFER" && order.status === "AWAITING_PAYMENT" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("CONFIRMED")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Confirm Payment / Confirm Order"}
                </button>
              )}

              {/* COD Confirmation */}
              {order.paymentMethod === "CASH_ON_DELIVERY" && order.status === "ORDER_RECEIVED" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("CONFIRMED")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Confirm Order"}
                </button>
              )}

              {/* Progression: CONFIRMED -> IN_PRODUCTION */}
              {order.status === "CONFIRMED" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("IN_PRODUCTION")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Send to Production"}
                </button>
              )}

              {/* Progression: IN_PRODUCTION -> READY_TO_SHIP */}
              {order.status === "IN_PRODUCTION" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("READY_TO_SHIP")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Mark Ready to Ship"}
                </button>
              )}

              {/* Progression: READY_TO_SHIP -> SHIPPED */}
              {order.status === "READY_TO_SHIP" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("SHIPPED")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Dispatch / Mark Shipped"}
                </button>
              )}

              {/* Progression: SHIPPED -> DELIVERED */}
              {order.status === "SHIPPED" && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("DELIVERED")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isMutating ? "Processing..." : "Mark Delivered"}
                </button>
              )}

              {/* Admin Cancellation */}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition("CANCELLED")}
                  disabled={isMutating}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-sm disabled:opacity-50 transition-colors"
                >
                  Cancel Order
                </button>
              )}

              {isTerminal && (
                <span className="text-xs text-brand-muted font-medium">
                  This order is in a terminal state ({order.statusLabel}) and cannot transition
                  further.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left 2 Cols: Items & Financials */}
            <div className="md:col-span-2 space-y-6">
              {/* Order Items Snapshot */}
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                  Order Items ({order.items.reduce((s, i) => s + i.quantity, 0)} pieces)
                </h2>

                <div className="divide-y divide-brand-sand/60">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-start space-x-3 text-xs">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          className="w-14 h-16 object-cover border border-brand-sand rounded-xs shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-16 bg-brand-sand/30 flex items-center justify-center text-brand-muted rounded-xs shrink-0">
                          <ShoppingBag className="w-5 h-5 opacity-40" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-brand-ink">{item.productName}</div>
                        <div className="font-mono text-[11px] text-brand-muted mt-0.5">
                          SKU: {item.productSku}
                        </div>
                        <div className="text-[11px] text-brand-muted mt-0.5">
                          Size: <span className="font-medium text-brand-ink">{item.sizeLabel}</span>{" "}
                          • Color:{" "}
                          <span className="font-medium text-brand-ink">{item.colorName}</span>
                        </div>
                        <div className="text-[11px] text-brand-muted mt-1">
                          Qty: <span className="font-semibold text-brand-ink">{item.quantity}</span>{" "}
                          × PKR {item.unitPrice}
                        </div>
                      </div>

                      <div className="text-right font-semibold text-brand-ink whitespace-nowrap">
                        PKR {item.lineSubtotal}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-4 border-t border-brand-sand space-y-1.5 text-xs">
                  <div className="flex justify-between text-brand-muted">
                    <span>Subtotal</span>
                    <span>PKR {order.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-brand-muted">
                    <span>Flat Delivery Charge</span>
                    <span>PKR {order.deliveryCharge}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-brand-ink pt-2 border-t border-brand-sand">
                    <span>Grand Total</span>
                    <span>PKR {order.grandTotal}</span>
                  </div>
                </div>
              </div>

              {/* Status History Timeline */}
              <div className="bg-white p-6 border border-brand-sand rounded-sm shadow-xs space-y-4">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-ink border-b border-brand-sand pb-2">
                  Status History & Audit Trail
                </h2>

                <div className="space-y-4">
                  {order.statusHistory.map((hist, index) => (
                    <div key={hist.id} className="flex items-start space-x-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-brand-ink">{hist.statusLabel}</span>
                          <span className="text-[11px] text-brand-muted">
                            {new Date(hist.changedAt).toLocaleString("en-PK", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {hist.changedByAdminEmail ? (
                          <p className="text-[10px] text-brand-muted mt-0.5">
                            Actioned by Admin: {hist.changedByAdminEmail}
                          </p>
                        ) : index === 0 ? (
                          <p className="text-[10px] text-brand-muted mt-0.5">
                            Initial order placement (System / Customer)
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Customer & Delivery Snapshot */}
            <div className="space-y-6">
              {/* Customer Details */}
              <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs space-y-3 text-xs">
                <div className="border-b border-brand-sand pb-2 flex items-center space-x-2">
                  <User className="w-4 h-4 text-brand-primary" />
                  <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-ink">
                    Customer Info
                  </h2>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-brand-ink">{order.customer.fullName}</div>
                  <div className="text-brand-muted">{order.customer.phone}</div>
                  {order.customer.email && (
                    <div className="text-brand-muted break-all">{order.customer.email}</div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs space-y-3 text-xs">
                <div className="border-b border-brand-sand pb-2 flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-brand-primary" />
                  <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-ink">
                    Delivery Address
                  </h2>
                </div>

                <div className="space-y-1 text-brand-ink">
                  <div>{order.customer.address}</div>
                  <div>
                    {order.customer.city}, {order.customer.province}
                  </div>
                  {order.customer.postalCode && (
                    <div className="text-brand-muted">Postal Code: {order.customer.postalCode}</div>
                  )}
                </div>

                {order.customer.orderNotes && (
                  <div className="pt-2 border-t border-brand-sand/60">
                    <span className="text-[10px] uppercase font-semibold text-brand-muted block">
                      Customer Delivery Note:
                    </span>
                    <p className="text-[11px] text-brand-ink italic mt-0.5">
                      &quot;{order.customer.orderNotes}&quot;
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Info */}
              <div className="bg-white p-5 border border-brand-sand rounded-sm shadow-xs space-y-3 text-xs">
                <div className="border-b border-brand-sand pb-2 flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-brand-primary" />
                  <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-ink">
                    Payment Method
                  </h2>
                </div>

                <div>
                  <span className="font-semibold text-brand-ink block">
                    {order.paymentMethod === "CASH_ON_DELIVERY"
                      ? "Cash on Delivery (COD)"
                      : "Manual Bank Transfer"}
                  </span>
                  <span className="text-[11px] text-brand-muted mt-1 block">
                    {order.paymentMethod === "CASH_ON_DELIVERY"
                      ? "Payment collected in cash by courier at time of physical parcel delivery."
                      : "Customer instructed to deposit payment directly into designated company bank account."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
