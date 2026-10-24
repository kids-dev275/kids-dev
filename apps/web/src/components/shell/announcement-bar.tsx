import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ApiAnnouncement } from "@/lib/api";

export interface AnnouncementBarProps {
  announcement?: ApiAnnouncement | null;
  className?: string;
  themed?: boolean;
}

/**
 * AnnouncementBar renders active global announcements from GET /api/v1/public/settings.
 * Strictly renders only when announcement.isActive === true and text is provided.
 */
export function AnnouncementBar({
  announcement,
  className = "",
  themed = false,
}: AnnouncementBarProps) {
  if (!announcement || !announcement.isActive || !announcement.text?.trim()) {
    return null;
  }

  const { text, link } = announcement;
  const isSafeLink = Boolean(
    link &&
    (link.startsWith("/") || link.startsWith("http://") || link.startsWith("https://")) &&
    !link.toLowerCase().startsWith("javascript:") &&
    !link.toLowerCase().startsWith("data:") &&
    !link.toLowerCase().startsWith("vbscript:")
  );
  const isExternal = Boolean(link && (link.startsWith("http://") || link.startsWith("https://")));

  return (
    <aside
      aria-label="Announcement"
      className={`${themed ? "bg-[var(--color-storefront-contrast)]" : "bg-[var(--color-text-primary)]"} relative z-50 px-4 py-2 text-center font-sans text-xs font-medium text-white transition-colors ${className}`.trim()}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        {link && isSafeLink ? (
          isExternal ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
            >
              <span>{text}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
            </a>
          ) : (
            <Link
              href={link}
              className="inline-flex items-center gap-1.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1"
            >
              <span>{text}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
            </Link>
          )
        ) : (
          <span>{text}</span>
        )}
      </div>
    </aside>
  );
}
