// src/services/pettyCashDeklarasiService.ts
//
// "Deklarasi" Petty Cash - tabel `petty_cash_deklarasi`, tahap SETELAH
// sebuah Sub-Voucher (petty_cash_sub_voucher, tarikan dana parsial - lihat
// services/pettyCashSubVoucherService.ts) ditarik. Di sini requester
// melaporkan pemakaian RIIL dana yang sudah dicairkan lewat tarikan itu -
// item disalin dari Voucher asalnya tapi qty/unit_price/note per baris
// BOLEH disesuaikan ke pemakaian riil (beda dari createVoucherFromPengajuan
// yang snapshot apa adanya) - satu Sub-Voucher cuma boleh dipakai untuk SATU
// Deklarasi (unique sub_voucher_id di DB, lihat
// supabase/petty-cash-deklarasi-sub-voucher-setup.sql).
//
// Jalur approval Deklarasi TERPISAH dari jalur approval Voucher-nya -
// diambil dari Template Approval ber-approval_type "Approval Deklarasi"
// (lihat resolvePcAutoTemplate, services/pcApprovalTemplateService.ts).
//
// created_by/updated_by/created_at/updated_at di-set otomatis oleh trigger DB
// dari auth.uid() (lihat supabase/petty-cash-deklarasi-setup.sql).

import { createClient } from "@/lib/supabase/client";
import {
  Attachment,
  PettyCashDeklarasi,
  PettyCashPengajuanApprover,
  PettyCashPengajuanItem,
} from "@/type";
import { PC_APPROVAL_TYPE_DEKLARASI } from "@/type/enum";
import { resolvePcAutoTemplate } from "@/services/pcApprovalTemplateService";
import {
  advanceApproval,
  buildEditAndApproveUpdate,
  isMyApprovalTurn,
  rejectApproval,
} from "@/lib/pcApprovalFlow";
import { generateRandomId } from "@/lib/utils";

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

// Sama seperti deptAbbreviations di pettyCashVoucherService.ts - disamakan
// supaya format kode konsisten se-aplikasi.
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

const VOUCHER_WITH_PENGAJUAN =
  "petty_cash_voucher(kode_voucher, total_amount, petty_cash_pengajuan(kode_pengajuan)), petty_cash_sub_voucher(kode_sub_voucher, amount)";

/**
 * Generate Kode Deklarasi Petty Cash yang unik per company.
 * Format: {COMPANY}/PC-DKL/{BULAN_ROMAWI}/{TAHUN}/{DEPT}/{URUTAN}
 */
export const generateDeklarasiCode = async (
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
    .from("petty_cash_deklarasi")
    .select("kode_deklarasi")
    .eq("company_code", prefix)
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    // created_at, BUKAN id - id sekarang random (lihat generateRandomId,
    // lib/utils.ts), jadi tidak lagi berurutan sesuai waktu dibuat.
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching last deklarasi of the year:", error);
    throw new Error("Gagal men-generate Kode Deklarasi.");
  }

  let nextNumber = 1;
  if (last) {
    try {
      const parts = last.kode_deklarasi.split("/");
      const lastNumberStr = parts[parts.length - 1];
      if (lastNumberStr) nextNumber = parseInt(lastNumberStr, 10) + 1;
    } catch (e) {
      console.error("Error parsing last deklarasi code:", e);
    }
  }

  return `${prefix}/PC-DKL/${currentMonthRoman}/${currentYearYY}/${deptIdentifier}/${nextNumber}`;
};

