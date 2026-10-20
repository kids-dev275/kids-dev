"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { admin, isLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div
        data-testid="admin-loading-guard"
        className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center p-6 text-brand-ink"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest text-brand-muted font-medium">
          Verifying Admin Authorization...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null;
  }

  return <>{children}</>;
}
