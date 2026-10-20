import React from "react";
import type { Metadata } from "next";
import { fetchPublicSettings } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { CartView } from "@/components/cart/cart-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping Bag — Kids Wear",
  description:
    "Review items in your Kids Wear shopping bag with live pricing and availability across all storefronts.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CartPage() {
  const settings = await fetchPublicSettings();

  return (
    <StorefrontShell storefront="mini-sprouts" announcement={settings?.announcement}>
      <CartView />
    </StorefrontShell>
  );
}
