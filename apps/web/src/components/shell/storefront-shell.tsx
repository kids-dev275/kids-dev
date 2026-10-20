import React from "react";
import { StorefrontScope } from "@/components/theme/storefront-theme";
import type { StorefrontSlug } from "@/components/theme/storefront-tokens";
import { AnnouncementBar } from "./announcement-bar";
import { Header } from "./header";
import { Footer } from "./footer";
import type { ApiAnnouncement } from "@/lib/api";

export interface StorefrontShellProps {
  storefront: StorefrontSlug;
  announcement?: ApiAnnouncement | null;
  children: React.ReactNode;
}

/**
 * StorefrontShell wraps storefront pages with the unified customer shell:
 * - Theme-scoped CSS accent tokens
 * - Global Announcement Bar
 * - Shared Header with Storefront switcher and navigation
 * - Semantic main landmark
 * - Shared Footer
 */
export function StorefrontShell({ storefront, announcement, children }: StorefrontShellProps) {
  return (
    <StorefrontScope
      storefront={storefront}
      className="min-h-screen flex flex-col bg-canvas selection:bg-champagne/30"
    >
      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ink focus:text-white focus:rounded focus:ring-2 focus:ring-accent-storefront"
      >
        Skip to main content
      </a>

      {/* Global Announcement */}
      <AnnouncementBar announcement={announcement} />

      {/* Storefront Header */}
      <Header storefront={storefront} />

      {/* Main Content Area */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Storefront Footer */}
      <Footer />
    </StorefrontScope>
  );
}
