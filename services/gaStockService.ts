// src/services/gaStockService.ts

import { createClient } from "@/lib/supabase/client";
import { GaStock, Profile } from "@/type";

const supabase = createClient();

const STOCK_SELECT =
  "*, barang!barang_id ( part_number, part_name, uom, category )";

/**
 * Ambil daftar Stok GA (join master barang) dengan paginasi, pencarian,
 * dan pembatasan perusahaan sesuai scope admin.
 */
export const fetchGaStocks = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  companyFilter: string | null,
  adminProfile: Profile | null,
): Promise<{ data: GaStock[]; count: number }> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("ga_stocks")
    .select(STOCK_SELECT, { count: "exact" });

  if (companyFilter) {
    query = query.eq("company_code", companyFilter);
  }
  // Admin/GA non-LOURDES hanya melihat stok perusahaannya
  if (adminProfile && adminProfile.company !== "LOURDES") {
    query = query.eq("company_code", adminProfile.company);
  }

  // Pencarian by part number / nama barang: cari id barang yang cocok dulu.
  if (searchQuery) {
    const { data: matched } = await supabase
      .from("barang")
      .select("id")
      .or(
        `part_number.ilike.%${searchQuery}%,part_name.ilike.%${searchQuery}%`,
      )
      .limit(1000);
    const ids = (matched ?? []).map((b: { id: number }) => b.id);
    if (ids.length === 0) return { data: [], count: 0 };
    query = query.in("barang_id", ids);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching GA stocks:", error);
    throw error;
  }

  return { data: data as GaStock[], count: count || 0 };
};

/**
 * Tambah stok baru untuk sebuah barang di sebuah perusahaan.
 * Gagal bila kombinasi (barang, perusahaan) sudah punya stok.
 */
export const createGaStock = async (
  payload: {
    barang_id: number;
    company_code: string;
    quantity: number;
    location: string | null;
    note: string | null;
  },
  userId: string,
) => {
  const { data, error } = await supabase
    .from("ga_stocks")
    .insert({
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Barang ini sudah memiliki stok untuk perusahaan tersebut. Silakan edit stok yang ada.",
      );
    }
    throw error;
  }
  return data as GaStock;
};

/**
 * Perbarui jumlah / lokasi / catatan stok. Barang & perusahaan tidak diubah.
 */
export const updateGaStock = async (
  id: number,
  payload: { quantity: number; location: string | null; note: string | null },
  userId: string,
) => {
  const { error } = await supabase
    .from("ga_stocks")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", id);

  if (error) throw error;
};

export const deleteGaStock = async (id: number) => {
  const { error } = await supabase.from("ga_stocks").delete().eq("id", id);
  if (error) throw error;
};
