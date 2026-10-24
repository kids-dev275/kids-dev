import { Leaf, Star } from "lucide-react";
import type { CSSProperties } from "react";
import type { StorefrontSlug } from "./storefront-tokens";

export function StorefrontIdentityIcon({
  storefront,
  className,
  style,
}: {
  storefront: StorefrontSlug;
  className?: string;
  style?: CSSProperties;
}) {
  if (storefront === "mini-sprouts") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <path d="M12 12c-2.5-3-6-3-7.5-1.5S3 14 6 14c3 0 6-2 6-2z" />
        <path d="M12 12c2.5-3 6-3 7.5-1.5S21 14 18 14c-3 0-6-2-6-2z" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <path d="M10.5 13.5L8 20" />
        <path d="M13.5 13.5L16 20" />
      </svg>
    );
  }

  const Icon = storefront === "teen-studio" ? Star : Leaf;
  return <Icon className={`${className ?? ""} fill-current/15`} style={style} aria-hidden="true" />;
}
