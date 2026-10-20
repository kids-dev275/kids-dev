"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { loginCustomer } from "@/lib/api";
import { getSafeNextUrl } from "@/lib/safe-redirect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel, FieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/form/input";
import { Alert, LoadingSpinner } from "@/components/ui/feedback";

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
    <div className="max-w-md mx-auto py-6 sm:py-10">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <span className="text-xs uppercase tracking-wider font-semibold text-accent-storefront font-sans">
            Welcome Back
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-normal">
            Customer Sign In
          </h1>
          <p className="text-xs sm:text-sm text-text-muted font-sans">
            Sign in to access your order history and profile.
          </p>
        </div>

        {serverError && (
          <Alert variant="error" title="Sign In Error">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField isInvalid={!!errors.email} isRequired>
            <FieldLabel>Email Address</FieldLabel>
            <Input
              type="email"
              autoComplete="email"
              placeholder="customer@example.com"
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
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
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

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
              Sign In
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-border">
          <p className="text-xs sm:text-sm text-text-muted font-sans">
            Don&apos;t have an account yet?{" "}
            <Link
              href={registerHref}
              className="text-accent-storefront font-semibold hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-6 sm:py-10">
          <div className="p-6 sm:p-8 space-y-6 border border-border rounded-lg bg-surface min-h-[460px] animate-pulse" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
