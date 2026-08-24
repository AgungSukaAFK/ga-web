import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GoodsReceiptSettingsClient } from "./GoodsReceiptSettingsClient";

export default function GoodsReceiptSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="col-span-12 h-64 w-full" />}>
      <GoodsReceiptSettingsClient />
    </Suspense>
  );
}
