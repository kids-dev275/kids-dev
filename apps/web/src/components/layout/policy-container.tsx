import React from "react";
import { PageContainer } from "@/components/layout/page-container";

export interface PolicyContainerProps {
  badge?: string;
  title: string;
  description?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

/**
 * Reusable layout container for informational and policy pages.
 * Ensures readable max-width, clear typographic hierarchy, consistent spacing,
 * and high-contrast, accessible content presentation.
 */
export function PolicyContainer({
  badge,
  title,
  description,
  lastUpdated,
  children,
}: PolicyContainerProps) {
  return (
    <PageContainer className="py-10 sm:py-16">
      <article className="max-w-3xl mx-auto">
        {/* Header Block */}
        <header className="mb-10 sm:mb-12 border-b border-border pb-8">
          {badge && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-sans font-semibold tracking-wide uppercase text-accent-storefront bg-surface-soft border border-border mb-3">
              {badge}
            </span>
          )}
          <h1 className="font-editorial text-3xl sm:text-4xl text-ink font-normal tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="font-sans text-sm sm:text-base text-text-muted mt-3 leading-relaxed">
              {description}
            </p>
          )}
          {lastUpdated && (
            <p className="font-sans text-xs text-text-muted/70 mt-4">{lastUpdated}</p>
          )}
        </header>

        {/* Content Body */}
        <div className="space-y-8 font-sans text-sm sm:text-base text-text-base leading-relaxed">
          {children}
        </div>
      </article>
    </PageContainer>
  );
}
