import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import MrTemplateClient from "./MrTemplateClient";

export default function MrTemplatePage() {
  return (
    <Suspense fallback={<MrTemplateSkeleton />}>
      <MrTemplateClient />
    </Suspense>
  );
}

const MrTemplateSkeleton = () => (
  <Content title="Template MR" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <Skeleton className="h-10 w-full md:w-1/2" />
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
  </Content>
);
