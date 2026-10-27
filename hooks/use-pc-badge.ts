// src/hooks/use-pc-badge.ts
//
// Angka badge menu Petty Cash di sidebar - lihat
// services/pettyCashBadgeService.ts utk apa yang dihitung. Tabel Petty Cash
// tidak ada di publikasi realtime, jadi refresh dipicu dari luar lewat
// `refreshKey` (sidebar mengisinya dgn jumlah notifikasi belum dibaca + path
// halaman Petty Cash yang sedang dibuka): notif baru masuk = biasanya ada
// dokumen yang berubah status, dan pindah halaman di modul Petty Cash =
// biasanya habis memproses sesuatu.

"use client";

import { useEffect, useState } from "react";
import {
  fetchPcBadgeCounts,
  PcBadgeCounts,
  PcBadgeProfile,
} from "@/services/pettyCashBadgeService";

export function usePcBadge(
  userId: string | null | undefined,
  profile: PcBadgeProfile | null | undefined,
  refreshKey: string,
): PcBadgeCounts {
  const [counts, setCounts] = useState<PcBadgeCounts>({
    approvals: 0,
    myActions: 0,
  });

  const role = profile?.role ?? null;
  const department = profile?.department ?? null;
  const company = profile?.company ?? null;
  const ready = !!userId && !!profile;

  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    fetchPcBadgeCounts(userId, { role, department, company })
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        // Best-effort - badge bukan fitur kritikal.
      });
    return () => {
      cancelled = true;
    };
  }, [ready, userId, role, department, company, refreshKey]);

  return counts;
}
