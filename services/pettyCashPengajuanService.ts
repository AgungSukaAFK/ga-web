// src/services/pettyCashPengajuanService.ts
//
// "Input Pengajuan" Petty Cash - alur berbasis item (tabel
// `petty_cash_pengajuan`). created_by/updated_by/created_at/updated_at
// di-set otomatis oleh trigger DB dari auth.uid() (lihat
// supabase/petty-cash-pengajuan-setup.sql).

import { createClient } from "@/lib/supabase/client";
import {
  Attachment,
  PettyCashPengajuan,
  PettyCashPengajuanApprover,
  PettyCashPengajuanItem,
  PettyCashPengajuanWithChain,
} from "@/type";
import { resolvePcAutoTemplate } from "@/services/pcApprovalTemplateService";
import { resolveAutoBudget } from "@/services/pettyCashBudgetService";
import { fetchPendingSubVouchers } from "@/services/pettyCashSubVoucherService";
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

// Sama seperti deptAbbreviations di mrService.ts - disamakan supaya format
// kode konsisten se-aplikasi.
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
    // created_at, BUKAN id - id sekarang random (lihat generateRandomId,
    // lib/utils.ts), jadi tidak lagi berurutan sesuai waktu dibuat.
    .order("created_at", { ascending: false })
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
  // Minggu ke berapa (bulan berjalan) dana ini dibutuhkan - lihat
  // lib/weekOfMonth.ts & InputPengajuanClient.tsx (cuma minggu ini/depan
  // dalam bulan yang sama, tidak boleh minggu yang sudah lewat).
  week_of_month: number;
  // Snapshot profiles.lokasi requester PAS submit - sama perlakuannya
  // dengan company/department yang juga dikirim dari form, bukan di-join
  // ulang belakangan.
  site: string | null;
  notes: string;
  items: PettyCashPengajuanItem[];
  attachments: { url: string; name: string }[];
}

export interface PengajuanEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Cek kelayakan `userId` membuat Pengajuan baru - dipanggil dari halaman
 * "Pengajuan Saya" & Input Pengajuan SEBELUM requester mulai mengisi form,
 * supaya alasannya ketahuan lebih awal (bukan baru muncul sebagai error
 * setelah form diisi penuh dan disubmit). `createPettyCashPengajuan` di
 * bawah memanggil ini lagi sebagai jaring pengaman terakhir (race condition
 * antara requester buka form & submit, atau requester akses form langsung
 * lewat URL tanpa lewat pengecekan di halaman Pengajuan Saya).
 *
 * 3 syarat wajib:
 * 1. Departemen requester harus punya Template Approval "Approval Pengajuan"
 *    aktif (resolvePcAutoTemplate) - tanpa ini dokumen tidak akan punya
 *    jalur approval sama sekali.
 * 2. Departemen (+ site) requester harus punya Budget Petty Cash aktif
 *    (resolveAutoBudget) - dulu ini TIDAK memblokir submit (budget_id boleh
 *    null, baru memblokir nanti pas pembuatan sub-voucher), sekarang
 *    diwajibkan dari awal supaya requester tidak mengajukan sesuatu yang
 *    dananya tidak akan pernah bisa dicairkan.
 * 3. Requester tidak sedang punya Sub-Voucher (tarikan dana) yang belum
 *    dideklarasikan - satu siklus pencairan dana harus dituntaskan dulu
 *    (Deklarasi) sebelum boleh mengajukan Pengajuan baru. Ini termasuk
 *    tarikan yang masih "Menunggu Pembayaran" Finance (belum tentu sudah
 *    "Selesai") - lihat fetchPendingSubVouchers,
 *    services/pettyCashSubVoucherService.ts.
 */
