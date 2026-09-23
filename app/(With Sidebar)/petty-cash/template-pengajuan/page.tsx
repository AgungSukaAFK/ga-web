import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import PettyCashPengajuanTemplateClient from "./PettyCashPengajuanTemplateClient";

export default function TemplatePengajuanPage() {
  return (
    <Suspense fallback={<TemplatePengajuanSkeleton />}>
      <PettyCashPengajuanTemplateClient />
    </Suspense>
  );
}

const TemplatePengajuanSkeleton = () => (
  <Content title="Template Pengajuan" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
  </Content>
);
