import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Policy — Kids Wear Delivery Information",
  description:
    "Official Kids Wear shipping policy. Transparent information on our flat Pakistan-wide delivery fee and delivery within 10 days.",
  alternates: {
    canonical: "/shipping-policy",
  },
};

export default async function ShippingPolicyPage() {
  const settings = await fetchPublicSettings();
  const currentFlatRate = settings?.shipping?.flatDeliveryCharge;

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <PolicyContainer
        badge="Fulfillment & Shipping"
        title="Shipping & Delivery Policy"
        description="Comprehensive information regarding order delivery across Pakistan, our flat shipping rate structure, and fulfillment timelines."
        lastUpdated="Active Kids Wear Fulfillment Policy"
      >
        {/* Dynamic Delivery Charge Banner */}
        <div className="p-6 rounded-lg bg-surface border border-border shadow-subtle space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-storefront block">
            Current Delivery Rate
          </span>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
            <span className="font-editorial text-2xl sm:text-3xl text-ink font-normal">
              {currentFlatRate ? `PKR ${currentFlatRate}` : "Flat Rate per Order"}
            </span>
            <span className="text-xs sm:text-sm text-text-muted">
              Standard flat delivery charge applied once per entire order across all Pakistan
              destinations.
            </span>
          </div>
          {!currentFlatRate && (
            <p className="text-xs text-text-muted/80 pt-1">
              The exact active delivery charge is calculated and confirmed in your Order Summary
              prior to final checkout.
            </p>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            1. Pakistan-Wide Coverage
          </h2>
          <p>
            Kids Wear delivers to customer addresses across Pakistan. Whether you reside in major
            metropolitan centers (such as Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, or
            Peshawar) or regional districts and towns, our logistics network provides nationwide
            delivery.
          </p>
          <p>
            All domestic locations are covered under our flat-rate policy. We do not impose
            remote-area surcharges, regional zoning markups, or per-item shipping fees.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            2. Flat Delivery Charge Structure
          </h2>
          <p>
            A single flat delivery fee applies to each order, regardless of the number of items or
            different storefront collections (Mini Sprouts, Teen Studio, or Aura Studio) included in
            your cart:
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>One Charge per Order:</strong> You are charged once per checkout order, never
              per item or per package.
            </li>
            <li>
              <strong>Dynamic & Transparent:</strong> The current active delivery fee is configured
              by Kids Wear administration and is displayed transparently in your Cart and Checkout
              Order Summary before order confirmation.
            </li>
            <li>
              <strong>Historical Rate Preservation:</strong> The delivery charge applied at the
              exact moment you submit your order is permanently preserved in your order snapshot and
              receipt. Future adjustments to general shipping rates will never alter an existing
              placed order.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            3. Delivery Timeline
          </h2>
          <p>
            Delivery is available across Pakistan. A single flat delivery charge applies per order.
            The current delivery charge is shown before checkout. Delivery is expected within 10
            days.
          </p>
          <div className="p-4 rounded-lg bg-surface-soft border border-border text-sm leading-relaxed text-ink font-medium">
            Standard delivery across Pakistan is expected within 10 days of order confirmation.
          </div>
          <p className="text-sm text-text-muted">
            For Cash on Delivery (COD) orders, the delivery timeline begins once the order is placed
            and confirmed. For Manual Bank Transfer orders, the timeline begins once payment is
            verified by administration.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            4. Delivery Process & Payment Handling
          </h2>
          <p>Depending on your chosen payment method:</p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Cash on Delivery (COD):</strong> Please prepare the exact invoice total in
              cash for the courier rider upon delivery of your parcel.
            </li>
            <li>
              <strong>Manual Bank Transfer:</strong> Bank details and account credentials are
              provided directly during checkout. Once payment proof is reviewed by administration,
              your order status transitions to confirmed and is prepared for dispatch.
            </li>
          </ul>
          <p className="text-xs text-text-muted pt-2">
            Customers are responsible for providing an accurate street address, city, and active
            mobile phone number to ensure the delivery courier can reach you without delay.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            5. Inquiries & Assistance
          </h2>
          <p>
            If you have questions regarding an existing shipment, delivery updates, or address
            clarifications, please reach out directly to our team via our{" "}
            <Link href="/contact" className="text-accent-storefront underline hover:text-ink">
              Contact Page
            </Link>{" "}
            or email us at{" "}
            <a
              href="mailto:info@thekidswear.com"
              className="text-accent-storefront underline hover:text-ink"
            >
              info@thekidswear.com
            </a>
            .
          </p>
        </section>
      </PolicyContainer>
    </SharedStorefrontShell>
  );
}
