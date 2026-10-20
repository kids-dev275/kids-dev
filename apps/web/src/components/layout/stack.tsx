import React from "react";

export type SpacingGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";

const GAP_MAP: Record<SpacingGap, string> = {
  none: "gap-0",
  xs: "gap-2",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
  xl: "gap-12",
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  gap?: SpacingGap;
  align?: "start" | "center" | "end" | "stretch";
  children: React.ReactNode;
}

const ALIGN_MAP = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

/**
 * Stack renders a vertical column with consistent spacing.
 */
export function Stack({
  as: Component = "div",
  gap = "md",
  align = "stretch",
  className = "",
  children,
  ...rest
}: StackProps) {
  return (
    <Component
      className={`flex flex-col ${GAP_MAP[gap]} ${ALIGN_MAP[align]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface ClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  gap?: SpacingGap;
  align?: "start" | "center" | "end" | "baseline";
  justify?: "start" | "center" | "end" | "between";
  children: React.ReactNode;
}

const JUSTIFY_MAP = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

const CLUSTER_ALIGN_MAP = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
};

/**
 * Cluster renders an inline group of elements with wrapping and consistent gap.
 */
export function Cluster({
  as: Component = "div",
  gap = "sm",
  align = "center",
  justify = "start",
  className = "",
  children,
  ...rest
}: ClusterProps) {
  return (
    <Component
      className={`flex flex-wrap ${GAP_MAP[gap]} ${CLUSTER_ALIGN_MAP[align]} ${JUSTIFY_MAP[justify]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}
