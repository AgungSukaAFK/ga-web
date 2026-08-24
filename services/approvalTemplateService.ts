// src/services/approvalTemplateService.ts

import { createClient } from "@/lib/supabase/client";
import { Approval, User } from "@/type"; // Asumsi Anda punya file types terpusat

const supabase = createClient();

export interface AutoRule {
  document_type: "material_request" | "purchase_order";
  department: string;
}

export interface ApprovalTemplate {
  id: number;
  template_name: string;
  description: string;
  approval_path: Approval[];
  // Kombinasi dokumen+departemen yang bikin template ini otomatis diterapkan
  // sebagai default saat GA membuka validasi awal MR/PO (lihat
  // fetchAutoTemplate) - satu template boleh punya banyak kombinasi. GA
  // tetap bisa mengganti/edit manual saat validasi.
  auto_rules: AutoRule[];
}

const TEMPLATE_SELECT =
  "*, auto_rules:approval_template_auto_rules(document_type, department)";

/**
 * Mengambil semua template approval yang ada.
 */
export const fetchTemplates = async (): Promise<ApprovalTemplate[]> => {
  const { data, error } = await supabase
    .from("approval_templates")
    .select(TEMPLATE_SELECT)
    .order("template_name", { ascending: true });

  if (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
  return data as unknown as ApprovalTemplate[];
};

/**
 * Mencari user untuk ditambahkan ke template.
 */
export const searchUsers = async (query: string): Promise<User[]> => {
  if (!query) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nama, email, role, department")
    .ilike("nama", `%${query}%`)
    .ilike("role", `approver`)
    .eq("is_active", true) // Sembunyikan user yang sudah dinonaktifkan
    .limit(5);

  if (error) {
    console.error("Error searching users:", error);
    throw error;
  }
  return data as User[];
};

/**
 * Simpan baris auto_rules sebuah template - hapus semua baris lama punya
 * template ini dulu, baru insert ulang dari array yang baru (lebih simpel
 * dibanding diff per-baris, dan cukup untuk operasi admin yang jarang ini).
 */
const saveAutoRules = async (templateId: number, autoRules: AutoRule[]) => {
  const { error: deleteError } = await supabase
    .from("approval_template_auto_rules")
    .delete()
    .eq("template_id", templateId);
  if (deleteError) throw deleteError;

  if (autoRules.length === 0) return;

  const { error: insertError } = await supabase
    .from("approval_template_auto_rules")
    .insert(
      autoRules.map((rule) => ({
        template_id: templateId,
        document_type: rule.document_type,
        department: rule.department,
      })),
    );
  if (insertError) throw insertError;
};

/**
 * Membuat template approval baru.
 */
export const createTemplate = async (
  templateData: Omit<ApprovalTemplate, "id">
) => {
  const { auto_rules, ...templateFields } = templateData;
  const { data, error } = await supabase
    .from("approval_templates")
    .insert([templateFields])
    .select()
    .single();

  if (error) throw error;

  if (auto_rules.length > 0) {
    await saveAutoRules(data.id, auto_rules);
  }
  return data;
};

/**
 * Memperbarui template approval yang sudah ada.
 */
export const updateTemplate = async (
  id: number,
  templateData: Partial<Omit<ApprovalTemplate, "id">>
) => {
  const { auto_rules, ...templateFields } = templateData;
  const { data, error } = await supabase
    .from("approval_templates")
    .update(templateFields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (auto_rules !== undefined) {
    await saveAutoRules(id, auto_rules);
  }
  return data;
};

/**
 * Menghapus template approval.
 */
export const deleteTemplate = async (id: number) => {
  const { error } = await supabase
    .from("approval_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const fetchTemplateList = async (): Promise<
  { id: number; template_name: string }[]
> => {
  const { data, error } = await supabase
    .from("approval_templates")
    .select("id, template_name")
    .order("template_name", { ascending: true });

  if (error) {
    console.error("Error fetching template list:", error);
    throw error;
  }
  return data;
};

/**
 * Cari template yang di-set sebagai auto-default untuk kombinasi document
 * type + departemen tertentu (lihat approval_template_auto_rules). Dipakai
 * saat GA membuka halaman validasi awal MR/PO buat auto-isi template - null
 * kalau tidak ada yang cocok.
 */
export const fetchAutoTemplate = async (
  documentType: "material_request" | "purchase_order",
  department: string | null | undefined,
): Promise<ApprovalTemplate | null> => {
  if (!department) return null;
  const { data: rule, error: ruleError } = await supabase
    .from("approval_template_auto_rules")
    .select("template_id")
    .eq("document_type", documentType)
    .eq("department", department)
    .maybeSingle();

  if (ruleError) {
    console.error("Error fetching auto template rule:", ruleError);
    return null;
  }
  if (!rule) return null;

  try {
    return await fetchTemplateById(rule.template_id);
  } catch {
    return null;
  }
};

/**
 * Mengambil detail lengkap satu template berdasarkan ID.
 */
export const fetchTemplateById = async (
  id: number
): Promise<ApprovalTemplate> => {
  const { data, error } = await supabase
    .from("approval_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching template details:", error);
    throw error;
  }
  return data as unknown as ApprovalTemplate;
};
