// src/services/mrTemplateService.ts
//
// "Template MR" - katalog BERSAMA barang MR rutin (tabel `mr_templates`,
// lihat supabase/migrations/20260930000000_mr_template_setup.sql). Dikelola
// GA level approver / admin (RLS), dibaca semua user login - requester
// tinggal terapkan di halaman Buat MR supaya tidak input barang manual.

import { createClient } from "@/lib/supabase/client";
import { MrTemplate, Order } from "@/type";
import { normalizeMrOrders } from "@/services/mrService";

const supabase = createClient();

export type MrTemplatePayload = {
  nama_template: string;
  deskripsi: string | null;
  kategori: string | null;
  remarks: string | null;
  orders: Order[];
};

// Cuma field yang relevan buat template - field tracking MR (status, po_refs,
// dst) jangan sampai ikut kesimpan.
const toTemplateOrder = (o: Order): Order => ({
  name: o.name,
  qty: o.qty,
  uom: o.uom,
  estimasi_harga: Number(o.estimasi_harga) || 0,
  note: o.note || "",
  url: o.url || "",
  barang_id: o.barang_id ?? null,
  part_number: o.part_number ?? null,
});

export const fetchMrTemplates = async (): Promise<MrTemplate[]> => {
  const { data, error } = await supabase
    .from("mr_templates")
    .select("*")
    .order("nama_template", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MrTemplate[];
};

export const fetchMrTemplateById = async (id: number): Promise<MrTemplate> => {
  const { data, error } = await supabase
    .from("mr_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as MrTemplate;
};

export const createMrTemplate = async (
  payload: MrTemplatePayload,
): Promise<MrTemplate> => {
  const { data, error } = await supabase
    .from("mr_templates")
    .insert([{ ...payload, orders: payload.orders.map(toTemplateOrder) }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MrTemplate;
};

export const updateMrTemplate = async (
  id: number,
  payload: MrTemplatePayload,
): Promise<void> => {
  const { error } = await supabase
    .from("mr_templates")
    .update({ ...payload, orders: payload.orders.map(toTemplateOrder) })
    .eq("id", id);

  if (error) throw error;
};

export const deleteMrTemplate = async (id: number): Promise<void> => {
  const { error } = await supabase.from("mr_templates").delete().eq("id", id);
  if (error) throw error;
};

/**
 * Siapkan orders (dari template / MR lama) untuk dimuat ke form Buat MR:
 * data barang (nama, part number, UoM, harga) di-refresh dari tabel
 * `barang` supaya ikut perubahan master barang. Barang yang sudah tidak ada
 * di database (atau item lama tanpa barang_id) dibuang & dilaporkan lewat
 * `missing`.
 */
const refreshOrdersFromBarang = async (
  sourceOrders: Order[],
): Promise<{ orders: Order[]; missing: string[] }> => {
  const ids = [
    ...new Set(
      sourceOrders
        .map((o) => o.barang_id)
        .filter((id): id is number => !!id),
    ),
  ];

  const barangMap = new Map<
    number,
    {
      part_name: string | null;
      part_number: string | null;
      uom: string | null;
      last_purchase_price: number | null;
    }
  >();
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("barang")
      .select("id, part_name, part_number, uom, last_purchase_price")
      .in("id", ids);
    if (error) throw error;
    (data ?? []).forEach((b) => barangMap.set(b.id, b));
  }

  const missing: string[] = [];
  const orders: Order[] = [];
  const seen = new Set<number>();
  for (const o of sourceOrders) {
    const b = o.barang_id ? barangMap.get(o.barang_id) : undefined;
    if (!b || !o.barang_id) {
      missing.push(o.name);
      continue;
    }
    // Barang sama muncul 2x (bisa terjadi di MR lama) - form Buat MR
    // melarang duplikat, ambil yang pertama saja.
    if (seen.has(o.barang_id)) continue;
    seen.add(o.barang_id);
    orders.push({
      ...toTemplateOrder(o),
      name: b.part_name || o.name,
      part_number: b.part_number ?? o.part_number ?? null,
      uom: b.uom || o.uom || "Pcs",
      estimasi_harga:
        b.last_purchase_price && b.last_purchase_price > 0
          ? b.last_purchase_price
          : Number(o.estimasi_harga) || 0,
      level: "Open 1",
    });
  }

  return { orders, missing };
};

export const applyMrTemplate = (template: MrTemplate) =>
  refreshOrdersFromBarang(template.orders ?? []);

// --- History MR: pakai MR lama sebagai template ---

export type MrHistoryItem = {
  id: number;
  kode_mr: string;
  kategori: string | null;
  remarks: string | null;
  status: string | null;
  department: string | null;
  company_code: string | null;
  created_at: string;
  orders: Order[];
  requester_name: string | null;
};

export const MR_HISTORY_SEARCH_LIMIT = 5;

/**
 * Cari MR lama dari departemen yang sama untuk dipakai ulang sebagai
 * template di Buat MR - cocok ke kode MR, teks remarks, nama barang, atau
 * part number. Lewat RPC `search_mr_history` (lihat
 * supabase/migrations/20260930010000_mr_history_search_setup.sql) karena
 * perlu cari di dalam kolom json `orders`. Dibatasi MR_HISTORY_SEARCH_LIMIT
 * hasil supaya hemat query. `companyCode` null = tanpa filter perusahaan
 * (user LOURDES).
 */
export const searchMrHistory = async (
  searchQuery: string,
  department: string,
  companyCode: string | null,
): Promise<MrHistoryItem[]> => {
  const q = searchQuery.trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_mr_history", {
    p_query: q,
    p_department: department,
    p_company_code: companyCode,
    p_limit: MR_HISTORY_SEARCH_LIMIT,
  });

  if (error) throw error;
  return ((data as any[]) ?? []).map((mr) => ({
    id: mr.id,
    kode_mr: mr.kode_mr,
    kategori: mr.kategori,
    remarks: mr.remarks,
    status: mr.status,
    department: mr.department,
    company_code: mr.company_code,
    created_at: mr.created_at,
    orders: normalizeMrOrders((mr.orders as any[]) ?? []),
    requester_name: mr.requester_nama ?? null,
  }));
};

export const applyMrHistory = (mr: MrHistoryItem) =>
  refreshOrdersFromBarang(mr.orders);
