"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

export interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}

/**
 * NavLink provides clean keyboard navigation, active state detection,
 * and restrained underline hover transitions.
 */
export function NavLink({ href, exact = false, className = "", children, ...rest }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname?.startsWith(href);

  return (
    <Link
      href={href}
      className={`relative inline-flex items-center py-2 text-sm font-sans font-medium transition-colors select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2 rounded
        ${
          isActive
            ? "text-accent-storefront font-semibold"
            : "text-text-primary hover:text-accent-storefront"
        }
        after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-accent-storefront
        after:transition-transform after:duration-200
        ${isActive ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"}
        ${className}`.trim()}
      aria-current={isActive ? "page" : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * IconButton ensures a minimum 44px accessible touch target for icon-only actions.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = "", icon, children, "aria-label": ariaLabel, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center h-11 w-11 rounded-full text-text-primary hover:bg-surface-soft hover:text-accent-storefront transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2
          disabled:opacity-50 disabled:pointer-events-none
          ${className}`.trim()}
        {...rest}
      >
        {icon || children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export interface DesktopNavProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * DesktopNav container wrapper hidden on mobile and visible from md breakpoint.
 */
export function DesktopNav({ className = "", children, ...rest }: DesktopNavProps) {
  return (
    <nav className={`hidden md:flex items-center gap-6 lg:gap-8 ${className}`.trim()} {...rest}>
      {children}
    </nav>
  );
}

export interface MobileNavTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen?: boolean;
}

/**
 * MobileNavTrigger is a foundational button for toggling navigation on smaller screens.
 */
export const MobileNavTrigger = React.forwardRef<HTMLButtonElement, MobileNavTriggerProps>(
  ({ isOpen = false, className = "", onClick, ...rest }, ref) => {
    return (
      <IconButton
        ref={ref}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        onClick={onClick}
        className={`md:hidden ${className}`.trim()}
        {...rest}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </IconButton>
    );
  }
);

MobileNavTrigger.displayName = "MobileNavTrigger";
