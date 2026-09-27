// src/services/pettyCashSubVoucherService.ts
//
// Sub-Voucher Petty Cash - tarikan dana PARSIAL dari sebuah Voucher yang
// sudah full-approved (tabel `petty_cash_sub_voucher`, lihat komentar
// PettyCashSubVoucher di type/index.ts & supabase/petty-cash-sub-voucher-setup.sql
// + petty-cash-sub-voucher-payment-setup.sql). MENGGANTIKAN alur klaim
// sekali-penuh yang lama (submitVoucherClaim, "Permintaan Klaim" - sudah
// dihapus dari services/pettyCashVoucherService.ts). UI Tarik Dana-nya
// menyatu di halaman "Pengajuan Voucher" (PengajuanVoucherClient.tsx, tabel
// "Voucher Saya") - bukan halaman terpisah, lihat komentar di sana.
//
// Tarikan dipilih PER-ITEM/QTY (checklist barang dari Voucher, qty boleh
// sebagian & di-split ke beberapa tarikan berbeda), BUKAN nominal bebas -
// lihat komentar PettyCashSubVoucherItem, type/index.ts. Pembuatan
// sub-voucher SELALU lewat RPC create_petty_cash_sub_voucher (SECURITY
// DEFINER) - satu transaksi yang atomically validasi sisa qty tiap item &
// sisa Voucher & potong petty_cash_budget.current_budget, supaya dua tarikan
// hampir bersamaan tidak bisa sama-sama lolos & berdua memotong lebih dari
// yang tersedia.
//
// Sub-Voucher yang baru dibuat BELUM berarti dana diterima requester -
// statusnya "Menunggu Pembayaran" sampai Finance approver (department
// "Finance" + role "approver", atau admin) menyelesaikan pembayaran lewat
// RPC mark_petty_cash_sub_voucher_paid (wajib sertakan bukti transfer) - baru
// setelah itu "Selesai" & boleh dideklarasikan.

import { createClient } from "@/lib/supabase/client";
import {
  Attachment,
  PettyCashSubVoucher,
  PettyCashSubVoucherItem,
  PettyCashVoucher,
} from "@/type";
import { generateRandomId } from "@/lib/utils";

const supabase = createClient();

const SUB_VOUCHER_WITH_VOUCHER = `
  *, petty_cash_voucher(kode_voucher, total_amount, items, company_code,
    department, week_of_month, site, petty_cash_pengajuan(kode_pengajuan),
    petty_cash_budget(name, current_budget)),
  users_with_profiles:profiles!user_id(nama, email),
  paid_by_profile:profiles!paid_by(nama)
`;

/**
 * Kode Sub-Voucher = {kode_voucher}-SV{urutan} - urutan dihitung dari
 * jumlah sub-voucher yang sudah ada utk Voucher itu + 1.
 */
const generateSubVoucherCode = async (
  voucherId: number,
  kodeVoucher: string,
): Promise<string> => {
  const { count, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", voucherId);

  if (error) throw error;
  return `${kodeVoucher}-SV${(count ?? 0) + 1}`;
};

/**
 * SEMUA Sub-Voucher milik `userId` yang belum ada Deklarasi-nya, TANPA
 * filter status pembayaran - dipakai checkPengajuanEligibility
 * (services/pettyCashPengajuanService.ts) supaya requester tetap tidak boleh
 * membuat Pengajuan baru selama masih ada tarikan yang belum tuntas, baik
 * yang masih "Menunggu Pembayaran" MAUPUN yang sudah "Selesai" tapi belum
 * dideklarasikan. Beda dari fetchSubVouchersForDeklarasi di bawah yang cuma
 * mengembalikan yang SUDAH boleh dideklarasikan (sudah dibayar).
 */
export const fetchPendingSubVouchers = async (
  userId: string,
): Promise<PettyCashSubVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select("id, kode_sub_voucher, status, petty_cash_deklarasi(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashSubVoucher[];
  return rows.filter(
    (row) =>
      !row.petty_cash_deklarasi || row.petty_cash_deklarasi.length === 0,
  );
};

/**
 * Sub-voucher milik `userId` yang SUDAH "Selesai" (sudah dibayar Finance)
 * dan BELUM dideklarasikan - dipakai halaman Deklarasi (menggantikan
 * fetchClaimedVouchersForDeklarasi yang lama). Sub-voucher yang masih
 * "Menunggu Pembayaran" SENGAJA tidak ikut - requester belum benar-benar
 * menerima dananya, jadi belum ada yang bisa dideklarasikan.
 */
export const fetchSubVouchersForDeklarasi = async (
  userId: string,
): Promise<PettyCashSubVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select(
      `*, petty_cash_voucher(kode_voucher, total_amount, items, company_code,
        department, week_of_month, site),
       petty_cash_deklarasi(id)`,
    )
    .eq("user_id", userId)
    .eq("status", "Selesai")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashSubVoucher[];
  return rows.filter(
    (row) =>
      !row.petty_cash_deklarasi || row.petty_cash_deklarasi.length === 0,
  );
};

