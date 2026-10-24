import React from "react";

export function CheckoutPrimaryAction({
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-storefront-contrast)] bg-[var(--color-storefront-contrast)] px-6 py-3.5 font-sans text-sm font-semibold tracking-wide text-white opacity-100 shadow-subtle transition-[background-color,border-color,box-shadow,transform] duration-200 enabled:hover:border-[var(--color-storefront-accent-hover)] enabled:hover:bg-[var(--color-storefront-accent-hover)] enabled:active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-storefront-contrast)] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-soft disabled:text-text-muted disabled:opacity-100 disabled:shadow-none ${className}`.trim()}
    >
      {children}
    </button>
  );
}