export const checkPengajuanEligibility = async (
  userId: string,
  department: string,
  site: string | null,
  companyCode: string,
): Promise<PengajuanEligibility> => {
  const reasons: string[] = [];

  const [template, budget, pendingDeklarasi] = await Promise.all([
    resolvePcAutoTemplate(department, site, companyCode),
    resolveAutoBudget(department, site, companyCode),
    fetchPendingSubVouchers(userId),
  ]);

  if (!template) {
    reasons.push(
      `Departemen "${department}" (site "${site ?? "-"}", perusahaan "${companyCode}") belum memiliki Template Approval Pengajuan yang aktif. Hubungi GA/Admin untuk mengaturnya terlebih dahulu.`,
    );
  }
  if (!budget) {
    reasons.push(
      `Departemen "${department}"${site ? ` (site ${site})` : ""} belum memiliki Budget Petty Cash yang aktif. Hubungi GA/Admin untuk mengaturnya terlebih dahulu.`,
    );
  }
  if (pendingDeklarasi.length > 0) {
    reasons.push(
      `Anda masih memiliki ${pendingDeklarasi.length} Sub-Voucher yang belum dideklarasikan (${pendingDeklarasi
        .map((sv) => sv.kode_sub_voucher)
        .join(", ")}). Selesaikan Deklarasi-nya dulu sebelum membuat Pengajuan baru.`,
    );
  }

  return { eligible: reasons.length === 0, reasons };
};

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

  const eligibility = await checkPengajuanEligibility(
    userId,
    payload.department,
    payload.site,
    payload.company_code,
  );
  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const template = await resolvePcAutoTemplate(
    payload.department,
    payload.site,
    payload.company_code,
  );
  if (!template) {
    throw new Error(
      `Belum ada Template Approval untuk departemen "${payload.department}", site "${payload.site ?? "-"}", perusahaan "${payload.company_code}". Hubungi GA/Admin untuk mengatur Template Approval terlebih dahulu.`,
    );
  }

  // Auto-isi Budget sesuai departemen & site (mirip resolvePcAutoTemplate di
  // atas, cuma kuncinya dua kolom) - wajib ada, lihat checkPengajuanEligibility
  // di atas utk kenapa (beda dari perilaku lama yang membolehkan budget_id
  // null sampai tahap pembuatan sub-voucher).
  const budget = await resolveAutoBudget(
    payload.department,
    payload.site,
    payload.company_code,
  );
  if (!budget) {
    throw new Error(
      `Departemen "${payload.department}" belum memiliki Budget Petty Cash yang aktif. Hubungi GA/Admin untuk mengatur Budget terlebih dahulu.`,
    );
  }

  const totalAmount = payload.items.reduce((sum, i) => sum + i.subtotal, 0);

  let attempts = 0;
  const maxAttempts = 5;
  let currentCode = await generatePengajuanCode(
    payload.company_code,
    payload.department,
  );
  let currentId = generateRandomId();

  while (attempts < maxAttempts) {
    const dbPayload = {
      id: currentId,
      kode_pengajuan: currentCode,
      user_id: userId,
      company_code: payload.company_code,
      department: payload.department,
      budget_id: budget.id,
      needed_date: payload.needed_date,
      week_of_month: payload.week_of_month,
      site: payload.site,
      notes: payload.notes,
      items: payload.items,
      total_amount: totalAmount,
      attachments: payload.attachments,
      status: "In Approval",
      approvals: template.approval_path,
      discussions: [],
      revisions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_pengajuan")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" &&
        (error.message.includes("kode_pengajuan") ||
          error.message.includes("petty_cash_pengajuan_pkey"))
      ) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor pengajuan. Silakan coba submit ulang.",
          );
        }
        if (error.message.includes("kode_pengajuan")) {
          currentCode = await generatePengajuanCode(
            payload.company_code,
            payload.department,
          );
        }
        if (error.message.includes("petty_cash_pengajuan_pkey")) {
          currentId = generateRandomId();
        }
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
    .select("*, petty_cash_budget(name, current_budget)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengajuan[];
};

/**
 * Sama seperti fetchMyPengajuan, tapi tiap Pengajuan diikuti SELURUH
 * turunannya (Voucher -> Sub-Voucher -> Deklarasi) lewat nested select -
 * dipakai halaman "Pengajuan Saya" (pusat dokumen) supaya modal detail bisa
 * menampilkan rantai lengkap tanpa query terpisah per dokumen. Lihat
 * komentar PettyCashPengajuanWithChain (type/index.ts) utk kenapa tipe ini
 * beda dari petty_cash_voucher?: {id}[] di fetchMyPengajuan biasa.
 */
