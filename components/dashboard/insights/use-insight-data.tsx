"use client";

import { useEffect, useState } from "react";
import type { InsightRangeInput } from "@/services/dashboardInsightService";

export interface InsightCardProps {
  companyCode: string;
  startDate: string; // ISO
  endDate: string; // ISO
  className?: string;
}

/**
 * Fetch data 1 kartu insight. Tiap kartu fetch sendiri (bukan lewat
 * Promise.all di dashboard/page.tsx) supaya kalau 1 RPC gagal - mis.
 * migration 0025 belum dijalankan - kartu lain & dashboard tetap jalan.
 * Flag `cancelled` mencegah respons periode lama menimpa periode baru saat
 * user ganti bulan/minggu dengan cepat.
 */
export function useInsightData<T>(
  { companyCode, startDate, endDate }: InsightRangeInput,
  fetcher: (input: InsightRangeInput) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetcher({ companyCode, startDate, endDate })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error("Gagal memuat insight dashboard:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // fetcher sengaja tidak masuk dependency - isinya selalu fungsi modul yang
    // sama, cuma identitasnya baru tiap render (arrow function di kartu).
  }, [companyCode, startDate, endDate]);

  return { data, loading, error };
}

export function InsightMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export const INSIGHT_ERROR_TEXT = "Gagal memuat data.";
export const INSIGHT_EMPTY_TEXT = "Belum ada data pada periode ini.";
