import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import PettyCashBarangClient from "./PettyCashBarangClient";

export default function BarangPettyCashPage() {
  return (
    <Suspense fallback={<BarangPettyCashSkeleton />}>
      <PettyCashBarangClient />
    </Suspense>
  );
}

const BarangPettyCashSkeleton = () => (
  <Content title="Barang Petty Cash" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
  </Content>
);
