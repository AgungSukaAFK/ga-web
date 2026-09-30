// src/services/itemVendorHistoryService.ts
//
// "History Vendor" per item MR di halaman Buat PO - vendor mana saja yang
// pernah dipakai membeli barang tsb (lewat RPC `get_item_vendor_history`,
// lihat supabase/migrations/20260930030000_item_vendor_history_setup.sql).
//
// Semua item 1 MR diambil dalam 1 RPC, lalu di-cache di memori (per MR +
// per barang) selama ITEM_VENDOR_HISTORY_TTL_MS - buka ulang MR yang sama
// (pindah halaman lalu balik, ganti link MR, dst) tidak query ulang.

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const ITEM_VENDOR_HISTORY_TTL_MS = 5 * 60 * 1000;

export interface ItemVendorHistoryVendor {
  vendor_id: number | null;
  kode_vendor: string | null;
  nama_vendor: string;
  po_count: number;
  bought_count: number;
  mr_count: number;
  total_qty: number;
  uom: string | null;
  last_price: number | null;
  min_price: number | null;
  max_price: number | null;
  last_kode_po: string | null;
  last_po_at: string | null;
}

export interface ItemVendorHistory {
  // Jumlah MR lain (di luar MR yang sedang dibuka) yang meminta barang ini.
  mr_request_count: number;
  vendors: ItemVendorHistoryVendor[];
}

interface ItemRef {
  barang_id?: number | null;
  part_number?: string | null;
}

/**
 * Kunci pencocokan barang - barang_id kalau ada, fallback part_number.
 * null = barang tanpa identitas (input manual tanpa part number), tidak
 * bisa dicari history-nya.
 */
export const getItemVendorHistoryKey = (item: ItemRef): string | null => {
  if (item.barang_id) return `b:${item.barang_id}`;
  const pn = item.part_number?.trim().toLowerCase();
  return pn ? `p:${pn}` : null;
};

const cache = new Map<string, { data: ItemVendorHistory; at: number }>();
const cacheKey = (mrId: number | null, key: string) => `${mrId ?? "-"}|${key}`;

/**
 * Ambil history vendor utk sekumpulan item sekaligus. Item yang masih ada di
 * cache tidak ikut di-query. Hasil: map kunci (getItemVendorHistoryKey) ->
 * history.
 */
export const fetchItemVendorHistory = async (
  items: ItemRef[],
  excludeMrId: number | null,
): Promise<Record<string, ItemVendorHistory>> => {
  const result: Record<string, ItemVendorHistory> = {};
  const toFetch = new Map<string, ItemRef>();
  const now = Date.now();

  for (const item of items) {
    const key = getItemVendorHistoryKey(item);
    if (!key || result[key] || toFetch.has(key)) continue;
    const cached = cache.get(cacheKey(excludeMrId, key));
    if (cached && now - cached.at < ITEM_VENDOR_HISTORY_TTL_MS) {
      result[key] = cached.data;
    } else {
      toFetch.set(key, item);
    }
  }

  if (toFetch.size === 0) return result;

  const { data, error } = await supabase.rpc("get_item_vendor_history", {
    p_items: Array.from(toFetch, ([key, item]) => ({
      key,
      barang_id: item.barang_id ?? null,
      part_number: item.part_number ?? null,
    })),
    p_exclude_mr_id: excludeMrId,
  });
  if (error) throw error;

  for (const row of (data as any[]) ?? []) {
    const history: ItemVendorHistory = {
      mr_request_count: Number(row.mr_request_count) || 0,
      vendors: ((row.vendors as any[]) ?? []).map((v) => ({
        vendor_id: v.vendor_id ?? null,
        kode_vendor: v.kode_vendor ?? null,
        nama_vendor: v.nama_vendor ?? "Tanpa nama",
        po_count: Number(v.po_count) || 0,
        bought_count: Number(v.bought_count) || 0,
        mr_count: Number(v.mr_count) || 0,
        total_qty: Number(v.total_qty) || 0,
        uom: v.uom ?? null,
        last_price: v.last_price != null ? Number(v.last_price) : null,
        min_price: v.min_price != null ? Number(v.min_price) : null,
        max_price: v.max_price != null ? Number(v.max_price) : null,
        last_kode_po: v.last_kode_po ?? null,
        last_po_at: v.last_po_at ?? null,
      })),
    };
    result[row.item_key] = history;
    cache.set(cacheKey(excludeMrId, row.item_key), { data: history, at: now });
  }

  return result;
};
