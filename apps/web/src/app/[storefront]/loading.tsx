import React from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/feedback";

export default function StorefrontLoading() {
  return (
    <div className="min-h-screen bg-canvas animate-pulse">
      {/* Top Announcement Skeleton */}
      <div className="h-9 w-full bg-border/40" />

      {/* Header Skeleton */}
      <div className="h-18 border-b border-border bg-surface px-4 sm:px-8 flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="hidden lg:flex items-center gap-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      {/* Hero Skeleton */}
      <div className="h-[460px] sm:h-[520px] bg-border/30 flex items-center justify-center p-8">
        <div className="max-w-xl w-full space-y-4">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-11 w-40 rounded-md" />
        </div>
      </div>

      {/* Content Skeleton */}
      <PageContainer className="py-12 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="aspect-[4/5] rounded-md" />
          <Skeleton className="aspect-[4/5] rounded-md" />
          <Skeleton className="aspect-[4/5] rounded-md" />
          <Skeleton className="aspect-[4/5] rounded-md" />
        </div>
      </PageContainer>
    </div>
  );
}
