// src/services/dashboardService.ts

import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/type";

const supabase = createClient();

// Tipe untuk data statistik dari RPC
export interface DashboardStats {
  mr_open: number;
  mr_closed: number;
  mr_total: number;
  po_pending: number;
  po_completed: number;
  po_total: number;
}

// Tipe untuk data chart
export interface ChartData {
  name: string;
  total: number;
}

// Tipe untuk daftar MR terbaru
export interface LatestMR {
  id: string;
  kode_mr: string;
  status: string;
  created_at: string;
  users_with_profiles: { nama: string } | null;
}

/**
 * Mengambil profil lengkap user yang sedang login
 */
export const getActiveUserProfile = async (): Promise<Profile | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile as Profile | null;
};

/**
 * Mengambil data statistik utama dari RPC
 */
export const fetchDashboardStats = async (
  company_code: string,
  startDate: string,
  endDate: string
): Promise<DashboardStats> => {
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_company_code: company_code,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  return data;
};

/**
 * Mengambil data tren MR bulanan
 */
export const fetchMonthlyMrTrend = async (
  company_code: string
): Promise<ChartData[]> => {
  const { data, error } = await supabase.rpc("get_monthly_mr_trend", {
    p_company_code: company_code,
  });
  if (error) throw error;
  return data.map((d: { month_name: any; total_mr: any }) => ({
    name: d.month_name,
    total: d.total_mr,
  }));
};

/**
 * Mengambil data distribusi MR per departemen
 */
export const fetchDepartmentMrDistribution = async (
  company_code: string
): Promise<ChartData[]> => {
  const { data, error } = await supabase.rpc("get_department_mr_distribution", {
    p_company_code: company_code,
  });
  if (error) throw error;
  return data.map((d: { department: any; total_mr: any }) => ({
    name: d.department,
    total: d.total_mr,
  }));
};

/**
 * Mengambil 5 MR terbaru
 */
export const fetchLatestMRs = async (
  company_code: string
): Promise<LatestMR[]> => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, status, created_at, users_with_profiles!userid(nama)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (company_code !== "LOURDES") {
    query = query.eq("company_code", company_code);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as LatestMR[];
};