export const fetchMyPengajuanWithChain = async (
  userId: string,
): Promise<PettyCashPengajuanWithChain[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select(
      `*, petty_cash_budget(name, current_budget),
       petty_cash_voucher(*, petty_cash_budget(name, current_budget),
         petty_cash_sub_voucher(*, petty_cash_deklarasi(*)))`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengajuanWithChain[];
};

/**
 * Semua Pengajuan lintas user/departemen - dipakai halaman Management Petty
 * Cash (admin only, lihat petty_cash_pengajuan_update_admin di
 * supabase/petty-cash-admin-management-setup.sql). Beda dari fetchMyPengajuan
 * yang difilter `user_id`.
 */
export const fetchAllPengajuan = async (): Promise<PettyCashPengajuan[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select(
      "*, users_with_profiles:profiles!user_id(nama, email), petty_cash_budget(name, current_budget)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengajuan[];
};

/**
 * Override status & approvals sebuah Pengajuan apa pun - hanya bisa
 * dieksekusi user dengan role admin (dijamin di level RLS oleh
 * petty_cash_pengajuan_update_admin, bukan cuma di client). Dipakai halaman
 * Management Petty Cash untuk membenahi dokumen yang nyangkut (mis. approver
 * resign, salah pencet, dsb) tanpa harus lewat alur approve/reject normal.
 */
export const adminUpdatePengajuan = async (
  id: number,
  patch: {
    status?: string;
    approvals?: PettyCashPengajuanApprover[];
  },
): Promise<void> => {
  const { error } = await supabase
    .from("petty_cash_pengajuan")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
};

export interface AdminForceEditPengajuan {
  needed_date: string;
  week_of_month: number | null;
  site: string | null;
  company_code: string;
  department: string;
  budget_id: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
}

/**
 * "Edit Paksa" (admin only) - beda dari editAndApprovePengajuanStep,
 * fungsi ini BISA dipanggil di status apa pun (tidak perlu giliran
 * approval) & bisa mengubah company_code/department/budget_id sekaligus -
 * dijamin admin only di dalam RPC (admin_force_update_pengajuan, lihat
 * supabase/petty-cash-admin-full-management-setup.sql), bukan cuma di
 * client. total_amount SELALU dihitung ulang dari `items` di server (bukan
 * dipercaya dari sini). Tidak menyentuh status/approvals/revisions - itu
 * tetap lewat adminUpdatePengajuan/panel override yang sudah ada.
 */
export const adminForceUpdatePengajuan = async (
  id: number,
  edits: AdminForceEditPengajuan,
  reason: string,
): Promise<PettyCashPengajuan> => {
  const { data, error } = await supabase.rpc("admin_force_update_pengajuan", {
    p_id: id,
    p_needed_date: edits.needed_date,
    p_week_of_month: edits.week_of_month,
    p_site: edits.site,
    p_company_code: edits.company_code,
    p_department: edits.department,
    p_budget_id: edits.budget_id,
    p_notes: edits.notes,
    p_items: edits.items,
    p_attachments: edits.attachments,
    p_reason: reason,
  });

  if (error) throw error;
  return data as unknown as PettyCashPengajuan;
};

export const fetchPengajuanById = async (
  id: number,
): Promise<PettyCashPengajuan> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select(
      "*, users_with_profiles:profiles!user_id(nama, email), petty_cash_budget(name, current_budget)",
    )
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
    .select(
      "*, users_with_profiles:profiles!user_id(nama, email), petty_cash_budget(name, current_budget)",
    )
    .eq("status", "In Approval")
    .contains(
      "approvals",
      JSON.stringify([{ userid: userId, status: "pending" }]),
    )
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
 * entri diskusi.
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

export interface EditPengajuanEdits {
  needed_date: string;
  week_of_month: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
  // Budget yang menanggung Pengajuan ini - approver boleh ganti dari yang
  // auto-terisi (lihat komentar budget_id, PettyCashPengajuan di
  // type/index.ts). undefined = tidak diubah (dipertahankan whatever yang
  // sudah ada), beda dari null yang secara eksplisit melepas budget.
  budget_id?: number | null;
}

/**
 * "Edit & Setujui" - approver mengedit seluruh field yang bisa diedit
 * SEKALIGUS approve step dia sendiri. Versi SEBELUM edit dicatat ke
 * `revisions[]` (lihat buildEditAndApproveUpdate, lib/pcApprovalFlow.ts)
 * supaya bisa dibandingkan lagi nanti - "versi asli" = revisions[0] kalau
 * dokumen ini belum pernah direvisi sebelumnya.
 */
export const editAndApprovePengajuanStep = async (
  pengajuan: Pick<
    PettyCashPengajuan,
    | "id"
    | "approvals"
    | "revisions"
    | "needed_date"
    | "week_of_month"
    | "notes"
    | "items"
    | "attachments"
  >,
  userId: string,
  userName: string,
  edits: EditPengajuanEdits,
): Promise<void> => {
  const result = buildEditAndApproveUpdate(pengajuan, userId, userName);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const totalAmount = edits.items.reduce((sum, i) => sum + i.subtotal, 0);

  const { error } = await supabase
    .from("petty_cash_pengajuan")
    .update({
      status: result.status,
      approvals: result.approvals,
      revisions: result.revisions,
      needed_date: edits.needed_date,
      week_of_month: edits.week_of_month,
      notes: edits.notes,
      items: edits.items,
      attachments: edits.attachments,
      total_amount: totalAmount,
      budget_id: edits.budget_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pengajuan.id);

  if (error) throw error;
};
