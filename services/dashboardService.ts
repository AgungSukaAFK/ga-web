"use client";

import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/type";
import { normalizeMrOrders } from "./mrService";
import {
  fetchMyPendingMrApprovals,
  fetchMyPendingPoApprovals,
  fetchPendingValidationMRs,
  fetchPendingValidationPOs,
  fetchPosReadyForGaReceive,
} from "./approvalService";
import { isGADepartment } from "@/lib/constants/departments";
import {
  PO_STATUS_PENDING_RECEIVE,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_FULL_RECEIVED,
} from "@/type/enum";

const supabase = createClient();

// Company GMI/GIS lihat data company sendiri + LOURDES (LOURDES kadang jadi
// pemilik data lintas-company); company LOURDES lihat semua tanpa filter -
// sama persis dengan pola yang sudah dipakai di semua halaman list
// (purchase-order/page.tsx, material-request/MaterialRequestClient.tsx,
// dst). Dashboard sebelumnya cuma `!== "LOURDES" ? eq(...) : (no filter)`,
// jadi user GMI/GIS gak pernah lihat data milik LOURDES - disamakan di sini.
const applyCompanyScope = (query: any, companyCode: string) => {
  if (companyCode === "LOURDES") return query;
  return query.in("company_code", [companyCode, "LOURDES"]);
};

export interface DateRangeInput {
  start: string;
  end: string;
}

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
  // Snapshot saat ini (TIDAK difilter periode - lihat catatan di
  // fetchDashboardStats).
  po_full_received: number;
  po_partial_received: number;
}

export interface ChartData {
  name: string;
  total?: number; // Untuk Pie Chart
  mr?: number; // Untuk Bar Chart MR
  po?: number; // Untuk Bar Chart PO
}

export interface DailyTrendPoint {
  date: string;
  label: string;
  mr: number;
  po: number;
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
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw new Error("Gagal mengambil profil user: " + error.message);
  return profile as Profile | null;
};

/**
 * Statistik utama (12 kartu). `mr_open`..`po_total` difilter rentang
 * tanggal (bulan/minggu terpilih di halaman). `po_full_received`/
 * `po_partial_received` SENGAJA tidak difilter tanggal - keduanya status
 * snapshot ("lagi ada berapa yang nyangkut sekarang"), bukan tren
 * historis, dan tidak ada log riwayat transisi status utk bisa dihitung
 * "masuk status ini dalam periode X" secara akurat.
 */
