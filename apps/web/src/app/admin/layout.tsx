import React from "react";
import type { Metadata } from "next";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Panel — Kids Wear",
  description: "Operational management for Kids Wear e-commerce platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
