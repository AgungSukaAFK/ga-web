// src/app/(With Sidebar)/material-request/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialRequestContent } from "./MaterialRequestClient";

export default function MaterialRequestPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <MaterialRequestContent />
    </Suspense>
  );
}
