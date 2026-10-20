import React from "react";
import { useFormField } from "./form-field";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className = "", id: customId, isInvalid: customInvalid, disabled: customDisabled, ...rest },
    ref
  ) => {
    const context = useFormField();
    const id = customId || context?.id;
    const isInvalid = customInvalid ?? context?.isInvalid ?? false;
    const isDisabled = customDisabled ?? context?.isDisabled ?? false;

    // Build aria-describedby for accessibility
    const describedBy =
      [isInvalid && context?.errorId, context?.hintId, rest["aria-describedby"]]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <input
        ref={ref}
        id={id}
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm font-sans text-text-primary placeholder:text-text-muted/60 transition-colors
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
      />
    );
  }
);

Input.displayName = "Input";
