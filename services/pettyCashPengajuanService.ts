// src/services/pettyCashPengajuanService.ts
//
// "Input Pengajuan" Petty Cash - alur BARU berbasis item (tabel
// `petty_cash_pengajuan`), terpisah total dari `petty_cash_requests`
// (pettyCashService.ts, alur lama lump-sum Reimbursement/Cash Advance).
// created_by/updated_by/created_at/updated_at di-set otomatis oleh trigger DB
// dari auth.uid() (lihat supabase/petty-cash-pengajuan-setup.sql).

import { createClient } from "@/lib/supabase/client";
import { PettyCashPengajuan, PettyCashPengajuanItem } from "@/type";
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

// Sama seperti deptAbbreviations di pettyCashService.ts - disamakan supaya
// format kode konsisten se-aplikasi.
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
 * Generate Kode Pengajuan Petty Cash (item-based) yang unik per company.
 * Format: {COMPANY}/PC-PJN/{BULAN_ROMAWI}/{TAHUN}/{DEPT}/{URUTAN}
 */
export const generatePengajuanCode = async (
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
    .from("petty_cash_pengajuan")
    .select("kode_pengajuan")
    .eq("company_code", prefix)
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching last pengajuan of the year:", error);
    throw new Error("Gagal men-generate Kode Pengajuan.");
  }

  let nextNumber = 1;
  if (last) {
    try {
      const parts = last.kode_pengajuan.split("/");
      const lastNumberStr = parts[parts.length - 1];
      if (lastNumberStr) nextNumber = parseInt(lastNumberStr, 10) + 1;
    } catch (e) {
      console.error("Error parsing last pengajuan code:", e);
    }
  }

  return `${prefix}/PC-PJN/${currentMonthRoman}/${currentYearYY}/${deptIdentifier}/${nextNumber}`;
};

export interface CreatePengajuanPayload {
  company_code: string;
  department: string;
  needed_date: string;
  notes: string;
  items: PettyCashPengajuanItem[];
  attachments: { url: string; name: string }[];
}

/**
 * Membuat Input Pengajuan baru - approval path-nya diambil OTOMATIS dari
 * Template Approval Petty Cash yang auto-terapkan sesuai departemen (lihat
 * resolvePcAutoTemplate). Kalau departemen belum punya template auto-
 * terapkan, submission ditolak (bukan dibuat dengan approvals kosong/nyangkut
 * - belum ada halaman "Approval Pengajuan" untuk override manual).
 */
export const createPettyCashPengajuan = async (
  payload: CreatePengajuanPayload,
  userId: string,
): Promise<PettyCashPengajuan> => {
  if (payload.items.length === 0) {
    throw new Error("Minimal harus ada 1 barang di pengajuan.");
  }

  const template = await resolvePcAutoTemplate(payload.department);
  if (!template) {
    throw new Error(
      `Belum ada Template Approval untuk departemen "${payload.department}". Hubungi GA/Admin untuk mengatur Template Approval terlebih dahulu.`,
    );
  }

  const totalAmount = payload.items.reduce((sum, i) => sum + i.subtotal, 0);

  let attempts = 0;
  const maxAttempts = 5;
  let currentCode = await generatePengajuanCode(
    payload.company_code,
    payload.department,
  );

  while (attempts < maxAttempts) {
    const dbPayload = {
      kode_pengajuan: currentCode,
      user_id: userId,
      company_code: payload.company_code,
      department: payload.department,
      cost_center_id: null,
      needed_date: payload.needed_date,
      notes: payload.notes,
      items: payload.items,
      total_amount: totalAmount,
      attachments: payload.attachments,
      status: "In Approval",
      approvals: template.approval_path,
      discussions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_pengajuan")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message.includes("kode_pengajuan")) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor pengajuan. Silakan coba submit ulang.",
          );
        }
        currentCode = await generatePengajuanCode(
          payload.company_code,
          payload.department,
        );
        continue;
      }
      throw error;
    }

    return data as unknown as PettyCashPengajuan;
  }

  throw new Error("Gagal membuat pengajuan setelah beberapa percobaan.");
};

export const fetchMyPengajuan = async (
  userId: string,
): Promise<PettyCashPengajuan[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengajuan[];
};

export const fetchPengajuanById = async (
  id: number,
): Promise<PettyCashPengajuan> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select("*, users_with_profiles!user_id(nama, email)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as PettyCashPengajuan;
};

/**
 * Antrian approval Pengajuan milik `userId` - prefilter server-side pakai
 * containment jsonb (siapapun yang tercatat "pending" di approvals-nya),
 * TAPI ini belum berarti giliran dia (semua approver mulai "pending" saat
 * dibuat, lihat komentar lib/pcApprovalFlow.ts) - makanya masih difilter
 * lagi di sini pakai isMyApprovalTurn sebelum dikembalikan ke UI.
 */
export const fetchPengajuanApprovalQueue = async (
  userId: string,
): Promise<PettyCashPengajuan[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select("*, users_with_profiles!user_id(nama, email)")
    .eq("status", "In Approval")
    .contains("approvals", [{ userid: userId, status: "pending" }])
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashPengajuan[];
  return rows.filter((row) => isMyApprovalTurn(row.approvals, userId));
};

/**
 * Approve step approval milik `userId` di sebuah Pengajuan. Kalau dia
 * approver terakhir, status dokumen naik jadi "Approved" - status inilah
 * yang jadi syarat sebuah Pengajuan boleh di-voucher-kan (lihat
 * fetchApprovedPengajuanForVoucher, services/pettyCashVoucherService.ts).
 */
export const approvePengajuanStep = async (
  pengajuan: Pick<PettyCashPengajuan, "id" | "approvals">,
  userId: string,
): Promise<void> => {
  const result = advanceApproval(pengajuan.approvals, userId);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const { error } = await supabase
    .from("petty_cash_pengajuan")
    .update({
      status: result.isLastApprover ? "Approved" : "In Approval",
      approvals: result.approvals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pengajuan.id);

  if (error) throw error;
};

/**
 * Reject step approval milik `userId` di sebuah Pengajuan - dokumen langsung
 * "Rejected" (tidak lanjut ke approver berikutnya), alasan dicatat sebagai
 * entri diskusi (sama seperti alur PettyCashRequest lama, lihat
 * handleRejectSubmit di petty-cash/[id]/page.tsx).
 */
export const rejectPengajuanStep = async (
  pengajuan: Pick<PettyCashPengajuan, "id" | "approvals" | "discussions">,
  userId: string,
  userName: string,
  reason: string,
): Promise<void> => {
  const updatedApprovals = rejectApproval(pengajuan.approvals, userId);
  if (!updatedApprovals)
    throw new Error("Bukan giliran Anda untuk menolak dokumen ini.");

  const newDiscussion = {
    user_id: userId,
    user_name: userName,
    message: `[PENOLAKAN] Alasan: ${reason}`,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("petty_cash_pengajuan")
    .update({
      status: "Rejected",
      approvals: updatedApprovals,
      discussions: [...(pengajuan.discussions || []), newDiscussion],
      updated_at: new Date().toISOString(),
    })
    .eq("id", pengajuan.id);

  if (error) throw error;
};
