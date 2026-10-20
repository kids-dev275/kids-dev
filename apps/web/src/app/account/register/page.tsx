"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { registerCustomer } from "@/lib/api";
import { getSafeNextUrl } from "@/lib/safe-redirect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel, FieldError, FieldHint } from "@/components/ui/form";
import { Input } from "@/components/ui/form/input";
import { Alert, LoadingSpinner } from "@/components/ui/feedback";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextUrl = getSafeNextUrl(rawNext, "/account");

  const { isAuthenticated, isLoading: authLoading, setCustomerDirect } = useCustomerAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(nextUrl);
    }
  }, [authLoading, isAuthenticated, nextUrl, router]);

  const validate = () => {
    const errs: {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      errs.fullName = "Full name is required";
    } else if (trimmedName.length < 2) {
      errs.fullName = "Full name must be at least 2 characters";
    } else if (trimmedName.length > 100) {
      errs.fullName = "Full name must not exceed 100 characters";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address";
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      if (trimmedPhone.length < 7) {
        errs.phone = "Phone number must be at least 7 characters";
      } else if (trimmedPhone.length > 20) {
        errs.phone = "Phone number must not exceed 20 characters";
      }
    }

    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters long";
    } else if (password.length > 128) {
      errs.password = "Password must not exceed 128 characters";
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
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
      const res = await registerCustomer({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() ? phone.trim() : null,
        password,
        confirmPassword,
      });

      if (res.success) {
        setCustomerDirect(res.data.customer);
        router.push(nextUrl);
      } else {
        const errorMsg =
          res.error.code === "EMAIL_ALREADY_EXISTS"
            ? "An account with this email address already exists. Please sign in instead."
            : res.error.message || "Registration failed. Please try again.";
        setServerError(errorMsg);
      }
    } catch {
      setServerError("A network error occurred. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginHref = rawNext
    ? `/account/login?next=${encodeURIComponent(rawNext)}`
    : "/account/login";

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <span className="text-xs uppercase tracking-wider font-semibold text-accent-storefront font-sans">
            New Customer
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-normal">
            Create an Account
          </h1>
          <p className="text-xs sm:text-sm text-text-muted font-sans">
            Join Kids Wear to view your orders and manage your profile.
          </p>
        </div>

        {serverError && (
          <Alert variant="error" title="Registration Error">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField isInvalid={!!errors.fullName} isRequired>
            <FieldLabel>Full Name</FieldLabel>
            <Input
              type="text"
              autoComplete="name"
              placeholder="e.g. Fatima Ali"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              disabled={isSubmitting}
            />
            {errors.fullName && <FieldError>{errors.fullName}</FieldError>}
          </FormField>

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

          <FormField isInvalid={!!errors.phone}>
            <FieldLabel>Phone Number (Optional)</FieldLabel>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="03001234567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              disabled={isSubmitting}
            />
            <FieldHint>
              Optional contact number (7–20 characters) for delivery coordination.
            </FieldHint>
            {errors.phone && <FieldError>{errors.phone}</FieldError>}
          </FormField>

          <FormField isInvalid={!!errors.password} isRequired>
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Between 8 and 128 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={isSubmitting}
            />
            <FieldHint>Must be between 8 and 128 characters.</FieldHint>
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </FormField>

          <FormField isInvalid={!!errors.confirmPassword} isRequired>
            <FieldLabel>Confirm Password</FieldLabel>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              disabled={isSubmitting}
            />
            {errors.confirmPassword && <FieldError>{errors.confirmPassword}</FieldError>}
          </FormField>

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-border">
          <p className="text-xs sm:text-sm text-text-muted font-sans">
            Already have an account?{" "}
            <Link href={loginHref} className="text-accent-storefront font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function CustomerRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-6 sm:py-10">
          <div className="p-6 sm:p-8 space-y-6 border border-border rounded-lg bg-surface min-h-[580px] animate-pulse" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
