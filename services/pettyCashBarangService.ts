// src/services/pettyCashBarangService.ts
//
// Katalog barang KHUSUS Petty Cash (tabel `petty_cash_barang`, terpisah dari
// `barang` utama). created_by/updated_by/created_at/updated_at di-set
// otomatis oleh trigger DB dari auth.uid() (lihat
// supabase/migrations/0003_petty_cash_master.sql (asal: petty_cash_barang_setup.sql)) - JANGAN dikirim dari sini, RLS juga
// yang membatasi insert/update/delete cuma admin & departemen GA (lihat
// isGADepartment di lib/constants/departments.ts).

import { createClient } from "@/lib/supabase/client";
import { PettyCashBarang } from "@/type";
import { PC_COA_OPTIONS } from "@/type/enum";

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
      `part_name.ilike.${search},part_number.ilike.${search},coa_gmi.ilike.${search},coa_gis.ilike.${search},vendor.ilike.${search}`,
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
  | "uom"
  | "vendor"
  | "last_purchase_price"
  | "link"
  | "description"
  | "coa_gmi"
  | "coa_gis"
>;

// COA barang ini di satu company - null = nonaktif di company tsb (lihat
// PettyCashBarang.coa_gmi/coa_gis di type/index.ts).
export const pettyCashBarangCoaFor = (
  barang: Pick<PettyCashBarang, "coa_gmi" | "coa_gis">,
  company: "GMI" | "GIS",
): string | null => (company === "GMI" ? barang.coa_gmi : barang.coa_gis);

// Company tempat barang ini aktif (COA-nya terisi).
export const pettyCashBarangActiveCompanies = (
  barang: Pick<PettyCashBarang, "coa_gmi" | "coa_gis">,
): ("GMI" | "GIS")[] =>
  PC_COA_OPTIONS.filter((c) => !!pettyCashBarangCoaFor(barang, c));

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

// Semua COA yang sudah pernah dipakai per company - dipakai sebagai saran
// combobox COA di form barang (digabung dengan
// PETTY_CASH_BARANG_KATEGORI_OPTIONS_BY_COA, type/enum.ts). Katalog cuma
// ratusan baris, jadi cukup ambil dua kolom ini semua lalu dedupe di sini.
export const fetchPettyCashBarangCoaOptions = async (): Promise<
  Record<"GMI" | "GIS", string[]>
> => {
  const { data, error } = await supabase
    .from("petty_cash_barang")
    .select("coa_gmi, coa_gis");
  if (error) throw error;
  const gmi = new Set<string>();
  const gis = new Set<string>();
  (data ?? []).forEach((r) => {
    if (r.coa_gmi) gmi.add(r.coa_gmi);
    if (r.coa_gis) gis.add(r.coa_gis);
  });
  return { GMI: [...gmi], GIS: [...gis] };
};

// COA katalog per company utk barang-barang ini - dipakai saat Template
// Pengajuan / Ajukan Ulang diterapkan supaya `category` tiap baris ikut COA
// company pengajuan yang baru, bukan yang tersimpan saat template dibuat
// (lihat InputPengajuanClient.tsx).
export const fetchPettyCashBarangCoaByIds = async (
  ids: number[],
): Promise<Record<number, Pick<PettyCashBarang, "coa_gmi" | "coa_gis">>> => {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("petty_cash_barang")
    .select("id, coa_gmi, coa_gis")
    .in("id", ids);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [r.id, { coa_gmi: r.coa_gmi, coa_gis: r.coa_gis }]),
  );
};

// Dipakai combobox pencarian barang di form Input Pengajuan (lihat
// PettyCashItemSearchCombobox.tsx) - ringan, tanpa join profil pembuat/
// pengubah yang tidak relevan buat requester biasa milih barang.
//
// `coaFilter` membatasi hasil ke barang yang aktif (COA-nya terisi) di
// company itu - pencarian teks juga cuma ke COA company tsb. Lourdes (atau
// kalau dipanggil dari halaman kelola katalog) kirim null/undefined supaya
// tidak difilter sama sekali. Lihat PettyCashBarang.coa_gmi/coa_gis di
// type/index.ts.
export const searchPettyCashBarang = async (
  query: string,
  coaFilter?: "GMI" | "GIS" | null,
): Promise<PettyCashBarang[]> => {
  let dbQuery = supabase
    .from("petty_cash_barang")
    .select(
      "id, part_number, part_name, uom, vendor, last_purchase_price, link, description, coa_gmi, coa_gis, created_at, created_by, updated_at, updated_by",
    )
    .order("part_name", { ascending: true })
    .limit(10);

  const coaColumns = coaFilter
    ? [coaFilter === "GMI" ? "coa_gmi" : "coa_gis"]
    : ["coa_gmi", "coa_gis"];

  if (query) {
    const search = `%${query}%`;
    dbQuery = dbQuery.or(
      [
        `part_name.ilike.${search}`,
        `part_number.ilike.${search}`,
        ...coaColumns.map((col) => `${col}.ilike.${search}`),
      ].join(","),
    );
  }

  if (coaFilter) {
    dbQuery = dbQuery.not(coaColumns[0], "is", null);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("Error searching petty cash barang:", error);
    return [];
  }
  return (data ?? []) as PettyCashBarang[];
};
