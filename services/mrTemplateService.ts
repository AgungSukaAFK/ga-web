// src/services/mrTemplateService.ts
//
// "Template MR" - katalog BERSAMA barang MR rutin (tabel `mr_templates`,
// lihat supabase/migrations/20260930000000_mr_template_setup.sql). Dikelola
// GA level approver / admin (RLS), dibaca semua user login - requester
// tinggal terapkan di halaman Buat MR supaya tidak input barang manual.

import { createClient } from "@/lib/supabase/client";
import { MrTemplate, Order } from "@/type";

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
 * Siapkan orders template untuk dimuat ke form Buat MR: data barang
 * (nama, part number, UoM, harga) di-refresh dari tabel `barang` supaya
 * ikut perubahan master barang sejak template dibuat. Barang yang sudah
 * tidak ada di database dibuang & dilaporkan lewat `missing`.
 */
export const applyMrTemplate = async (
  template: MrTemplate,
): Promise<{ orders: Order[]; missing: string[] }> => {
  const templateOrders = template.orders ?? [];
  const ids = [
    ...new Set(
      templateOrders
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
  for (const o of templateOrders) {
    const b = o.barang_id ? barangMap.get(o.barang_id) : undefined;
    if (!b) {
      missing.push(o.name);
      continue;
    }
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
