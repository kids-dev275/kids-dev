"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/form/input";

interface CustomerAuthCardProps {
  variant: "login" | "register";
  eyebrow: string;
  heading: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function CustomerAuthCard({
  variant,
  eyebrow,
  heading,
  description,
  children,
  footer,
}: CustomerAuthCardProps) {
  return (
    <div
      className={`relative mx-auto w-full py-3 sm:py-5 ${
        variant === "login" ? "max-w-[490px]" : "max-w-[560px]"
      }`}
    >
      <div className="absolute inset-x-8 top-8 bottom-2 -z-10 rounded-[40px] bg-accent-storefront-soft/70 blur-3xl" />
      <div className="rounded-[22px] border border-[#eaded5] bg-[#fffdfb] px-5 py-7 shadow-[0_24px_70px_-45px_rgba(77,48,39,0.38)] sm:rounded-[24px] sm:px-9 sm:py-9">
        <div className="mb-7 text-center sm:mb-8">
          <Image
            src="/brand/kids-wear-logo.webp"
            alt="Kids Wear"
            width={108}
            height={70}
            className="mx-auto mb-5 h-auto w-[100px] object-contain sm:w-[108px]"
            priority
          />
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-storefront">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-editorial text-[26px] leading-tight text-ink sm:text-[30px]">
            {heading}
          </h1>
          <p className="mx-auto mt-3 max-w-[390px] font-sans text-[13px] leading-relaxed text-text-muted sm:text-sm">
            {description}
          </p>
        </div>

        <div className="space-y-5">{children}</div>

        <div className="mt-7 border-t border-border pt-5 text-center font-sans text-[13px] text-text-muted sm:text-sm">
          {footer}
        </div>
      </div>
    </div>
  );
}

export const authInputClassName =
  "h-[50px] rounded-xl bg-white/90 px-4 text-sm placeholder:text-text-muted/60 focus-visible:border-accent-storefront focus-visible:ring-4 focus-visible:ring-accent-storefront/15 focus-visible:ring-offset-0";

export const authLabelClassName = "normal-case tracking-normal text-[13px]";

export const authButtonClassName =
  "h-[50px] rounded-xl font-semibold shadow-[0_10px_20px_-12px_rgba(77,48,39,0.48)]";

interface PasswordFieldProps extends Omit<InputProps, "type"> {
  visibilityLabel: string;
}

export function PasswordField({ visibilityLabel, className = "", ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        className={`${authInputClassName} pr-14 ${className}`.trim()}
      />
      <button
        type="button"
        aria-label={`${isVisible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((visible) => !visible)}
        disabled={props.disabled}
        className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-accent-storefront focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isVisible ? (
          <EyeOff className="h-[18px] w-[18px]" />
        ) : (
          <Eye className="h-[18px] w-[18px]" />
        )}
      </button>
    </div>
  );
}
