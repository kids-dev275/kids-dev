import React from "react";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  isInvalid?: boolean;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className = "", label, hint, isInvalid = false, disabled, id: customId, ...rest }, ref) => {
    const generatedId = React.useId();
    const id = customId || `radio-${generatedId}`;
    const hintId = hint ? `${id}-hint` : undefined;

    return (
      <label
        htmlFor={id}
        className={`inline-flex items-start gap-3 select-none py-1.5 cursor-pointer group ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${className}`.trim()}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            ref={ref}
            id={id}
            type="radio"
            disabled={disabled}
            aria-describedby={hintId}
            className="peer sr-only"
            {...rest}
          />
          <div
            className={`h-5 w-5 rounded-full border transition-colors flex items-center justify-center
              bg-surface
              peer-focus-visible:ring-2 peer-focus-visible:ring-accent-storefront peer-focus-visible:ring-offset-2
              peer-checked:border-accent-storefront
              ${isInvalid ? "border-danger" : "border-border group-hover:border-text-muted/60"}`}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-accent-storefront opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        {(label || hint) && (
          <div className="flex flex-col text-sm">
            {label && (
              <span className="font-sans font-medium text-text-primary group-hover:text-text-primary">
                {label}
              </span>
            )}
            {hint && (
              <span id={hintId} className="text-xs text-text-muted mt-0.5">
                {hint}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Radio.displayName = "Radio";
