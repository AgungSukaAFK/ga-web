// src/services/pettyCashSubVoucherService.ts
//
// Sub-Voucher Petty Cash - tarikan dana PARSIAL dari sebuah Voucher yang
// sudah full-approved (tabel `petty_cash_sub_voucher`, lihat komentar
// PettyCashSubVoucher di type/index.ts & supabase/petty-cash-sub-voucher-setup.sql).
// MENGGANTIKAN alur klaim sekali-penuh yang lama (submitVoucherClaim,
// "Permintaan Klaim" - sudah dihapus dari services/pettyCashVoucherService.ts).
//
// Pembuatan sub-voucher SELALU lewat RPC create_petty_cash_sub_voucher
// (SECURITY DEFINER) - satu transaksi yang atomically validasi sisa Voucher
// & potong petty_cash_budget.current_budget, supaya dua tarikan hampir
// bersamaan tidak bisa sama-sama lolos & berdua memotong lebih dari yang
// tersedia.

import { createClient } from "@/lib/supabase/client";
import { PettyCashSubVoucher, PettyCashVoucher } from "@/type";
import { generateRandomId } from "@/lib/utils";

const supabase = createClient();

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
 * Voucher milik `userId` yang masih bisa ditarik - status "Approved" dan
 * sisa (total_amount - SUM sub-voucher yang sudah ada) > 0. Dipakai halaman
 * /petty-cash/sub-voucher.
 */
export const fetchDrawableVouchers = async (
  userId: string,
): Promise<PettyCashVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      "*, petty_cash_pengajuan(kode_pengajuan), petty_cash_sub_voucher(id, amount), petty_cash_budget(name, current_budget)",
    )
    .eq("user_id", userId)
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashVoucher[];
  return rows.filter((v) => {
    const drawn = (v.petty_cash_sub_voucher ?? []).reduce(
      (sum, sv) => sum + sv.amount,
      0,
    );
    return v.total_amount - drawn > 0;
  });
};

export const fetchMySubVouchers = async (
  userId: string,
): Promise<PettyCashSubVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select("*, petty_cash_voucher(kode_voucher, total_amount)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashSubVoucher[];
};

/**
 * Sub-voucher milik `userId` yang BELUM dideklarasikan - dipakai halaman
 * Deklarasi (menggantikan fetchClaimedVouchersForDeklarasi yang lama).
 */
export const fetchSubVouchersForDeklarasi = async (
  userId: string,
): Promise<PettyCashSubVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_sub_voucher")
    .select(
      `*, petty_cash_voucher(kode_voucher, total_amount, items, company_code,
        department, cost_center_id, week_of_month, site),
       petty_cash_deklarasi(id)`,
    )
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
 * Tarik dana sebagian dari Voucher yang sudah Approved - lihat komentar di
 * atas file ini utk kenapa lewat RPC (bukan insert langsung). Retry kalau
 * bentrok id/kode (sama idiom dengan createPettyCashPengajuan dkk.).
 */
export const createSubVoucher = async (
  voucher: Pick<PettyCashVoucher, "id" | "kode_voucher">,
  amount: number,
  notes: string,
): Promise<PettyCashSubVoucher> => {
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
        p_amount: amount,
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
