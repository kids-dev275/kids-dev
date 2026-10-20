import React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2 } from "lucide-react";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
}

const ALERT_STYLES: Record<
  AlertVariant,
  { container: string; icon: React.ReactNode; titleColor: string }
> = {
  info: {
    container: "bg-surface-soft border-border text-text-primary",
    icon: <Info className="h-5 w-5 text-accent-storefront shrink-0" aria-hidden="true" />,
    titleColor: "text-text-primary",
  },
  success: {
    container: "bg-[#edf5ee] border-[#c8e3cc] text-[#1c401e]",
    icon: <CheckCircle2 className="h-5 w-5 text-[#2e6930] shrink-0" aria-hidden="true" />,
    titleColor: "text-[#1c401e]",
  },
  warning: {
    container: "bg-[#fdf7ec] border-[#f4e2be] text-[#5c3e0e]",
    icon: <AlertTriangle className="h-5 w-5 text-[#9a6514] shrink-0" aria-hidden="true" />,
    titleColor: "text-[#5c3e0e]",
  },
  error: {
    container: "bg-[#fbeeed] border-[#f3ccc8] text-[#5e221d]",
    icon: <AlertCircle className="h-5 w-5 text-[#a33b32] shrink-0" aria-hidden="true" />,
    titleColor: "text-[#5e221d]",
  },
};

export function Alert({ variant = "info", title, className = "", children, ...rest }: AlertProps) {
  const { container, icon, titleColor } = ALERT_STYLES[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm font-sans ${container} ${className}`.trim()}
      {...rest}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 space-y-1">
        {title && <h4 className={`font-semibold ${titleColor}`}>{title}</h4>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function InlineError({ className = "", children, ...rest }: InlineErrorProps) {
  if (!children) return null;

  return (
    <div
      role="alert"
      className={`inline-flex items-center gap-1.5 text-xs font-sans text-danger font-medium ${className}`.trim()}
      {...rest}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export interface SuccessMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SuccessMessage({ className = "", children, ...rest }: SuccessMessageProps) {
  if (!children) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-sm font-sans text-[#2e6930] font-medium ${className}`.trim()}
      {...rest}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export interface LoadingSpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SPINNER_SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function LoadingSpinner({
  size = "md",
  label = "Loading...",
  className = "",
  ...rest
}: LoadingSpinnerProps) {
  return (
    <div className="inline-flex items-center gap-2" role="status">
      <Loader2
        className={`animate-spin motion-reduce:animate-none text-accent-storefront ${SPINNER_SIZES[size]} ${className}`.trim()}
        aria-hidden="true"
        {...rest}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...rest }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-soft animate-pulse motion-reduce:animate-none rounded ${className}`.trim()}
      aria-hidden="true"
      {...rest}
    />
  );
}
