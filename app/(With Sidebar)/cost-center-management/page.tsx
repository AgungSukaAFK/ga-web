// src/app/(With Sidebar)/cost-center-management/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { CostCenterClientContent } from "./CostCenterClient";

export default function CostCenterManagementPage() {
  return (
    <Suspense fallback={<CostCenterSkeleton />}>
      <CostCenterClientContent />
    </Suspense>
  );
}

// Komponen skeleton untuk fallback
const CostCenterSkeleton = () => (
  <Content title="Manajemen Cost Center" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
