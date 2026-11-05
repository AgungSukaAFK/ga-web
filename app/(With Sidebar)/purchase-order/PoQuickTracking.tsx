"use client";

import { useMemo } from "react";
import { buildPoTracking } from "@/lib/poTracking";
import type { PoQuickTracking as PoQuickTrackingData } from "@/services/quickTrackingService";
import { PoTrackingCard } from "./[id]/PoTrackingCard";

// Di-lazy load oleh tabel list, supaya kode Lacak PO tidak ikut bundle awal.
export default function PoQuickTracking({
  data,
  userId,
}: {
  data: PoQuickTrackingData;
  userId: string | undefined;
}) {
  const tracking = useMemo(
    () =>
      buildPoTracking({
        po: data.po,
        logs: data.logs,
        isRequester: !!userId && userId === data.po.material_requests?.userid,
        now: new Date(),
      }),
    [data, userId],
  );

  return (
    <PoTrackingCard tracking={tracking} paymentTerm={data.po.payment_term} />
  );
}
