import React from "react";

export type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body-large"
  | "body"
  | "body-small"
  | "label"
  | "caption";

const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  display:
    "font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-text-primary font-normal",
  h1: "font-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight text-text-primary font-normal",
  h2: "font-serif text-2xl sm:text-3xl tracking-tight text-text-primary font-normal",
  h3: "font-serif text-xl sm:text-2xl tracking-normal text-text-primary font-normal",
  h4: "font-serif text-lg sm:text-xl tracking-normal text-text-primary font-normal",
  "body-large": "font-sans text-lg text-text-secondary leading-relaxed font-normal",
  body: "font-sans text-base text-text-secondary leading-relaxed font-normal",
  "body-small": "font-sans text-sm text-text-secondary leading-normal font-normal",
  label: "font-sans text-xs uppercase tracking-wider font-semibold text-text-muted",
  caption: "font-sans text-xs text-text-muted leading-tight font-normal",
};

const DEFAULT_TAG: Record<TypographyVariant, React.ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  "body-large": "p",
  body: "p",
  "body-small": "p",
  label: "span",
  caption: "span",
};

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  as?: React.ElementType;
  children: React.ReactNode;
}

export function Typography({
  variant = "body",
  as,
  className = "",
  children,
  ...rest
}: TypographyProps) {
  const Component = as || DEFAULT_TAG[variant];
  const variantClass = VARIANT_CLASSES[variant];

  return (
    <Component className={`${variantClass} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
}

// Convenient semantic aliases
export function Heading({
  level = 2,
  variant,
  className = "",
  children,
  ...rest
}: {
  level?: 1 | 2 | 3 | 4;
  variant?: "display" | "h1" | "h2" | "h3" | "h4";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  const tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const mappedVariant = variant || tag;
  return (
    <Typography as={tag} variant={mappedVariant} className={className} {...rest}>
      {children}
    </Typography>
  );
}

export function Text({
  variant = "body",
  as = "p",
  className = "",
  children,
  ...rest
}: {
  variant?: "body-large" | "body" | "body-small" | "label" | "caption";
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Typography as={as} variant={variant} className={className} {...rest}>
      {children}
    </Typography>
  );
}
