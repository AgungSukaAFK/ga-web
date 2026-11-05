// src/services/vendorService.ts

import { orIlikePattern } from "@/lib/supabase/search-filter";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createClient } from "@/lib/supabase/client";
import { Vendor } from "@/type";

const supabase = createClient();

export const fetchVendors = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  sort?: { column: string; ascending: boolean },
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("vendors").select("*", { count: "exact" });

  if (searchQuery) {
    // SEARCH CASE-INSENSITIVE
    const search = orIlikePattern(searchQuery);
    query = query.or(
      `kode_vendor.ilike.${search},nama_vendor.ilike.${search},pic_contact_person.ilike.${search}`,
    );
  }

  const { data, error, count } = await query
    .order(sort?.column ?? "nama_vendor", {
      ascending: sort?.ascending ?? true,
      nullsFirst: false,
    })
    .order("id", { ascending: true }) // urutan stabil antar halaman
    .range(from, to);

  if (error) throw error;
  return { data: data as Vendor[], count: count || 0 };
};

// Semua vendor untuk export Excel, tanpa terpotong limit 1000 Supabase.
export const fetchAllVendors = async (searchQuery: string | null) =>
  fetchAllRows<Vendor>(() => {
    let query = supabase.from("vendors").select("*");
    if (searchQuery) {
      const search = orIlikePattern(searchQuery);
      query = query.or(
        `kode_vendor.ilike.${search},nama_vendor.ilike.${search},pic_contact_person.ilike.${search}`,
      );
    }
    return query
      .order("nama_vendor", { ascending: true })
      .order("id", { ascending: true });
  });

export const fetchVendorById = async (id: number) => {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Vendor;
};

export const createVendor = async (
  newData: Omit<Vendor, "id" | "created_at">,
) => {
  const { data, error } = await supabase
    .from("vendors")
    .insert([newData])
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Kode Vendor sudah terdaftar.");
    throw error;
  }
  return data as Vendor;
};

export const updateVendor = async (
  id: number,
  updatedData: Partial<Vendor>,
) => {
  // `id` di vendors GENERATED ALWAYS AS IDENTITY - Postgres menolak update
  // apapun ke kolom itu (walau nilainya sama). Caller (form edit) biasanya
  // nge-spread seluruh row lama termasuk id/created_at, jadi dibuang dulu
  // di sini biar semua pemanggil aman, bukan cuma yang inget strip manual.
  const { id: _id, created_at: _createdAt, ...safeData } = updatedData as any;
  const { data, error } = await supabase
    .from("vendors")
    .update(safeData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Vendor;
};

export const deleteVendor = async (id: number) => {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
};

// SEARCH UNTUK DROPDOWN (CASE-INSENSITIVE)
export const searchVendors = async (query: string): Promise<Vendor[]> => {
  const supabase = createClient();

  // Jika query kosong, ambil 10 vendor pertama saja sebagai default list
  let dbQuery = supabase.from("vendors").select("*").limit(10); // LIMIT 10 AGAR RINGAN

  if (query) {
    // Cari berdasarkan Nama ATAU Kode
    dbQuery = dbQuery.or(
      `nama_vendor.ilike.%${query}%,kode_vendor.ilike.%${query}%`,
    );
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("Error searching vendors:", error);
    return [];
  }

  return (data as Vendor[]) || ([] as Vendor[]);
};
