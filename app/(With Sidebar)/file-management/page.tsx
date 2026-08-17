// src/app/(With Sidebar)/file-management/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { FileManagementClientContent } from "./FileManagementClient";

export default function FileManagementPage() {
  return (
    <Suspense fallback={<FileManagementSkeleton />}>
      <FileManagementClientContent />
    </Suspense>
  );
}

const FileManagementSkeleton = () => (
  <Content title="File Management (Admin)" size="lg" className="col-span-12">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
    <div className="flex flex-col gap-4 mb-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
