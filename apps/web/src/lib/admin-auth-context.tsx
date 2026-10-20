"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAdminMe, adminLogout, type AdminUser } from "./admin-api";

interface AdminAuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshAdmin: () => Promise<AdminUser | null>;
  logout: () => Promise<void>;
  setAdminDirect: (admin: AdminUser | null) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAdmin = useCallback(async (): Promise<AdminUser | null> => {
    setIsLoading(true);
    try {
      const res = await getAdminMe();
      if (res.success && res.data?.admin) {
        setAdmin(res.data.admin);
        setIsLoading(false);
        return res.data.admin;
      } else {
        setAdmin(null);
        setIsLoading(false);
        return null;
      }
    } catch {
      setAdmin(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } catch {
      // Always clear local in-memory state
    } finally {
      setAdmin(null);
    }
  }, []);

  const setAdminDirect = useCallback((user: AdminUser | null) => {
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
