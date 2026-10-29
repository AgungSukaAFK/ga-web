// src/services/pettyCashBadgeService.ts
//
// Angka badge menu Petty Cash di sidebar (components/app-sidebar.tsx, lewat
// hooks/use-pc-badge.ts):
//  - approvals: dokumen yang SEDANG giliran user login approve (Pengajuan/
//    Voucher/Deklarasi, isMyApprovalTurn) + antrian Finance (tarikan menunggu
//    dibayar, pengembalian menunggu konfirmasi, & permintaan pembatalan)
//    kalau dia Finance approver atau admin - sama dgn isi halaman Approval
//    Petty Cash.
//  - myActions: rantai Pengajuan milik user yang statusnya "giliran Anda"
//    (buildActionItems, services/pettyCashDashboardService.ts) - sama dgn
//    panel "Perlu Tindakan Anda" di Dashboard.
// Query sengaja ramping (cuma kolom yang dipakai hitungan) karena jalan dari
// sidebar, bukan cuma di halaman Petty Cash.

import { createClient } from "@/lib/supabase/client";
import { isMyApprovalTurn, PcApprovalStep } from "@/lib/pcApprovalFlow";
import { buildActionItems } from "@/services/pettyCashDashboardService";
import { isPcFinanceApprover } from "@/lib/constants/departments";
import { PettyCashPengajuanWithChain } from "@/type";

const supabase = createClient();

export interface PcBadgeCounts {
  approvals: number;
  myActions: number;
}

export interface PcBadgeProfile {
  role: string | null;
  department: string | null;
  company: string | null;
}

const countMyApprovalTurns = async (
  table: "petty_cash_pengajuan" | "petty_cash_voucher" | "petty_cash_deklarasi",
  userId: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from(table)
    .select("approvals")
    .eq("status", "In Approval")
    .contains(
      "approvals",
      JSON.stringify([{ userid: userId, status: "pending" }]),
    );

  if (error) throw error;
  return ((data ?? []) as { approvals: PcApprovalStep[] }[]).filter((row) =>
    isMyApprovalTurn(row.approvals, userId),
  ).length;
};

// Batas company sama dgn fetchSubVoucherPaymentQueue/fetchPengembalianQueue
// (Finance company sendiri, LOURDES lihat semua).
const countFinanceQueue = async (
  table: "petty_cash_sub_voucher" | "petty_cash_pengembalian",
  status: string,
  financeCompany: string | null,
): Promise<number> => {
  let query = supabase
    .from(table)
    .select("id, petty_cash_voucher!inner(company_code)", {
      count: "exact",
      head: true,
    })
    .eq("status", status);

  if (financeCompany && financeCompany !== "LOURDES") {
    query = query.eq("petty_cash_voucher.company_code", financeCompany);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

const countPembatalanQueue = async (
  financeCompany: string | null,
): Promise<number> => {
  let query = supabase
    .from("petty_cash_pembatalan")
    .select("id", { count: "exact", head: true })
    .eq("status", "Menunggu Persetujuan");

  if (financeCompany && financeCompany !== "LOURDES") {
    query = query.eq("company_code", financeCompany);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

const countMyActions = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select(
      `id, status, petty_cash_pembatalan(id, status),
       petty_cash_voucher(id, status, total_amount, created_at,
         petty_cash_sub_voucher(id, status, amount,
           petty_cash_deklarasi(id, status, created_at)))`,
    )
    .eq("user_id", userId)
    .not("status", "in", "(Rejected,Dibatalkan)");

  if (error) throw error;
  return buildActionItems(
    (data ?? []) as unknown as PettyCashPengajuanWithChain[],
  ).length;
};

export const fetchPcBadgeCounts = async (
  userId: string,
  profile: PcBadgeProfile,
): Promise<PcBadgeCounts> => {
  const isFinanceApprover = isPcFinanceApprover(profile);

  const [
    pengajuan,
    voucher,
    deklarasi,
    payment,
    pengembalian,
    pembatalan,
    myActions,
  ] = await Promise.all([
      countMyApprovalTurns("petty_cash_pengajuan", userId),
      countMyApprovalTurns("petty_cash_voucher", userId),
      countMyApprovalTurns("petty_cash_deklarasi", userId),
      isFinanceApprover
        ? countFinanceQueue(
            "petty_cash_sub_voucher",
            "Menunggu Pembayaran",
            profile.company,
          )
        : Promise.resolve(0),
      isFinanceApprover
        ? countFinanceQueue(
            "petty_cash_pengembalian",
            "Menunggu Konfirmasi",
            profile.company,
          )
        : Promise.resolve(0),
      isFinanceApprover
        ? countPembatalanQueue(profile.company)
        : Promise.resolve(0),
      countMyActions(userId),
    ]);

  return {
    approvals:
      pengajuan + voucher + deklarasi + payment + pengembalian + pembatalan,
    myActions,
  };
};