export const fetchSubVoucherById = async (
  id: number,
): Promise<PettyCashSubVoucher> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select(SUB_VOUCHER_WITH_VOUCHER)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as PettyCashSubVoucher;
};

/**
 * SEMUA Sub-Voucher lintas user/departemen - dipakai halaman Management
 * Petty Cash (admin only, tab "Sub-Voucher"). Beda dari
 * fetchSubVoucherPaymentQueue (Finance, difilter status "Menunggu
 * Pembayaran" + company) atau fetchPendingSubVouchers/
 * fetchSubVouchersForDeklarasi (difilter user_id) - ini benar-benar semua
 * baris, sama pola dengan fetchAllPengajuan/fetchAllVouchers/
 * fetchAllDeklarasi di service sebelahnya.
 */
export const fetchAllSubVouchers = async (): Promise<PettyCashSubVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select(SUB_VOUCHER_WITH_VOUCHER)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashSubVoucher[];
};

export interface AdminForceEditSubVoucher {
  // Item WAJIB persis set `item_index` yang sama dgn baris yang sudah ada -
  // cuma qty/unit_price/note per baris yang boleh disesuaikan admin (lihat
  // komentar lengkap di admin_force_update_sub_voucher,
  // supabase/petty-cash-admin-full-management-setup.sql, utk kenapa baris
  // tidak boleh ditambah/dihapus di sini).
  items: PettyCashSubVoucherItem[];
  notes: string | null;
  status: "Menunggu Pembayaran" | "Selesai";
  payment_proof: Attachment[];
}

/**
 * "Edit Paksa" Sub-Voucher (admin only) - SATU-SATUNYA cara admin
 * mengoreksi Sub-Voucher (dokumen ini tidak punya jalur approval sendiri
 * utk di-override lewat panel seperti 3 dokumen lain, lihat komentar
 * PettyCashSubVoucher, type/index.ts). Selisih nominal (kalau qty/harga
 * disesuaikan) otomatis direkonsiliasi ke Budget terkait (potong lagi kalau
 * naik, refund kalau turun) - lihat RPC-nya utk detail lengkap. Dijamin
 * admin only di dalam RPC (admin_force_update_sub_voucher).
 */
export const adminForceUpdateSubVoucher = async (
  id: number,
  edits: AdminForceEditSubVoucher,
  reason: string,
): Promise<PettyCashSubVoucher> => {
  const { data, error } = await supabase.rpc(
    "admin_force_update_sub_voucher",
    {
      p_id: id,
      p_items: edits.items,
      p_notes: edits.notes,
      p_status: edits.status,
      p_payment_proof: edits.payment_proof,
      p_reason: reason,
    },
  );

  if (error) throw error;
  return data as unknown as PettyCashSubVoucher;
};

