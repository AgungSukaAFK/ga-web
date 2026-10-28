// src/services/pettyCashVoucherService.ts
//
// "Pengajuan Voucher" Petty Cash - tabel `petty_cash_voucher`, tahap
// SETELAH sebuah Input Pengajuan (petty_cash_pengajuan,
// pettyCashPengajuanService.ts) selesai di-approve. Satu Voucher = SNAPSHOT
// persis dari satu Pengajuan berstatus "Approved" (item/qty/harga/catatan/
// lampiran di-copy apa adanya, requester tidak bisa mengubahnya di sini) -
// satu Pengajuan paling banyak punya SATU Voucher aktif; kalau ditolak,
// requester boleh mengajukan ulang dari Pengajuan yang sama (unique index
// parsial, lihat supabase/migrations/0010_petty_cash_voucher_ulang.sql).
//
// Jalur approval Voucher TERPISAH dari jalur approval Pengajuan-nya -
// diambil dari Template Approval ber-approval_type "Approval Voucher" (lihat
// resolvePcAutoTemplate, services/pcApprovalTemplateService.ts).
//
// created_by/updated_by/created_at/updated_at di-set otomatis oleh trigger DB
// dari auth.uid() (lihat supabase/migrations/0004_petty_cash.sql (asal: petty_cash_voucher_setup.sql)).

import { createClient } from "@/lib/supabase/client";
import {
  Attachment,
  PettyCashPengajuan,
  PettyCashPengajuanItem,
  PettyCashVoucher,
  PettyCashVoucherWithChain,
} from "@/type";
import { PC_APPROVAL_TYPE_VOUCHER } from "@/type/enum";
import { resolvePcAutoTemplate } from "@/services/pcApprovalTemplateService";
import {
  advanceApproval,
  buildEditAndApproveUpdate,
  isMyApprovalTurn,
  rejectApproval,
} from "@/lib/pcApprovalFlow";
import { generateRandomId } from "@/lib/utils";
import { getActiveDoc } from "@/lib/pcChain";
import {
  notifyOnPcApproval,
  notifyOnPcSubmitted,
} from "@/lib/notifications/client";

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

// Sama seperti deptAbbreviations di pettyCashPengajuanService.ts -
// disamakan supaya format kode konsisten se-aplikasi.
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
    // created_at, BUKAN id - id sekarang random (lihat generateRandomId,
    // lib/utils.ts), jadi tidak lagi berurutan sesuai waktu dibuat.
    .order("created_at", { ascending: false })
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
 * Pengajuan milik `userId` yang sudah "Approved" dan BELUM punya Voucher
 * aktif (belum pernah dibuatkan, atau Voucher-nya ditolak) - inilah daftar
 * yang boleh dipilih requester di halaman Pengajuan Voucher.
 * `petty_cash_voucher(...)` di-embed lewat FK pengajuan_id supaya bisa
 * difilter tanpa query terpisah, sekaligus jadi riwayat Voucher yang ditolak.
 */
export const fetchApprovedPengajuanForVoucher = async (
  userId: string,
): Promise<PettyCashPengajuan[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan")
    .select("*, petty_cash_voucher(id, kode_voucher, status, created_at)")
    .eq("user_id", userId)
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashPengajuan[];
  return rows.filter((row) => !getActiveDoc(row.petty_cash_voucher));
};

/**
 * Voucher milik `userId` - dipakai halaman Pengajuan Voucher ("Voucher
 * Saya"), termasuk join sub-voucher (progress tarikan) & budget (batas
 * tarikan) supaya tabel & dialog "Tarik Dana" di halaman itu tidak perlu
 * query terpisah.
 */
