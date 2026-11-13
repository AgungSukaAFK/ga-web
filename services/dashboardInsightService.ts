"use client";

import { createClient } from "@/lib/supabase/client";

// Insight tambahan dashboard (planning-dashboard-insight.md). Semua agregasi
// dikerjakan di RPC (supabase/migrations/0025_dashboard_insights.sql) karena
// data barang ada di kolom JSON - kalau dihitung di client harus tarik semua
// baris MR/PO dulu.

const supabase = createClient();

export interface InsightRangeInput {
  companyCode: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface TopPoItem {
  item_key: string;
  barang_id: number | null;
  part_number: string | null;
  item_name: string | null;
  po_count: number;
  total_value: number;
  total_qty: number;
  uom: string | null; // null = satuan campur
}

export interface TopVendor {
  vendor_name: string;
  po_count: number;
  total_value: number;
  last_po_at: string;
}

export interface ApprovalTimeRow {
  doc_type: "MR" | "PO";
  doc_count: number;
  avg_hours: number | null;
  median_hours: number | null;
}

// bigint/numeric dari PostgREST bisa datang sebagai string.
const toNum = (v: unknown): number => Number(v ?? 0);
const toNumOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

// --- Top Barang (MR + PO) & detail popup (0026_dashboard_insights_v2.sql) ---

export interface TopItem {
  item_key: string;
  barang_id: number | null;
  part_number: string | null;
  item_name: string | null;
  uom: string | null; // UoM katalog, fallback satuan di MR/PO
  mr_count: number;
  mr_qty: number;
  mr_uom: string | null; // null = satuan di MR campur
  department_count: number;
  po_count: number;
  po_qty: number;
  po_uom: string | null; // null = satuan di PO campur / belum ada PO
}

export interface ItemDetailMrRow {
  mr_id: number;
  kode_mr: string;
  department: string | null;
  created_at: string;
  mr_status: string;
  line_status: string;
  item_name: string | null;
  qty: number;
  uom: string | null;
  requester: string | null;
}

export interface ItemDetailPoRow {
  po_id: number;
  kode_po: string;
  created_at: string;
  po_status: string;
  vendor_name: string;
  item_name: string | null;
  qty: number;
  uom: string | null;
  price: number;
  line_total: number;
}

export interface ItemDetail {
  mr: ItemDetailMrRow[];
  po: ItemDetailPoRow[];
  departments: { department: string; mr_count: number; qty: number }[];
}

export interface VendorDetail {
  pos: {
    po_id: number;
    kode_po: string;
    created_at: string;
    po_status: string;
    total_price: number;
    item_count: number;
  }[];
  items: {
    item_key: string;
    item_name: string | null;
    part_number: string | null;
    po_count: number;
    qty: number;
    uom: string | null;
    total_value: number;
  }[];
}

export interface ApprovalDetail {
  approvers: {
    nama: string;
    step_type: string;
    step_count: number;
    avg_hours: number;
    max_hours: number;
  }[];
  slowest: {
    id: number;
    kode: string;
    department: string | null;
    created_at: string;
    approved_at: string;
    hours: number;
  }[];
}

const rangeParams = ({ companyCode, startDate, endDate }: InsightRangeInput) => ({
  p_company_code: companyCode,
  p_start_date: startDate,
  p_end_date: endDate,
});

// Ubah field angka (bisa string dari PostgREST) di array objek jadi number.
const numify = <T,>(rows: unknown, numKeys: string[]): T[] =>
  (Array.isArray(rows) ? rows : []).map((row: any) => {
    const out = { ...row };
    for (const k of numKeys) out[k] = toNum(row[k]);
    return out as T;
  });

export const fetchTopItems = async (
  input: InsightRangeInput,
  limit = 10,
): Promise<TopItem[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_top_items", {
    ...rangeParams(input),
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    item_key: row.item_key,
    barang_id: toNumOrNull(row.barang_id),
    part_number: row.part_number ?? null,
    item_name: row.item_name ?? null,
    uom: row.uom ?? null,
    mr_count: toNum(row.mr_count),
    mr_qty: toNum(row.mr_qty),
    mr_uom: row.mr_uom ?? null,
    department_count: toNum(row.department_count),
    po_count: toNum(row.po_count),
    po_qty: toNum(row.po_qty),
    po_uom: row.po_uom ?? null,
  }));
};

export const fetchItemDetail = async (
  input: InsightRangeInput,
  itemKey: string,
): Promise<ItemDetail> => {
  const { data, error } = await supabase.rpc("get_dashboard_item_detail", {
    ...rangeParams(input),
    p_item_key: itemKey,
  });
  if (error) throw error;
  return {
    mr: numify<ItemDetailMrRow>(data?.mr, ["mr_id", "qty"]),
    po: numify<ItemDetailPoRow>(data?.po, ["po_id", "qty", "price", "line_total"]),
    departments: numify(data?.departments, ["mr_count", "qty"]),
  };
};

export const fetchVendorDetail = async (
  input: InsightRangeInput,
  vendorName: string,
): Promise<VendorDetail> => {
  const { data, error } = await supabase.rpc("get_dashboard_vendor_detail", {
    ...rangeParams(input),
    p_vendor_name: vendorName,
  });
  if (error) throw error;
  return {
    pos: numify(data?.pos, ["po_id", "total_price", "item_count"]),
    items: numify(data?.items, ["po_count", "qty", "total_value"]),
  };
};

export const fetchApprovalDetail = async (
  input: InsightRangeInput,
  docType: "MR" | "PO",
): Promise<ApprovalDetail> => {
  const { data, error } = await supabase.rpc("get_dashboard_approval_detail", {
    ...rangeParams(input),
    p_doc_type: docType,
  });
  if (error) throw error;
  return {
    approvers: numify(data?.approvers, ["step_count", "avg_hours", "max_hours"]),
    slowest: numify(data?.slowest, ["id", "hours"]),
  };
};

export const fetchTopPoItems = async (
  { companyCode, startDate, endDate }: InsightRangeInput,
  limit = 10,
): Promise<TopPoItem[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_top_po_items", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    item_key: row.item_key,
    barang_id: toNumOrNull(row.barang_id),
    part_number: row.part_number ?? null,
    item_name: row.item_name ?? null,
    po_count: toNum(row.po_count),
    total_value: toNum(row.total_value),
    total_qty: toNum(row.total_qty),
    uom: row.uom ?? null,
  }));
};

export const fetchTopVendors = async (
  { companyCode, startDate, endDate }: InsightRangeInput,
  limit = 10,
): Promise<TopVendor[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_top_vendors", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    vendor_name: row.vendor_name,
    po_count: toNum(row.po_count),
    total_value: toNum(row.total_value),
    last_po_at: row.last_po_at,
  }));
};

export const fetchApprovalTime = async ({
  companyCode,
  startDate,
  endDate,
}: InsightRangeInput): Promise<ApprovalTimeRow[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_approval_time", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    doc_type: row.doc_type,
    doc_count: toNum(row.doc_count),
    avg_hours: toNumOrNull(row.avg_hours),
    median_hours: toNumOrNull(row.median_hours),
  }));
};
