// src/services/pettyCashBarangService.ts
//
// Katalog barang KHUSUS Petty Cash (tabel `petty_cash_barang`, terpisah dari
// `barang` utama). created_by/updated_by/created_at/updated_at di-set
// otomatis oleh trigger DB dari auth.uid() (lihat
// supabase/petty-cash-barang-setup.sql) - JANGAN dikirim dari sini, RLS juga
// yang membatasi insert/update/delete cuma admin & departemen GA (lihat
// isGADepartment di lib/constants/departments.ts).

import { createClient } from "@/lib/supabase/client";
import { PettyCashBarang } from "@/type";

const supabase = createClient();

const SELECT_WITH_PROFILES = `
  *,
  created_by_profile:profiles!petty_cash_barang_created_by_fkey (nama),
  updated_by_profile:profiles!petty_cash_barang_updated_by_fkey (nama)
`;

export const fetchPettyCashBarang = async (
  page: number,
  limit: number,
  searchQuery: string | null,
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("petty_cash_barang")
    .select(SELECT_WITH_PROFILES, { count: "exact" });

  if (searchQuery) {
    const search = `%${searchQuery}%`;
    query = query.or(
      `part_name.ilike.${search},part_number.ilike.${search},category.ilike.${search},vendor.ilike.${search}`,
    );
  }

  const { data, error, count } = await query
    .order("part_name", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { data: (data ?? []) as unknown as PettyCashBarang[], count: count || 0 };
};

export type PettyCashBarangFormInput = Pick<
  PettyCashBarang,
  | "part_number"
  | "part_name"
  | "category"
  | "uom"
  | "vendor"
  | "last_purchase_price"
  | "link"
  | "description"
>;

export const createPettyCashBarang = async (
  newData: PettyCashBarangFormInput,
) => {
  const { data, error } = await supabase
    .from("petty_cash_barang")
    .insert([newData])
    .select(SELECT_WITH_PROFILES)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error("Part Number sudah terdaftar. Gunakan kode unik.");
    throw error;
  }
  return data as unknown as PettyCashBarang;
};

export const updatePettyCashBarang = async (
  id: number,
  updatedData: Partial<PettyCashBarangFormInput>,
) => {
  const { data, error } = await supabase
    .from("petty_cash_barang")
    .update(updatedData)
    .eq("id", id)
    .select(SELECT_WITH_PROFILES)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error("Part Number sudah terdaftar. Gunakan kode unik.");
    throw error;
  }
  return data as unknown as PettyCashBarang;
};

export const deletePettyCashBarang = async (id: number) => {
  const { error } = await supabase
    .from("petty_cash_barang")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// Dipakai combobox pencarian barang di form Input Pengajuan (lihat
// PettyCashItemSearchCombobox.tsx) - ringan, tanpa join profil pembuat/
// pengubah yang tidak relevan buat requester biasa milih barang.
export const searchPettyCashBarang = async (
  query: string,
): Promise<PettyCashBarang[]> => {
  let dbQuery = supabase
    .from("petty_cash_barang")
    .select(
      "id, part_number, part_name, category, uom, vendor, last_purchase_price, link, description, created_at, created_by, updated_at, updated_by",
    )
    .order("part_name", { ascending: true })
    .limit(10);

  if (query) {
    const search = `%${query}%`;
    dbQuery = dbQuery.or(
      `part_name.ilike.${search},part_number.ilike.${search},category.ilike.${search}`,
    );
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("Error searching petty cash barang:", error);
    return [];
  }
  return (data ?? []) as PettyCashBarang[];
};
