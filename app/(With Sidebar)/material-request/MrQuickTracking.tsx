"use client";

import { useMemo } from "react";
import { buildMrTracking } from "@/lib/mrTracking";
import type { MrQuickTracking as MrQuickTrackingData } from "@/services/quickTrackingService";
import { MrTrackingCard } from "./[id]/MrTrackingCard";

// Di-lazy load oleh tabel list, supaya kode Lacak MR tidak ikut bundle awal.
export default function MrQuickTracking({
  data,
  userId,
}: {
  data: MrQuickTrackingData;
  userId: string | undefined;
}) {
  const tracking = useMemo(
    () =>
      buildMrTracking({
        mr: data.mr,
        pos: data.pos,
        logs: data.logs,
        isOwner: userId === data.mr.userid,
        now: new Date(),
      }),
    [data, userId],
  );

  return <MrTrackingCard tracking={tracking} />;
}
