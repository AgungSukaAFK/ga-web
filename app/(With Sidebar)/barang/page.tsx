// src/app/(With Sidebar)/barang/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import BarangClientContent from "./BarangClient";

export default function BarangPage() {
  return (
    <Suspense fallback={<BarangPageSkeleton />}>
      <BarangClientContent />
    </Suspense>
  );
}

const BarangPageSkeleton = () => (
  <Content
    title="Data Barang"
    description="Daftar barang yang tersedia."
    className="col-span-12"
  >
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-[200px]" />
        <Skeleton className="h-10 w-full md:w-[200px]" />
      </div>
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
