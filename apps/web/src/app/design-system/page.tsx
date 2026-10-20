import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystemShowcase } from "./showcase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design System Showcase — Kids Wear",
  robots: {
    index: false,
    follow: false,
  },
};

export function isDesignSystemAvailable(): boolean {
  return process.env.NODE_ENV !== "production";
}

export default function DesignSystemPage() {
  if (!isDesignSystemAvailable()) {
    notFound();
  }

  return <DesignSystemShowcase />;
}
