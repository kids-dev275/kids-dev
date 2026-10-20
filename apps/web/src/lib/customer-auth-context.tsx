"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { CustomerProfileData } from "@kids-wear/shared";
import { getCurrentCustomer, logoutCustomer } from "./api";

interface CustomerAuthContextValue {
  customer: CustomerProfileData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshCustomer: () => Promise<CustomerProfileData | null>;
  logout: () => Promise<void>;
  setCustomerDirect: (customer: CustomerProfileData | null) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomer = useCallback(async (): Promise<CustomerProfileData | null> => {
    setIsLoading(true);
    try {
      const res = await getCurrentCustomer();
      if (res.success && res.data?.customer) {
        setCustomer(res.data.customer);
        setIsLoading(false);
        return res.data.customer;
      } else {
        setCustomer(null);
        setIsLoading(false);
        return null;
      }
    } catch {
      setCustomer(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutCustomer();
    } catch {
      // Ignored: always clear local memory state
    } finally {
      setCustomer(null);
    }
  }, []);

  const setCustomerDirect = useCallback((cust: CustomerProfileData | null) => {
    setCustomer(cust);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      await refreshCustomer();
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, [refreshCustomer]);

  const value: CustomerAuthContextValue = {
    customer,
    isLoading,
    isAuthenticated: !!customer,
    refreshCustomer,
    logout,
    setCustomerDirect,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}
