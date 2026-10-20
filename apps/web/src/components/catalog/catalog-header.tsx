import React from "react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface CatalogHeaderProps {
  storefront: StorefrontSlug;
  title: string;
  description?: string;
  totalItems?: number;
  className?: string;
}

export function CatalogHeader({
  storefront,
  title,
  description,
  totalItems,
  className = "",
}: CatalogHeaderProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];

  return (
    <header className={`py-6 sm:py-8 border-b border-border mb-8 ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-sans font-semibold text-white tracking-wide mb-2"
            style={{ backgroundColor: currentTheme.primaryAccent }}
          >
            {currentTheme.name} ({currentTheme.ageRange})
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="font-sans text-sm text-text-muted mt-1.5 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {totalItems !== undefined && (
          <div className="font-sans text-xs text-text-muted shrink-0 sm:text-right">
            <span>
              {totalItems} {totalItems === 1 ? "product" : "products"}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
