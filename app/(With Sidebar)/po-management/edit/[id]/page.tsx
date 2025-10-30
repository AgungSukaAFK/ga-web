// src/app/(With Sidebar)/po-management/edit/[id]/page.tsx

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Content } from "@/components/content";
import { PoManagementEditClientContent } from "./PoManagementClientContent";

export default function AdminEditPOPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Tidak perlu use(params) di sini karena ini Server Component
  return (
    <Suspense fallback={<DetailPOSkeleton />}>
      {/* Kirim Promise params langsung ke Client Component */}
      <PoManagementEditClientContent params={params} />
    </Suspense>
  );
}

// Komponen Skeleton Helper
const DetailPOSkeleton = () => (
  <>
    <div className="col-span-12">
      {" "}
      <Skeleton className="h-12 w-1/2" />{" "}
    </div>
    <Content className="col-span-12 lg:col-span-7">
      {" "}
      <Skeleton className="h-96 w-full" />{" "}
    </Content>
    <Content className="col-span-12 lg:col-span-5">
      {" "}
      <Skeleton className="h-96 w-full" />{" "}
    </Content>
  </>
);
