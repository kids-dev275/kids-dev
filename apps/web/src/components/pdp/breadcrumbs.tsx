import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  storefront: StorefrontSlug;
  productName?: string;
  currentPageTitle?: string;
  className?: string;
}

export function Breadcrumbs({
  storefront,
  productName,
  currentPageTitle,
  className = "",
}: BreadcrumbsProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];

  const items: BreadcrumbItem[] = [
    { label: currentTheme.name, href: `/${storefront}` },
    { label: "Shop", href: `/${storefront}/shop` },
  ];

  if (productName) {
    items.push({ label: productName });
  } else if (currentPageTitle) {
    items.push({ label: currentPageTitle });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`py-3 text-xs font-sans text-text-muted ${className}`.trim()}
    >
      <ol className="flex items-center flex-wrap gap-1.5 list-none p-0 m-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-border shrink-0" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span
                  className="text-ink font-medium truncate max-w-[200px] sm:max-w-xs"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-accent-storefront transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-storefront rounded"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
