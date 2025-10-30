// src/app/(With Sidebar)/po-management/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { PoManagementClientContent } from "./PoManagementClient";

export default function PoManagementPage() {
  return (
    <Suspense fallback={<PoManagementSkeleton />}>
      <PoManagementClientContent />
    </Suspense>
  );
}

// Komponen skeleton untuk fallback
const PoManagementSkeleton = () => (
  <Content
    title="Manajemen Purchase Order (Admin)"
    size="lg"
    className="col-span-12"
  >
    {/* Skeleton untuk filter */}
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
    {/* Skeleton untuk tabel */}
    <Skeleton className="h-96 w-full rounded-lg" />
    {/* Skeleton untuk pagination */}
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
