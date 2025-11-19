// src/services/vendorService.ts

import { createClient } from "@/lib/supabase/client";
import { Vendor } from "@/type";

const supabase = createClient();

/**
 * Mengambil daftar Vendors dengan paginasi dan filter
 */
export const fetchVendors = async (
  page: number,
  limit: number,
  searchQuery: string | null
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("vendors").select("*", { count: "exact" });

  if (searchQuery) {
    const search = `%${searchQuery.toLowerCase()}%`;
    query = query.or(
      `kode_vendor.ilike.${search},nama_vendor.ilike.${search},pic_contact_person.ilike.${search},email.ilike.${search}`
    );
  }

  const { data, error, count } = await query
    .order("nama_vendor", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching vendors:", error);
    throw error;
  }

  return { data: data as Vendor[], count: count || 0 };
};

/**
 * Mencari vendor untuk digunakan di Combobox PO
 */
export const searchVendors = async (query: string): Promise<Vendor[]> => {
  if (!query || query.length < 3) return [];
  const search = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("vendors")
    .select("id, kode_vendor, nama_vendor, alamat, pic_contact_person, email")
    .or(`kode_vendor.ilike.${search},nama_vendor.ilike.${search}`)
    .limit(10);

  if (error) {
    console.error("Error searching vendors:", error);
    return [];
  }
  return data as Vendor[];
};

/**
 * Membuat Vendor baru
 */
export const createVendor = async (
  newData: Omit<Vendor, "id" | "created_at">
) => {
  const { data, error } = await supabase
    .from("vendors")
    .insert([newData])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Kode Vendor sudah terdaftar.");
    }
    throw error;
  }
  return data as Vendor;
};

/**
 * Memperbarui Vendor
 */
export const updateVendor = async (
  id: number,
  updatedData: Partial<Omit<Vendor, "id" | "created_at" | "kode_vendor">>
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

/**
 * Menghapus Vendor
 */
export const deleteVendor = async (id: number) => {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
};
