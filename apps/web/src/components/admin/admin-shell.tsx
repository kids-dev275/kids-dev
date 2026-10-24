"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Star,
  Store,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { name: "Reviews", href: "/admin/reviews", icon: Star },
  { name: "Storefronts", href: "/admin/storefronts", icon: Store },
  { name: "Settings", href: "/admin/settings", icon: SettingsIcon },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  const handleCloseMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const mobileDrawerRef = useFocusTrap<HTMLDivElement>({
    isOpen: mobileMenuOpen,
    onClose: handleCloseMobileMenu,
    triggerRef: mobileToggleRef,
  });

  // Close mobile drawer on Escape key press
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      setLogoutError(false);
      if (await logout()) {
        router.replace("/admin/login");
      } else {
        setLogoutError(true);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isCurrent = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink flex flex-col font-sans">
      {/* Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-ink focus:text-white focus:rounded focus:ring-2 focus:ring-offset-2 focus:ring-brand-ink"
      >
        Skip to main content
      </a>

      {/* Top Mobile Bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-white border-b border-brand-border sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/kids-wear-logo.webp"
            alt="Kids Wear"
            width={55}
            height={36}
            className="h-auto w-[55px] object-contain"
          />
          <span className="border-l border-brand-border pl-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">
            Operations
          </span>
        </div>
        <button
          ref={mobileToggleRef}
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-brand-ink hover:bg-brand-surface-soft/60 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside
          className="hidden lg:flex lg:flex-col w-[264px] bg-[#fffdfb] border-r border-brand-border shrink-0 sticky top-0 h-screen shadow-[8px_0_30px_-26px_rgba(63,43,36,0.28)]"
          aria-label="Admin Sidebar"
        >
          {/* Logo Region */}
          <div className="px-6 py-5 border-b border-brand-border">
            <Image
              src="/brand/kids-wear-logo.webp"
              alt="Kids Wear"
              width={82}
              height={54}
              className="h-auto w-[82px] object-contain"
              priority
            />
            <span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-muted">
              Operations Panel
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto" aria-label="Admin navigation">
            {NAV_ITEMS.map((item) => {
              const active = isCurrent(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition-colors border-l-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-1 ${
                    active
                      ? "bg-brand-ink text-white border-champagne shadow-[0_7px_18px_-13px_rgba(63,43,36,0.7)]"
                      : "text-brand-text hover:text-brand-ink hover:bg-brand-surface-soft border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                      active ? "text-champagne" : "text-brand-muted group-hover:text-brand-ink"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User & Logout Region */}
          <div className="p-4 border-t border-brand-border bg-brand-canvas/40">
            {admin?.email && (
              <div className="mb-3 px-2">
                <span className="text-[10px] uppercase tracking-widest text-brand-muted block">
                  Logged in as
                </span>
                <span className="text-xs font-medium text-brand-ink truncate block">
                  {admin.email}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
              aria-label="Sign out of Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            onClick={handleCloseMobileMenu}
          >
            <div
              ref={mobileDrawerRef}
              className="w-4/5 max-w-xs bg-white h-full flex flex-col p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-brand-border">
                <div className="flex items-center space-x-2">
                  <Image
                    src="/brand/kids-wear-logo.webp"
                    alt="Kids Wear"
                    width={62}
                    height={40}
                    className="h-auto w-[62px] object-contain"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-muted">
                    Operations
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMobileMenu}
                  className="p-1 text-brand-muted hover:text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const active = isCurrent(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors border-l-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-1 ${
                        active
                          ? "bg-brand-ink text-white border-champagne shadow-xs"
                          : "text-brand-text hover:text-brand-ink hover:bg-brand-surface-soft/60 border-transparent"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? "text-champagne" : "text-brand-muted group-hover:text-brand-ink"
                        }`}
                        aria-hidden="true"
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-brand-border">
                {admin?.email && (
                  <p className="text-[11px] text-brand-muted truncate mb-2">{admin.email}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleLogout();
                  }}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"
        >
          {logoutError && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              Sign out could not be confirmed. Please try again.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
