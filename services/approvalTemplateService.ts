// src/services/approvalTemplateService.ts

import { createClient } from "@/lib/supabase/client";
import { Approval, User } from "@/type"; // Asumsi Anda punya file types terpusat

const supabase = createClient();

export interface ApprovalTemplate {
  id: number;
  template_name: string;
  description: string;
  approval_path: Approval[];
}

/**
 * Mengambil semua template approval yang ada.
 */
export const fetchTemplates = async (): Promise<ApprovalTemplate[]> => {
  const { data, error } = await supabase
    .from("approval_templates")
    .select("*")
    .order("template_name", { ascending: true });

  if (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
  return data;
};

/**
 * Mencari user untuk ditambahkan ke template.
 */
export const searchUsers = async (query: string): Promise<User[]> => {
  if (!query) return [];
  const { data, error } = await supabase
    .from("users_with_profiles")
    .select("id, nama, email, role, department")
    .ilike("nama", `%${query}%`)
    .ilike("role", `approver`)
    .limit(5);

  if (error) {
    console.error("Error searching users:", error);
    throw error;
  }
  return data as User[];
};

/**
 * Membuat template approval baru.
 */
export const createTemplate = async (
  templateData: Omit<ApprovalTemplate, "id">
) => {
  const { data, error } = await supabase
    .from("approval_templates")
    .insert([templateData])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Memperbarui template approval yang sudah ada.
 */
export const updateTemplate = async (
  id: number,
  templateData: Partial<Omit<ApprovalTemplate, "id">>
) => {
  const { data, error } = await supabase
    .from("approval_templates")
    .update(templateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
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
 * Mengambil detail lengkap satu template berdasarkan ID.
 */
export const fetchTemplateById = async (
  id: number
): Promise<ApprovalTemplate> => {
  const { data, error } = await supabase
    .from("approval_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching template details:", error);
    throw error;
  }
  return data;
};
