"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAdminMe, adminLogout, type AdminUser } from "./admin-api";

interface AdminAuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshAdmin: () => Promise<AdminUser | null>;
  logout: () => Promise<boolean>;
  setAdminDirect: (admin: AdminUser | null) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);
const ADMIN_TAB_MARKER = "kw_admin_tab_authenticated";

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdmin = useCallback(async (): Promise<AdminUser | null> => {
    setIsLoading(true);
    if (sessionStorage.getItem(ADMIN_TAB_MARKER) !== "true") {
      setAdmin(null);
      setIsLoading(false);
      return null;
    }
    try {
      const res = await getAdminMe();
      if (res.success && res.data?.admin) {
        setAdmin(res.data.admin);
        setIsLoading(false);
        return res.data.admin;
      } else {
        sessionStorage.removeItem(ADMIN_TAB_MARKER);
        setAdmin(null);
        setIsLoading(false);
        return null;
      }
    } catch {
      sessionStorage.removeItem(ADMIN_TAB_MARKER);
      setAdmin(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const res = await adminLogout();
      if (!res.success) return false;
      sessionStorage.removeItem(ADMIN_TAB_MARKER);
      setAdmin(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  const setAdminDirect = useCallback((user: AdminUser | null) => {
    if (user) {
      sessionStorage.setItem(ADMIN_TAB_MARKER, "true");
    } else {
      sessionStorage.removeItem(ADMIN_TAB_MARKER);
    }
    setAdmin(user);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await refreshAdmin();
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, [refreshAdmin]);

  const value: AdminAuthContextValue = {
    admin,
    isLoading,
    isAuthenticated: !!admin,
    refreshAdmin,
    logout,
    setAdminDirect,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
