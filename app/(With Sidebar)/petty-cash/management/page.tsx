// src/app/(With Sidebar)/petty-cash/management/page.tsx
//
// Manajemen Petty Cash (admin only) - bagian dari revisi "Rombak Petty
// Cash", sekarang lengkap: monitoring 4 tab (Pengajuan/Voucher/Sub-Voucher/
// Deklarasi) + hapus cepat per baris. Override status/jalur approval,
// ganti kode, & edit paksa ada di halaman detail masing-masing dokumen
// (petty-cash/{stage}/[id]/page.tsx) - lihat komentar lengkap di
// PettyCashManagementClient.tsx.

import { Suspense } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import PettyCashManagementClient from "./PettyCashManagementClient";

const ManagementSkeleton = () => (
  <Content title="Management Petty Cash" className="col-span-12">
    <Skeleton className="h-96 w-full" />
  </Content>
);

export default function PettyCashManagementPage() {
  return (
    <Suspense fallback={<ManagementSkeleton />}>
      <PettyCashManagementClient />
    </Suspense>
  );
}