export const fetchDashboardStats = async (
  companyCode: string,
  startDate: string,
  endDate: string,
): Promise<DashboardStats> => {
  const createQuery = (
    table: "material_requests" | "purchase_orders",
    statusFilter: string[] | string | null,
    scopeToDateRange: boolean,
  ) => {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    query = applyCompanyScope(query, companyCode);

    if (scopeToDateRange) {
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    if (statusFilter) {
      query = Array.isArray(statusFilter)
        ? query.in("status", statusFilter)
        : query.eq("status", statusFilter);
    }

    return query;
  };

  const [
    { count: mr_open, error: e1 },
    { count: mr_closed, error: e2 },
    { count: mr_total, error: e3 },
    { count: po_pending, error: e4 },
    { count: po_completed, error: e5 },
    { count: po_total, error: e6 },
    { count: mr_rejected, error: e7 },
    { count: mr_waiting_po, error: e8 },
    { count: po_full_received, error: e9 },
    { count: po_partial_received, error: e10 },
  ] = await Promise.all([
    createQuery("material_requests", ["Pending Validation", "Pending Approval"], true),
    createQuery("material_requests", "Full Received", true),
    createQuery("material_requests", null, true),
    createQuery(
      "purchase_orders",
      [
        "Pending Validation",
        "Pending Approval",
        PO_STATUS_PENDING_RECEIVE,
        PO_STATUS_PARTIAL_RECEIVE,
      ],
      true,
    ),
    createQuery("purchase_orders", PO_STATUS_FULL_RECEIVED, true),
    createQuery("purchase_orders", null, true),
    createQuery("material_requests", "Rejected", true),
    createQuery("material_requests", "Waiting PO", true),
    createQuery("purchase_orders", PO_STATUS_FULL_RECEIVED, false),
    createQuery("purchase_orders", PO_STATUS_PARTIAL_RECEIVE, false),
  ]);

  const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10;
  if (err) console.error("Dashboard Stats Error:", err);

  return {
    mr_open: mr_open ?? 0,
    mr_closed: mr_closed ?? 0,
    mr_total: mr_total ?? 0,
    mr_rejected: mr_rejected ?? 0,
    mr_waiting_po: mr_waiting_po ?? 0,
    po_pending: po_pending ?? 0,
    po_completed: po_completed ?? 0,
    po_total: po_total ?? 0,
    po_full_received: po_full_received ?? 0,
    po_partial_received: po_partial_received ?? 0,
  };
};

export interface PagedResult<T> {
  rows: T[];
  count: number;
}

export interface MrStatusRow {
  id: number;
  kode_mr: string;
  status: string;
  created_at: string;
  users_with_profiles: { nama: string } | null;
}

/**
 * Fetcher generik dipakai semua modal kartu statistik berbasis status MR
 * (MR Open, MR Menunggu PO, MR Selesai, MR Ditolak, Total MR) - satu fungsi
 * dipakai berkali-kali dengan statusFilter beda, bukan 1 fungsi per kartu.
 */
export const fetchMrByStatus = async (
  companyCode: string,
  statusFilter: string[] | string | null,
  dateRange: DateRangeInput | null,
  page: number,
  limit: number,
): Promise<PagedResult<MrStatusRow>> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, status, created_at, users_with_profiles!userid(nama)", {
      count: "exact",
    });
  query = applyCompanyScope(query, companyCode);
  if (statusFilter) {
    query = Array.isArray(statusFilter)
      ? query.in("status", statusFilter)
      : query.eq("status", statusFilter);
  }
  if (dateRange) {
    query = query.gte("created_at", dateRange.start).lte("created_at", dateRange.end);
  }
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data || []).map((mr: any) => ({
    ...mr,
    users_with_profiles: Array.isArray(mr.users_with_profiles)
      ? (mr.users_with_profiles[0] ?? null)
      : mr.users_with_profiles,
  })) as MrStatusRow[];

  return { rows, count: count ?? 0 };
};

export interface PoStatusRow {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  created_at: string;
  users_with_profiles: { nama: string } | null;
}

/** Sama seperti fetchMrByStatus, versi PO. */
export const fetchPoByStatus = async (
  companyCode: string,
  statusFilter: string[] | string | null,
  dateRange: DateRangeInput | null,
  page: number,
  limit: number,
): Promise<PagedResult<PoStatusRow>> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, kode_po, status, total_price, created_at, users_with_profiles!user_id(nama)",
      { count: "exact" },
    );
  query = applyCompanyScope(query, companyCode);
  if (statusFilter) {
    query = Array.isArray(statusFilter)
      ? query.in("status", statusFilter)
      : query.eq("status", statusFilter);
  }
  if (dateRange) {
    query = query.gte("created_at", dateRange.start).lte("created_at", dateRange.end);
  }
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data || []).map((po: any) => ({
    ...po,
    users_with_profiles: Array.isArray(po.users_with_profiles)
      ? (po.users_with_profiles[0] ?? null)
      : po.users_with_profiles,
  })) as PoStatusRow[];

  return { rows, count: count ?? 0 };
};

export interface PipelineItemRow {
  mr_id: number;
  kode_mr: string;
  part_number: string;
  name: string;
  qty: string;
  uom: string;
  status: string;
}

export interface ItemStatusPipeline {
  counts: Record<string, number>;
  itemsByStatus: Record<string, PipelineItemRow[]>;
}

