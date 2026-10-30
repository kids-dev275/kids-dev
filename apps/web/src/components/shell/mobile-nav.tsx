"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShoppingBag, User } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";
import { StorefrontIdentityIcon } from "@/components/theme/storefront-identity-icon";
import { CartUnitBadge } from "@/components/cart/cart-badge";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface MobileNavProps {
  storefront: StorefrontSlug;
}

const STOREFRONT_SLUGS: StorefrontSlug[] = ["mini-sprouts", "teen-studio", "aura-studio"];

export function getMobileNavLinks(storefront: StorefrontSlug, pathname: string | null) {
  return [
    { label: "Home", href: `/${storefront}`, active: pathname === `/${storefront}` },
    { label: "Shop", href: `/${storefront}/shop`, active: pathname === `/${storefront}/shop` },
    { label: "New Arrivals", href: `/${storefront}/new-arrivals`, active: pathname === `/${storefront}/new-arrivals` },
    { label: "Reviews", href: `/${storefront}#reviews`, active: pathname === "/reviews" },
    { label: "Contact", href: `/${storefront}#contact`, active: pathname === "/contact" },
    { label: "My Account", href: "/account", active: pathname?.startsWith("/account") ?? false },
  ];
}

/** Full-width navigation sheet for phone viewports. */
export function MobileNav({ storefront }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const close = () => setIsOpen(false);
  const menuRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose: close, triggerRef: toggleButtonRef });
  const navLinks = getMobileNavLinks(storefront, pathname);

  return (
    <div ref={menuRef} className="md:hidden">
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-drawer"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
      >
        {isOpen ? <X className="h-[22px] w-[22px]" aria-hidden="true" /> : <Menu className="h-[22px] w-[22px]" aria-hidden="true" />}
      </button>
      {isOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="absolute inset-x-0 top-full z-20 h-[calc(100dvh-72px)] overflow-y-auto border-t border-border bg-surface shadow-[0_12px_24px_rgba(63,43,36,0.08)] animate-[mobile-nav-enter_180ms_ease-out_both]"
        >
          <nav aria-label="Mobile Menu Links" className="mx-auto flex max-w-7xl flex-col px-6 py-5">
            {navLinks.map(({ label, href, active }) => (
              <Link
                key={label}
                href={href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 items-center border-b border-border/70 font-sans text-[20px] font-medium transition-colors last:border-b-0 hover:text-[var(--color-storefront-contrast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-inset ${active ? "text-[var(--color-storefront-contrast)] underline decoration-accent-storefront underline-offset-4" : "text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

/**
 * TabletNav preserves the existing slide-over navigation drawer for tablet viewports.
 * Handles keyboard escape dismissal, body scroll lock, route-change closing, focus trapping, and ARIA state.
 */
export function TabletNav({ storefront }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close drawer upon pathname change without triggering cascading renders in effect
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const handleClose = () => {
    setIsOpen(false);
  };

  // Traps Tab/Shift+Tab focus, closes on Escape (e.key === "Escape"), locks body scroll, and restores focus
  const drawerRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: handleClose,
    triggerRef: toggleButtonRef,
  });

  const navLinks = [
    { label: "Home", href: `/${storefront}` },
    { label: "Shop", href: `/${storefront}/shop` },
    { label: "New Arrivals", href: `/${storefront}/new-arrivals` },
    { label: "Reviews", href: `/${storefront}#reviews` },
    { label: "Contact", href: `/${storefront}#contact` },
  ];

  return (
    <div className="hidden md:block lg:hidden">
      {/* Trigger Button */}
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="tablet-navigation-drawer"
        aria-label={isOpen ? "Close main menu" : "Open main menu"}
        className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-md text-ink hover:text-accent-storefront hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Backdrop & Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div
            ref={drawerRef}
            id="tablet-navigation-drawer"
            className="relative ml-auto w-full max-w-xs bg-surface h-full shadow-lg flex flex-col justify-between p-6 z-10 overflow-y-auto"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-border">
                <span className="flex items-center gap-2 font-editorial text-xl text-[var(--color-storefront-contrast)]">
                  <StorefrontIdentityIcon storefront={storefront} className="h-5 w-5" />
                  {STOREFRONT_THEMES[storefront].name}
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close menu"
                  className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-md text-text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Storefront Switcher inside Drawer */}
              <div className="py-6 border-b border-border">
                <span className="block text-xs uppercase tracking-wider font-sans font-semibold text-text-muted mb-3">
                  Switch Storefront
                </span>
                <div className="flex flex-col gap-2">
                  {STOREFRONT_SLUGS.map((slug) => {
                    const theme = STOREFRONT_THEMES[slug];
                    const isCurrent = storefront === slug;
                    return (
                      <Link
                        key={slug}
                        href={`/${slug}`}
                        prefetch={false}
                        className={`flex items-center justify-between px-3 py-2 rounded-md font-sans text-sm font-medium transition-colors ${
                          isCurrent
                            ? "bg-accent-storefront text-white"
                            : "bg-surface-soft text-text-base hover:text-ink"
                        }`}
                      >
                        <span>{theme.name}</span>
                        <span className="text-xs opacity-80">{theme.ageRange}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Links */}
              <nav aria-label="Mobile Menu Links" className="py-6 flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="font-sans text-base text-text-base hover:text-accent-storefront py-1 font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Bottom Actions: Account & Cart placeholders */}
            <div className="pt-6 border-t border-border flex flex-col gap-3">
              <Link
                href="/account"
                className="flex items-center gap-3 font-sans text-sm text-text-base hover:text-accent-storefront py-1"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span>My Account</span>
              </Link>
              <Link
                href="/cart"
                className="flex items-center justify-between font-sans text-sm text-text-base hover:text-accent-storefront py-1"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  <span>Cart</span>
                </div>
                <CartUnitBadge className="relative top-0 right-0 transform-none" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
