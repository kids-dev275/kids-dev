import React from "react";
import Link from "next/link";
import { Search, User, ShoppingBag } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";
import { StorefrontSwitcher } from "./storefront-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "../ui/navigation";
import { CartUnitBadge } from "@/components/cart/cart-badge";

export interface HeaderProps {
  storefront: StorefrontSlug;
  className?: string;
}

/**
 * Shared responsive customer Header.
 * Displays master brand identity, storefront switcher, storefront-scoped navigation,
 * action utilities (Search, Account, Cart placeholder), and accessible mobile navigation.
 */
export function Header({ storefront, className = "" }: HeaderProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur-md transition-colors ${className}`.trim()}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between gap-4">
          {/* Left: Brand Identity & Current Storefront Marker */}
          <div className="flex items-center gap-3">
            <Link
              href={`/${storefront}`}
              className="group flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront rounded px-1"
            >
              <span className="font-editorial text-2xl sm:text-3xl text-ink font-normal tracking-tight group-hover:text-accent-storefront transition-colors">
                Kids Wear
              </span>
              <span className="font-sans text-[11px] font-semibold tracking-wider uppercase text-text-muted">
                {currentTheme.name} &bull; {currentTheme.ageRange}
              </span>
            </Link>
          </div>

          {/* Center: Desktop Navigation Links (Storefront Scoped) */}
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-6">
            <NavLink href={`/${storefront}`} exact>
              Home
            </NavLink>
            <NavLink href={`/${storefront}/shop`}>Shop</NavLink>
            <NavLink href={`/${storefront}/new-arrivals`}>New Arrivals</NavLink>
            <NavLink href={`/${storefront}#reviews`}>Reviews</NavLink>
            <NavLink href={`/${storefront}#contact`}>Contact</NavLink>
          </nav>

          {/* Right: Storefront Switcher, Utilities & Mobile Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Storefront Switcher */}
            <div className="hidden md:block">
              <StorefrontSwitcher currentStorefront={storefront} variant="compact" />
            </div>

            {/* Utility Icons */}
            <Link
              href={`/${storefront}/search`}
              aria-label={`Search ${currentTheme.name}`}
              className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-full text-text-base hover:text-accent-storefront hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>

            <Link
              href="/account"
              aria-label="Customer Account"
              className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-full text-text-base hover:text-accent-storefront hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Link>

            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="relative min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-full text-text-base hover:text-accent-storefront hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
            >
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              <CartUnitBadge />
            </Link>

            {/* Mobile Navigation Trigger */}
            <MobileNav storefront={storefront} />
          </div>
        </div>
      </div>
    </header>
  );
}
