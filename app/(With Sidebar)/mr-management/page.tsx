// src/app/(With Sidebar)/mr-management/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import MrManagementClient from "./MrManagementClient";

export default function MrManagementPage() {
  return (
    <Suspense fallback={<MrManagementSkeleton />}>
      <MrManagementClient />
    </Suspense>
  );
}

// Komponen skeleton untuk fallback
const MrManagementSkeleton = () => (
  <Content
    title="Manajemen Material Request (Admin)"
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
