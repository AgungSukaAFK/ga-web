// src/services/pettyCashVoucherService.ts
//
// "Pengajuan Voucher" Petty Cash - tabel `petty_cash_voucher`, tahap
// SETELAH sebuah Input Pengajuan (petty_cash_pengajuan,
// pettyCashPengajuanService.ts) selesai di-approve. Satu Voucher = SNAPSHOT
// persis dari satu Pengajuan berstatus "Approved" (item/qty/harga/catatan/
// lampiran di-copy apa adanya, requester tidak bisa mengubahnya di sini) -
// satu Pengajuan cuma boleh dipakai untuk SATU Voucher (unique pengajuan_id
// di DB, lihat supabase/petty-cash-voucher-setup.sql).
//
// Jalur approval Voucher TERPISAH dari jalur approval Pengajuan-nya -
// diambil dari Template Approval ber-approval_type "Approval Voucher" (lihat
// resolvePcAutoTemplate, services/pcApprovalTemplateService.ts).
//
// created_by/updated_by/created_at/updated_at di-set otomatis oleh trigger DB
// dari auth.uid() (lihat supabase/petty-cash-voucher-setup.sql).

import { createClient } from "@/lib/supabase/client";
import { PettyCashPengajuan, PettyCashVoucher } from "@/type";
import { PC_APPROVAL_TYPE_VOUCHER } from "@/type/enum";
import { resolvePcAutoTemplate } from "@/services/pcApprovalTemplateService";
import {
  advanceApproval,
  isMyApprovalTurn,
  rejectApproval,
} from "@/lib/pcApprovalFlow";

const supabase = createClient();

const toRoman = (num: number): string => {
  const roman = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  return roman[num] || num.toString();
};

// Sama seperti deptAbbreviations di pettyCashPengajuanService.ts /
// pettyCashService.ts - disamakan supaya format kode konsisten se-aplikasi.
const deptAbbreviations: { [key: string]: string } = {
  "General Affair": "GA",
  "HRGA-HSE": "HRGA-HSE",
  "Human Resource": "HR",
  "Human Resources": "HR",
  Marketing: "MKT",
  Produksi: "PROD",
  K3: "HSE",
  Finance: "FIN",
  IT: "IT",
  Logistik: "LOG",
  Purchasing: "PUR",
  Warehouse: "WH",
  Service: "SVC",
  "General Manager": "GM",
  "Executive Manager": "EM",
  "Boards of Director": "BOD",
};

/**
 * Generate Kode Voucher Petty Cash yang unik per company.
 * Format: {COMPANY}/PC-VCR/{BULAN_ROMAWI}/{TAHUN}/{DEPT}/{URUTAN}
 */
export const generateVoucherCode = async (
  company_code: string,
  department: string,
): Promise<string> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearYY = currentYear.toString().slice(-2);
  const currentMonthRoman = toRoman(now.getMonth() + 1);

  const deptIdentifier = department
    ? deptAbbreviations[department] || department.substring(0, 3).toUpperCase()
    : "GA";

  const prefix = company_code || "GMI";

  const { data: last, error } = await supabase
    .from("petty_cash_voucher")
    .select("kode_voucher")
    .eq("company_code", prefix)
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching last voucher of the year:", error);
    throw new Error("Gagal men-generate Kode Voucher.");
  }

  let nextNumber = 1;
  if (last) {
    try {
      const parts = last.kode_voucher.split("/");
      const lastNumberStr = parts[parts.length - 1];
      if (lastNumberStr) nextNumber = parseInt(lastNumberStr, 10) + 1;
    } catch (e) {
      console.error("Error parsing last voucher code:", e);
    }
  }

  return `${prefix}/PC-VCR/${currentMonthRoman}/${currentYearYY}/${deptIdentifier}/${nextNumber}`;
};

/**
 * Pengajuan milik `userId` yang sudah "Approved" dan BELUM punya Voucher -
 * inilah daftar yang boleh dipilih requester di halaman Pengajuan Voucher.
 * `petty_cash_voucher(id)` di-embed lewat FK pengajuan_id supaya bisa
 * difilter "belum ada voucher"-nya tanpa query terpisah.
 */
export const fetchApprovedPengajuanForVoucher = async (
  userId: string,
): Promise<PettyCashPengajuan[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select("*, petty_cash_voucher(id)")
    .eq("user_id", userId)
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashPengajuan[];
  return rows.filter(
    (row) => !row.petty_cash_voucher || row.petty_cash_voucher.length === 0,
  );
};

export const fetchMyVouchers = async (
  userId: string,
): Promise<PettyCashVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select("*, petty_cash_pengajuan(kode_pengajuan)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashVoucher[];
};

/**
 * Voucher milik `userId` yang sudah "Approved" dan siap diajukan klaim
 * pencairannya - dipakai halaman /petty-cash/claim-voucher.
 */
export const fetchClaimableVouchers = async (
  userId: string,
): Promise<PettyCashVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select("*, petty_cash_pengajuan(kode_pengajuan)")
    .eq("user_id", userId)
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashVoucher[];
};

/**
 * Ajukan klaim pencairan atas Voucher yang sudah "Approved" - menaikkan
 * status jadi "Permintaan Klaim" (lihat PC_VOUCHER_STATUS_OPTIONS,
 * type/enum.ts). Cuma pemilik dokumen yang boleh (lihat
 * petty_cash_voucher_update_owner, supabase/petty-cash-voucher-claim-setup.sql)
 * - dicek juga di sini supaya gagal cepat dengan pesan yang jelas kalau
 * statusnya sudah bukan "Approved" lagi (mis. double-submit dari 2 tab).
 */