export const fetchMyDeklarasi = async (
  userId: string,
): Promise<PettyCashDeklarasi[]> => {
  const { data, error } = await supabase
    .from("petty_cash_deklarasi")
    .select(`*, ${VOUCHER_WITH_PENGAJUAN}`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashDeklarasi[];
};

/**
 * Satu Deklarasi by id - dipakai halaman detail + cetak
 * (petty-cash/deklarasi/[id]/page.tsx), sama pola dengan fetchPengajuanById/
 * fetchVoucherById di service sebelahnya.
 */
export const fetchDeklarasiById = async (
  id: number,
): Promise<PettyCashDeklarasi> => {
  const { data, error } = await supabase
    .from("petty_cash_deklarasi")
    .select(
      `*, users_with_profiles:profiles!user_id(nama, email), ${VOUCHER_WITH_PENGAJUAN}`,
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as PettyCashDeklarasi;
};

/**
 * Semua Deklarasi lintas user/departemen - dipakai halaman Management Petty
 * Cash (admin only, lihat petty_cash_deklarasi_update_admin di
 * supabase/petty-cash-admin-management-setup.sql).
 */
export const fetchAllDeklarasi = async (): Promise<PettyCashDeklarasi[]> => {
  const { data, error } = await supabase
    .from("petty_cash_deklarasi")
    .select(
      `*, users_with_profiles:profiles!user_id(nama, email), ${VOUCHER_WITH_PENGAJUAN}`,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashDeklarasi[];
};

/**
 * Override status & approvals sebuah Deklarasi apa pun - admin only (dijamin
 * di RLS, lihat komentar adminUpdatePengajuan,
 * services/pettyCashPengajuanService.ts untuk alasan yang sama).
 */
export const adminUpdateDeklarasi = async (
  id: number,
  patch: {
    status?: string;
    approvals?: PettyCashPengajuanApprover[];
  },
): Promise<void> => {
  const { error } = await supabase
    .from("petty_cash_deklarasi")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
};

export interface CreateDeklarasiPayload {
  sub_voucher_id: number;
  voucher_id: number;
  company_code: string;
  department: string;
  cost_center_id: number | null;
  // Disalin dari Voucher asalnya - lihat komentar week_of_month/site di
  // PettyCashDeklarasi (type/index.ts).
  week_of_month: number | null;
  site: string | null;
  notes: string;
  items: PettyCashPengajuanItem[];
  total_amount: number;
  attachments: Attachment[];
}

/**
 * Buat Deklarasi baru dari sebuah Sub-Voucher (tarikan dana parsial) - item
 * disalin dari Voucher asalnya, tapi qty/unit_price/note per baris boleh
 * sudah disesuaikan requester ke pemakaian riil (lihat komentar di atas
 * file ini). Jalur approval-nya diambil dari Template Approval
 * ber-approval_type "Approval Deklarasi" untuk departemen yang sama. Begitu
 * Deklarasi ini disetujui, trigger DB
 * (petty-cash-voucher-deklarasi-complete-setup.sql) yang cek apakah SEMUA
 * sub-voucher Voucher induknya sudah tuntas dideklarasikan.
 */
export const createDeklarasiFromSubVoucher = async (
  payload: CreateDeklarasiPayload,
  userId: string,
): Promise<PettyCashDeklarasi> => {
  if (payload.items.length === 0) {
    throw new Error("Minimal harus ada 1 barang di deklarasi.");
  }

  const template = await resolvePcAutoTemplate(
    payload.department,
    PC_APPROVAL_TYPE_DEKLARASI,
  );
  if (!template) {
    throw new Error(
      `Belum ada Template Approval "Approval Deklarasi" untuk departemen "${payload.department}". Hubungi GA/Admin untuk mengatur Template Approval terlebih dahulu.`,
    );
  }

  let attempts = 0;
  const maxAttempts = 5;
  let currentCode = await generateDeklarasiCode(
    payload.company_code,
    payload.department,
  );
  let currentId = generateRandomId();

  while (attempts < maxAttempts) {
    const dbPayload = {
      id: currentId,
      kode_deklarasi: currentCode,
      sub_voucher_id: payload.sub_voucher_id,
      voucher_id: payload.voucher_id,
      user_id: userId,
      company_code: payload.company_code,
      department: payload.department,
      cost_center_id: payload.cost_center_id,
      week_of_month: payload.week_of_month,
      site: payload.site,
      notes: payload.notes,
      items: payload.items,
      total_amount: payload.total_amount,
      attachments: payload.attachments,
      status: "In Approval",
      approvals: template.approval_path,
      discussions: [],
      revisions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_deklarasi")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" &&
        error.message.includes("petty_cash_deklarasi_sub_voucher_id_key")
      ) {
        throw new Error(
          "Sub-Voucher ini sudah pernah dibuatkan Deklarasi sebelumnya.",
        );
      }
      if (
        error.code === "23505" &&
        (error.message.includes("kode_deklarasi") ||
          error.message.includes("petty_cash_deklarasi_pkey"))
      ) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor deklarasi. Silakan coba submit ulang.",
          );
        }
        if (error.message.includes("kode_deklarasi")) {
          currentCode = await generateDeklarasiCode(
            payload.company_code,
            payload.department,
          );
        }
        if (error.message.includes("petty_cash_deklarasi_pkey")) {
          currentId = generateRandomId();
        }
        continue;
      }
      throw error;
    }

    return data as unknown as PettyCashDeklarasi;
  }

  throw new Error("Gagal membuat deklarasi setelah beberapa percobaan.");
};

