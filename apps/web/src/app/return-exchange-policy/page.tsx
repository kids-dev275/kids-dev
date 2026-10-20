import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Return & Exchange Policy — Kids Wear Customer Care",
  description:
    "Current status and customer guidance regarding returns, exchanges, and order inquiries at Kids Wear.",
  alternates: {
    canonical: "/return-exchange-policy",
  },
};

export default async function ReturnExchangePolicyPage() {
  const settings = await fetchPublicSettings();

  return (
    <StorefrontShell storefront="mini-sprouts" announcement={settings?.announcement}>
      <PolicyContainer
        badge="Customer Care"
        title="Return & Exchange Policy"
        description="Information regarding returns, product exchanges, and customer support for orders placed with Kids Wear."
        lastUpdated="Status: Terms Currently Being Finalized"
      >
        <div className="p-6 rounded-lg bg-surface-soft border border-border space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-storefront block">
            Policy Notice
          </span>
          <p className="font-editorial text-lg sm:text-xl text-ink font-normal">
            Detailed Return and Exchange Terms Are Currently Being Finalized
          </p>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            Kids Wear is currently formalizing its comprehensive return, exchange, and
            item-condition guidelines to best serve families across Pakistan. In the interim, all
            customer inquiries, fit questions, or order concerns are addressed directly and
            individually by our customer care team.
          </p>
        </div>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Order Inquiries & Concerns
          </h2>
          <p>
            If you have a concern about a damaged or incorrect item, please contact Kids Wear by
            phone or email with your order details.
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-sm text-text-base/90">
            <li>
              <strong>Pre-Purchase Sizing Guidance:</strong> Detailed measurements and size guide
              tables are available on product pages. We encourage customers to review these
              measurements prior to placing an order.
            </li>
            <li>
              <strong>Direct Communication:</strong> If you have questions regarding your order or
              the condition of a received item, reach out to our team with your Order Number for
              assistance.
            </li>
            <li>
              <strong>Individual Attention:</strong> Each inquiry is reviewed directly by our team
              to assist you.
            </li>
          </ul>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Contacting Support
          </h2>
          <p>
            For any questions regarding a delivered package, garment condition, or sizing
            clarification, please reach out to us using our confirmed contact channels:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-surface border border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink block mb-1">
                Telephone Support
              </span>
              <a
                href="tel:+923350981321"
                className="text-sm font-semibold text-accent-storefront hover:underline"
              >
                +92 335 0981 321
              </a>
              <p className="text-xs text-text-muted mt-1">Direct assistance for existing orders</p>
            </div>

            <div className="p-4 rounded-lg bg-surface border border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink block mb-1">
                Email Support
              </span>
              <a
                href="mailto:info@thekidswear.com"
                className="text-sm font-semibold text-accent-storefront hover:underline break-all"
              >
                info@thekidswear.com
              </a>
              <p className="text-xs text-text-muted mt-1">
                Please include your Order Number (e.g., KW-1001)
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Updates & Publication
          </h2>
          <p className="text-sm text-text-muted">
            Once formal return and exchange guidelines are ratified by Kids Wear operations and
            legal review, the full policy terms will be published directly on this page. We
            appreciate your patience and trust as we build our generational apparel experience.
          </p>
          <div className="pt-2">
            <Link href="/" className="text-xs font-semibold text-accent-storefront hover:underline">
              &larr; Return to Kids Wear Home
            </Link>
          </div>
        </section>
      </PolicyContainer>
    </StorefrontShell>
  );
}
