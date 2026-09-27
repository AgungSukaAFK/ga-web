// src/services/pettyCashBudgetService.ts
//
// "Budgeting" Petty Cash (GA/Admin only, tabel `petty_cash_budget` +
// `petty_cash_budget_history`, lihat supabase/petty-cash-budget-setup.sql &
// petty-cash-budget-site-setup.sql & petty-cash-budget-company-setup.sql) -
// pool budget PER DEPARTEMEN + SITE + COMPANY, AUTO-terisi ke Pengajuan
// baru sesuai departemen & site & company requester (resolveAutoBudget,
// mirip resolvePcAutoTemplate di services/pcApprovalTemplateService.ts -
// cuma kuncinya tiga kolom di sini), approver Pengajuan boleh ganti.
//
// CRUD/top-up/history/activate-nya SENGAJA dibuat identik dengan
// services/costCenterService.ts (cost center milik MR/PO) supaya
// konsisten, meski tabelnya terpisah - lihat komentar PettyCashBudget di
// type/index.ts untuk alasannya. fetchBudgets juga ikut pola
// fetchCostCenters (paginasi + search + filter company, LOURDES bebas
// lihat semua company, GMI/GIS dikunci ke company sendiri).

import { createClient } from "@/lib/supabase/client";
import { PettyCashBudget, PettyCashBudgetHistory, Profile } from "@/type";

const supabase = createClient();

export const fetchBudgets = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  companyFilter: string | null,
  adminProfile: Profile | null,
): Promise<{ data: PettyCashBudget[]; count: number }> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("petty_cash_budget")
    .select("*", { count: "exact" });

  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%,site.ilike.%${searchQuery}%`,
    );
  }

  if (companyFilter) {
    query = query.eq("company_code", companyFilter);
  }

  // Filter berdasarkan perusahaan admin, kecuali admin LOURDES (sama pola
  // dengan fetchCostCenters, services/costCenterService.ts).
  if (adminProfile && adminProfile.company !== "LOURDES") {
    query = query.eq("company_code", adminProfile.company);
  }

  const { data, error, count } = await query
    .order("department", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return {
    data: (data ?? []) as unknown as PettyCashBudget[],
    count: count || 0,
  };
};

/**
 * Dipakai combobox pilih budget (Input Pengajuan otomatis / Edit & Setujui
 * approver) - `companyCode` opsional membatasi pilihan ke company dokumen
 * yang sedang diedit (approver tidak boleh salah pasang budget company
 * lain), kalau tidak diisi kembalikan semua budget aktif apa pun company-nya.
 */
export const fetchActiveBudgets = async (
  companyCode?: string | null,
): Promise<PettyCashBudget[]> => {
  let query = supabase
    .from("petty_cash_budget")
    .select("*")
    .eq("is_active", true);
  if (companyCode) query = query.eq("company_code", companyCode);

  const { data, error } = await query.order("department", {
    ascending: true,
  });

  if (error) throw error;
  return (data ?? []) as unknown as PettyCashBudget[];
};

/**
 * Budget aktif utk SATU kombinasi departemen+site+company - dipakai
 * auto-isi budget_id saat createPettyCashPengajuan
 * (services/pettyCashPengajuanService.ts). Cocok PERSIS department & site
 * & company sekaligus (bukan wildcard/fallback kalau site tidak cocok).
 * Null kalau belum ada budget aktif utk kombinasi itu (GA/Admin belum
 * setup) - TIDAK memblokir submit Pengajuan, cuma memblokir nanti pas
 * pembuatan sub-voucher (lihat komentar PettyCashSubVoucher, type/index.ts).
 */
export const resolveAutoBudget = async (
  department: string,
  site: string | null,
  companyCode: string,
): Promise<PettyCashBudget | null> => {
  let query = supabase
    .from("petty_cash_budget")
    .select("*")
    .eq("department", department)
    .eq("company_code", companyCode)
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
    company_code: string;
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
      company_code: input.company_code,
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
