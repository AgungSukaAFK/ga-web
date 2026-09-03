// src/services/pcApprovalTemplateService.ts
//
// Template approval KHUSUS Petty Cash (tabel `pc_approval_templates`,
// terpisah total dari `approval_templates` milik MR/PO). Dipakai dari 2
// tempat:
//  1. Halaman kelola template (/petty-cash/template-approval, GA/Admin only)
//  2. Dropdown pilih template saat GA/Finance memvalidasi pengajuan Petty
//     Cash (app/(With Sidebar)/petty-cash/[id]/page.tsx) - fetchPcTemplateList
//     & fetchPcTemplateById JANGAN diubah shape return-nya, dipakai di sana.
//
// created_by/updated_by/created_at/updated_at di-set otomatis oleh trigger DB
// dari auth.uid() (lihat supabase/pc-approval-templates-access-setup.sql) -
// jangan dikirim dari sini. RLS yang membatasi insert/update/delete cuma
// admin & departemen GA; select juga terbuka untuk Finance (dipakai alur
// validasi di atas).

import { createClient } from "@/lib/supabase/client";
import { PcApprovalType } from "@/type";
import { PC_APPROVAL_TYPE_PENGAJUAN } from "@/type/enum";

const supabase = createClient();

// Baris approver di jalur persetujuan - SENGAJA tidak punya field `type`
// (beda dari Approval milik MR/PO) karena alur approval Petty Cash cuma
// sekuensial approve/reject biasa, tidak ada percabangan logic per jenis
// approval (lihat handleApprove di petty-cash/[id]/page.tsx).
export interface PcApprover {
  userid: string;
  nama: string;
  department: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  processed_at?: string | null;
}

// Kombinasi departemen yang bikin template ini otomatis diterapkan begitu
// user submit Input Pengajuan (lihat resolvePcAutoTemplate) - beda dari
// AutoRule milik MR/PO yang butuh document_type juga, karena Petty Cash cuma
// satu jenis dokumen. Satu departemen cuma boleh punya SATU template auto
// (unique per department, lihat pc_approval_template_auto_rules).
export interface PcAutoRule {
  department: string;
}

export interface PcApprovalTemplate {
  id: number;
  template_name: string;
  description: string | null;
  // Tahap alur Petty Cash yang dilayani template ini - lihat komentar
  // PcApprovalType di type/index.ts. Wajib diisi (bukan opsional) supaya
  // auto-terapkan (lihat resolvePcAutoTemplate) & tampilan daftar template
  // selalu bisa membedakan Pengajuan/Voucher/Deklarasi.
  approval_type: PcApprovalType;
  approval_path: PcApprover[];
  auto_rules: PcAutoRule[];
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  created_by_profile?: { nama: string | null } | null;
  updated_by_profile?: { nama: string | null } | null;
}

export type PcTemplateFormInput = {
  template_name: string;
  description: string;
  approval_type: PcApprovalType;
  approval_path: PcApprover[];
  auto_rules: PcAutoRule[];
};

const SELECT_WITH_PROFILES = `
  *,
  created_by_profile:profiles!pc_approval_templates_created_by_fkey (nama),
  updated_by_profile:profiles!pc_approval_templates_updated_by_fkey (nama),
  auto_rules:pc_approval_template_auto_rules (department)
`;

/** Dipakai halaman kelola template (/petty-cash/template-approval). */
export const fetchPcTemplates = async (): Promise<PcApprovalTemplate[]> => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .select(SELECT_WITH_PROFILES)
    .order("template_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PcApprovalTemplate[];
};

/**
 * Simpan baris auto_rules sebuah template - hapus semua rule lama punya
 * template ini dulu, baru insert ulang dari array baru (sama seperti
 * saveAutoRules milik MR/PO di approvalTemplateService.ts).
 *
 * `approval_type` didenormalisasi ke tiap baris rule (diambil dari
 * approval_type template-nya sendiri) supaya constraint unique di DB bisa
 * per (department, approval_type) - satu departemen boleh punya auto-rule
 * beda utk tiap tahap (Pengajuan/Voucher/Deklarasi), bukan cuma satu total.
 */
