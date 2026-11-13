// src/app/(With Sidebar)/approval-validation/page.tsx

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalValidationClient } from "./ApprovalValidationClient";

// Suspense wajib karena client memakai useSearchParams (filter di URL).
export default function ApprovalValidationPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <ApprovalValidationClient />
    </Suspense>
  );
}
