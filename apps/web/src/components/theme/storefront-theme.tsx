"use client";

import React, { createContext, useContext } from "react";

import type { StorefrontSlug, StorefrontThemeMeta } from "./storefront-tokens";
import { STOREFRONT_THEMES, STOREFRONT_SLUGS, isValidStorefrontSlug } from "./storefront-tokens";

export type { StorefrontSlug, StorefrontThemeMeta };
export { STOREFRONT_THEMES, STOREFRONT_SLUGS, isValidStorefrontSlug };

interface StorefrontContextValue {
  storefront: StorefrontSlug | null;
  meta: StorefrontThemeMeta | null;
}

const StorefrontContext = createContext<StorefrontContextValue>({
  storefront: null,
  meta: null,
});

export interface StorefrontScopeProps extends React.HTMLAttributes<HTMLDivElement> {
  storefront: StorefrontSlug;
  children: React.ReactNode;
}

/**
 * StorefrontScope sets the data-storefront attribute on a container
 * which automatically activates the CSS custom property accent colors.
 */
export function StorefrontScope({
  storefront,
  children,
  className = "",
  ...rest
}: StorefrontScopeProps) {
  const meta = STOREFRONT_THEMES[storefront] ?? null;

  return (
    <StorefrontContext.Provider value={{ storefront, meta }}>
      <div data-storefront={storefront} className={className} {...rest}>
        {children}
      </div>
    </StorefrontContext.Provider>
  );
}

/**
 * Hook to access current storefront theme context.
 */
export function useStorefront(): StorefrontContextValue {
  return useContext(StorefrontContext);
}
