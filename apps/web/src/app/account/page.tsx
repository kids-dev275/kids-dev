"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Package, User, ChevronRight, ShoppingBag, Clock } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { AccountShell } from "@/components/account/account-shell";
import { getCustomerOrders } from "@/lib/api";
import type { CustomerOrderListItem } from "@kids-wear/shared";
import { ORDER_STATUS_LABELS } from "@kids-wear/shared";
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
    });
  } catch {
    return iso;
  }
}

export default function AccountOverviewPage() {
  const { customer } = useCustomerAuth();
  const [recentOrders, setRecentOrders] = useState<CustomerOrderListItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadRecentOrders() {
      try {
        const res = await getCustomerOrders({ page: 1, limit: 3 });
        if (isMounted && res.success && res.data) {
          setRecentOrders(res.data.orders);
        }
      } catch {
        // Safe fallback to empty list
      } finally {
        if (isMounted) setLoadingOrders(false);
      }
    }

    if (customer) {
      loadRecentOrders();
    }
    return () => {
      isMounted = false;
    };
  }, [customer]);

  return (
    <AccountShell>
      <div className="space-y-8">
        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-accent-storefront" />
                <h2 className="font-editorial text-lg text-ink">Personal Profile</h2>
              </div>
              <Link
                href="/account/profile"
                className="text-xs font-semibold text-accent-storefront hover:underline"
              >
                Edit Profile &rarr;
              </Link>
            </div>

            <div className="space-y-2 text-sm font-sans">
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider block">Name</span>
                <span className="font-medium text-ink">{customer?.fullName}</span>
              </div>
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider block">
                  Email
                </span>
                <span className="font-medium text-ink">{customer?.email}</span>
              </div>
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider block">
                  Phone
                </span>
                <span className="font-medium text-ink">{customer?.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider block">
                  Account Status
                </span>
                <span className="text-ink font-medium">Active Customer</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-accent-storefront" />
                <h2 className="font-editorial text-lg text-ink">Storefront Quick Access</h2>
              </div>
              <p className="text-xs text-text-muted font-sans leading-relaxed">
                Explore our age-curated apparel collections for children, teens, and youth with fast
                10-day delivery across Pakistan.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button href="/mini-sprouts" variant="outline" size="sm">
                Mini Sprouts (0–10 Y)
              </Button>
              <Button href="/teen-studio" variant="outline" size="sm">
                Teen Studio (11–16 Y)
              </Button>
              <Button href="/aura-studio" variant="outline" size="sm">
                Aura Studio (17+ Y)
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent Orders Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-accent-storefront" />
              <h2 className="font-editorial text-xl text-ink">Recent Orders</h2>
            </div>
            {recentOrders.length > 0 && (
              <Link
                href="/account/orders"
                className="text-xs font-semibold text-accent-storefront hover:underline"
              >
                View All Orders &rarr;
              </Link>
            )}
          </div>

          {loadingOrders ? (
            <div className="py-12 flex justify-center" role="status" aria-busy="true">
              <LoadingSpinner size="md" label="Loading recent orders..." />
            </div>
          ) : recentOrders.length === 0 ? (
            <Card className="p-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center text-text-muted">
                <Package className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-editorial text-lg text-ink">No orders yet</h3>
                <p className="text-xs sm:text-sm text-text-muted font-sans max-w-sm mx-auto">
                  You haven&apos;t placed any orders with this account yet. Discover our latest
                  collections today.
                </p>
              </div>
              <Button href="/mini-sprouts" variant="primary" size="md">
                Start Shopping
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                return (
                  <Link
                    key={order.orderNumber}
                    href={`/account/orders/${order.orderNumber}`}
                    className="block group"
                  >
                    <Card
                      hoverable
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-semibold text-sm text-ink group-hover:text-accent-storefront transition-colors">
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

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="font-sans font-semibold text-sm text-ink">
                          {formatPrice(order.grandTotal)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-accent-storefront group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}