/**
 * Status barang (Order.status) tersimpan di dalam JSONB `orders` per MR,
 * bukan kolom sendiri - jadi tidak bisa di-COUNT langsung lewat query
 * biasa. Ambil `orders` semua MR yang masih relevan (selain Rejected -
 * barang di MR yang ditolak tidak pernah lanjut prosesnya) lalu tally di
 * client, sama pola dengan export Excel di MrManagementClient.tsx. Dipakai
 * bareng utk kartu "Dikirim dari Vendor"/"Dikirim dari GA" (snapshot,
 * bukan filter tanggal - lihat catatan fetchDashboardStats) dan grafik
 * pipeline barang.
 */
export const fetchItemStatusPipeline = async (
  companyCode: string,
): Promise<ItemStatusPipeline> => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, orders")
    .neq("status", "Rejected");
  query = applyCompanyScope(query, companyCode);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Record<string, number> = {};
  const itemsByStatus: Record<string, PipelineItemRow[]> = {};

  for (const mr of data || []) {
    const orders = normalizeMrOrders((mr.orders as any[]) || []);
    for (const order of orders) {
      const status = order.status || "Pending";
      counts[status] = (counts[status] || 0) + 1;
      if (!itemsByStatus[status]) itemsByStatus[status] = [];
      itemsByStatus[status].push({
        mr_id: mr.id,
        kode_mr: mr.kode_mr,
        part_number: order.part_number || "-",
        name: order.name,
        qty: order.qty,
        uom: order.uom,
        status,
      });
    }
  }

  return { counts, itemsByStatus };
};

/**
 * Tren harian MR vs PO dibuat, dibucket per hari (bukan per bulan seperti
 * RPC get_monthly_mr_po_trend lama - filter sekarang granularitasnya
 * bulan/minggu, jadi rentangnya cukup kecil utk di-bucket per hari di
 * client tanpa perlu RPC baru).
 */
