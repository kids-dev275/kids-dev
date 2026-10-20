import React from "react";
import { ChevronDown } from "lucide-react";
import { useFormField } from "./form-field";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isInvalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className = "",
      id: customId,
      isInvalid: customInvalid,
      disabled: customDisabled,
      children,
      ...rest
    },
    ref
  ) => {
    const context = useFormField();
    const id = customId || context?.id;
    const isInvalid = customInvalid ?? context?.isInvalid ?? false;
    const isDisabled = customDisabled ?? context?.isDisabled ?? false;

    const describedBy =
      [isInvalid && context?.errorId, context?.hintId, rest["aria-describedby"]]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          id={id}
          disabled={isDisabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none rounded-md border bg-surface pl-3.5 pr-10 py-2.5 text-sm font-sans text-text-primary transition-colors
            min-h-[44px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-offset-1
            disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-60
            ${
              isInvalid
                ? "border-danger focus-visible:ring-danger"
                : "border-border hover:border-text-muted/40"
            }
            ${className}`.trim()}
          {...rest}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
