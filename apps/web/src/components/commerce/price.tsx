import React from "react";

export interface PriceProps extends React.HTMLAttributes<HTMLSpanElement> {
  price: string | number;
  compareAtPrice?: string | number | null;
  size?: "sm" | "md" | "lg";
  showDecimals?: boolean;
}

/**
 * Formats a numeric string/number into Pakistani Rupee presentation.
 * Example: "2499.00" -> "Rs. 2,499"
 */
export function formatPKR(amount: string | number, showDecimals = false): string {
  const numeric = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(numeric)) {
    return "Rs. 0";
  }

  // Format with en-PK standard grouping
  const formatted = numeric.toLocaleString("en-PK", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return `Rs. ${formatted}`;
}

const SIZE_MAP = {
  sm: {
    current: "text-sm font-semibold",
    compare: "text-xs line-through text-text-muted",
  },
  md: {
    current: "text-base font-semibold",
    compare: "text-sm line-through text-text-muted",
  },
  lg: {
    current: "text-xl sm:text-2xl font-semibold",
    compare: "text-base line-through text-text-muted",
  },
};

export function Price({
  price,
  compareAtPrice,
  size = "md",
  showDecimals = false,
  className = "",
  ...rest
}: PriceProps) {
  const formattedPrice = formatPKR(price, showDecimals);
  const formattedCompare = compareAtPrice ? formatPKR(compareAtPrice, showDecimals) : null;
  const isDiscounted = Boolean(formattedCompare && compareAtPrice !== price);

  const styles = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-baseline gap-2 font-sans select-none ${className}`.trim()}
      aria-label={
        isDiscounted
          ? `Current price: ${formattedPrice}, original price: ${formattedCompare}`
          : `Price: ${formattedPrice}`
      }
      {...rest}
    >
      <span className={`text-text-primary ${styles.current}`}>{formattedPrice}</span>
      {isDiscounted && (
        <span className={styles.compare} aria-hidden="true">
          {formattedCompare}
        </span>
      )}
    </span>
  );
}
