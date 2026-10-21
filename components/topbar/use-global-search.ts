"use client";

// Data global search di top bar (./topbar-search.tsx): hasil RPC
// `global_search` & `global_search_pending` (supabase/migrations/
// 0008_global_search.sql) plus riwayat pencarian per akun.
//
// Supaya ringan buat Supabase:
// - 1 RPC per query (bukan query per tabel), maks. SEARCH_PER_GROUP baris per
//   grup, cuma kolom ringan.
// - Baru dikirim setelah berhenti mengetik SEARCH_DEBOUNCE_MS & minimal
//   SEARCH_MIN_CHARS huruf (di bawah itu cuma cari menu/aksi, lokal).
// - Hasil disimpan sebentar (SEARCH_CACHE_TTL_MS) - hapus satu huruf lalu
//   ketik lagi tidak memicu request baru. Request yang sudah basi dibatalkan.
// - Antrian approval cuma diambil saat search dibuka, maks. 1x per
//   PENDING_TTL_MS.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const SEARCH_MIN_CHARS = 3;
export const SEARCH_PER_GROUP = 5;
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_MAX = 40;
const PENDING_LIMIT = 5;
const PENDING_TTL_MS = 60_000;

export type GlobalSearchKind =
  | "mr"
  | "po"
  | "pc_pengajuan"
  | "pc_voucher"
  | "pc_sub_voucher"
  | "pc_deklarasi"
  | "barang"
  | "vendor"
  | "user";

export type GlobalSearchRow = {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  company: string | null;
  amount: number | null;
  created_at: string | null;
  exact: boolean;
  /** Kode utk tautan (vendor: kode_vendor). */
  ref: string | null;
};

/** `total_*` = jumlah semua dokumen yang menunggu (sama di tiap baris). */
export type PendingRow = Omit<GlobalSearchRow, "exact" | "ref"> & {
  total_mr_po: number;
  total_pc: number;
};

export type SearchStatus = "idle" | "loading" | "done" | "error";

const NO_ROWS: GlobalSearchRow[] = [];

export function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

// Cache dibagi semua instance (inline desktop & dialog mobile), dikunci per
// akun supaya ganti akun di tab yang sama tidak kebagian hasil akun lain.
const searchCache = new Map<string, { at: number; rows: GlobalSearchRow[] }>();

function readCache(key: string) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.rows;
}

function writeCache(key: string, rows: GlobalSearchRow[]) {
  searchCache.delete(key);
  searchCache.set(key, { at: Date.now(), rows });
  while (searchCache.size > SEARCH_CACHE_MAX) {
    searchCache.delete(searchCache.keys().next().value!);
  }
}

/**
 * Hasil `global_search` untuk `query`. Selama hasil query baru dimuat, hasil
 * query sebelumnya tetap ditampilkan (status "loading") supaya daftar tidak
 * berkedip tiap ketikan. `flush()` = cari sekarang tanpa menunggu debounce
 * (dipakai saat Enter).
 */
