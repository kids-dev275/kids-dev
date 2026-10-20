import React from "react";
import type { Metadata } from "next";
import { fetchPublicSettings } from "@/lib/api";
import { StorefrontShell } from "@/components/shell/storefront-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Account — Kids Wear",
  description: "View your order history and manage your Kids Wear profile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchPublicSettings();

  return (
    <StorefrontShell storefront="mini-sprouts" announcement={settings?.announcement}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">{children}</div>
    </StorefrontShell>
  );
}
