import React from "react";

export type BadgeVariant =
  | "new"
  | "unavailable"
  | "draft"
  | "published"
  | "inactive"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
}

const VARIANT_MAP: Record<BadgeVariant, string> = {
  new: "bg-accent-storefront text-white border-transparent font-semibold shadow-subtle",
  unavailable: "bg-surface-soft text-text-muted border-border font-medium",
  draft: "bg-surface-soft text-text-secondary border-border font-medium",
  published: "bg-[#edf5ee] text-[#2e6930] border-[#c8e3cc] font-medium",
  inactive: "bg-surface-soft text-text-muted border-border font-normal",
  neutral: "bg-surface-soft text-text-primary border-border font-medium",
  success: "bg-[#edf5ee] text-[#2e6930] border-[#c8e3cc] font-medium",
  warning: "bg-[#fdf7ec] text-[#9a6514] border-[#f4e2be] font-medium",
  danger: "bg-[#fbeeed] text-[#a33b32] border-[#f3ccc8] font-medium",
};

const SIZE_MAP: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] tracking-wider uppercase",
  md: "px-2.5 py-1 text-xs tracking-wider uppercase",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-sans select-none ${VARIANT_MAP[variant]} ${SIZE_MAP[size]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
