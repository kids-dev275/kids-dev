import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OrderSuccessClientView } from "./order-success-client";
import { fetchPublicSettings } from "@/lib/api";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Success | Kids Wear",
  description: "Your order has been successfully placed with Kids Wear.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderSuccessPage() {
  const settings = await fetchPublicSettings();

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <div className="min-h-[70vh] bg-surface flex flex-col justify-center">
        <Suspense
          fallback={
            <div className="py-24 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent mx-auto" />
              <p className="font-sans text-xs text-text-muted mt-3">
                Loading order confirmation...
              </p>
            </div>
          }
        >
          <OrderSuccessClientView />
        </Suspense>
      </div>
    </SharedStorefrontShell>
  );
}
