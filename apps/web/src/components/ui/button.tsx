import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export type ButtonAsButton = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: undefined;
  };

export type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-storefront text-white hover:bg-accent-storefront-hover border border-transparent shadow-subtle",
  secondary: "bg-surface-soft text-text-primary hover:bg-border/40 border border-border/60",
  outline: "bg-transparent text-text-primary hover:bg-surface-soft border border-border",
  ghost: "bg-transparent text-text-primary hover:bg-surface-soft border border-transparent",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[36px] min-w-[36px] gap-1.5 rounded-md",
  md: "px-4 py-2.5 text-sm min-h-[44px] min-w-[44px] gap-2 rounded-md",
  lg: "px-6 py-3.5 text-base min-h-[48px] min-w-[48px] gap-2.5 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = "",
      ...rest
    } = props;

    const baseClasses = [
      "inline-flex items-center justify-center font-sans font-medium transition-colors select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-2",
      "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
      VARIANT_STYLES[variant],
      SIZE_STYLES[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const content = (
      <>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </>
    );

    if (props.href) {
      const { href, ...linkProps } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <Link
          href={props.href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={baseClasses}
          aria-busy={isLoading || undefined}
          {...linkProps}
        >
          {content}
        </Link>
      );
    }

    const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={buttonProps.type || "button"}
        disabled={buttonProps.disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={baseClasses}
        {...buttonProps}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
