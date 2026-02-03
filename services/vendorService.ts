// src/services/vendorService.ts

import { createClient } from "@/lib/supabase/client";
import { Vendor } from "@/type";

const supabase = createClient();

export const fetchVendors = async (
  page: number,
  limit: number,
  searchQuery: string | null,
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("vendors").select("*", { count: "exact" });

  if (searchQuery) {
    // SEARCH CASE-INSENSITIVE
    const search = `%${searchQuery}%`;
    query = query.or(
      `kode_vendor.ilike.${search},nama_vendor.ilike.${search},pic_contact_person.ilike.${search}`,
    );
  }

  const { data, error, count } = await query
    .order("nama_vendor", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { data: data as Vendor[], count: count || 0 };
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
  const { data, error } = await supabase
    .from("vendors")
    .update(updatedData)
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
  let dbQuery = supabase
    .from("vendors")
    .select("id, kode_vendor, nama_vendor")
    .limit(10); // LIMIT 10 AGAR RINGAN

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
