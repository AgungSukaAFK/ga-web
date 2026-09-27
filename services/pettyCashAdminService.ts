// src/services/pettyCashAdminService.ts
//
// Kemampuan admin LINTAS tipe dokumen Petty Cash (Pengajuan/Voucher/
// Sub-Voucher/Deklarasi) yang menyentuh lebih dari satu tabel sekaligus -
// terpisah dari `adminUpdate*` (status/approvals saja, per tabel, di
// services/pettyCash{Pengajuan,Voucher,Deklarasi}Service.ts) karena dua
// kemampuan di sini SELALU beres-beres dokumen TURUNAN juga:
//
//  - Hapus (`adminDeletePettyCashDocument`): hapus Pengajuan ikut menghapus
//    Voucher -> Sub-Voucher -> Deklarasi turunannya, DAN me-refund dana yang
//    sudah ditarik sub-voucher kembali ke Budget. Hapus Voucher/Sub-Voucher/
//    Deklarasi satuan juga otomatis merapikan konsekuensinya (refund/
//    downgrade status "Selesai" Voucher induk kalau relevan).
//  - Ganti Kode (`adminRenamePettyCashKode`): ganti kode_voucher otomatis
//    ikut mengganti kode_sub_voucher SEMUA Sub-Voucher turunannya (format
//    "{kode_voucher}-SV{urutan}").
//
// SEMUA lewat RPC SECURITY DEFINER (admin_delete_petty_cash_document /
// admin_rename_petty_cash_kode, lihat
// supabase/petty-cash-admin-full-management-setup.sql) - bukan delete/update
// langsung dari client - supaya konsistensi & refund budget SELALU atomic
// & tidak bisa "lupa" diurus dari sisi client. Tiap aksi WAJIB alasan
// (`reason`), tercatat permanen ke `petty_cash_admin_audit_log`.

import { createClient } from "@/lib/supabase/client";
import { PcDocType, PettyCashAdminAuditLog } from "@/type";

const supabase = createClient();

const DOC_TYPE_LABEL: Record<PcDocType, string> = {
  pengajuan: "Pengajuan",
  voucher: "Voucher",
  sub_voucher: "Sub-Voucher",
  deklarasi: "Deklarasi",
};

export const getPcDocTypeLabel = (docType: PcDocType): string =>
  DOC_TYPE_LABEL[docType];

/**
 * Penjelasan dampak cascade HAPUS per tipe dokumen - ditampilkan di dialog
 * konfirmasi (PcAdminDeleteDialog) SEBELUM admin menekan tombol hapus,
 * supaya tidak ada kejutan ("kenapa Sub-Voucher X ikut hilang?" dst).
 */
export const getDeleteImpactWarning = (docType: PcDocType): string => {
  switch (docType) {
    case "pengajuan":
      return "Menghapus Pengajuan ini AKAN IKUT MENGHAPUS Voucher turunannya (kalau sudah ada) beserta SELURUH Sub-Voucher (tarikan dana) & Deklarasi di bawahnya. Dana yang sudah ditarik lewat Sub-Voucher tersebut akan otomatis dikembalikan (refund) ke Budget terkait.";
    case "voucher":
      return "Menghapus Voucher ini AKAN IKUT MENGHAPUS SELURUH Sub-Voucher (tarikan dana) & Deklarasi turunannya. Dana yang sudah ditarik lewat Sub-Voucher tersebut akan otomatis dikembalikan (refund) ke Budget terkait. Pengajuan asalnya TIDAK ikut terhapus.";
    case "sub_voucher":
      return "Menghapus Sub-Voucher ini AKAN IKUT MENGHAPUS Deklarasi turunannya (kalau sudah ada). Nominal yang sudah ditarik akan otomatis dikembalikan (refund) ke Budget terkait. Kalau Voucher induknya sudah berstatus \"Selesai\", statusnya akan diturunkan lagi ke \"Approved\" karena siklus tarikan-nya jadi belum tuntas.";
    case "deklarasi":
      return "Menghapus Deklarasi ini TIDAK mengembalikan dana apa pun (dana sudah ditarik di tahap Sub-Voucher, bukan di sini) - dipakai kalau requester perlu mengulang laporan pemakaian yang salah. Kalau Voucher induknya sudah berstatus \"Selesai\" karena Deklarasi ini, statusnya akan diturunkan lagi ke \"Approved\".";
  }
};

export interface AdminDeleteSummary {
  [key: string]: any;
}

/**
 * Hapus SATU dokumen Petty Cash berikut SELURUH turunannya (cascade) &
 * refund budget yang relevan - admin only, dijamin di dalam RPC (bukan
 * cuma di client). Melempar error kalau bukan admin/dokumen tidak
 * ditemukan/alasan kosong.
 */
export const adminDeletePettyCashDocument = async (
  docType: PcDocType,
  id: number,
  reason: string,
): Promise<AdminDeleteSummary> => {
  const { data, error } = await supabase.rpc(
    "admin_delete_petty_cash_document",
    { p_doc_type: docType, p_id: id, p_reason: reason },
  );
  if (error) throw error;
  return (data ?? {}) as AdminDeleteSummary;
};

export interface AdminRenameKodeSummary {
  kode_lama: string;
  kode_baru: string;
  cascaded_sub_voucher_count: number;
}

/**
 * Ganti kode sebuah dokumen Petty Cash - kalau docType "voucher", SEMUA
 * kode_sub_voucher turunannya otomatis ikut diganti prefix-nya (lihat
 * komentar RPC-nya). Dokumen lain (Pengajuan/Deklarasi) tidak perlu
 * disentuh karena relasinya selalu lewat id, bukan kode literal.
 */
export const adminRenamePettyCashKode = async (
  docType: PcDocType,
  id: number,
  newKode: string,
  reason: string,
): Promise<AdminRenameKodeSummary> => {
  const { data, error } = await supabase.rpc(
    "admin_rename_petty_cash_kode",
    { p_doc_type: docType, p_id: id, p_new_kode: newKode, p_reason: reason },
  );
  if (error) throw error;
  return data as unknown as AdminRenameKodeSummary;
};

/**
 * Jejak audit seluruh aksi admin (hapus/ganti kode/edit paksa) - dipakai
 * halaman Management Petty Cash (tab riwayat, admin only - dijamin juga di
 * RLS select petty_cash_admin_audit_log_select). Bisa difilter per dokumen
 * (docType+docId) utk ditampilkan di halaman detail dokumen ybs.
 */
export const fetchAdminAuditLog = async (filter?: {
  docType?: PcDocType;
  docId?: number;
  limit?: number;
}): Promise<PettyCashAdminAuditLog[]> => {
  let query = supabase
    .from("petty_cash_admin_audit_log")
    .select("*, admin_profile:profiles!admin_id(nama)")
    .order("created_at", { ascending: false });

  if (filter?.docType) query = query.eq("doc_type", filter.docType);
  if (filter?.docId !== undefined) query = query.eq("doc_id", filter.docId);
  query = query.limit(filter?.limit ?? 100);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PettyCashAdminAuditLog[];
};