export function useGlobalSearch(query: string, userId: string | null) {
  const q = normalizeQuery(query);
  const enabled = !!userId && q.length >= SEARCH_MIN_CHARS;
  const key = `${userId}:${q.toLowerCase()}`;

  const [result, setResult] = useState<{
    key: string;
    rows: GlobalSearchRow[];
    status: SearchStatus;
  } | null>(null);
  const inflight = useRef<{
    key: string;
    promise: Promise<GlobalSearchRow[]>;
    controller: AbortController;
  } | null>(null);

  const fetchRows = useCallback(
    (key: string, q: string): Promise<GlobalSearchRow[]> => {
      const cached = readCache(key);
      if (cached) return Promise.resolve(cached);
      if (inflight.current?.key === key) return inflight.current.promise;

      inflight.current?.controller.abort();
      const controller = new AbortController();
      const promise = (async () => {
        const { data, error } = await createClient()
          .rpc("global_search", { p_query: q, p_limit: SEARCH_PER_GROUP })
          .abortSignal(controller.signal);
        if (error) throw error;
        const rows = (data ?? []) as GlobalSearchRow[];
        writeCache(key, rows);
        return rows;
      })().finally(() => {
        if (inflight.current?.key === key) inflight.current = null;
      });
      inflight.current = { key, promise, controller };
      return promise;
    },
    [],
  );

  // Ambil hasil & simpan ke state (kalau query-nya masih yang sama).
  const load = useCallback(
    (key: string, q: string) =>
      fetchRows(key, q).then(
        (rows) => {
          setResult((cur) =>
            cur?.key === key ? { key, rows, status: "done" } : cur,
          );
          return rows;
        },
        (error) => {
          setResult((cur) =>
            cur?.key === key ? { key, rows: [], status: "error" } : cur,
          );
          throw error;
        },
      ),
    [fetchRows],
  );

  useEffect(() => {
    if (!enabled) {
      // Mulai query baru dari nol - jangan tampilkan sisa hasil query lama.
      setResult(null);
      return;
    }
    const cached = readCache(key);
    if (cached) {
      setResult({ key, rows: cached, status: "done" });
      return;
    }
    setResult((prev) => ({ key, rows: prev?.rows ?? [], status: "loading" }));
    const timer = window.setTimeout(
      () => load(key, q).catch(() => {}),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [key, enabled, load]);

  // Cari sekarang (Enter / "Coba lagi") tanpa menunggu debounce.
  const flush = useCallback((): Promise<GlobalSearchRow[]> => {
    if (!enabled) return Promise.resolve(NO_ROWS);
    setResult((cur) =>
      cur?.key === key && cur.status === "error"
        ? { ...cur, status: "loading" }
        : cur,
    );
    return load(key, q);
  }, [enabled, load, key, q]);

  if (!enabled) return { rows: NO_ROWS, status: "idle" as SearchStatus, flush };
  return {
    rows: result?.rows ?? NO_ROWS,
    status: (result?.key === key ? result.status : "loading") as SearchStatus,
    flush,
  };
}

const pendingCache = new Map<string, { at: number; rows: PendingRow[] }>();
const NO_PENDING: PendingRow[] = [];

/** Dokumen yang menunggu approval user ini - diambil saat `active`. */
export function usePendingApprovals(userId: string | null, active: boolean) {
  const [rows, setRows] = useState<PendingRow[]>(
    () => (userId && pendingCache.get(userId)?.rows) || NO_PENDING,
  );

  useEffect(() => {
    if (!userId || !active) return;
    const hit = pendingCache.get(userId);
    if (hit) setRows(hit.rows);
    if (hit && Date.now() - hit.at < PENDING_TTL_MS) return;

    let cancelled = false;
    createClient()
      .rpc("global_search_pending", { p_limit: PENDING_LIMIT })
      .then(({ data, error }) => {
        if (error || cancelled) return;
        const next = (data ?? []) as PendingRow[];
        pendingCache.set(userId, { at: Date.now(), rows: next });
        setRows(next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, active]);

  return userId ? rows : NO_PENDING;
}

// ---------------------------------------------------------------------------
// Riwayat (per akun, per device): dokumen yang terakhir dibuka lewat search &
// query yang menghasilkan sesuatu yang dibuka.

export type RecentDoc = {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

type SearchHistory = { docs: RecentDoc[]; queries: string[] };

const HISTORY_MAX_DOCS = 5;
const HISTORY_MAX_QUERIES = 4;
const EMPTY_HISTORY: SearchHistory = { docs: [], queries: [] };

const historyKey = (userId: string) => `ga-global-search-history:${userId}`;

function loadHistory(userId: string): SearchHistory {
  try {
    const raw = localStorage.getItem(historyKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      docs: Array.isArray(parsed?.docs) ? parsed.docs : [],
      queries: Array.isArray(parsed?.queries) ? parsed.queries : [],
    };
  } catch {
    return EMPTY_HISTORY;
  }
}

export function useSearchHistory(userId: string | null) {
  const [history, setHistory] = useState<SearchHistory>(EMPTY_HISTORY);

  // Dibaca setelah mount supaya tidak mismatch hidrasi.
  useEffect(() => {
    setHistory(userId ? loadHistory(userId) : EMPTY_HISTORY);
  }, [userId]);

  const update = useCallback(
    (fn: (prev: SearchHistory) => SearchHistory) => {
      if (!userId) return;
      setHistory((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(historyKey(userId), JSON.stringify(next));
        } catch {
          // abaikan (localStorage penuh / diblokir)
        }
        return next;
      });
    },
    [userId],
  );

  const addDoc = useCallback(
    (doc: RecentDoc) =>
      update((prev) => ({
        ...prev,
        docs: [
          doc,
          ...prev.docs.filter((d) => !(d.kind === doc.kind && d.id === doc.id)),
        ].slice(0, HISTORY_MAX_DOCS),
      })),
    [update],
  );

  const addQuery = useCallback(
    (query: string) => {
      const q = normalizeQuery(query);
      if (q.length < 2) return;
      update((prev) => ({
        ...prev,
        queries: [
          q,
          ...prev.queries.filter((x) => x.toLowerCase() !== q.toLowerCase()),
        ].slice(0, HISTORY_MAX_QUERIES),
      }));
    },
    [update],
  );

  const clear = useCallback(() => update(() => EMPTY_HISTORY), [update]);

  return { history, addDoc, addQuery, clear };
}