const savePcAutoRules = async (
  templateId: number,
  approvalType: PcApprovalType,
  autoRules: PcAutoRule[],
) => {
  const { error: deleteError } = await supabase
    .from("pc_approval_template_auto_rules")
    .delete()
    .eq("template_id", templateId);
  if (deleteError) throw deleteError;

  if (autoRules.length === 0) return;

  const { error: insertError } = await supabase
    .from("pc_approval_template_auto_rules")
    .insert(
      autoRules.map((rule) => ({
        template_id: templateId,
        department: rule.department,
        approval_type: approvalType,
      })),
    );
  if (insertError) {
    if (insertError.code === "23505")
      throw new Error(
        "Ada departemen yang sudah punya template auto-terapkan lain untuk tipe approval ini. Kosongkan dulu setting auto-terapkan di template tersebut.",
      );
    throw insertError;
  }
};

/**
 * Cari template yang auto-terapkan untuk departemen tertentu - dipanggil
 * saat submit Input Pengajuan. Lewat RPC (security definer) supaya requester
 * biasa tidak perlu akses baca langsung ke pc_approval_templates /
 * pc_approval_template_auto_rules. Null kalau departemen belum ada rule-nya.
 *
 * `approvalType` default "Approval Pengajuan" karena satu-satunya caller
 * saat ini (submitPengajuan, pettyCashPengajuanService.ts) memang khusus
 * tahap Input Pengajuan - saat alur Voucher/Deklarasi dibangun, panggil
 * dengan approvalType yang sesuai.
 */
export const resolvePcAutoTemplate = async (
  department: string,
  approvalType: PcApprovalType = PC_APPROVAL_TYPE_PENGAJUAN,
): Promise<{ id: number; template_name: string; approval_path: PcApprover[] } | null> => {
  const { data, error } = await supabase.rpc("resolve_pc_auto_template", {
    p_department: department,
    p_approval_type: approvalType,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.template_id,
    template_name: row.template_name,
    approval_path: (row.approval_path ?? []) as PcApprover[],
  };
};

/**
 * Dipakai dropdown pilih template saat validasi Petty Cash (GA/Finance) -
 * JANGAN diubah shape return-nya, lihat komentar di atas file ini.
 */
export const fetchPcTemplateList = async () => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .select("id, template_name, description")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

/** Dipakai saat template dipilih & diterapkan ke sebuah pengajuan Petty Cash. */
export const fetchPcTemplateById = async (id: number) => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};

export const createPcTemplate = async (payload: PcTemplateFormInput) => {
  const { auto_rules, ...templateFields } = payload;
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .insert([templateFields])
    .select(SELECT_WITH_PROFILES)
    .single();

  if (error) {
    if (error.code === "23505")
      throw new Error("Nama template sudah dipakai. Gunakan nama lain.");
    throw error;
  }

  if (auto_rules.length > 0) {
    await savePcAutoRules(data.id, payload.approval_type, auto_rules);
  }
  return data as unknown as PcApprovalTemplate;
};

export const updatePcTemplate = async (
  id: number,
  payload: PcTemplateFormInput,
) => {
  const { auto_rules, ...templateFields } = payload;
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .update(templateFields)
    .eq("id", id)
    .select(SELECT_WITH_PROFILES)
    .single();

  if (error) {
    if (error.code === "23505")
      throw new Error("Nama template sudah dipakai. Gunakan nama lain.");
    throw error;
  }

  await savePcAutoRules(id, payload.approval_type, auto_rules);
  return data as unknown as PcApprovalTemplate;
};

export const deletePcTemplate = async (id: number) => {
  const { error } = await supabase
    .from("pc_approval_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
};
