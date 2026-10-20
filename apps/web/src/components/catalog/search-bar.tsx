import React from "react";
import { Search } from "lucide-react";
import { STOREFRONT_THEMES, StorefrontSlug } from "@/components/theme/storefront-tokens";

export interface SearchBarProps {
  storefront: StorefrontSlug;
  initialQuery?: string;
  className?: string;
}

export function SearchBar({ storefront, initialQuery = "", className = "" }: SearchBarProps) {
  const currentTheme = STOREFRONT_THEMES[storefront];

  return (
    <form
      method="GET"
      action={`/${storefront}/search`}
      className={`relative w-full max-w-xl ${className}`.trim()}
      role="search"
      aria-label={`Search ${currentTheme.name}`}
    >
      <label htmlFor="search-input" className="sr-only">
        Search {currentTheme.name} products
      </label>
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-text-muted pointer-events-none">
          <Search className="h-4 w-4" aria-hidden="true" />
        </div>
        <input
          id="search-input"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder={`Search products in ${currentTheme.name}...`}
          className="w-full pl-10 pr-24 py-2.5 rounded-md border border-border bg-surface text-ink text-sm font-sans placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-storefront focus:border-accent-storefront transition-colors"
          required
        />
        <button
          type="submit"
          className="absolute right-1.5 px-4 py-1.5 text-xs font-sans font-semibold text-white bg-accent-storefront rounded hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
        >
          Search
        </button>
      </div>
    </form>
  );
}
