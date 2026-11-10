// lib/pending-approver.ts
//
// Filter "Menunggu Approval" di halaman list MR & PO: tampilkan dokumen yang
// saat ini sedang menunggu giliran approval user tertentu.
//
// "Giliran" mengikuti aturan yang sama dengan antrian approval
// (fetchMyPendingMrApprovals / fetchMyPendingPoApprovals di
// services/approvalService.ts): step pertama di `approvals` yang belum
// "approved" berstatus "pending" -> user di step itu yang sedang ditunggu.
//
// `approvals` berupa kolom JSON yang tidak bisa difilter "step pertama yang
// pending" lewat PostgREST, jadi dokumen yang masih pending diambil dulu
// (hanya id + approvals), dihitung di sini, lalu tabel difilter `id in (...)`.

import type { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

type ApprovalLike = { userid?: string; nama?: string; status?: string };

export type PendingApprover = { userid: string; nama: string; ids: number[] };

// Status dokumen yang masih punya step approval berjalan.
const PENDING_STATUSES = {
  material_requests: ["Pending Approval"],
  // "Pending Payment" ikut, sama seperti antrian approval PO.
  purchase_orders: ["Pending Approval", "Pending Payment"],
} as const;

/** Approver yang sedang ditunggu, atau null kalau tidak ada. */
export const getCurrentApprover = (
  approvals: unknown,
): ApprovalLike | null => {
  if (!Array.isArray(approvals)) return null;
  const step = (approvals as ApprovalLike[]).find(
    (a) => a?.status !== "approved",
  );
  return step?.status === "pending" && step.userid ? step : null;
};

/**
 * Kelompokkan dokumen pending per approver yang sedang ditunggu.
 * `applyScope` = hak akses company halaman (supaya pilihan & jumlahnya
 * sesuai yang boleh dilihat user). Diurutkan berdasarkan nama.
 */
export const fetchPendingApprovers = async (
  s: ReturnType<typeof createClient>,
  table: keyof typeof PENDING_STATUSES,
  applyScope: (query: any) => any = (q) => q,
): Promise<PendingApprover[]> => {
  const rows = await fetchAllRows<{ id: number; approvals: unknown }>(() =>
    applyScope(
      s
        .from(table)
        .select("id, approvals")
        .in("status", [...PENDING_STATUSES[table]]),
    ).order("id", { ascending: true }),
  );

  const byUser = new Map<string, PendingApprover>();
  for (const row of rows) {
    const approver = getCurrentApprover(row.approvals);
    if (!approver?.userid) continue;
    const entry = byUser.get(approver.userid) ?? {
      userid: approver.userid,
      nama: approver.nama || "(Tanpa nama)",
      ids: [],
    };
    entry.ids.push(row.id);
    byUser.set(approver.userid, entry);
  }
  return [...byUser.values()].sort((a, b) => a.nama.localeCompare(b.nama));
};

/** Batasi query ke dokumen yang sedang menunggu `userid`. */
export const applyPendingApproverFilter = (
  query: any,
  approvers: PendingApprover[],
  userid: string,
) => {
  const ids = approvers.find((a) => a.userid === userid)?.ids ?? [];
  return ids.length > 0 ? query.in("id", ids) : query.eq("id", -1);
};
