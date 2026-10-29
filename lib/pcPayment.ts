// src/lib/pcPayment.ts
//
// Helper Metode Pencairan Petty Cash (Transfer/Cash/Overbook, lihat
// PcPaymentMethod di type/index.ts & supabase/migrations/0015_petty_cash_revisi.sql).
// Dipakai form Buat Voucher, Edit & Setujui Voucher, form pembayaran
// Finance, tampilan detail, dan Excel - supaya label & aturannya sama di
// semua tempat.

import { PcPaymentInfo, PcPaymentMethod } from "@/type";
import { PC_PAYMENT_METHOD_OPTIONS } from "@/type/enum";
import {
  isFinanceDepartment,
  isGADepartment,
} from "@/lib/constants/departments";

export const EMPTY_PC_PAYMENT: PcPaymentInfo = {
  payment_method: null,
  bank_name: null,
  bank_account_number: null,
  bank_account_holder_name: null,
};

/** Ambil 4 field metode pencairan saja dari dokumen apa pun (Voucher/Sub-Voucher). */
export const pickPcPayment = (
  doc: Partial<PcPaymentInfo> | null | undefined,
): PcPaymentInfo => ({
  payment_method: doc?.payment_method ?? null,
  bank_name: doc?.bank_name ?? null,
  bank_account_number: doc?.bank_account_number ?? null,
  bank_account_holder_name: doc?.bank_account_holder_name ?? null,
});

/** Bukti pembayaran Finance wajib utk metode ini? (Transfer & Overbook wajib, Cash opsional) */
export const isPcPaymentProofRequired = (
  method: PcPaymentMethod | null | undefined,
): boolean =>
  PC_PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.proofRequired ??
  true;

/** "BCA 1234567890 a.n. Budi" - kosong kalau bukan Transfer / data rekening tidak lengkap. */
export const formatPcBankAccount = (
  info: Partial<PcPaymentInfo> | null | undefined,
): string => {
  if (!info?.bank_account_number) return "";
  return [
    info.bank_name,
    info.bank_account_number,
    info.bank_account_holder_name ? `a.n. ${info.bank_account_holder_name}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

/** "Transfer - BCA 1234567890 a.n. Budi" / "Cash" / "Overbook" / fallback. */
export const formatPcPayment = (
  info: Partial<PcPaymentInfo> | null | undefined,
  fallback = "Belum dipilih",
): string => {
  if (!info?.payment_method) return fallback;
  if (info.payment_method !== "Transfer") return info.payment_method;
  const bank = formatPcBankAccount(info);
  return bank ? `Transfer - ${bank}` : "Transfer";
};

/** Pesan error kalau isian metode pencairan belum lengkap, null kalau valid. */
export const validatePcPayment = (info: PcPaymentInfo): string | null => {
  if (!info.payment_method) return "Pilih metode pencairan.";
  if (
    info.payment_method === "Transfer" &&
    (!info.bank_name?.trim() ||
      !info.bank_account_number?.trim() ||
      !info.bank_account_holder_name?.trim())
  ) {
    return "Pilih rekening tujuan transfer (bank, nomor, dan atas nama wajib lengkap).";
  }
  return null;
};

/** Rapikan sebelum dikirim ke DB - field rekening dikosongkan kalau bukan Transfer. */
export const normalizePcPayment = (info: PcPaymentInfo): PcPaymentInfo =>
  info.payment_method === "Transfer"
    ? {
        payment_method: "Transfer",
        bank_name: info.bank_name?.trim() || null,
        bank_account_number: info.bank_account_number?.trim() || null,
        bank_account_holder_name: info.bank_account_holder_name?.trim() || null,
      }
    : { ...EMPTY_PC_PAYMENT, payment_method: info.payment_method };

/**
 * Metode yang berlaku utk satu tarikan: yang dicatat Finance saat bayar,
 * atau (selama belum dibayar) rencana di Voucher induknya. `final` = sudah
 * dicatat di tarikan itu sendiri.
 */
export const resolveSubVoucherPayment = (sv: {
  payment_method?: PcPaymentMethod | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder_name?: string | null;
  petty_cash_voucher?: Partial<PcPaymentInfo> | null;
}): PcPaymentInfo & { final: boolean } =>
  sv.payment_method
    ? { ...pickPcPayment(sv), final: true }
    : { ...pickPcPayment(sv.petty_cash_voucher), final: false };

/**
 * Boleh mengubah metode pencairan Voucher di luar "Edit & Setujui": admin,
 * departemen GA, departemen Finance, atau siapa pun di jalur approval
 * Voucher. Harus sama dengan _pc_can_manage_voucher_payment
 * (supabase/migrations/0015_petty_cash_revisi.sql).
 */
export const canManageVoucherPayment = (
  viewer: { id: string; role?: string | null; department?: string | null } | null,
  approvals: { userid: string }[] | null | undefined,
): boolean =>
  !!viewer &&
  (viewer.role === "admin" ||
    isGADepartment(viewer.department) ||
    isFinanceDepartment(viewer.department) ||
    (approvals ?? []).some((a) => a.userid === viewer.id));