/**
 * Antrian pembayaran Finance - semua Sub-Voucher berstatus "Menunggu
 * Pembayaran", dibatasi ke company Finance yang login (sama pola dengan
 * fetchBudgets, services/pettyCashBudgetService.ts) kecuali company
 * "LOURDES" yang lihat semua. `!inner` dipakai supaya filter company bisa
 * jalan di atas kolom hasil join (petty_cash_voucher.company_code).
 */
export const fetchSubVoucherPaymentQueue = async (
  financeCompany: string | null,
): Promise<PettyCashSubVoucher[]> => {
  let query = supabase
    .from("petty_cash_sub_voucher")
    .select(
      `*, petty_cash_voucher!inner(kode_voucher, total_amount, items, company_code,
        department, week_of_month, site, petty_cash_pengajuan(kode_pengajuan)),
       users_with_profiles:profiles!user_id(nama, email)`,
    )
    .eq("status", "Menunggu Pembayaran");

  if (financeCompany && financeCompany !== "LOURDES") {
    query = query.eq("petty_cash_voucher.company_code", financeCompany);
  }

  const { data, error } = await query.order("created_at", {
    ascending: true,
  });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashSubVoucher[];
};

export interface SubVoucherDraw {
  item_index: number;
  qty: number;
}

/**
 * Tarik dana sebagian dari Voucher yang sudah Approved - `draws` adalah
 * daftar barang (identitas lewat posisi array di voucher.items) & berapa
 * qty yang ditarik SEKARANG dari barang itu (boleh sebagian, sisanya bisa
 * ditarik lagi di Sub-Voucher lain). Lihat komentar di atas file ini utk
 * kenapa lewat RPC (bukan insert langsung) & PettyCashSubVoucherItem
 * (type/index.ts) utk kenapa identitas barangnya pakai index, bukan id.
 * Retry kalau bentrok id/kode (sama idiom dengan createPettyCashPengajuan
 * dkk.).
 */
export const createSubVoucher = async (
  voucher: Pick<PettyCashVoucher, "id" | "kode_voucher">,
  draws: SubVoucherDraw[],
  notes: string,
): Promise<PettyCashSubVoucher> => {
  if (draws.length === 0) {
    throw new Error("Pilih minimal 1 barang untuk ditarik.");
  }

  let attempts = 0;
  const maxAttempts = 5;
  let currentId = generateRandomId();
  let currentCode = await generateSubVoucherCode(
    voucher.id,
    voucher.kode_voucher,
  );

  while (attempts < maxAttempts) {
    const { data, error } = await supabase.rpc(
      "create_petty_cash_sub_voucher",
      {
        p_id: currentId,
        p_kode_sub_voucher: currentCode,
        p_voucher_id: voucher.id,
        p_draws: draws,
        p_notes: notes,
      },
    );

    if (error) {
      if (
        error.code === "23505" &&
        (error.message.includes("kode_sub_voucher") ||
          error.message.includes("petty_cash_sub_voucher_pkey"))
      ) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor sub-voucher. Silakan coba lagi.",
          );
        }
        if (error.message.includes("kode_sub_voucher")) {
          currentCode = await generateSubVoucherCode(
            voucher.id,
            voucher.kode_voucher,
          );
        }
        if (error.message.includes("petty_cash_sub_voucher_pkey")) {
          currentId = generateRandomId();
        }
        continue;
      }
      throw error;
    }

    return data as unknown as PettyCashSubVoucher;
  }

  throw new Error("Gagal membuat sub-voucher setelah beberapa percobaan.");
};

/**
 * Selesaikan pembayaran Sub-Voucher (Finance/admin only, dijamin di RPC -
 * lihat mark_petty_cash_sub_voucher_paid,
 * supabase/petty-cash-sub-voucher-payment-setup.sql) - wajib sertakan bukti
 * transfer, tidak bisa dipanggil dgn attachment kosong.
 */
export const markSubVoucherPaid = async (
  id: number,
  paymentProof: Attachment[],
): Promise<void> => {
  const { error } = await supabase.rpc("mark_petty_cash_sub_voucher_paid", {
    p_id: id,
    p_payment_proof: paymentProof,
  });
  if (error) throw error;
};