export const submitVoucherClaim = async (
  voucher: Pick<PettyCashVoucher, "id" | "status" | "discussions">,
  userId: string,
  userName: string,
): Promise<void> => {
  if (voucher.status !== "Approved") {
    throw new Error(
      "Voucher ini belum/sudah tidak berstatus Approved, tidak bisa diajukan klaim.",
    );
  }

  const newDiscussion = {
    user_id: userId,
    user_name: userName,
    message: "Klaim pencairan Voucher diajukan.",
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("petty_cash_voucher")
    .update({
      status: "Permintaan Klaim",
      discussions: [...(voucher.discussions || []), newDiscussion],
      updated_at: new Date().toISOString(),
    })
    .eq("id", voucher.id)
    .eq("status", "Approved");

  if (error) throw error;
};

export const fetchVoucherById = async (
  id: number,
): Promise<PettyCashVoucher> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      "*, users_with_profiles!user_id(nama, email), petty_cash_pengajuan(kode_pengajuan)",
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as PettyCashVoucher;
};

/**
 * Buat Voucher baru dari sebuah Pengajuan yang sudah "Approved" - item,
 * nominal, catatan, dan lampiran di-snapshot APA ADANYA dari Pengajuan
 * asalnya (tidak bisa diedit di sini, lihat komentar di atas file ini).
 * Jalur approval-nya diambil dari Template Approval ber-approval_type
 * "Approval Voucher" untuk departemen yang sama.
 */
export const createVoucherFromPengajuan = async (
  pengajuan: Pick<
    PettyCashPengajuan,
    | "id"
    | "company_code"
    | "department"
    | "cost_center_id"
    | "needed_date"
    | "notes"
    | "items"
    | "total_amount"
    | "attachments"
  >,
  userId: string,
): Promise<PettyCashVoucher> => {
  const template = await resolvePcAutoTemplate(
    pengajuan.department,
    PC_APPROVAL_TYPE_VOUCHER,
  );
  if (!template) {
    throw new Error(
      `Belum ada Template Approval "Approval Voucher" untuk departemen "${pengajuan.department}". Hubungi GA/Admin untuk mengatur Template Approval terlebih dahulu.`,
    );
  }

  let attempts = 0;
  const maxAttempts = 5;
  let currentCode = await generateVoucherCode(
    pengajuan.company_code,
    pengajuan.department,
  );

  while (attempts < maxAttempts) {
    const dbPayload = {
      kode_voucher: currentCode,
      pengajuan_id: pengajuan.id,
      user_id: userId,
      company_code: pengajuan.company_code,
      department: pengajuan.department,
      cost_center_id: pengajuan.cost_center_id,
      needed_date: pengajuan.needed_date,
      notes: pengajuan.notes,
      items: pengajuan.items,
      total_amount: pengajuan.total_amount,
      attachments: pengajuan.attachments,
      status: "In Approval",
      approvals: template.approval_path,
      discussions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_voucher")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message.includes("kode_voucher")) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor voucher. Silakan coba submit ulang.",
          );
        }
        currentCode = await generateVoucherCode(
          pengajuan.company_code,
          pengajuan.department,
        );
        continue;
      }
      if (
        error.code === "23505" &&
        error.message.includes("petty_cash_voucher_pengajuan_id_key")
      ) {
        throw new Error(
          "Pengajuan ini sudah pernah dibuatkan Voucher sebelumnya.",
        );
      }
      throw error;
    }

    return data as unknown as PettyCashVoucher;
  }

  throw new Error("Gagal membuat voucher setelah beberapa percobaan.");
};

/**
 * Antrian approval Voucher milik `userId` - lihat komentar
 * fetchPengajuanApprovalQueue (pettyCashPengajuanService.ts) untuk kenapa
 * masih perlu difilter ulang pakai isMyApprovalTurn.
 */
export const fetchVoucherApprovalQueue = async (
  userId: string,
): Promise<PettyCashVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      "*, users_with_profiles!user_id(nama, email), petty_cash_pengajuan(kode_pengajuan)",
    )
    .eq("status", "In Approval")
    .contains("approvals", [{ userid: userId, status: "pending" }])
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashVoucher[];
  return rows.filter((row) => isMyApprovalTurn(row.approvals, userId));
};

export const approveVoucherStep = async (
  voucher: Pick<PettyCashVoucher, "id" | "approvals">,
  userId: string,
): Promise<void> => {
  const result = advanceApproval(voucher.approvals, userId);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const { error } = await supabase
    .from("petty_cash_voucher")
    .update({
      status: result.isLastApprover ? "Approved" : "In Approval",
      approvals: result.approvals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", voucher.id);

  if (error) throw error;
};

export const rejectVoucherStep = async (
  voucher: Pick<PettyCashVoucher, "id" | "approvals" | "discussions">,
  userId: string,
  userName: string,
  reason: string,
): Promise<void> => {
  const updatedApprovals = rejectApproval(voucher.approvals, userId);
  if (!updatedApprovals)
    throw new Error("Bukan giliran Anda untuk menolak dokumen ini.");

  const newDiscussion = {
    user_id: userId,
    user_name: userName,
    message: `[PENOLAKAN] Alasan: ${reason}`,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("petty_cash_voucher")
    .update({
      status: "Rejected",
      approvals: updatedApprovals,
      discussions: [...(voucher.discussions || []), newDiscussion],
      updated_at: new Date().toISOString(),
    })
    .eq("id", voucher.id);

  if (error) throw error;
};
