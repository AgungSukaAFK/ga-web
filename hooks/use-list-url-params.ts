// src/hooks/use-list-url-params.ts
//
// State halaman list di URL (`page`, `limit`, `sort`, plus filter halaman),
// supaya tombol Back & link yang dibagikan tetap membawa posisi tabel.

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LIMIT_OPTIONS } from "@/type/enum";

const DEFAULT_LIMIT = 25;

type ParamUpdates = Record<string, string | number | undefined>;

export function useListUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = LIMIT_OPTIONS.includes(requestedLimit)
    ? requestedLimit
    : DEFAULT_LIMIT;
  const sort = searchParams.get("sort") || "";

  /** Nilai kosong menghapus param-nya. */
  const setParams = (updates: ParamUpdates) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    const query = params.toString();
    // scroll: false - halaman Petty Cash bisa punya beberapa tabel, jadi ganti
    // halaman di tabel bawah tidak boleh melempar user ke atas.
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  /** Sama seperti setParams, tapi kembali ke halaman 1. */
  const setFilters = (updates: ParamUpdates) =>
    setParams({ ...updates, page: undefined });

  return { searchParams, page, limit, sort, setParams, setFilters };
}
