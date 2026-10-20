import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  hoverable?: boolean;
  children: React.ReactNode;
}

/**
 * Card primitive with editorial border, clean surface, and subtle depth.
 */
export function Card({
  as: Component = "div",
  hoverable = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={`rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-subtle ${
        hoverable ? "transition-shadow hover:shadow-card" : ""
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  tone?: "default" | "soft";
  children: React.ReactNode;
}

/**
 * Surface primitive for sectioning or grouping without card border.
 */
export function Surface({
  as: Component = "div",
  tone = "default",
  className = "",
  children,
  ...rest
}: SurfaceProps) {
  const toneClass = tone === "soft" ? "bg-surface-soft" : "bg-surface";

  return (
    <Component className={`rounded-lg ${toneClass} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  children: React.ReactNode;
}

/**
 * Panel primitive for secondary content or callouts.
 */
export function Panel({ as: Component = "div", className = "", children, ...rest }: PanelProps) {
  return (
    <Component
      className={`rounded-lg border border-border/80 bg-surface-soft p-4 sm:p-5 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

/**
 * Restrained divider line using design token border color.
 */
export function Divider({ orientation = "horizontal", className = "", ...rest }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`inline-block h-full min-h-[1em] w-[1px] bg-border ${className}`.trim()}
        {...rest}
      />
    );
  }

  return (
    <hr className={`my-4 w-full border-0 border-t border-border ${className}`.trim()} {...rest} />
  );
}