export const fetchMyVouchers = async (
  userId: string,
): Promise<PettyCashVoucherWithChain[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      `*, petty_cash_pengajuan(kode_pengajuan),
       petty_cash_sub_voucher(id, kode_sub_voucher, amount, items, status, paid_at, created_at,
         petty_cash_deklarasi(id, kode_deklarasi, status, created_at)),
       petty_cash_budget(name, current_budget)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("created_at", {
      referencedTable: "petty_cash_sub_voucher",
      ascending: true,
    });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashVoucherWithChain[];
};

/**
 * Semua Voucher lintas user/departemen - dipakai halaman Management Petty
 * Cash (admin only, lihat petty_cash_voucher_update_admin di
 * supabase/migrations/0004_petty_cash.sql (asal: petty_cash_admin_management_setup.sql)).
 */
export const fetchAllVouchers = async (): Promise<PettyCashVoucher[]> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      "*, users_with_profiles:profiles!user_id(nama, email), petty_cash_pengajuan(kode_pengajuan), petty_cash_budget(name, current_budget)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashVoucher[];
};

export interface AdminForceEditVoucher {
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
 * "Edit Paksa" (admin only) - sama pola dengan adminForceUpdatePengajuan
 * (services/pettyCashPengajuanService.ts), lihat komentar di sana. Dijamin
 * admin only di dalam RPC (admin_force_update_voucher, lihat
 * supabase/migrations/0004_petty_cash.sql (asal: petty_cash_admin_full_management_setup.sql)).
 */
export const adminForceUpdateVoucher = async (
  id: number,
  edits: AdminForceEditVoucher,
  reason: string,
): Promise<PettyCashVoucher> => {
  const { data, error } = await supabase.rpc("admin_force_update_voucher", {
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
  return data as unknown as PettyCashVoucher;
};

export const fetchVoucherById = async (
  id: number,
): Promise<PettyCashVoucher> => {
  const { data, error } = await supabase
    .from("petty_cash_voucher")
    .select(
      `*, users_with_profiles:profiles!user_id(nama, email),
       petty_cash_pengajuan(kode_pengajuan, pengguna_budget_nama, pengguna_budget_department),
       petty_cash_budget(name, current_budget),
       petty_cash_sub_voucher(id, kode_sub_voucher, amount, notes, status, created_at,
         petty_cash_deklarasi(id, kode_deklarasi, status, created_at))`,
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
    | "budget_id"
    | "needed_date"
    | "week_of_month"
    | "site"
    | "notes"
    | "items"
    | "total_amount"
    | "attachments"
  >,
  userId: string,
): Promise<PettyCashVoucher> => {
  const template = await resolvePcAutoTemplate(
    pengajuan.department,
    pengajuan.site,
    pengajuan.company_code,
    PC_APPROVAL_TYPE_VOUCHER,
  );
  if (!template) {
    throw new Error(
      `Belum ada Template Approval "Approval Voucher" untuk departemen "${pengajuan.department}", site "${pengajuan.site ?? "-"}", perusahaan "${pengajuan.company_code}". Hubungi GA/Admin untuk mengatur Template Approval terlebih dahulu.`,
    );
  }

  let attempts = 0;
  const maxAttempts = 5;
  let currentCode = await generateVoucherCode(
    pengajuan.company_code,
    pengajuan.department,
  );
  let currentId = generateRandomId();

  while (attempts < maxAttempts) {
    const dbPayload = {
      id: currentId,
      kode_voucher: currentCode,
      pengajuan_id: pengajuan.id,
      user_id: userId,
      company_code: pengajuan.company_code,
      department: pengajuan.department,
      budget_id: pengajuan.budget_id,
      needed_date: pengajuan.needed_date,
      week_of_month: pengajuan.week_of_month,
      site: pengajuan.site,
      notes: pengajuan.notes,
      items: pengajuan.items,
      total_amount: pengajuan.total_amount,
      attachments: pengajuan.attachments,
      status: "In Approval",
      approvals: template.approval_path,
      discussions: [],
      revisions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_voucher")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" &&
        error.message.includes("petty_cash_voucher_pengajuan_active_key")
      ) {
        throw new Error(
          "Pengajuan ini sudah punya Voucher yang sedang diproses atau sudah disetujui.",
        );
      }
      if (
        error.code === "23505" &&
        (error.message.includes("kode_voucher") ||
          error.message.includes("petty_cash_voucher_pkey"))
      ) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor voucher. Silakan coba submit ulang.",
          );
        }
        if (error.message.includes("kode_voucher")) {
          currentCode = await generateVoucherCode(
            pengajuan.company_code,
            pengajuan.department,
          );
        }
        if (error.message.includes("petty_cash_voucher_pkey")) {
          currentId = generateRandomId();
        }
        continue;
      }
      throw error;
    }

    const created = data as unknown as PettyCashVoucher;
    notifyOnPcSubmitted({
      actorId: userId,
      docType: "voucher",
      docId: created.id,
      kode: created.kode_voucher,
      firstApproverId: created.approvals?.[0]?.userid,
    });
    return created;
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
      "*, users_with_profiles:profiles!user_id(nama, email), petty_cash_pengajuan(kode_pengajuan), petty_cash_budget(name, current_budget)",
    )
    .eq("status", "In Approval")
    .contains(
      "approvals",
      JSON.stringify([{ userid: userId, status: "pending" }]),
    )
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as PettyCashVoucher[];
  return rows.filter((row) => isMyApprovalTurn(row.approvals, userId));
};

export const approveVoucherStep = async (
  voucher: Pick<
    PettyCashVoucher,
    "id" | "approvals" | "kode_voucher" | "user_id"
  >,
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
  notifyOnPcApproval({
    actorId: userId,
    docType: "voucher",
    docId: voucher.id,
    kode: voucher.kode_voucher,
    creatorId: voucher.user_id,
    nextApproverId: result.nextApprover?.userid,
    decision: "approved",
  });
};

export const rejectVoucherStep = async (
  voucher: Pick<
    PettyCashVoucher,
    "id" | "approvals" | "discussions" | "kode_voucher" | "user_id"
  >,
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
  notifyOnPcApproval({
    actorId: userId,
    docType: "voucher",
    docId: voucher.id,
    kode: voucher.kode_voucher,
    creatorId: voucher.user_id,
    decision: "rejected",
  });
};

export interface EditVoucherEdits {
  needed_date: string;
  week_of_month: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
}

/**
 * "Edit & Setujui" - approver Voucher mengedit seluruh field yang bisa
 * diedit SEKALIGUS approve step dia sendiri. Sama pola dengan
 * editAndApprovePengajuanStep (pettyCashPengajuanService.ts) - lihat
 * komentar di sana.
 */
export const editAndApproveVoucherStep = async (
  voucher: Pick<
    PettyCashVoucher,
    | "id"
    | "approvals"
    | "revisions"
    | "needed_date"
    | "week_of_month"
    | "notes"
    | "items"
    | "attachments"
    | "kode_voucher"
    | "user_id"
  >,
  userId: string,
  userName: string,
  edits: EditVoucherEdits,
): Promise<void> => {
  const result = buildEditAndApproveUpdate(voucher, userId, userName);
  if (!result) throw new Error("Bukan giliran Anda untuk approve dokumen ini.");

  const totalAmount = edits.items.reduce((sum, i) => sum + i.subtotal, 0);

  const { error } = await supabase
    .from("petty_cash_voucher")
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", voucher.id);

  if (error) throw error;
  notifyOnPcApproval({
    actorId: userId,
    docType: "voucher",
    docId: voucher.id,
    kode: voucher.kode_voucher,
    creatorId: voucher.user_id,
    nextApproverId: result.nextApprover?.userid,
    decision: "approved",
  });
};