export const fetchDailyMrPoTrend = async (
  companyCode: string,
  startDate: string,
  endDate: string,
): Promise<DailyTrendPoint[]> => {
  let mrQuery = supabase
    .from("material_requests")
    .select("created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate);
  mrQuery = applyCompanyScope(mrQuery, companyCode);

  let poQuery = supabase
    .from("purchase_orders")
    .select("created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate);
  poQuery = applyCompanyScope(poQuery, companyCode);

  const [{ data: mrRows, error: e1 }, { data: poRows, error: e2 }] = await Promise.all([
    mrQuery,
    poQuery,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const dayMap: Record<string, { mr: number; po: number }> = {};
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(endDate);
  endDay.setHours(0, 0, 0, 0);
  while (cursor <= endDay) {
    dayMap[cursor.toISOString().slice(0, 10)] = { mr: 0, po: 0 };
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of mrRows || []) {
    const key = new Date(row.created_at as string).toISOString().slice(0, 10);
    if (dayMap[key]) dayMap[key].mr += 1;
  }
  for (const row of poRows || []) {
    const key = new Date(row.created_at as string).toISOString().slice(0, 10);
    if (dayMap[key]) dayMap[key].po += 1;
  }

  return Object.entries(dayMap).map(([date, v]) => ({
    date,
    label: new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    }),
    mr: v.mr,
    po: v.po,
  }));
};

// --- SKOR MR/PO ---
//
// Grading berdasarkan umur (created_at -> full_received_at, dalam hari):
//   A <= 12 hari, B <= 15 hari, C <= 20 hari, D <= 30 hari, E > 30 hari.
// Dihitung dari MR/PO yang SELESAI (full_received_at terisi) di dalam
// periode terpilih - filternya pakai full_received_at (kapan dia
// kelar), bukan created_at, karena skor ini ngukur "performa
// penyelesaian periode ini", bukan "volume dibuat periode ini".
export type AgeGrade = "A" | "B" | "C" | "D" | "E";

export const GRADE_THRESHOLDS: { grade: AgeGrade; maxDays: number | null; label: string }[] = [
  { grade: "A", maxDays: 12, label: "≤ 12 Hari" },
  { grade: "B", maxDays: 15, label: "≤ 15 Hari" },
  { grade: "C", maxDays: 20, label: "≤ 20 Hari" },
  { grade: "D", maxDays: 30, label: "≤ 30 Hari" },
  { grade: "E", maxDays: null, label: "> 30 Hari" },
];

export const getAgeGrade = (ageDays: number): AgeGrade => {
  if (ageDays <= 12) return "A";
  if (ageDays <= 15) return "B";
  if (ageDays <= 20) return "C";
  if (ageDays <= 30) return "D";
  return "E";
};

export interface ScoreEntry {
  id: number;
  kode: string;
  created_at: string;
  full_received_at: string;
  age_days: number;
  grade: AgeGrade;
}

export interface ScoreResult {
  grade: AgeGrade | null;
  avgDays: number;
  count: number;
  entries: ScoreEntry[];
}

const buildScoreResult = (
  rows: { id: number; kode: string; created_at: string; full_received_at: string }[],
): ScoreResult => {
  const entries: ScoreEntry[] = rows.map((row) => {
    const ageDays =
      (new Date(row.full_received_at).getTime() - new Date(row.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    return { ...row, age_days: ageDays, grade: getAgeGrade(ageDays) };
  });
  entries.sort((a, b) => new Date(b.full_received_at).getTime() - new Date(a.full_received_at).getTime());
  const avgDays = entries.length
    ? entries.reduce((sum, e) => sum + e.age_days, 0) / entries.length
    : 0;
  return {
    grade: entries.length ? getAgeGrade(avgDays) : null,
    avgDays,
    count: entries.length,
    entries,
  };
};

export const fetchMrScore = async (
  companyCode: string,
  dateRange: DateRangeInput,
): Promise<ScoreResult> => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, created_at, full_received_at")
    .not("full_received_at", "is", null)
    .gte("full_received_at", dateRange.start)
    .lte("full_received_at", dateRange.end);
  query = applyCompanyScope(query, companyCode);

  const { data, error } = await query;
  if (error) throw error;

  return buildScoreResult(
    (data || []).map((mr: any) => ({
      id: mr.id,
      kode: mr.kode_mr,
      created_at: mr.created_at,
      full_received_at: mr.full_received_at,
    })),
  );
};

export const fetchPoScore = async (
  companyCode: string,
  dateRange: DateRangeInput,
): Promise<ScoreResult> => {
  let query = supabase
    .from("purchase_orders")
    .select("id, kode_po, created_at, full_received_at")
    .not("full_received_at", "is", null)
    .gte("full_received_at", dateRange.start)
    .lte("full_received_at", dateRange.end);
  query = applyCompanyScope(query, companyCode);

  const { data, error } = await query;
  if (error) throw error;

  return buildScoreResult(
    (data || []).map((po: any) => ({
      id: po.id,
      kode: po.kode_po,
      created_at: po.created_at,
      full_received_at: po.full_received_at,
    })),
  );
};

/**
 * REVISI: Mengambil distribusi MR per departemen (dari RPC) berdasarkan rentang tanggal.
 */
export const fetchDepartmentMrDistribution = async (
  companyCode: string,
  startDate: string,
  endDate: string,
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
 * Mengambil 5 MR terbaru (tidak terpengaruh filter tanggal).
 */
export const fetchLatestMRs = async (companyCode: string): Promise<LatestMR[]> => {
  let query = supabase.from("material_requests").select(
    `
      id,
      kode_mr,
      status,
      created_at,
      users_with_profiles!userid ( nama )
    `,
  );
  query = applyCompanyScope(query, companyCode);
  query = query.order("created_at", { ascending: false }).limit(5);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching latest MRs:", error);
    throw error;
  }

  return (data || []).map((mr) => ({
    ...mr,
    users_with_profiles: Array.isArray(mr.users_with_profiles)
      ? (mr.users_with_profiles[0] ?? null)
      : mr.users_with_profiles,
  })) as LatestMR[];
};

export interface ActionItemGroup {
  key: string;
  title: string;
  count: number;
  href: string;
}

/**
 * Panel "perlu aksi Anda" di puncak dashboard - beda dari `notifications`
 * (log histori terpisah, lihat NotificationProvider) - ini dihitung
 * live tiap load, bukan dibaca dari tabel log. Fan-out murni berdasarkan
 * role/department, query-nya reuse fungsi yang sudah ada di
 * services/approvalService.ts (dipakai juga oleh halaman Approval &
 * Validation) supaya angkanya selalu konsisten dengan apa yang requester
 * lihat kalau mereka buka halaman itu langsung.
 */
export const fetchMyActionItems = async (
  userId: string,
  profile: Profile,
): Promise<ActionItemGroup[]> => {
  const groups: ActionItemGroup[] = [];
  const isApprover = profile.role === "approver";
  const isGA = isGADepartment(profile.department) || profile.role === "admin";
  const isPurchasing =
    profile.department === "Purchasing" || profile.role === "admin";

  const tasks: Promise<void>[] = [];

  if (isApprover) {
    tasks.push(
      Promise.all([
        fetchMyPendingMrApprovals(userId),
        fetchMyPendingPoApprovals(userId),
      ]).then(([mrs, pos]) => {
        if (mrs.length > 0) {
          groups.push({
            key: "approve-mr",
            title: `${mrs.length} MR menunggu approval Anda`,
            count: mrs.length,
            href: "/approval-validation",
          });
        }
        if (pos.length > 0) {
          groups.push({
            key: "approve-po",
            title: `${pos.length} PO menunggu approval Anda`,
            count: pos.length,
            href: "/approval-validation",
          });
        }
      }),
    );
  }

  if (isGA) {
    tasks.push(
      Promise.all([
        fetchPendingValidationMRs(),
        fetchPendingValidationPOs(),
        fetchPosReadyForGaReceive(),
      ]).then(([mrs, pos, receivePos]) => {
        if (mrs.length > 0) {
          groups.push({
            key: "validate-mr",
            title: `${mrs.length} MR menunggu validasi GA`,
            count: mrs.length,
            href: "/approval-validation",
          });
        }
        if (pos.length > 0) {
          groups.push({
            key: "validate-po",
            title: `${pos.length} PO menunggu validasi GA`,
            count: pos.length,
            href: "/approval-validation",
          });
        }
        if (receivePos.length > 0) {
          groups.push({
            key: "receive-po",
            title: `${receivePos.length} PO siap diterima`,
            count: receivePos.length,
            href: "/purchase-order",
          });
        }
      }),
    );
  }

  if (isPurchasing) {
    tasks.push(
      (async () => {
        const { count: itemReqCount } = await supabase
          .from("item_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        if ((itemReqCount ?? 0) > 0) {
          groups.push({
            key: "item-requests",
            title: `${itemReqCount} Request Barang belum diproses`,
            count: itemReqCount ?? 0,
            href: "/item-requests",
          });
        }

        let waitingPoQuery = supabase
          .from("material_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "Waiting PO");
        waitingPoQuery = applyCompanyScope(waitingPoQuery, profile.company || "");
        const { count: waitingPoCount } = await waitingPoQuery;
        if ((waitingPoCount ?? 0) > 0) {
          groups.push({
            key: "waiting-po",
            title: `${waitingPoCount} MR menunggu dibuatkan PO`,
            count: waitingPoCount ?? 0,
            href: "/purchase-order/create",
          });
        }
      })(),
    );
  }

  // Requester (siapa pun) - MR miliknya sendiri yang "On Hold" (perlu
  // diperbaiki & submit ulang).
  tasks.push(
    (async () => {
      const { data: onHoldMrs, error } = await supabase
        .from("material_requests")
        .select("id")
        .eq("userid", userId)
        .eq("status", "On Hold");
      if (!error && onHoldMrs && onHoldMrs.length > 0) {
        groups.push({
          key: "on-hold",
          title: `${onHoldMrs.length} MR Anda perlu diperbaiki`,
          count: onHoldMrs.length,
          href: "/mr-saya",
        });
      }
    })(),
  );

  await Promise.all(tasks);
  return groups;
};
