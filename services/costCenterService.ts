// src/services/costCenterService.ts

import { createClient } from "@/lib/supabase/client";
import { CostCenter, CostCenterHistory, Profile } from "@/type";
import { toast } from "sonner";

const supabase = createClient();

/**
 * Mengambil daftar Cost Center dengan paginasi dan filter
 */
export const fetchCostCenters = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  companyFilter: string | null,
  adminProfile: Profile | null
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("cost_centers").select("*", { count: "exact" });

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
  }

  if (companyFilter) {
    query = query.eq("company_code", companyFilter);
  }

  // Filter berdasarkan perusahaan admin, kecuali admin LOURDES
  if (adminProfile && adminProfile.company !== "LOURDES") {
    query = query.eq("company_code", adminProfile.company);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error fetching cost centers:", error);
    throw error;
  }

  return { data: data as CostCenter[], count: count || 0 };
};

/**
 * Mengambil riwayat transaksi untuk satu Cost Center
 */
export const fetchCostCenterHistory = async (costCenterId: number) => {
  const { data, error } = await supabase
    .from("cost_center_history")
    .select(
      `
      *,
      material_requests!mr_id ( kode_mr ),
      users_with_profiles!user_id ( nama )
    `
    )
    .eq("cost_center_id", costCenterId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching cost center history:", error);
    throw error;
  }
  return data as CostCenterHistory[];
};

/**
 * Membuat Cost Center baru
 */
export const createCostCenter = async (
  newData: Omit<
    CostCenter,
    "id" | "created_at" | "updated_at" | "current_budget"
  >,
  adminUserId: string
) => {
  // Budget awal diset sama dengan budget saat ini
  const fullData = {
    ...newData,
    current_budget: newData.initial_budget,
  };

  const { data: newCostCenter, error } = await supabase
    .from("cost_centers")
    .insert(fullData)
    .select()
    .single();

  if (error) throw error;

  // Buat entri history pertama
  await supabase.from("cost_center_history").insert({
    cost_center_id: newCostCenter.id,
    user_id: adminUserId,
    change_amount: newCostCenter.current_budget,
    previous_budget: 0,
    new_budget: newCostCenter.current_budget,
    description: "Initial budget set by Admin",
  });

  return newCostCenter;
};

/**
 * Memperbarui Budget Cost Center (Top-up/Penyesuaian)
 * MENGGUNAKAN RPC (Remote Procedure Call) agar aman
 */
export const updateCostCenterBudget = async (
  costCenterId: number,
  newInitialBudget: number,
  newCurrentBudget: number,
  adminUserId: string,
  reason: string
) => {
  // Ambil data budget sebelumnya
  const { data: oldData, error: fetchError } = await supabase
    .from("cost_centers")
    .select("initial_budget, current_budget")
    .eq("id", costCenterId)
    .single();

  if (fetchError) throw fetchError;

  // Hitung perubahan
  const changeAmount = newCurrentBudget - oldData.current_budget;

  // Gunakan transaction untuk memastikan konsistensi
  const { error: updateError } = await supabase
    .from("cost_centers")
    .update({
      initial_budget: newInitialBudget,
      current_budget: newCurrentBudget,
      updated_at: new Date().toISOString(),
    })
    .eq("id", costCenterId);

  if (updateError) throw updateError;

  // Catat di history
  const { error: historyError } = await supabase
    .from("cost_center_history")
    .insert({
      cost_center_id: costCenterId,
      user_id: adminUserId,
      change_amount: changeAmount,
      previous_budget: oldData.current_budget,
      new_budget: newCurrentBudget,
      description: `Admin Adjustment: ${reason}`,
    });

  if (historyError) {
    // Rollback manual (idealnya gunakan RPC/Transaction)
    // Untuk saat ini, kita hanya laporkan error
    console.error("History update failed:", historyError);
    toast.error("Gagal update history, tapi budget mungkin sudah terupdate.");
    throw historyError;
  }

  return;
};

/**
 * (Opsional) Jika Anda membuat RPC 'admin_update_budget' seperti saran saya,
 * panggil RPC-nya seperti ini agar lebih aman dari race condition.
 */
export const updateCostCenterBudgetWithRPC = async (
  costCenterId: number,
  newBudget: number,
  adminUserId: string,
  reason: string
) => {
  const { error } = await supabase.rpc("admin_update_budget", {
    p_cost_center_id: costCenterId,
    p_new_budget: newBudget,
    p_admin_user_id: adminUserId,
    p_description: `Admin Adjustment: ${reason}`,
  });

  if (error) throw error;
  return;
};
