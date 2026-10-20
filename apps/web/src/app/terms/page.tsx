import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service — Kids Wear Operational Terms",
  description:
    "Terms of service governing use of Kids Wear, our age storefronts, ordering, and customer responsibilities.",
  alternates: {
    canonical: "/terms",
  },
};

export default async function TermsPage() {
  const settings = await fetchPublicSettings();

  return (
    <StorefrontShell storefront="mini-sprouts" announcement={settings?.announcement}>
      <PolicyContainer
        badge="Platform Terms"
        title="Terms of Service"
        description="These operational terms govern your access to and use of Kids Wear, our three age-based storefronts, and our order fulfillment services."
        lastUpdated="Effective for Kids Wear V1 Platform"
      >
        <section className="space-y-4">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            1. Platform & Storefront Identity
          </h2>
          <p>
            Kids Wear is an apparel e-commerce business operating in Pakistan. Our platform
            organizes apparel into three age-specific storefronts:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Mini Sprouts:</strong> 0–10 Years (Infants, Toddlers, and Children)
            </li>
            <li>
              <strong>Teen Studio:</strong> 11–16 Years (Teens)
            </li>
            <li>
              <strong>Aura Studio:</strong> 17+ Years (Young Adults and Beyond)
            </li>
          </ul>
          <p className="text-sm">
            All storefronts share a unified cart, checkout engine, and fulfillment process based in
            Attock, Pakistan.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            2. Product Information & Availability
          </h2>
          <p>
            Product variants operate on boolean availability: each specific Size and Color
            combination is either <strong>Available</strong> or <strong>Unavailable</strong> for
            order. If a selected variant is not active, the combination is currently unavailable.
          </p>
          <p>
            While we strive to display current availability and accurate product details, final
            variant availability and current prices are verified server-side at the time your
            checkout request is submitted.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            3. Pricing, Cart & Checkout
          </h2>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Currency:</strong> All prices displayed on our website are denominated in
              Pakistani Rupees (PKR).
            </li>
            <li>
              <strong>Flat Delivery Charge:</strong> A flat delivery fee applies per completed
              order, regardless of item count. The active rate is calculated and displayed
              transparently in your Order Summary before confirmation.
            </li>
            <li>
              <strong>Guest Checkout:</strong> Customer account creation is completely optional. You
              may check out as a guest without creating an account.
            </li>
            <li>
              <strong>Order Confirmation:</strong> An order is created once you complete the
              checkout step and a sequential Order Number (e.g., KW-1001) is generated.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            4. Payment Terms
          </h2>
          <p>Kids Wear accepts two payment methods in V1:</p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Cash on Delivery (COD):</strong> Payment is collected in cash by the courier
              rider at the time of parcel delivery. Please have the exact order amount ready.
            </li>
            <li>
              <strong>Manual Bank Transfer:</strong> Official Kids Wear bank credentials and payment
              instructions are displayed upon checkout. Bank transfer orders remain in an
              awaiting-payment state until payment proof is verified by our administration, after
              which the order is confirmed and scheduled for dispatch.
            </li>
          </ul>
          <p className="text-xs text-text-muted">
            Payment methods are Cash on Delivery and Manual Bank Transfer. There is no online
            card-payment gateway.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            5. Customer Information & Delivery Responsibilities
          </h2>
          <p>
            When placing an order, you agree to provide complete, accurate, and current contact and
            delivery details, including:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-sm text-text-base/90">
            <li>Your complete legal name.</li>
            <li>An active, reachable mobile phone number.</li>
            <li>A precise physical delivery address with city and province in Pakistan.</li>
          </ul>
          <p className="text-sm">
            Kids Wear cannot be held responsible for delayed delivery or failed courier attempts
            resulting from incomplete addresses, unreachable telephone numbers, or recipient
            absence.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            6. Customer Accounts
          </h2>
          <p>If you create an optional customer account:</p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              You are responsible for maintaining the confidentiality of your login credentials.
            </li>
            <li>
              Your account dashboard displays orders placed while logged in. Orders previously
              placed as a guest prior to account registration are not retroactively attached to
              newly registered accounts.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            7. Product Reviews & User Content
          </h2>
          <p>
            When submitting a review for a Kids Wear garment, you agree that your submission
            reflects your honest experience. All reviews undergo moderation prior to publication.
            Kids Wear reserves the right to approve, hide, or remove reviews that violate content
            decency, contain spam, or include irrelevant materials. Published reviews are genuine
            customer opinions and are not tied to confirmed transactions or commercial endorsements.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            8. Contact & Notice
          </h2>
          <p>
            For questions regarding these operational terms or to resolve an inquiry regarding your
            order, please contact us:
          </p>
          <address className="not-italic p-4 rounded-lg bg-surface-soft border border-border text-sm leading-relaxed">
            <span className="font-semibold text-ink block">Kids Wear</span>
            Street-05, Darul Islam Colony, Attock, Pakistan
            <br />
            Telephone:{" "}
            <a href="tel:+923350981321" className="text-accent-storefront underline hover:text-ink">
              +92 335 0981 321
            </a>
            <br />
            Email:{" "}
            <a
              href="mailto:info@thekidswear.com"
              className="text-accent-storefront underline hover:text-ink"
            >
              info@thekidswear.com
            </a>
          </address>
        </section>
      </PolicyContainer>
    </StorefrontShell>
  );
}
