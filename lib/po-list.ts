// lib/po-list.ts
//
// Aturan tabel list PO yang dipakai bersama halaman Purchase Order & Manajemen
// PO: kolom sort, hak akses company, filter, dan search.

import type { SortColumnConfig } from "@/components/sortable-table-head";
import type { createClient } from "@/lib/supabase/client";
import { orIlikePattern } from "@/lib/supabase/search-filter";
import { PAYMENT_VALIDATOR_USER_ID } from "@/type/enum";

// Kolom yang bisa di-sort lewat klik header tabel (key = nilai di URL).
export const PO_DEFAULT_SORT = "created_at.desc";
export const PO_SORTABLE_COLUMNS: Record<string, SortColumnConfig> = {
  kode_po: { column: "kode_po" },
  kode_mr: { column: "material_requests(kode_mr)" },
  vendor: { column: "vendor_details->>nama_vendor" },
  pembuat: { column: "users_with_profiles(nama)" },
  company: { column: "company_code" },
  status: { column: "status" },
  umur: { column: "created_at", invert: true },
  total_price: { column: "total_price" },
  created_at: { column: "created_at" },
};

export type PoListFilters = {
  status: string;
  assetType: string;
  minPrice: string;
  maxPrice: string;
  startDate: string;
  endDate: string;
  payment: string;
  paymentTerm: string;
};

// Hak akses company, selalu berlaku (termasuk export "Semua data").
// GMI / GIS -> company sendiri + LOURDES, LOURDES -> semua, lainnya -> sendiri.
// `companyFilter` = pilihan filter Perusahaan, kalau ada.
export const applyPoCompanyAccess = (
  query: any,
  userCompany: string | null | undefined,
  companyFilter?: string,
) => {
  const hasFilter = !!companyFilter && companyFilter !== "all";
  if (userCompany === "LOURDES") {
    return hasFilter ? query.eq("company_code", companyFilter) : query;
  }
  if (userCompany === "GMI" || userCompany === "GIS") {
    return companyFilter === userCompany || companyFilter === "LOURDES"
      ? query.eq("company_code", companyFilter)
      : query.in("company_code", [userCompany, "LOURDES"]);
  }
  return userCompany ? query.eq("company_code", userCompany) : query;
};

// Dipakai tabel & export Excel supaya hasilnya selalu sama.
export const applyPoFilters = (query: any, filters: PoListFilters) => {
  const {
    status,
    assetType,
    minPrice,
    maxPrice,
    startDate,
    endDate,
    payment,
    paymentTerm,
  } = filters;
  let result = query;
  if (status) result = result.eq("status", status);
  if (assetType === "asset") result = result.eq("is_asset", true);
  else if (assetType === "goods") result = result.eq("is_asset", false);
  if (minPrice) result = result.gte("total_price", Number(minPrice));
  if (maxPrice) result = result.lte("total_price", Number(maxPrice));
  if (startDate) result = result.gte("created_at", startDate);
  if (endDate) result = result.lte("created_at", `${endDate}T23:59:59.999Z`);

  const paymentApprovalObject = `[{"userid": "${PAYMENT_VALIDATOR_USER_ID}", "status": "approved"}]`;
  if (payment === "paid") {
    result = result.contains("approvals", paymentApprovalObject);
  } else if (payment === "unpaid") {
    result = result.not("approvals", "cs", paymentApprovalObject);
  }
  if (
    paymentTerm === "ship_after_dp" ||
    paymentTerm === "ship_after_full_payment"
  ) {
    result = result.eq("dp_bp_shipping_type", paymentTerm);
  } else if (paymentTerm) {
    result = result.ilike("payment_term", `%${paymentTerm}%`);
  }
  return result;
};

// Harus sama dengan kolom yang dicari di buildPoSearchFilter.
export const PO_SEARCH_FIELDS = [
  "Kode PO",
  "Nama barang",
  "Part number",
  "Deskripsi barang",
  "Nama vendor",
  "Kode vendor",
  "Kode MR",
  "Pembuat PO",
  "Status PO",
];

// Dipakai tabel & export Excel supaya hasilnya selalu sama.
export const buildPoSearchFilter = async (
  s: ReturnType<typeof createClient>,
  term: string,
) => {
  const pattern = orIlikePattern(term);
  const [{ data: matchingMRs }, { data: matchingUsers }] = await Promise.all([
    s.from("material_requests").select("id").ilike("kode_mr", `%${term}%`),
    s.from("users_with_profiles").select("id").ilike("nama", `%${term}%`),
  ]);

  const filters = [
    "kode_po",
    "status",
    "vendor_details->>nama_vendor",
    "vendor_details->>kode_vendor",
    "po_items_search_text", // computed field, lihat 0021_list_search_items.sql
  ].map((column) => `${column}.ilike.${pattern}`);
  if (matchingMRs?.length) {
    filters.push(`mr_id.in.(${matchingMRs.map((mr) => mr.id).join(",")})`);
  }
  if (matchingUsers?.length) {
    filters.push(`user_id.in.(${matchingUsers.map((u) => u.id).join(",")})`);
  }
  return filters.join(",");
};
