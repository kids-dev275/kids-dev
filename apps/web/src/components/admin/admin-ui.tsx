"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
} from "lucide-react";

// ============================================================================
// 1. AdminPageHeader
// ============================================================================
export interface AdminPageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminPageHeader({ title, eyebrow, description, action }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#806943]">
            {eyebrow}
          </span>
        )}
        <h1 className="font-sans text-[26px] font-semibold tracking-tight text-brand-ink sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-brand-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2.5 shrink-0">{action}</div>}
    </div>
  );
}

// ============================================================================
// 2. Admin Compound Card (shadcn inspired)
// ============================================================================
export function AdminCard({ className = "", children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`rounded-2xl border border-brand-border bg-[#fffdfb] shadow-[0_14px_36px_-30px_rgba(63,43,36,0.34)] ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminCardHeader({
  className = "",
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-brand-border p-5 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminCardTitle({ className = "", children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={`font-sans text-[15px] font-semibold text-brand-ink ${className}`.trim()}
      {...props}
    >
      {children}
    </h2>
  );
}

export function AdminCardDescription({
  className = "",
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={`mt-1 text-xs text-brand-muted ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function AdminCardContent({
  className = "",
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={`p-5 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function AdminCardFooter({
  className = "",
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`p-4 border-t border-brand-border bg-brand-canvas/30 flex items-center justify-between text-xs text-brand-muted ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// 3. AdminMetricCard
// ============================================================================
export interface AdminMetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  tone?: "default" | "blue" | "emerald" | "amber";
  testId?: string;
  isLoading?: boolean;
}

const METRIC_TONE_STYLES = {
  default: {
    iconBg: "bg-brand-surface-soft text-brand-ink",
    valueText: "text-brand-ink",
  },
  blue: {
    iconBg: "bg-blue-50 text-blue-700",
    valueText: "text-brand-ink",
  },
  emerald: {
    iconBg: "bg-emerald-50 text-emerald-700",
    valueText: "text-emerald-700",
  },
  amber: {
    iconBg: "bg-amber-50 text-amber-700",
    valueText: "text-amber-700",
  },
};

export function AdminMetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  tone = "default",
  testId,
  isLoading = false,
}: AdminMetricCardProps) {
  const styles = METRIC_TONE_STYLES[tone];

  return (
    <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-[#fffdfb] p-5 shadow-[0_14px_36px_-30px_rgba(63,43,36,0.34)] transition-colors hover:border-champagne/70">
      <div>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted block">
          {title}
        </span>
        <span
          data-testid={testId}
          className={`mt-2 block font-sans text-[29px] font-semibold leading-none tracking-tight ${styles.valueText}`}
        >
          {isLoading ? "—" : value}
        </span>
        {subtitle && <span className="text-[10px] text-brand-muted mt-0.5 block">{subtitle}</span>}
      </div>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-border/40 ${styles.iconBg}`}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
    </div>
  );
}

// ============================================================================
// 4. AdminTable Compound Primitives (shadcn inspired)
// ============================================================================
export function AdminTable({ className = "", children, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={`w-full min-w-[660px] border-collapse text-left text-xs ${className}`.trim()}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function AdminTableHeader({
  className = "",
  children,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={`border-b border-brand-border bg-brand-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-brand-muted ${className}`.trim()}
      {...props}
    >
      {children}
    </thead>
  );
}

export function AdminTableBody({
  className = "",
  children,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody className={`divide-y divide-brand-border/60 ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export function AdminTableRow({ className = "", children, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={`transition-colors hover:bg-brand-surface-soft/50 ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

export function AdminTableHead({
  className = "",
  children,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "center" | "right" }) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`py-3 px-4 ${alignClass} ${className}`.trim()} {...props}>
      {children}
    </th>
  );
}

export function AdminTableCell({
  className = "",
  children,
  align = "left",
  ...props
}: React.ComponentProps<"td"> & { align?: "left" | "center" | "right" }) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td className={`py-3.5 px-4 ${alignClass} ${className}`.trim()} {...props}>
      {children}
    </td>
  );
}

// ============================================================================
// 5. AdminFilterBar
// ============================================================================
export interface AdminFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function AdminFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: AdminFilterBarProps) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-brand-border bg-[#fffdfb] p-4 shadow-[0_14px_36px_-30px_rgba(63,43,36,0.34)] md:flex-row">
      <div className="flex-1 relative">
        <Search className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" aria-hidden="true" />
        <input
          type="text"
          aria-label="Search records"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-xl border border-brand-border bg-white pl-9 pr-8 text-xs text-brand-ink transition-colors placeholder:text-brand-muted/70 focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-2 text-brand-muted hover:text-brand-ink"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// 6. AdminBadge
// ============================================================================
export type AdminBadgeVariant =
  "default" | "emerald" | "amber" | "blue" | "indigo" | "rose" | "slate" | "champagne";

const BADGE_VARIANT_STYLES: Record<AdminBadgeVariant, string> = {
  default: "bg-brand-surface-soft text-brand-ink border-brand-border",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
  rose: "bg-rose-50 text-rose-800 border-rose-200",
  slate: "bg-slate-100 text-slate-700 border-slate-300",
  champagne: "bg-brand-surface-soft text-brand-ink border-champagne",
};

export interface AdminBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: AdminBadgeVariant;
  children: React.ReactNode;
}

export function AdminBadge({
  variant = "default",
  className = "",
  children,
  ...props
}: AdminBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${BADGE_VARIANT_STYLES[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

// Helper badge mappings
export function getOrderStatusBadgeVariant(status: string): AdminBadgeVariant {
  switch (status) {
    case "ORDER_RECEIVED":
    case "AWAITING_PAYMENT":
      return "amber";
    case "CONFIRMED":
    case "IN_PRODUCTION":
    case "READY_TO_SHIP":
      return "blue";
    case "SHIPPED":
      return "indigo";
    case "DELIVERED":
      return "emerald";
    case "CANCELLED":
      return "rose";
    default:
      return "slate";
  }
}

export function getProductStatusBadgeVariant(status: string): AdminBadgeVariant {
  switch (status) {
    case "PUBLISHED":
      return "emerald";
    case "DRAFT":
      return "amber";
    case "INACTIVE":
      return "slate";
    default:
      return "default";
  }
}

export function getReviewStatusBadgeVariant(status: string): AdminBadgeVariant {
  switch (status) {
    case "APPROVED":
      return "emerald";
    case "PENDING":
      return "amber";
    case "HIDDEN":
      return "slate";
    default:
      return "default";
  }
}

// ============================================================================
// 7. AdminEmptyState
// ============================================================================
export interface AdminEmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({ icon: Icon, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-brand-surface-soft border border-brand-border/60 flex items-center justify-center text-brand-muted mb-3">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="font-sans text-sm font-semibold text-brand-ink">{title}</h3>
      <p className="text-xs text-brand-muted mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================================================
// 8. AdminButton
// ============================================================================
export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const BUTTON_VARIANT_STYLES = {
  primary:
    "bg-brand-ink text-white hover:bg-brand-text active:bg-brand-ink/90 border border-transparent shadow-xs focus-visible:ring-brand-ink",
  secondary:
    "bg-brand-surface-soft text-brand-ink hover:bg-brand-border/60 border border-brand-border focus-visible:ring-brand-ink",
  outline:
    "bg-white text-brand-ink hover:bg-brand-surface-soft border border-brand-border focus-visible:ring-brand-ink",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 border border-transparent shadow-xs focus-visible:ring-rose-600",
  ghost:
    "bg-transparent text-brand-ink hover:bg-brand-surface-soft border border-transparent focus-visible:ring-brand-ink",
};

const BUTTON_SIZE_STYLES = {
  sm: "px-2.5 py-1.5 text-xs min-h-[36px] gap-1.5 rounded-lg",
  md: "px-3.5 py-2 text-xs min-h-[40px] gap-2 rounded-lg",
};

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center uppercase tracking-wider font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none ${BUTTON_VARIANT_STYLES[variant]} ${BUTTON_SIZE_STYLES[size]} ${className}`.trim()}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);
AdminButton.displayName = "AdminButton";

// ============================================================================
// 9. AdminPagination
// ============================================================================
export interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemName?: string;
  onPageChange: (page: number) => void;
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  itemName = "items",
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="p-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-muted bg-brand-canvas/20">
      <span>
        Showing Page {currentPage} of {totalPages}
        {totalItems !== undefined && ` (${totalItems} total ${itemName})`}
      </span>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center space-x-1 px-2.5 py-1 border border-brand-border rounded-sm bg-white hover:bg-brand-surface-soft text-brand-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Prev</span>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center space-x-1 px-2.5 py-1 border border-brand-border rounded-sm bg-white hover:bg-brand-surface-soft text-brand-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink"
          aria-label="Next page"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 10. AdminAlert Banner
// ============================================================================
export interface AdminAlertProps {
  type: "success" | "error" | "info" | "warning";
  message: string;
  onDismiss?: () => void;
  fading?: boolean;
}

const ALERT_STYLES = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  error: "bg-rose-50 text-rose-800 border-rose-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
};

export function AdminAlert({ type, message, onDismiss, fading = false }: AdminAlertProps) {
  const Icon =
    type === "success"
      ? CheckCircle
      : type === "error"
        ? AlertCircle
        : type === "warning"
          ? AlertCircle
          : Info;

  const iconColor =
    type === "success"
      ? "text-emerald-600"
      : type === "error"
        ? "text-rose-600"
        : type === "warning"
          ? "text-amber-600"
          : "text-blue-600";

  return (
    <div
      role={type === "success" || type === "info" ? "status" : "alert"}
      className={`p-3.5 rounded-sm border flex items-start justify-between space-x-2 text-xs transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"} ${ALERT_STYLES[type]}`}
    >
      <div className="flex items-start space-x-2">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-brand-muted hover:text-brand-ink p-0.5"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// 11. AdminModal / AdminDialog (Accessible Dialog)
// ============================================================================
export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const MODAL_WIDTH_STYLES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: AdminModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-ink/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`w-full ${MODAL_WIDTH_STYLES[maxWidth]} bg-white border border-brand-border rounded-sm shadow-xl p-6 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-brand-border mb-4">
          <div>
            <h3
              id="admin-modal-title"
              className="font-heading text-lg font-bold uppercase tracking-wide text-brand-ink"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs uppercase tracking-wider text-brand-muted mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-brand-muted hover:text-brand-ink rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
