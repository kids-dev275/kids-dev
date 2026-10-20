import React from "react";
import Link from "next/link";
import { StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface FooterProps {
  className?: string;
}

const STOREFRONT_LINKS: { slug: StorefrontSlug; name: string; ageRange: string }[] = [
  { slug: "mini-sprouts", name: "Mini Sprouts", ageRange: "0–10 Years" },
  { slug: "teen-studio", name: "Teen Studio", ageRange: "11–16 Years" },
  { slug: "aura-studio", name: "Aura Studio", ageRange: "17+ Years" },
];

const POLICY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return & Exchange Policy", href: "/return-exchange-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms" },
];

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=100057616711479",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/kidswearattire/",
  },
  {
    name: "Pinterest",
    href: "https://www.pinterest.com/khalil786tfw/",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@kids.wear251?_r=1&_t=ZS-9AU3ONhdbgm",
  },
  {
    name: "Threads",
    href: "https://www.threads.com/@kidswearattire?invite=0",
  },
];

/**
 * Shared customer Footer component.
 * Exposes approved storefront navigation, informational and policy destinations,
 * and confirmed business contact information.
 */
export function Footer({ className = "" }: FooterProps) {
  return (
    <footer className={`border-t border-border bg-surface text-text-base ${className}`.trim()}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1: Brand & Overview */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              href="/"
              className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded"
            >
              <span className="font-editorial text-2xl sm:text-3xl text-ink font-normal tracking-tight">
                Kids Wear
              </span>
            </Link>
            <p className="font-sans text-sm text-text-base/80 max-w-sm leading-relaxed">
              Kids Wear apparel across three age-based storefronts, delivered across Pakistan within
              10 days.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="font-sans text-xs font-semibold text-ink hover:text-accent-storefront hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-storefront rounded"
              >
                &larr; Switch Storefront / Visit Root Gateway
              </Link>
            </div>
          </div>

          {/* Column 2: Storefronts */}
          <div className="space-y-3">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-ink">
              Storefronts
            </h3>
            <ul className="space-y-2 text-sm">
              {STOREFRONT_LINKS.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    className="hover:text-accent-storefront transition-colors"
                  >
                    {s.name} <span className="text-xs text-text-muted">({s.ageRange})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Customer Care & Policies */}
          <div className="space-y-3">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-ink">
              Customer Care
            </h3>
            <ul className="space-y-2 text-sm">
              {POLICY_LINKS.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:text-accent-storefront transition-colors">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Business Address */}
          <div className="space-y-3">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-ink">
              Contact & Business Address
            </h3>
            <div className="space-y-1.5 text-xs text-text-base/80 leading-relaxed font-sans">
              <p className="font-medium text-ink">Phone:</p>
              <a
                href="tel:+923350981321"
                className="hover:text-accent-storefront transition-colors block"
              >
                +92 335 0981 321
              </a>
              <p className="font-medium text-ink pt-1">Email:</p>
              <a
                href="mailto:info@thekidswear.com"
                className="hover:text-accent-storefront transition-colors block"
              >
                info@thekidswear.com
              </a>
              <p className="font-medium text-ink pt-1">Business Address:</p>
              <address className="not-italic leading-relaxed">
                Street-05, Darul Islam Colony, Attock, Pakistan
              </address>
            </div>

            {/* Social Links */}
            <div className="pt-2">
              <span className="block font-sans text-xs font-semibold uppercase tracking-wider text-ink mb-2">
                Follow Us
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[24px] inline-flex items-center text-text-muted hover:text-accent-storefront transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-storefront rounded"
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>&copy; {new Date().getFullYear()} Kids Wear. All rights reserved.</p>
          <p>
            Pakistan-Wide Delivery &bull; Delivery Within 10 Days &bull; Cash on Delivery & Bank
            Transfer
          </p>
        </div>
      </div>
    </footer>
  );
}
