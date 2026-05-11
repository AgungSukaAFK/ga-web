// src/services/pcApprovalTemplateService.ts

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const fetchPcTemplateList = async () => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .select("id, template_name, description")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const fetchPcTemplateById = async (id: number) => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
};

export const createPcTemplate = async (payload: {
  template_name: string;
  description: string;
  approval_path: any[];
}) => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deletePcTemplate = async (id: number) => {
  const { error } = await supabase
    .from("pc_approval_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const updatePcTemplate = async (
  id: number,
  payload: { template_name: string; description: string; approval_path: any[] },
) => {
  const { data, error } = await supabase
    .from("pc_approval_templates")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
