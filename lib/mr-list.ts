// lib/mr-list.ts
//
// Aturan tabel list MR yang dipakai bersama halaman Material Request, MR Saya
// & Manajemen MR: kolom sort, hak akses company, dan search.

import type { SortColumnConfig } from "@/components/sortable-table-head";
import type { createClient } from "@/lib/supabase/client";
import { orIlikePattern } from "@/lib/supabase/search-filter";

// Kolom yang bisa di-sort lewat klik header tabel (key = nilai di URL).
export const MR_DEFAULT_SORT = "created_at.desc";
export const MR_SORTABLE_COLUMNS: Record<string, SortColumnConfig> = {
  kode_mr: { column: "kode_mr" },
  prioritas: { column: "prioritas" },
  cost_center: { column: "cost_centers(code)" },
  level: { column: "level" },
  kategori: { column: "kategori" },
  department: { column: "department" },
  tujuan_site: { column: "tujuan_site" },
  requester: { column: "users_with_profiles(nama)" },
  status: { column: "status" },
  umur: { column: "created_at", invert: true },
  company: { column: "company_code" },
  created_at: { column: "created_at" },
  due_date: { column: "due_date" },
  cost_estimation: { column: "cost_estimation" },
};

// Company yang boleh dilihat user. ["ALL"] = semua company.
export const getMrAllowedScope = (userCompany: string | null | undefined) => {
  if (userCompany === "LOURDES") return ["ALL"];
  if (userCompany === "GMI" || userCompany === "GIS") {
    return [userCompany, "LOURDES"];
  }
  return userCompany ? [userCompany] : [];
};

// Harus sama dengan kolom yang dicari di buildMrSearchFilter.
export const MR_SEARCH_FIELDS = [
  "Kode MR",
  "Nama barang",
  "Part number",
  "Catatan barang",
  "Requester",
  "Remarks",
  "Status",
  "Kategori",
  "Departemen",
  "Tujuan Site",
  "Cost Center",
];

// Dipakai tabel & export Excel supaya hasilnya selalu sama.
export const buildMrSearchFilter = async (
  s: ReturnType<typeof createClient>,
  term: string,
) => {
  const pattern = orIlikePattern(term);
  const [{ data: users }, { data: costCenters }] = await Promise.all([
    s.from("users_with_profiles").select("id").ilike("nama", `%${term}%`),
    s
      .from("cost_centers")
      .select("id")
      .or(`code.ilike.${pattern},name.ilike.${pattern}`),
  ]);

  const filters = [
    "kode_mr",
    "remarks",
    "status",
    "kategori",
    "department",
    "tujuan_site",
    "mr_items_search_text", // computed field, lihat 0021_list_search_items.sql
  ].map((column) => `${column}.ilike.${pattern}`);
  if (users?.length) {
    filters.push(`userid.in.(${users.map((u) => u.id).join(",")})`);
  }
  if (costCenters?.length) {
    filters.push(
      `cost_center_id.in.(${costCenters.map((c) => c.id).join(",")})`,
    );
  }
  return filters.join(",");
};
