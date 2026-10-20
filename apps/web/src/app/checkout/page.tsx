import React from "react";
import type { Metadata } from "next";
import { fetchPublicSettings } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { CheckoutView } from "@/components/checkout/checkout-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — Kids Wear",
  description: "Complete delivery details and select payment method for your Kids Wear order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage() {
  const settings = await fetchPublicSettings();

  return (
    <StorefrontShell storefront="mini-sprouts" announcement={settings?.announcement}>
      <CheckoutView />
    </StorefrontShell>
  );
}
