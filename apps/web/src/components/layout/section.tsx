import React from "react";
import { Heading, Text } from "../ui/typography";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  spacing?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const SPACING_MAP = {
  sm: "py-6 sm:py-8 lg:py-10",
  md: "py-8 sm:py-12 lg:py-16",
  lg: "py-12 sm:py-16 lg:py-24",
};

export function Section({
  as: Component = "section",
  spacing = "md",
  className = "",
  children,
  ...rest
}: SectionProps) {
  return (
    <Component className={`${SPACING_MAP[spacing]} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  kicker?: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
}

export function SectionHeader({
  title,
  kicker,
  description,
  action,
  align = "left",
  className = "",
  ...rest
}: SectionHeaderProps) {
  const isCentered = align === "center";

  return (
    <div
      className={`mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 ${
        isCentered ? "text-center md:items-center" : ""
      } ${className}`.trim()}
      {...rest}
    >
      <div className={`space-y-1.5 ${isCentered ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
        {kicker && (
          <Text variant="label" className="text-accent-storefront block">
            {kicker}
          </Text>
        )}
        <Heading level={2} variant="h2" className="tracking-tight text-text-primary">
          {title}
        </Heading>
        {description && (
          <Text variant="body" className="text-text-muted mt-1">
            {description}
          </Text>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