/**
 * Antrian approval Deklarasi milik `userId` - lihat komentar
 * fetchPengajuanApprovalQueue (pettyCashPengajuanService.ts) untuk kenapa
 * masih perlu difilter ulang pakai isMyApprovalTurn.
 */
export const fetchDeklarasiApprovalQueue = async (
  userId: string,
): Promise<PettyCashDeklarasi[]> => {
  const { data, error } = await supabase
    .from("petty_cash_deklarasi")
    .select(
      `*, users_with_profiles:profiles!user_id(nama, email), ${VOUCHER_WITH_PENGAJUAN}`,
    )
    .eq("status", "In Approval")
    .contains(
      "approvals",
      JSON.stringify([{ userid: userId, status: "pending" }]),
    )
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashDeklarasi[];
  return rows.filter((row) => isMyApprovalTurn(row.approvals, userId));
};

export const approveDeklarasiStep = async (
  deklarasi: Pick<PettyCashDeklarasi, "id" | "approvals">,
  userId: string,
): Promise<void> => {
  const result = advanceApproval(deklarasi.approvals, userId);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const { error } = await supabase
    .from("petty_cash_deklarasi")
    .update({
      status: result.isLastApprover ? "Approved" : "In Approval",
      approvals: result.approvals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deklarasi.id);

  if (error) throw error;
};

export const rejectDeklarasiStep = async (
  deklarasi: Pick<PettyCashDeklarasi, "id" | "approvals" | "discussions">,
  userId: string,
  userName: string,
  reason: string,
): Promise<void> => {
  const updatedApprovals = rejectApproval(deklarasi.approvals, userId);
  if (!updatedApprovals)
    throw new Error("Bukan giliran Anda untuk menolak dokumen ini.");

  const newDiscussion = {
    user_id: userId,
    user_name: userName,
    message: `[PENOLAKAN] Alasan: ${reason}`,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("petty_cash_deklarasi")
    .update({
      status: "Rejected",
      approvals: updatedApprovals,
      discussions: [...(deklarasi.discussions || []), newDiscussion],
      updated_at: new Date().toISOString(),
    })
    .eq("id", deklarasi.id);

  if (error) throw error;
};

export interface EditDeklarasiEdits {
  // Deklarasi tidak punya needed_date sendiri (lihat komentar di
  // PettyCashDeklarasi, type/index.ts) - week_of_month/site tetap ikut
  // dokumen (disalin dari Voucher), tidak diedit lewat sini.
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
}

/**
 * "Edit & Setujui" - approver Deklarasi mengedit item/catatan/lampiran
 * SEKALIGUS approve step dia sendiri. Sama pola dengan
 * editAndApprovePengajuanStep (pettyCashPengajuanService.ts) - lihat
 * komentar di sana.
 */
export const editAndApproveDeklarasiStep = async (
  deklarasi: Pick<
    PettyCashDeklarasi,
    "id" | "approvals" | "revisions" | "notes" | "items" | "attachments"
  >,
  userId: string,
  userName: string,
  edits: EditDeklarasiEdits,
): Promise<void> => {
  const result = buildEditAndApproveUpdate(deklarasi, userId, userName);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const totalAmount = edits.items.reduce((sum, i) => sum + i.subtotal, 0);

  const { error } = await supabase
    .from("petty_cash_deklarasi")
    .update({
      status: result.status,
      approvals: result.approvals,
      revisions: result.revisions,
      notes: edits.notes,
      items: edits.items,
      attachments: edits.attachments,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deklarasi.id);

  if (error) throw error;
};
