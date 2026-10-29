// src/services/pettyCashPembatalanService.ts
//
// Pembatalan Pengajuan Petty Cash - tabel `petty_cash_pembatalan`
// (supabase/migrations/0015_petty_cash_revisi.sql). Requester mengajukan
// pembatalan dari halaman detail Pengajuan / Pengajuan Saya, Finance
// approver (department "Finance" + role "approver", atau admin) menyetujui
// atau menolak dari halaman Approval Petty Cash (sesi "Permintaan
// Pembatalan"). Disetujui = Pengajuan, Voucher aktif, & tarikan yang belum
// dibayar jadi "Dibatalkan", potongan budget tarikan itu di-refund.
//
// Cuma boleh selama BELUM ADA tarikan yang dibayar Finance - dana yang sudah
// cair diselesaikan lewat Deklarasi/Pengembalian Dana, bukan pembatalan.
// Semua tulis lewat RPC SECURITY DEFINER (tidak ada policy insert/update),
// syarat & hak akses dicek ulang di sana.

import { createClient } from "@/lib/supabase/client";
import { PettyCashPembatalan, PettyCashPengajuan } from "@/type";
import {
  notifyFinanceOnPcCancelRequested,
  notifyOnPcCancelProcessed,
} from "@/lib/notifications/client";

const supabase = createClient();

const PEMBATALAN_WITH_REFS = `
  *, petty_cash_pengajuan(id, kode_pengajuan, department, site, total_amount, status, is_eskalasi,
    petty_cash_voucher(id, kode_voucher, status,
      petty_cash_sub_voucher(id, kode_sub_voucher, amount, status))),
  users_with_profiles:profiles!user_id(nama, email),
  processed_by_profile:profiles!processed_by(nama)
`;

/** Requester mengajukan pembatalan (wajib alasan). */
export const requestPembatalan = async (
  pengajuan: Pick<PettyCashPengajuan, "id" | "kode_pengajuan" | "company_code">,
  reason: string,
): Promise<PettyCashPembatalan> => {
  const { data, error } = await supabase.rpc("request_petty_cash_pembatalan", {
    p_pengajuan_id: pengajuan.id,
    p_reason: reason,
  });
  if (error) throw error;
  notifyFinanceOnPcCancelRequested({
    companyCode: pengajuan.company_code,
    pengajuanId: pengajuan.id,
    kode: pengajuan.kode_pengajuan,
  });
  return data as unknown as PettyCashPembatalan;
};

/**
 * Antrian Finance - permintaan "Menunggu Persetujuan", dibatasi ke company
 * Finance yang login kecuali "LOURDES" (sama pola dgn
 * fetchSubVoucherPaymentQueue). company_code sudah didenormalisasi di
 * tabelnya sendiri, jadi tidak perlu join `!inner`.
 */
export const fetchPembatalanQueue = async (
  financeCompany: string | null,
): Promise<PettyCashPembatalan[]> => {
  let query = supabase
    .from("petty_cash_pembatalan")
    .select(PEMBATALAN_WITH_REFS)
    .eq("status", "Menunggu Persetujuan");

  if (financeCompany && financeCompany !== "LOURDES") {
    query = query.eq("company_code", financeCompany);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPembatalan[];
};

/** Finance menyetujui - rantai Pengajuan dibatalkan & budget tarikan di-refund. */
export const approvePembatalan = async (
  pembatalan: Pick<PettyCashPembatalan, "id" | "user_id" | "pengajuan_id"> & {
    kode_pengajuan: string;
  },
  note: string,
): Promise<PettyCashPembatalan> => {
  const { data, error } = await supabase.rpc("approve_petty_cash_pembatalan", {
    p_id: pembatalan.id,
    p_note: note,
  });
  if (error) throw error;
  notifyOnPcCancelProcessed({
    requesterId: pembatalan.user_id,
    pengajuanId: pembatalan.pengajuan_id,
    kode: pembatalan.kode_pengajuan,
    decision: "approved",
  });
  return data as unknown as PettyCashPembatalan;
};

/** Finance menolak (wajib alasan) - rantai Pengajuan jalan terus. */
export const rejectPembatalan = async (
  pembatalan: Pick<PettyCashPembatalan, "id" | "user_id" | "pengajuan_id"> & {
    kode_pengajuan: string;
  },
  reason: string,
): Promise<PettyCashPembatalan> => {
  const { data, error } = await supabase.rpc("reject_petty_cash_pembatalan", {
    p_id: pembatalan.id,
    p_reason: reason,
  });
  if (error) throw error;
  notifyOnPcCancelProcessed({
    requesterId: pembatalan.user_id,
    pengajuanId: pembatalan.pengajuan_id,
    kode: pembatalan.kode_pengajuan,
    decision: "rejected",
    note: reason,
  });
  return data as unknown as PettyCashPembatalan;
};
