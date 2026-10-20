"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Truck,
} from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { getCustomerOrder } from "@/lib/api";
import type { CustomerOrderDetailData } from "@kids-wear/shared";
import { PAYMENT_METHODS } from "@kids-wear/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/feedback";

function formatPrice(amount: string | number): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num)) return `Rs. ${amount}`;
  return `Rs. ${Math.round(num).toLocaleString()}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AccountOrderDetailPage() {
  const params = useParams();
  const orderNumber = (params?.orderNumber as string) || "";

  const [order, setOrder] = useState<CustomerOrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchOrder() {
      if (!orderNumber) {
        setError("Invalid order number");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await getCustomerOrder(orderNumber);
        if (!isMounted) return;

        if (res.success) {
          setOrder(res.data);
        } else {
          setError(
            res.error.code === "ORDER_NOT_FOUND"
              ? "Order not found. It may have been placed under a different account or as a guest."
              : res.error.message || "Failed to load order details."
          );
        }
      } catch {
        if (isMounted) {
          setError("A network error occurred while loading order details.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderNumber]);

  const deliveryChargeNum = order ? parseFloat(order.deliveryCharge) : 0;
  const deliveryDisplay = deliveryChargeNum === 0 ? "Free" : formatPrice(order!.deliveryCharge);

  return (
    <AccountShell>
      <div className="space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-sans font-medium text-text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Orders</span>
          </Link>
        </div>

        {loading ? (
          <div
            className="py-20 flex flex-col items-center justify-center"
            role="status"
            aria-busy="true"
          >
            <LoadingSpinner size="lg" label="Loading order details..." />
            <p className="mt-3 text-xs sm:text-sm text-text-muted font-sans">
              Retrieving order snapshots...
            </p>
          </div>
        ) : error || !order ? (
          <Card className="p-8 sm:p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#fbeeed] flex items-center justify-center text-danger">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-editorial text-xl text-ink">Order Not Found</h2>
              <p className="text-xs sm:text-sm text-text-muted font-sans max-w-md mx-auto">
                {error || "We could not find the order you requested."}
              </p>
            </div>
            <div className="pt-2">
              <Button href="/account/orders" variant="primary">
                Return to Order History
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Order Header Summary */}
            <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-normal">
                    Order {order.orderNumber}
                  </h1>
                  <Badge variant="neutral" size="md">
                    {order.statusLabel}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-text-muted font-sans flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-xs uppercase tracking-wider text-text-muted font-sans block">
                  Total Amount
                </span>
                <span className="font-sans font-bold text-2xl text-ink">
                  {formatPrice(order.grandTotal)}
                </span>
              </div>
            </div>

            {/* Main Content Grid: Items (Left) & Delivery/Payment (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left 2 Cols: Purchased Items Snapshot & Timeline */}
              <div className="lg:col-span-2 space-y-8">
                {/* Order Items Card */}
                <Card className="p-6 space-y-5">
                  <h2 className="font-editorial text-lg text-ink">
                    Purchased Items ({order.items.length})
                  </h2>

                  <div className="divide-y divide-border">
                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        className="py-4 first:pt-0 last:pb-0 flex gap-4 items-center"
                      >
                        {item.thumbnailUrl ? (
                          <div className="h-16 w-16 rounded-md bg-surface-soft overflow-hidden shrink-0 border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.thumbnailUrl}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-surface-soft flex items-center justify-center shrink-0 border border-border text-text-muted">
                            <Package className="h-6 w-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-sans font-semibold text-sm text-ink truncate">
                            {item.productName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted font-sans">
                            <span>
                              Size:{" "}
                              <strong className="text-ink font-medium">{item.sizeLabel}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Color:{" "}
                              <strong className="text-ink font-medium">{item.colorName}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Qty: <strong className="text-ink font-medium">{item.quantity}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-sans font-semibold text-sm text-ink block">
                            {formatPrice(item.lineSubtotal)}
                          </span>
                          <span className="text-[11px] text-text-muted font-sans">
                            {formatPrice(item.unitPrice)} each
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="pt-4 border-t border-border space-y-2 text-sm font-sans">
                    <div className="flex justify-between text-text-muted">
                      <span>Items Subtotal</span>
                      <span className="text-ink font-medium">{formatPrice(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Delivery Fee</span>
                      <span className="text-ink font-medium">{deliveryDisplay}</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between font-semibold text-base text-ink">
                      <span>Total Amount</span>
                      <span>{formatPrice(order.grandTotal)}</span>
                    </div>
                  </div>
                </Card>

                {/* Status Progression Timeline */}
                <Card className="p-6 space-y-5">
                  <h2 className="font-editorial text-lg text-ink">Status History</h2>

                  <div className="space-y-4">
                    {order.timeline.map((entry, idx) => {
                      const isLatest = idx === order.timeline.length - 1;

                      return (
                        <div key={idx} className="flex gap-3 relative">
                          {idx !== order.timeline.length - 1 && (
                            <span
                              className="absolute left-2.5 top-5 -bottom-4 w-0.5 bg-border"
                              aria-hidden="true"
                            />
                          )}
                          <div
                            className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                              isLatest
                                ? "bg-accent-storefront text-white ring-4 ring-accent-storefront/20"
                                : "bg-surface-soft text-text-muted border border-border"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </div>

                          <div className="flex-1 space-y-0.5 pb-2">
                            <div className="flex items-center justify-between">
                              <span className="font-sans font-semibold text-xs sm:text-sm text-ink">
                                {entry.statusLabel}
                              </span>
                              <span className="text-[11px] text-text-muted font-sans">
                                {formatDate(entry.changedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Right Col: Delivery Details & Payment Info */}
              <div className="space-y-6">
                {/* Delivery Snapshot */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-accent-storefront" />
                    <h2 className="font-editorial text-lg text-ink">Delivery Details</h2>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm font-sans">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-text-muted block">
                        Recipient
                      </span>
                      <span className="font-medium text-ink">{order.customer.fullName}</span>
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-wider text-text-muted block">
                        Phone
                      </span>
                      <span className="font-medium text-ink">{order.customer.phone}</span>
                    </div>

                    {order.customer.email && (
                      <div>
                        <span className="text-xs uppercase tracking-wider text-text-muted block">
                          Email
                        </span>
                        <span className="font-medium text-ink">{order.customer.email}</span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs uppercase tracking-wider text-text-muted block">
                        Shipping Address
                      </span>
                      <p className="font-medium text-ink leading-relaxed">
                        {order.customer.address}
                        <br />
                        {order.customer.city}, {order.customer.province}
                        {order.customer.postalCode ? ` ${order.customer.postalCode}` : ""}
                      </p>
                    </div>

                    {order.customer.orderNotes && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs uppercase tracking-wider text-text-muted block">
                          Delivery Notes
                        </span>
                        <p className="italic text-text-muted mt-0.5">{order.customer.orderNotes}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Payment Method Snapshot */}
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-accent-storefront" />
                    <h2 className="font-editorial text-lg text-ink">Payment Method</h2>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Method</span>
                      <span className="font-medium text-ink">
                        {order.paymentMethod === PAYMENT_METHODS.CASH_ON_DELIVERY
                          ? "Cash on Delivery (COD)"
                          : "Manual Bank Transfer"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Status</span>
                      <span className="font-medium text-ink">{order.statusLabel}</span>
                    </div>
                  </div>
                </Card>

                {/* Fulfillment Timeline Notice */}
                <Card className="p-6 space-y-3 bg-surface-soft border-border/80">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-accent-storefront" />
                    <h3 className="font-editorial text-base text-ink">Delivery Promise</h3>
                  </div>
                  <p className="text-xs text-text-muted font-sans leading-relaxed">
                    All Kids Wear orders are custom-tailored with premium fabrics and delivered to
                    your doorstep within 10 days across Pakistan.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccountShell>
  );
}
