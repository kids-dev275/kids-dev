import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SharedStorefrontShell } from "@/components/shell/storefront-shell";
import { PolicyContainer } from "@/components/layout/policy-container";
import { fetchPublicSettings } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Kids Wear — Generational Children's & Youth Apparel",
  description:
    "Learn about Kids Wear, our three age-dedicated storefronts, and Pakistan-wide delivery.",
  alternates: {
    canonical: "/about",
  },
};

export default async function AboutPage() {
  const settings = await fetchPublicSettings();

  return (
    <SharedStorefrontShell announcement={settings?.announcement}>
      <PolicyContainer
        badge="About Us"
        title="About Kids Wear"
        description="An apparel e-commerce business serving families across Pakistan with generational collections for children, teens, and young adults."
      >
        <section className="space-y-4">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Our Business
          </h2>
          <p>Kids Wear is an apparel e-commerce business based in Attock, Pakistan.</p>
          <p>
            Pakistan-wide delivery is available, with delivery expected within 10 days of order
            confirmation. Customers can shop conveniently using either Cash on Delivery (COD) or
            Manual Bank Transfer, with complete freedom to checkout as a guest or create an optional
            customer account to view order history.
          </p>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Three Generational Storefronts
          </h2>
          <p>
            To deliver an experience tailored to developmental and stylistic needs, Kids Wear is
            organized into three distinct age-based storefronts sharing a unified shopping platform:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-5 rounded-lg bg-surface border border-border shadow-subtle space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-storefront">
                0–10 Years
              </span>
              <h3 className="font-editorial text-lg text-ink font-normal">Mini Sprouts</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Comfortable, durable, and playful essentials created for infants, toddlers, and
                young children.
              </p>
              <Link
                href="/mini-sprouts"
                className="inline-block text-xs font-medium text-accent-storefront hover:underline pt-2"
              >
                Explore Mini Sprouts &rarr;
              </Link>
            </div>

            <div className="p-5 rounded-lg bg-surface border border-border shadow-subtle space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-storefront">
                11–16 Years
              </span>
              <h3 className="font-editorial text-lg text-ink font-normal">Teen Studio</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Contemporary casualwear and refined silhouettes tailored specifically for growing
                pre-teens and teenagers.
              </p>
              <Link
                href="/teen-studio"
                className="inline-block text-xs font-medium text-accent-storefront hover:underline pt-2"
              >
                Explore Teen Studio &rarr;
              </Link>
            </div>

            <div className="p-5 rounded-lg bg-surface border border-border shadow-subtle space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-storefront">
                17+ Years
              </span>
              <h3 className="font-editorial text-lg text-ink font-normal">Aura Studio</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Modern styles, everyday classics, and youthful occasionwear tailored for young
                adults and older youth.
              </p>
              <Link
                href="/aura-studio"
                className="inline-block text-xs font-medium text-accent-storefront hover:underline pt-2"
              >
                Explore Aura Studio &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Business Address
          </h2>
          <p>Kids Wear is based in Attock, Pakistan:</p>
          <address className="not-italic p-4 rounded-lg bg-surface-soft border border-border text-sm leading-relaxed">
            <span className="font-semibold text-ink block">Kids Wear</span>
            Street-05, Darul Islam Colony
            <br />
            Attock, Pakistan
          </address>
        </section>

        <section className="space-y-4 pt-4 border-t border-border">
          <h2 className="font-editorial text-xl sm:text-2xl text-ink font-normal tracking-tight">
            Brand Story
          </h2>
          <div className="p-4 rounded-lg bg-surface-soft border border-border text-xs sm:text-sm text-text-muted leading-relaxed">
            Additional brand background and editorial storytelling will be published as our
            collections expand. For any inquiries regarding our apparel or orders, please contact
            our team via our{" "}
            <Link href="/contact" className="text-accent-storefront underline hover:text-ink">
              Contact Page
            </Link>
            .
          </div>
        </section>
      </PolicyContainer>
    </SharedStorefrontShell>
  );
}
