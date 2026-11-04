// src/app/(With Sidebar)/petty-cash/deklarasi/page.tsx
//
// Deklarasi Petty Cash - requester mendeklarasikan Sub-Voucher (tarikan
// dana) yang sudah dibayar Finance (lihat DeklarasiClient.tsx).

import { Suspense } from "react";
import DeklarasiClient from "./DeklarasiClient";

export default function DeklarasiPage() {
  return (
    <Suspense>
      <DeklarasiClient />
    </Suspense>
  );
}
