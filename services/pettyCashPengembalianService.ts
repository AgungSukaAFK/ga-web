// src/services/pettyCashPengembalianService.ts
//
// Pengembalian Dana Lebih Petty Cash - tabel `petty_cash_pengembalian`
// (supabase/migrations/0009_petty_cash_pengembalian.sql). Kalau Deklarasi
// yang disetujui lebih kecil dari nominal tarikan (Sub-Voucher), requester
// mengembalikan sisanya ke Finance + melampirkan bukti setor. Budget baru
// bertambah lagi setelah Finance approver (department "Finance" + role
// "approver", atau admin) mengkonfirmasi - kebalikan dari alur pembayaran
// tarikan (markSubVoucherPaid, services/pettyCashSubVoucherService.ts).
//
// Semua tulis lewat RPC SECURITY DEFINER (tidak ada policy insert/update),
// sisa dana & hak akses dicek ulang di sana - validasi di UI cuma proteksi
// tampilan.

import { createClient } from "@/lib/supabase/client";
import { Attachment, PettyCashPengembalian, PettyCashSubVoucher } from "@/type";
import { computeSisaPengembalian, toEmbedArray } from "@/lib/pcChain";
import {
  notifyFinanceOnPcReturnSubmitted,
  notifyOnPcReturnProcessed,
} from "@/lib/notifications/client";

const supabase = createClient();

const PENGEMBALIAN_WITH_REFS = `
  *, petty_cash_sub_voucher(kode_sub_voucher, amount),
  petty_cash_voucher(kode_voucher, company_code, department),
  users_with_profiles:profiles!user_id(nama, email),
  processed_by_profile:profiles!processed_by(nama)
`;

/** Tarikan yang punya sisa dana bisa dikembalikan, berikut nominal sisanya. */
export interface SubVoucherWithSisa {
  subVoucher: PettyCashSubVoucher;
  sisa: number;
  declared: number;
}

/**
 * Tarikan milik `userId` yang Deklarasi-nya sudah disetujui dan masih
 * punya sisa dana (nominal tarikan - Deklarasi disetujui - pengembalian
 * yang belum ditolak > 0) - dipakai halaman Deklarasi, tabel "Sisa Dana
 * Bisa Dikembalikan".
 */
export const fetchSubVouchersForPengembalian = async (
  userId: string,
): Promise<SubVoucherWithSisa[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select(
      `*, petty_cash_voucher(kode_voucher, total_amount, company_code, department),
       petty_cash_deklarasi(id, kode_deklarasi, status, total_amount, created_at),
       petty_cash_pengembalian(id, kode_pengembalian, amount, status)`,
    )
    .eq("user_id", userId)
    .eq("status", "Selesai")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashSubVoucher[];
  return rows.flatMap((sv) => {
    const sisa = computeSisaPengembalian(sv);
    if (sisa === null || sisa <= 0) return [];
    const declared =
      toEmbedArray(sv.petty_cash_deklarasi).find(
        (d) => d.status === "Approved",
      )?.total_amount ?? 0;
    return [{ subVoucher: sv, sisa, declared: Number(declared) }];
  });
};

/** Semua pengembalian milik `userId` - tabel "Pengembalian Saya" di halaman Deklarasi. */
export const fetchMyPengembalian = async (
  userId: string,
): Promise<PettyCashPengembalian[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengembalian")
    .select(PENGEMBALIAN_WITH_REFS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengembalian[];
};

/**
 * Antrian konfirmasi Finance - semua pengembalian "Menunggu Konfirmasi",
 * dibatasi ke company Finance yang login kecuali "LOURDES" (sama pola dengan
 * fetchSubVoucherPaymentQueue, services/pettyCashSubVoucherService.ts).
 */
export const fetchPengembalianQueue = async (
  financeCompany: string | null,
): Promise<PettyCashPengembalian[]> => {
  let query = supabase
    .from("petty_cash_pengembalian")
    .select(
      `*, petty_cash_sub_voucher(kode_sub_voucher, amount),
       petty_cash_voucher!inner(kode_voucher, company_code, department),
       users_with_profiles:profiles!user_id(nama, email)`,
    )
    .eq("status", "Menunggu Konfirmasi");

  if (financeCompany && financeCompany !== "LOURDES") {
    query = query.eq("petty_cash_voucher.company_code", financeCompany);
  }

  const { data, error } = await query.order("created_at", {
    ascending: true,
  });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengembalian[];
};

/**
 * Requester mengajukan pengembalian sisa dana satu tarikan (wajib bukti
 * setor). `companyCode` = company Voucher-nya, utk menentukan Finance mana
 * yang dinotifikasi.
 */
export const createPengembalian = async (
  subVoucherId: number,
  companyCode: string,
  amount: number,
  notes: string,
  attachments: Attachment[],
): Promise<PettyCashPengembalian> => {
  const { data, error } = await supabase.rpc("create_petty_cash_pengembalian", {
    p_sub_voucher_id: subVoucherId,
    p_amount: amount,
    p_notes: notes,
    p_attachments: attachments,
  });

  if (error) throw error;
  const created = data as unknown as PettyCashPengembalian;
  notifyFinanceOnPcReturnSubmitted({
    companyCode,
    pengembalianId: created.id,
    kode: created.kode_pengembalian,
    amount: created.amount,
  });
  return created;
};

/** Finance mengkonfirmasi uang pengembalian sudah diterima - budget bertambah. */
export const confirmPengembalian = async (id: number): Promise<void> => {
  const { data, error } = await supabase.rpc(
    "confirm_petty_cash_pengembalian",
    { p_id: id },
  );
  if (error) throw error;
  const row = data as unknown as PettyCashPengembalian;
  notifyOnPcReturnProcessed({
    requesterId: row.user_id,
    pengembalianId: row.id,
    kode: row.kode_pengembalian,
    amount: row.amount,
    decision: "confirmed",
  });
};

/** Finance menolak pengembalian (wajib alasan) - budget tidak berubah. */
export const rejectPengembalian = async (
  id: number,
  reason: string,
): Promise<void> => {
  const { data, error } = await supabase.rpc(
    "reject_petty_cash_pengembalian",
    { p_id: id, p_reason: reason },
  );
  if (error) throw error;
  const row = data as unknown as PettyCashPengembalian;
  notifyOnPcReturnProcessed({
    requesterId: row.user_id,
    pengembalianId: row.id,
    kode: row.kode_pengembalian,
    amount: row.amount,
    decision: "rejected",
    reason: row.reject_reason ?? undefined,
  });
};
