"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { getCustomerOrders } from "@/lib/api";
import type { CustomerOrderListItem, CustomerOrdersResponseData } from "@kids-wear/shared";
import { ORDER_STATUS_LABELS } from "@kids-wear/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, LoadingSpinner } from "@/components/ui/feedback";

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
    });
  } catch {
    return iso;
  }
}

function OrdersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPage = searchParams.get("page");
  const currentPage = rawPage ? Math.max(1, parseInt(rawPage, 10) || 1) : 1;

  const [data, setData] = useState<CustomerOrdersResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCustomerOrders({ page, limit: 10 });
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error.message || "Unable to load order history.");
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchPage = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await loadOrders(currentPage);
    };
    void fetchPage();
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    router.push(`/account/orders?page=${newPage}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal">Order History</h2>
          <p className="text-xs sm:text-sm text-text-muted font-sans mt-0.5">
            View details, item snapshots, and delivery timelines for all your orders.
          </p>
        </div>
        {data && data.pagination.totalOrders > 0 && (
          <span className="text-xs font-sans text-text-muted">
            {data.pagination.totalOrders}{" "}
            {data.pagination.totalOrders === 1 ? "order" : "total orders"}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="error" title="Error Loading Orders">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => loadOrders(currentPage)}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div
          className="py-16 flex flex-col items-center justify-center"
          role="status"
          aria-busy="true"
        >
          <LoadingSpinner size="md" label="Loading orders..." />
          <p className="mt-3 text-xs text-text-muted font-sans">Fetching your orders...</p>
        </div>
      ) : !data || data.orders.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-text-muted">
            <Package className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-editorial text-lg text-ink">No orders yet</h3>
            <p className="text-xs sm:text-sm text-text-muted font-sans max-w-sm mx-auto leading-relaxed">
              When you place an order while signed in to your account, you will see its details,
              historical items snapshot, and status progression here.
            </p>
          </div>
          <div className="pt-2">
            <Button href="/mini-sprouts" variant="primary">
              Explore Collections
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {data.orders.map((order) => {
              return (
                <Link
                  key={order.orderNumber}
                  href={`/account/orders/${order.orderNumber}`}
                  className="block group"
                >
                  <Card
                    hoverable
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-sans font-semibold text-sm sm:text-base text-ink group-hover:text-accent-storefront transition-colors">
                          {order.orderNumber}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {order.statusLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted font-sans">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span>•</span>
                        <span>
                          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <span className="font-sans font-semibold text-base text-ink">
                        {formatPrice(order.grandTotal)}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-accent-storefront">
                        <span>Details</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!data.pagination.hasPrevPage}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>

              <span className="text-xs font-sans text-text-muted">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!data.pagination.hasNextPage}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <AccountShell>
      <Suspense
        fallback={
          <div className="py-16 flex justify-center" role="status" aria-busy="true">
            <LoadingSpinner size="md" label="Loading order history..." />
          </div>
        }
      >
        <OrdersListContent />
      </Suspense>
    </AccountShell>
  );
}
