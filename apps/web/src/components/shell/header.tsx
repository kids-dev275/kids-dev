"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ShoppingBag, User } from "lucide-react";
import { STOREFRONT_THEMES, type StorefrontSlug } from "@/components/theme/storefront-tokens";
import { StorefrontIdentityIcon } from "@/components/theme/storefront-identity-icon";
import { CartUnitBadge } from "@/components/cart/cart-badge";
import { MobileNav, TabletNav } from "./mobile-nav";

export function Header({ storefront }: { storefront: StorefrontSlug }) {
  const theme = STOREFRONT_THEMES[storefront];
  const pathname = usePathname();
  const nav = [
    { label: "Home", href: `/${storefront}`, active: pathname === `/${storefront}` },
    { label: "Shop", href: `/${storefront}/shop`, active: pathname === `/${storefront}/shop` },
    {
      label: "New Arrivals",
      href: `/${storefront}/new-arrivals`,
      active: pathname === `/${storefront}/new-arrivals`,
    },
    { label: "Reviews", href: `/${storefront}#reviews`, active: pathname === "/reviews" },
    { label: "Contact", href: `/${storefront}#contact`, active: pathname === "/contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md max-md:shadow-[0_2px_12px_rgba(63,43,36,0.05)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-testid="mobile-storefront-header" className="flex h-[72px] items-center justify-between md:hidden">
          <Link
            href={`/${storefront}`}
            prefetch={false}
            className="flex min-w-0 items-start gap-1 leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
          >
            <StorefrontIdentityIcon storefront={storefront} className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--color-storefront-contrast)]" />
            <span className="flex flex-col">
              <span className="whitespace-nowrap font-editorial text-[18px] text-[var(--color-storefront-contrast)] min-[390px]:text-[19px]">
                {theme.name}
              </span>
              <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-text-muted">
                {theme.ageRange}
              </span>
            </span>
          </Link>
          <Link href="/" aria-label="Kids Wear gateway" className="absolute left-1/2 -translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront">
            <Image src="/brand/kids-wear-logo.webp" alt="Kids Wear" width={84} height={55} className="h-auto w-[52px] object-contain min-[390px]:w-[56px]" />
          </Link>
          <div className="flex items-center">
            <Link
              href={`/${storefront}/search`}
              aria-label={`Search ${theme.name}`}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              <CartUnitBadge />
            </Link>
            <MobileNav storefront={storefront} />
          </div>
        </div>
        <div data-testid="tablet-desktop-storefront-header" className="hidden min-h-20 items-center justify-between gap-3 py-2 md:flex lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
          <div className="flex items-center gap-2 max-[419px]:w-full sm:gap-5 lg:gap-2 xl:gap-3">
            <Link
              href={`/${storefront}`}
              prefetch={false}
              className="flex items-start gap-1 leading-tight sm:gap-1.5 lg:gap-1 xl:gap-1.5"
            >
              <StorefrontIdentityIcon
                storefront={storefront}
                className="mt-1 h-4 w-4 shrink-0 text-[var(--color-storefront-contrast)] lg:h-4 lg:w-4 xl:h-5 xl:w-5"
              />
              <span className="flex flex-col">
                <span className="font-editorial text-xl text-[var(--color-storefront-contrast)] sm:text-3xl lg:whitespace-nowrap lg:text-xl xl:text-2xl">
                  {theme.name}
                </span>
                <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.1em] text-text-muted sm:text-[10px] sm:tracking-[0.2em]">
                  {theme.ageRange}
                </span>
              </span>
            </Link>
            <span className="h-9 w-px bg-border" aria-hidden="true" />
            <Link href="/" aria-label="Kids Wear gateway" className="shrink-0">
              <Image
                src="/brand/kids-wear-logo.webp"
                alt="Kids Wear"
                width={84}
                height={55}
                className="h-10 w-auto object-contain sm:h-12 lg:h-10 xl:h-12"
              />
            </Link>
          </div>
          <div className="hidden items-center justify-center lg:flex">
            <nav
              aria-label="Main Navigation"
              className="flex items-center justify-center gap-4 whitespace-nowrap text-[17px] font-medium text-ink xl:gap-7"
            >
              {nav.map(({ label, href, active }) => (
                <Link
                  key={label}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`hover:text-[var(--color-storefront-contrast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 ${active ? "text-[var(--color-storefront-contrast)] underline underline-offset-4" : ""}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-0 max-[419px]:w-full max-[419px]:justify-between sm:gap-2 lg:justify-self-end">
            <Link
              href={`/${storefront}/search`}
              aria-label={`Search ${theme.name}`}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              <CartUnitBadge />
            </Link>
            <Link
              href="/account"
              aria-label="Customer Account"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-soft"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Link>
            <TabletNav storefront={storefront} />
          </div>
        </div>
      </div>
    </header>
  );
}
