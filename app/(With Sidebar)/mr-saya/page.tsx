// src/app/(With Sidebar)/mr-saya/page.tsx

"use client";

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialRequestContent } from "../material-request/MaterialRequestClient";

export default function MrSayaPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <MaterialRequestContent onlyMine />
    </Suspense>
  );
}
