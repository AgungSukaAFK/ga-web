// src/app/(With Sidebar)/petty-cash/pengajuan-saya/page.tsx
//
// Pengajuan Saya - pusat dokumen Petty Cash (lihat PengajuanSayaClient.tsx).
// Dibungkus Suspense karena PengajuanSayaClient sekarang pakai
// useSearchParams (deep-link "?open=<id>" dari Dashboard Petty Cash,
// PcDashboardClient.tsx) - pola yang sama dgn halaman lain di folder ini
// yang sudah lebih dulu pakai useSearchParams (lihat budgeting/page.tsx,
// input-pengajuan/page.tsx).

import { Suspense } from "react";
import PengajuanSayaClient from "./PengajuanSayaClient";

export default function PengajuanSayaPage() {
  return (
    <Suspense>
      <PengajuanSayaClient />
    </Suspense>
  );
}
