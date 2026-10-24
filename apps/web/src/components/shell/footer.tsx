import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { STOREFRONT_THEMES, STOREFRONT_SLUGS } from "@/components/theme/storefront-tokens";

const CUSTOMER_CARE_LINKS = [
  ["About Us", "/about"],
  ["Contact", "/contact"],
  ["Shipping Policy", "/shipping-policy"],
  ["Return & Exchange Policy", "/return-exchange-policy"],
  ["Privacy Policy", "/privacy-policy"],
  ["Terms & Conditions", "/terms"],
] as const;

/** Shared customer-facing footer, themed by the surrounding StorefrontScope. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <Link href="/">
            <Image
              src="/brand/kids-wear-logo.webp"
              alt="Kids Wear"
              width={105}
              height={68}
              className="h-16 w-auto object-contain"
            />
          </Link>
          <p className="mt-3 text-sm text-text-muted">
            Apparel for three age groups, delivered across Pakistan.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Storefronts</h2>
          {STOREFRONT_SLUGS.map((slug) => (
            <Link
              className="mb-2 block text-sm text-text-base hover:text-[var(--color-storefront-contrast)]"
              key={slug}
              href={`/${slug}`}
              prefetch={false}
            >
              {STOREFRONT_THEMES[slug].name} — {STOREFRONT_THEMES[slug].ageRange}
            </Link>
          ))}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Customer Care</h2>
          {CUSTOMER_CARE_LINKS.map(([label, href]) => (
            <Link
              className="mb-2 block text-sm text-text-base hover:text-[var(--color-storefront-contrast)]"
              key={href}
              href={href}
            >
              {label}
            </Link>
          ))}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Contact &amp; Business Address</h2>
          <a
            className="mb-2 flex items-start gap-2.5 text-sm text-text-base hover:text-[var(--color-storefront-contrast)]"
            href="tel:+923350981321"
          >
            <Phone size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--color-storefront-contrast)]" aria-hidden="true" />
            <span>+92 335 0981321</span>
          </a>
          <a
            className="mb-2 flex items-start gap-2.5 text-sm text-text-base hover:text-[var(--color-storefront-contrast)]"
            href="mailto:info@thekidswear.com"
          >
            <Mail size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--color-storefront-contrast)]" aria-hidden="true" />
            <span className="min-w-0 break-words">info@thekidswear.com</span>
          </a>
          <div className="flex items-start gap-2.5">
            <MapPin size={17} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--color-storefront-contrast)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="mb-1 text-sm font-semibold text-ink">Business Address</p>
              <address className="text-sm not-italic text-text-muted">
                Street-05, Darul Islam Colony, Attock, Pakistan
              </address>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} Kids Wear. All rights reserved.
      </div>
    </footer>
  );
}
