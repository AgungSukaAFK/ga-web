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

export interface TopMrItem {
  item_key: string;
  barang_id: number | null;
  part_number: string | null;
  item_name: string | null;
  mr_count: number;
  line_count: number;
  department_count: number;
  in_catalog: boolean;
  stock_qty: number | null; // null = barang non-katalog (stok tidak bisa dicek)
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

export const fetchTopMrItems = async (
  { companyCode, startDate, endDate }: InsightRangeInput,
  limit = 10,
): Promise<TopMrItem[]> => {
  const { data, error } = await supabase.rpc("get_dashboard_top_mr_items", {
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
    mr_count: toNum(row.mr_count),
    line_count: toNum(row.line_count),
    department_count: toNum(row.department_count),
    in_catalog: Boolean(row.in_catalog),
    stock_qty: toNumOrNull(row.stock_qty),
  }));
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
