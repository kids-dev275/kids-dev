"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { adminLogin } from "@/lib/admin-api";
import { Shield, Lock, Mail, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, setAdminDirect } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-brand-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-primary/10 text-brand-primary mb-4">
          <Shield className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-brand-ink uppercase">
          Kids Wear Admin
        </h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-brand-muted font-medium">
          Secure Store Operations Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-brand-sand rounded-sm sm:px-10">
          {errorMessage && (
            <div
              className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-sm flex items-start space-x-2 text-rose-800 text-xs"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1.5"
              >
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-muted">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kidswear.local"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink placeholder:text-brand-muted/70 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs uppercase tracking-wider font-semibold text-brand-ink mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-muted">
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-brand-canvas/30 border border-brand-sand rounded-sm text-brand-ink placeholder:text-brand-muted/70 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-sm text-xs uppercase tracking-widest font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? "Authenticating..." : "Sign In to Admin"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-brand-sand text-center">
            <p className="text-[11px] text-brand-muted">
              Access restricted to authorized personnel only. All access attempts are audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
