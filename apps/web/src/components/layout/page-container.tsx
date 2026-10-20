import React from "react";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  children: React.ReactNode;
}

/**
 * PageContainer provides consistent horizontal margin, max-width (1320px),
 * and responsive horizontal padding across mobile, tablet, and desktop.
 */
export function PageContainer({
  as: Component = "div",
  className = "",
  children,
  ...rest
}: PageContainerProps) {
  return (
    <Component
      className={`mx-auto w-full max-w-container px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}
