import React from "react";
import { SearchX, ShoppingBag, AlertTriangle, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "../ui/feedback";
import { Button } from "../ui/button";
import { Heading, Text } from "../ui/typography";

export interface LoadingStateProps {
  title?: string;
  message?: string;
  className?: string;
}

export function LoadingState({
  title = "Loading collection...",
  message,
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center ${className}`.trim()}
      role="status"
    >
      <LoadingSpinner size="lg" label={title} />
      <h3 className="font-serif text-lg text-text-primary mt-4 font-normal">{title}</h3>
      {message && (
        <Text variant="body-small" className="text-text-muted mt-1">
          {message}
        </Text>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We were unable to load this section. Please try again or refresh the page.",
  onRetry,
  retryLabel = "Try Again",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto ${className}`.trim()}
      role="alert"
    >
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-danger/10 text-danger mb-4">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <Heading level={3} variant="h3" className="text-text-primary">
        {title}
      </Heading>
      <Text variant="body-small" className="text-text-muted mt-2 leading-relaxed">
        {description}
      </Text>
      {onRetry && (
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto ${className}`.trim()}
    >
      {icon && <div className="text-text-muted mb-4">{icon}</div>}
      <Heading level={3} variant="h3" className="text-text-primary">
        {title}
      </Heading>
      {description && (
        <Text variant="body-small" className="text-text-muted mt-2 leading-relaxed">
          {description}
        </Text>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export interface NoResultsStateProps {
  query?: string;
  onClear?: () => void;
  className?: string;
}

export function NoResultsState({ query, onClear, className = "" }: NoResultsStateProps) {
  return (
    <EmptyState
      icon={<SearchX className="h-10 w-10 text-text-muted" aria-hidden="true" />}
      title="No products found"
      description={
        query
          ? `We couldn't find any products matching "${query}". Try checking your spelling or using different keywords.`
          : "We couldn't find any products matching your active criteria."
      }
      action={
        onClear ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear Search
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface EmptyCartStateProps {
  onStartShopping?: () => void;
  shopHref?: string;
  className?: string;
}

export function EmptyCartState({ onStartShopping, shopHref, className = "" }: EmptyCartStateProps) {
  return (
    <EmptyState
      icon={<ShoppingBag className="h-10 w-10 text-text-muted" aria-hidden="true" />}
      title="Your shopping bag is empty"
      description="Looks like you haven't added anything to your cart yet. Discover our curated collections for children, teens, and young adults."
      action={
        shopHref ? (
          <Button variant="primary" size="md" href={shopHref}>
            Start Shopping
          </Button>
        ) : onStartShopping ? (
          <Button variant="primary" size="md" onClick={onStartShopping}>
            Start Shopping
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}

export interface OutOfStockStateProps {
  message?: string;
  className?: string;
}

export function OutOfStockState({
  message = "This combination is currently unavailable.",
  className = "",
}: OutOfStockStateProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md bg-surface-soft border border-border px-3 py-2 text-xs font-sans text-text-muted ${className}`.trim()}
    >
      <AlertCircle className="h-4 w-4 text-text-muted shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
