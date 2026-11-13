"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { INSIGHT_ERROR_TEXT, InsightMessage } from "./use-insight-data";

// Helper bersama untuk popup detail kartu insight dashboard.

export const formatQty = (value: number): string =>
  value.toLocaleString("id-ID", { maximumFractionDigits: 2 });

/** Qty + satuan; satuan null = campur (beda-beda antar baris). */
export const formatQtyUom = (value: number, uom: string | null): string =>
  `${formatQty(value)} ${uom ?? "(satuan campur)"}`;

export const formatHours = (hours: number | null): string => {
  if (hours == null) return "–";
  if (hours < 1) return "< 1 jam";
  if (hours < 24) return `${Math.round(hours)} jam`;
  return `${(hours / 24).toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;
};

export const formatShortDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * Fetch data detail hanya saat popup dibuka (`key` tidak null). Ganti key =
 * fetch ulang; respons lama dibuang kalau key sudah berubah.
 */
export function useDetailData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (key == null) return;
    let cancelled = false;
    setData(null);
    setLoading(true);
    setError(false);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error("Gagal memuat detail insight:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // fetcher sengaja tidak masuk dependency (sama seperti useInsightData).
  }, [key]);

  return { data, loading, error };
}

export function InsightDetailDialog({
  open,
  onOpenChange,
  title,
  description,
  loading,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  loading: boolean;
  error: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-[240px] w-full" />
          </div>
        ) : error ? (
          <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
        ) : (
          children
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Kotak angka ringkas di bagian atas popup. */
export function DetailStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Wrapper tabel di dalam popup: scroll sendiri supaya dialog tidak kepanjangan. */
export function DetailTableWrap({ children }: { children: React.ReactNode }) {
  return <div className="max-h-[360px] overflow-auto rounded-md border">{children}</div>;
}
