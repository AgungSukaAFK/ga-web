// src/app/(With Sidebar)/purchase-order/edit/[id]/page.tsx

"use client";

import { use, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PoEditForm } from "../PoEditForm";

// Form-nya dipakai bersama dengan Edit PO admin (po-management/edit/[id]) -
// lihat PoEditForm.tsx.
export default function EditPOPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <div className="col-span-12">
          <Skeleton className="h-[80vh] w-full" />
        </div>
      }
    >
      <PoEditForm poId={parseInt(resolvedParams.id)} mode="user" />
    </Suspense>
  );
}
