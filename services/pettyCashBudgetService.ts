// src/services/pettyCashBudgetService.ts
//
// "Budgeting" Petty Cash (GA/Admin only, tabel `petty_cash_budget` +
// `petty_cash_budget_history`, lihat supabase/petty-cash-budget-setup.sql &
// petty-cash-budget-site-setup.sql) - pool budget PER DEPARTEMEN + SITE,
// AUTO-terisi ke Pengajuan baru sesuai departemen & site requester
// (resolveAutoBudget, mirip resolvePcAutoTemplate di
// services/pcApprovalTemplateService.ts - cuma kuncinya dua kolom di sini),
// approver Pengajuan boleh ganti.
//
// CRUD/top-up/history/activate-nya SENGAJA dibuat identik dengan
// services/costCenterService.ts (cost center milik MR/PO) supaya
// konsisten, meski tabelnya terpisah - lihat komentar PettyCashBudget di
// type/index.ts untuk alasannya.

import { createClient } from "@/lib/supabase/client";
import { PettyCashBudget, PettyCashBudgetHistory } from "@/type";

const supabase = createClient();

export const fetchBudgets = async (): Promise<PettyCashBudget[]> => {
  const { data, error } = await supabase
    .from("petty_cash_budget")
    .select("*")
    .order("department", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashBudget[];
};

/** Dipakai combobox pilih budget (Input Pengajuan otomatis / Edit & Setujui approver). */
export const fetchActiveBudgets = async (): Promise<PettyCashBudget[]> => {
  const { data, error } = await supabase
    .from("petty_cash_budget")
    .select("*")
    .eq("is_active", true)
    .order("department", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashBudget[];
};

/**
 * Budget aktif utk SATU kombinasi departemen+site - dipakai auto-isi
 * budget_id saat createPettyCashPengajuan
 * (services/pettyCashPengajuanService.ts). Cocok PERSIS department & site
 * sekaligus (bukan wildcard/fallback kalau site tidak cocok). Null kalau
 * belum ada budget aktif utk kombinasi itu (GA/Admin belum setup) - TIDAK
 * memblokir submit Pengajuan, cuma memblokir nanti pas pembuatan
 * sub-voucher (lihat komentar PettyCashSubVoucher, type/index.ts).
 */
export const resolveAutoBudget = async (
  department: string,
  site: string | null,
): Promise<PettyCashBudget | null> => {
  let query = supabase
    .from("petty_cash_budget")
    .select("*")
    .eq("department", department)
    .eq("is_active", true);
  // `.eq("site", null)` tidak match NULL di Postgrest (perlu `.is`) - cabang
  // ini menjaga requester yang belum punya site (`site` null di profile-nya)
  // tetap bisa ke-match ke budget yang site-nya juga belum diisi.
  query = site ? query.eq("site", site) : query.is("site", null);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data as unknown as PettyCashBudget | null;
};

export const fetchBudgetHistory = async (
  budgetId: number,
): Promise<PettyCashBudgetHistory[]> => {
  const { data, error } = await supabase
    .from("petty_cash_budget_history")
    .select("*, profiles:profiles!user_id(nama)")
    .eq("budget_id", budgetId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashBudgetHistory[];
};

export const createBudget = async (
  input: {
    name: string;
    department: string;
    site: string;
    initial_budget: number;
  },
  adminUserId: string,
): Promise<PettyCashBudget> => {
  const { data: newBudget, error } = await supabase
    .from("petty_cash_budget")
    .insert({
      name: input.name,
      department: input.department,
      site: input.site,
      initial_budget: input.initial_budget,
      current_budget: input.initial_budget,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("petty_cash_budget_history").insert({
    budget_id: newBudget.id,
    ref_type: "initial",
    user_id: adminUserId,
    change_amount: newBudget.current_budget,
    previous_budget: 0,
    new_budget: newBudget.current_budget,
    description: "Budget awal dibuat oleh GA/Admin",
  });

  return newBudget as unknown as PettyCashBudget;
};

/** "Edit/Top-up" - GA/Admin ubah initial & current budget, wajib isi alasan. */
export const updateBudgetAmount = async (
  budgetId: number,
  newInitialBudget: number,
  newCurrentBudget: number,
  adminUserId: string,
  reason: string,
): Promise<void> => {
  const { data: oldData, error: fetchError } = await supabase
    .from("petty_cash_budget")
    .select("current_budget")
    .eq("id", budgetId)
    .single();
  if (fetchError) throw fetchError;

  const changeAmount = newCurrentBudget - oldData.current_budget;

  const { error: updateError } = await supabase
    .from("petty_cash_budget")
    .update({
      initial_budget: newInitialBudget,
      current_budget: newCurrentBudget,
    })
    .eq("id", budgetId);
  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from("petty_cash_budget_history")
    .insert({
      budget_id: budgetId,
      ref_type: "adjustment",
      user_id: adminUserId,
      change_amount: changeAmount,
      previous_budget: oldData.current_budget,
      new_budget: newCurrentBudget,
      description: `Penyesuaian GA/Admin: ${reason}`,
    });
  if (historyError) throw historyError;
};

export const setBudgetActiveStatus = async (
  budgetId: number,
  isActive: boolean,
  adminUserId: string,
): Promise<void> => {
  const { data: oldData, error: fetchError } = await supabase
    .from("petty_cash_budget")
    .select("current_budget")
    .eq("id", budgetId)
    .single();
  if (fetchError) throw fetchError;

  const { error: updateError } = await supabase
    .from("petty_cash_budget")
    .update({ is_active: isActive })
    .eq("id", budgetId);
  if (updateError) throw updateError;

  await supabase.from("petty_cash_budget_history").insert({
    budget_id: budgetId,
    ref_type: "deactivate",
    user_id: adminUserId,
    change_amount: 0,
    previous_budget: oldData.current_budget,
    new_budget: oldData.current_budget,
    description: isActive
      ? "Budget diaktifkan oleh GA/Admin"
      : "Budget dinonaktifkan oleh GA/Admin",
  });
};
