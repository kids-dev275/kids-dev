"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminLogin } from "@/lib/admin-api";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, setAdminDirect } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/admin");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your admin email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminLogin(trimmedEmail, password);
      if (res.success && res.data?.admin) {
        setAdminDirect(res.data.admin);
        router.push("/admin");
      } else {
        setErrorMessage(
          res.error?.message || "Invalid email or password. Please verify your credentials."
        );
      }
    } catch {
      setErrorMessage("An unexpected authentication error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-canvas px-4 py-10 font-sans sm:px-6">
      <div className="w-full max-w-[480px] rounded-[24px] border border-brand-border bg-[#fffdfb] px-6 py-8 shadow-[0_26px_75px_-46px_rgba(63,43,36,0.42)] sm:px-10 sm:py-10">
        <div className="mb-8 text-center">
          <Image
            src="/brand/kids-wear-logo.webp"
            alt="Kids Wear"
            width={104}
            height={68}
            className="mx-auto mb-5 h-auto w-[104px] object-contain"
            priority
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#806943]">
            Admin Operations
          </p>
          <h1 className="mt-2 font-editorial text-[30px] leading-tight text-brand-ink">
            Admin Sign In
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Secure access to the Kids Wear management panel.
          </p>
        </div>

        {errorMessage && (
          <div
            className="mb-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="admin-email"
              className="mb-2 block text-[13px] font-semibold text-brand-ink"
            >
              Email
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={isSubmitting}
              className="h-[50px] w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-ink placeholder:text-brand-muted/60 hover:border-brand-muted/40 focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-champagne/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-[13px] font-semibold text-brand-ink"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isSubmitting}
                className="h-[50px] w-full rounded-xl border border-brand-border bg-white px-4 pr-14 text-sm text-brand-ink placeholder:text-brand-muted/60 hover:border-brand-muted/40 focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-champagne/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={isSubmitting}
                className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-brand-muted hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-champagne disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="h-[18px] w-[18px]" />
                ) : (
                  <Eye className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex h-[50px] w-full items-center justify-center rounded-xl border border-transparent bg-brand-ink px-4 text-sm font-semibold text-white shadow-[0_10px_20px_-12px_rgba(63,43,36,0.65)] transition-colors hover:bg-brand-text active:bg-brand-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-champagne disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-7 border-t border-brand-border pt-5 text-center">
          <p className="text-xs text-brand-muted">Authorized personnel only.</p>
        </div>
      </div>
    </main>
  );
}
