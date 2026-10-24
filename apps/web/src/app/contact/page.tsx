import React from "react";
import type { Metadata } from "next";
import { Phone, Mail, MapPin } from "lucide-react";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us — Kids Wear Customer Support",
  description:
    "Get in touch with Kids Wear customer care. Official contact details for order questions, sizing guidance, and delivery support.",
  alternates: {
    canonical: "/contact",
  },
};

export default async function ContactPage() {
  const settings = await fetchPublicSettings();

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <PolicyContainer
        wide
        badge="Customer Support"
        title="Contact Kids Wear"
        description="We are here to help with your orders, sizing guidance, and product inquiries. Reach out to our dedicated team using our confirmed contact channels below."
      >
        <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2 lg:grid-cols-3">
          {/* Phone Card */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-subtle">
            <div>
              <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
                <Phone className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-editorial text-lg text-ink font-normal mb-1">
                Telephone Support
              </h2>
              <p className="font-sans text-xs text-text-muted mb-4">
                Direct phone inquiries for orders & sizing
              </p>
              <p className="font-sans text-base font-semibold text-ink">+92 335 0981 321</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <a
                href="tel:+923350981321"
                className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-accent-storefront hover:underline"
              >
                <span>Call +92 335 0981 321</span>
              </a>
            </div>
          </div>

          {/* Email Card */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-subtle">
            <div>
              <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-editorial text-lg text-ink font-normal mb-1">Email Inquiries</h2>
              <p className="font-sans text-xs text-text-muted mb-4">
                Written support & order assistance
              </p>
              <p className="whitespace-nowrap font-sans text-sm font-semibold text-ink sm:text-base">
                info@thekidswear.com
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50">
              <a
                href="mailto:info@thekidswear.com"
                className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-accent-storefront hover:underline"
              >
                <span>Email info@thekidswear.com</span>
              </a>
            </div>
          </div>

          {/* Business Address Card */}
          <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-surface p-6 shadow-subtle">
            <div>
              <div className="h-10 w-10 rounded-full bg-surface-soft border border-border flex items-center justify-center text-accent-storefront mb-4">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-editorial text-lg text-ink font-normal mb-4">Business Address</h2>
              <address className="font-sans text-xs sm:text-sm text-text-base/80 not-italic leading-relaxed">
                Street-05
                <br />
                Darul Islam Colony
                <br />
                Attock, Pakistan
              </address>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50 text-xs text-text-muted">
              Attock, Punjab, Pakistan
            </div>
          </div>
        </div>

        <section className="space-y-4 pt-6 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Order & Service Inquiries
          </h2>
          <p>
            When contacting our support team regarding an existing order, please have your Kids Wear
            Order Number (e.g., <span className="font-mono text-xs font-semibold">KW-1001</span>)
            and contact details ready to help us assist you quickly.
          </p>
          <div className="p-4 rounded-lg bg-surface-soft border border-border text-xs sm:text-sm text-text-muted leading-relaxed">
            Note: We currently do not offer an online contact form or real-time live chat. Direct
            communication via telephone and email ensures every request receives personal attention
            from our team.
          </div>
        </section>
      </PolicyContainer>
    </SharedStorefrontShell>
  );
}
