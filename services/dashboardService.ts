"use client";

import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/type";

// Tipe data untuk hasil
export interface DashboardStats {
  mr_open: number;
  mr_closed: number;
  mr_total: number;
  mr_rejected: number;
  mr_waiting_po: number;
  po_pending: number;
  po_completed: number;
  po_total: number;
}

export interface ChartData {
  name: string;
  total?: number; // Untuk Pie Chart
  mr?: number; // Untuk Bar Chart MR
  po?: number; // Untuk Bar Chart PO
}

export interface LatestMR {
  id: number; // Tipe ID di tabel MR adalah bigint (number)
  kode_mr: string;
  status: string;
  created_at: string;
  users_with_profiles: {
    nama: string;
  } | null;
}

const supabase = createClient();

/**
 * Mengambil profil (terutama company) user yang sedang login.
 */
export const getActiveUserProfile = async (): Promise<Profile | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User tidak ditemukan.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company") // Hanya ambil company
    .eq("id", user.id)
    .single();

  if (error) throw new Error("Gagal mengambil profil user: " + error.message);
  return profile as Profile | null;
};

/**
 * --- FUNGSI DIPERBAIKI ---
 * Mengambil statistik utama (Kartu Statistik) berdasarkan rentang tanggal.
 */
export const fetchDashboardStats = async (
  companyCode: string,
  startDate: string,
  endDate: string
): Promise<DashboardStats> => {
  /**
   * --- HELPER DIPERBAIKI ---
   * Helper ini sekarang memulai query DENGAN .select()
   * lalu baru menerapkan filter lainnya.
   */
  const createQuery = (
    table: "material_requests" | "purchase_orders",
    statusFilter: string[] | string | null
  ) => {
    // 1. Mulai dengan .select()
    let query = supabase.from(table).select("id", { count: "exact" });

    // 2. Terapkan semua filter (urutan filter tidak masalah setelah select)
    query = query.gte("created_at", startDate);
    query = query.lte("created_at", endDate);

    if (companyCode !== "LOURDES") {
      query = query.eq("company_code", companyCode);
    }

    if (statusFilter) {
      if (Array.isArray(statusFilter)) {
        query = query.in("status", statusFilter);
      } else {
        query = query.eq("status", statusFilter);
      }
    }

    // 3. Kembalikan query builder yang sudah difilter
    return query;
  };

  // Setiap item di Promise.all SEKARANG adalah query yang independen dan benar
  const [
    { count: mr_open, error: e1 },
    { count: mr_closed, error: e2 },
    { count: mr_total, error: e3 },
    { count: po_pending, error: e4 },
    { count: po_completed, error: e5 },
    { count: po_total, error: e6 },
    { count: mr_rejected, error: e7 },
    { count: mr_waiting_po, error: e8 },
  ] = await Promise.all([
    // 1. MR Open (Pending Validation + Pending Approval)
    createQuery("material_requests", [
      "Pending Validation",
      "Pending Approval",
    ]),

    // 2. MR Closed
    createQuery("material_requests", "Completed"),

    // 3. MR Total
    createQuery("material_requests", null), // null = tanpa filter status

    // 4. PO Pending (Pending Validation + Approval + BAST)
    createQuery("purchase_orders", [
      "Pending Validation",
      "Pending Approval",
      "Pending BAST",
    ]),

    // 5. PO Completed
    createQuery("purchase_orders", "Completed"),

    // 6. PO Total
    createQuery("purchase_orders", null), // null = tanpa filter status

    // 7. MR Rejected
    createQuery("material_requests", "Rejected"),

    // 8. MR Waiting PO
    createQuery("material_requests", "Waiting PO"),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8)
    console.error(
      "Dashboard Stats Error:",
      e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8
    );

  return {
    mr_open: mr_open ?? 0,
    mr_closed: mr_closed ?? 0,
    mr_total: mr_total ?? 0,
    mr_rejected: mr_rejected ?? 0,
    mr_waiting_po: mr_waiting_po ?? 0,
    po_pending: po_pending ?? 0,
    po_completed: po_completed ?? 0,
    po_total: po_total ?? 0,
  };
};

/**
 * REVISI: Mengambil tren MR vs PO bulanan (dari RPC) berdasarkan rentang tanggal.
 */
export const fetchMonthlyMrTrend = async (
  companyCode: string,
  startDate: string,
  endDate: string
): Promise<ChartData[]> => {
  const { data, error } = await supabase.rpc("get_monthly_mr_po_trend", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error("Error fetching monthly trend:", error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    name: item.name,
    mr: item.jumlah_mr,
    po: item.jumlah_po,
  }));
};

/**
 * REVISI: Mengambil distribusi MR per departemen (dari RPC) berdasarkan rentang tanggal.
 */
export const fetchDepartmentMrDistribution = async (
  companyCode: string,
  startDate: string,
  endDate: string
): Promise<ChartData[]> => {
  const { data, error } = await supabase.rpc("get_mr_distribution_by_dept", {
    p_company_code: companyCode,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error("Error fetching department distribution:", error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    name: item.department,
    total: item.total,
  }));
};

/**
 * --- FUNGSI DIPERBAIKI ---
 * Mengambil 5 MR terbaru (tidak terpengaruh filter tanggal).
 */
export const fetchLatestMRs = async (
  companyCode: string
): Promise<LatestMR[]> => {
  // 1. Mulai query dengan .select()
  let query = supabase.from("material_requests").select(
    `
      id,
      kode_mr,
      status,
      created_at,
      users_with_profiles!userid ( nama )
    `
  );

  // 2. Terapkan filter SEKARANG (setelah .select())
  if (companyCode !== "LOURDES") {
    query = query.eq("company_code", companyCode);
  }

  // 3. Terapkan modifier (order, limit) SETELAH filter
  query = query.order("created_at", { ascending: false }).limit(5);

  // 4. Eksekusi query
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching latest MRs:", error);
    throw error;
  }

  return (data || []).map((mr) => ({
    ...mr,
    users_with_profiles: Array.isArray(mr.users_with_profiles)
      ? mr.users_with_profiles[0] ?? null
      : mr.users_with_profiles,
  })) as LatestMR[];
};
