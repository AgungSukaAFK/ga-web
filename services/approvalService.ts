// src/services/approvalService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest, PurchaseOrder } from "@/type"; // REVISI: Impor PurchaseOrder

const supabase = createClient();

/**
 * Mengambil semua Purchase Order yang menunggu validasi oleh GA.
 */
export const fetchPendingValidationPOs = async () => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, users_with_profiles!user_id(nama)") // Join ke user pembuat
    .eq("status", "Pending Validation")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching POs for validation:", error);
    throw error;
  }
  return data;
};

/**
 * Mengambil semua Material Request yang menunggu validasi oleh GA.
 */
export const fetchPendingValidationMRs = async (): Promise<
  MaterialRequest[]
> => {
  const { data, error } = await supabase
    .from("material_requests")
    .select("*, users_with_profiles!userid(nama)")
    .eq("status", "Pending Validation")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching MRs for validation:", error);
    throw error;
  }
  return data as MaterialRequest[];
};

/**
 * Mengambil semua Material Request yang menunggu approval dari user tertentu
 * dan sudah merupakan gilirannya untuk approve.
 */
export const fetchMyPendingMrApprovals = async (
  userId: string
): Promise<MaterialRequest[]> => {
  const { data: allPendingMRs, error } = await supabase
    .from("material_requests")
    .select("*, users_with_profiles!userid(nama)")
    .eq("status", "Pending Approval");

  if (error) {
    console.error("Error fetching all pending MRs:", error);
    throw error;
  }

  if (!allPendingMRs) return [];

  const myTurnMRs = allPendingMRs.filter((mr) => {
    if (!mr.approvals) return false; // Pengaman jika approvals null
    const myApproval = mr.approvals.find(
      (app: any) => app.userid === userId && app.status === "pending"
    );
    if (!myApproval) {
      return false;
    }
    const myIndex = mr.approvals.findIndex((app: any) => app.userid === userId);
    if (myIndex === 0) {
      return true;
    }
    const previousApprovers = mr.approvals.slice(0, myIndex);
    return previousApprovers.every((app: any) => app.status === "approved");
  });

  return myTurnMRs as MaterialRequest[];
};

/**
 * Mengambil semua Purchase Order berstatus 'Draft' yang dibuat oleh user tertentu.
 */
export const fetchMyDraftPOs = async (userId: string) => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, kode_po, status, total_price, created_at")
    .eq("status", "Draft")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching draft POs:", error);
    throw error;
  }

  return data;
};

/**
 * BARU: Mengambil semua Purchase Order yang menunggu approval dari user tertentu
 * dan sudah merupakan gilirannya untuk approve.
 */
export const fetchMyPendingPoApprovals = async (
  userId: string
): Promise<PurchaseOrder[]> => {
  const { data: allPendingPOs, error } = await supabase
    .from("purchase_orders")
    .select(
      "*, users_with_profiles!user_id(nama), material_requests!mr_id(kode_mr)"
    )
    .eq("status", "Pending Approval");

  if (error) {
    console.error("Error fetching all pending POs:", error);
    throw error;
  }

  if (!allPendingPOs) return [];

  // Filter di sisi klien
  const myTurnPOs = allPendingPOs.filter((po) => {
    if (!po.approvals) return false; // Pengaman jika approvals null
    const myApproval = po.approvals.find(
      (app: any) => app.userid === userId && app.status === "pending"
    );
    if (!myApproval) {
      return false;
    }
    const myIndex = po.approvals.findIndex((app: any) => app.userid === userId);
    if (myIndex === 0) {
      return true;
    }
    const previousApprovers = po.approvals.slice(0, myIndex);
    return previousApprovers.every((app: any) => app.status === "approved");
  });

  return myTurnPOs as PurchaseOrder[];
};
