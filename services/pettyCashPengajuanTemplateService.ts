// src/services/pettyCashPengajuanTemplateService.ts
//
// "Template Pengajuan" Petty Cash - daftar barang siap pakai PER-USER (tabel
// `petty_cash_pengajuan_template`, lihat
// supabase/petty-cash-pengajuan-template-setup.sql) untuk kebutuhan yang
// bisa diprediksi & relatif konstan (mis. "ATK Bulanan") - dipakai supaya
// requester tidak input ulang barang yang sama tiap kali submit Input
// Pengajuan. Murni privat milik pembuatnya (RLS: user_id = auth.uid()),
// beda dari petty_cash_barang yang katalog bersama semua user.

import { createClient } from "@/lib/supabase/client";
import { PettyCashPengajuanItem, PettyCashPengajuanTemplate } from "@/type";

const supabase = createClient();

export const fetchMyPengajuanTemplates = async (
  userId: string,
): Promise<PettyCashPengajuanTemplate[]> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan_template")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashPengajuanTemplate[];
};

/**
 * Satu template by id - dipakai InputPengajuanClient.tsx menerapkan template
 * lewat ?template=<id>. RLS sudah menjamin cuma pemiliknya yang bisa baca -
 * kalau template milik user lain atau tidak ada, `error`/`data` null.
 */
export const fetchPengajuanTemplateById = async (
  id: number,
): Promise<PettyCashPengajuanTemplate> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan_template")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as PettyCashPengajuanTemplate;
};

export const createPengajuanTemplate = async (
  namaTemplate: string,
  items: PettyCashPengajuanItem[],
  userId: string,
): Promise<PettyCashPengajuanTemplate> => {
  const { data, error } = await supabase
    .from("petty_cash_pengajuan_template")
    .insert([{ user_id: userId, nama_template: namaTemplate, items }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PettyCashPengajuanTemplate;
};

export const updatePengajuanTemplate = async (
  id: number,
  patch: { nama_template: string; items: PettyCashPengajuanItem[] },
): Promise<void> => {
  const { error } = await supabase
    .from("petty_cash_pengajuan_template")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
};

export const deletePengajuanTemplate = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("petty_cash_pengajuan_template")
    .delete()
    .eq("id", id);

  if (error) throw error;
};
