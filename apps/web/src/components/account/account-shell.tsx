"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Package, Settings, LogOut } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, Skeleton } from "@/components/ui/feedback";

export interface AccountShellProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Overview", icon: User, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package, exact: false },
  { href: "/account/profile", label: "Profile", icon: Settings, exact: true },
];

export function AccountShell({ children }: AccountShellProps) {
  const { customer, isLoading, isAuthenticated, logout } = useCustomerAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/account/login${nextParam}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div
        className="py-16 flex flex-col items-center justify-center min-h-[400px]"
        role="status"
        aria-busy="true"
      >
        <LoadingSpinner size="lg" label="Loading customer account..." />
        <p className="mt-4 text-sm text-text-muted font-sans animate-pulse">
          Loading your account...
        </p>
        <div className="mt-8 w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer) {
    return null;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/account/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Account Header Banner */}
      <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-semibold text-accent-storefront font-sans">
            Customer Account
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-normal">
            Welcome, {customer.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted font-sans">
            {customer.email} {customer.phone ? `• ${customer.phone}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Account Navigation Tabs */}
      <nav aria-label="Account Navigation" className="border-b border-border">
        <ul className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-sans font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px] ${
                    isActive
                      ? "border-accent-storefront text-accent-storefront font-semibold"
                      : "border-transparent text-text-muted hover:text-ink hover:border-border"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content Area */}
      <main className="focus:outline-none">{children}</main>
    </div>
  );
}
