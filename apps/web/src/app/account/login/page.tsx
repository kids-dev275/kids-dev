"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { loginCustomer } from "@/lib/api";
import { getSafeNextUrl } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel, FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/form/input";
import { Alert } from "@/components/ui/feedback";
import {
  CustomerAuthCard,
  PasswordField,
  authButtonClassName,
  authInputClassName,
  authLabelClassName,
} from "@/components/account/customer-auth-ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextUrl = getSafeNextUrl(rawNext, "/account");

  const { isAuthenticated, isLoading: authLoading, setCustomerDirect } = useCustomerAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(nextUrl);
    }
  }, [authLoading, isAuthenticated, nextUrl, router]);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    if (!password) {
      errs.password = "Password is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginCustomer({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.success) {
        setCustomerDirect(res.data.customer);
        router.push(nextUrl);
      } else {
        const errorMsg =
          res.error.code === "INVALID_CREDENTIALS"
            ? "Invalid email or password. Please check your credentials and try again."
            : res.error.message || "Login failed. Please try again.";
        setServerError(errorMsg);
      }
    } catch {
      setServerError("A network error occurred. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerHref = rawNext
    ? `/account/register?next=${encodeURIComponent(rawNext)}`
    : "/account/register";

  return (
    <CustomerAuthCard
      variant="login"
      eyebrow="Welcome Back"
      heading="Sign In to Kids Wear"
      description="Sign in to view your orders and manage your profile."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-accent-storefront hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-storefront"
          >
            Create Account
          </Link>
        </>
      }
    >
      {serverError && (
        <Alert variant="error" title="Sign In Error">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormField isInvalid={!!errors.email} isRequired>
          <FieldLabel className={authLabelClassName}>Email Address</FieldLabel>
          <Input
            type="email"
            autoComplete="email"
            placeholder="customer@example.com"
            className={authInputClassName}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={isSubmitting}
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </FormField>

        <FormField isInvalid={!!errors.password} isRequired>
          <FieldLabel className={authLabelClassName}>Password</FieldLabel>
          <PasswordField
            visibilityLabel="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={isSubmitting}
          />
          {errors.password && <FieldError>{errors.password}</FieldError>}
        </FormField>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            className={authButtonClassName}
          >
            Sign In
          </Button>
        </div>
      </form>
    </CustomerAuthCard>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[490px] py-3 sm:py-5">
          <div className="min-h-[510px] animate-pulse rounded-[24px] border border-border bg-surface" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
