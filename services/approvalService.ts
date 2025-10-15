// src/services/approvalService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest } from "@/type"; // Pastikan path ini benar

const supabase = createClient();

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
  // REVISI: Ambil SEMUA MR yang statusnya 'Pending Approval'
  const { data: allPendingMRs, error } = await supabase
    .from("material_requests")
    .select("*, users_with_profiles!userid(nama)")
    .eq("status", "Pending Approval");

  if (error) {
    console.error("Error fetching all pending MRs:", error);
    throw error;
  }

  if (!allPendingMRs) return [];

  // REVISI: Filter dilakukan sepenuhnya di sisi klien (JavaScript), menghindari .contains()
  const myTurnMRs = allPendingMRs.filter((mr) => {
    // 1. Cek apakah user ada di dalam daftar approval dan statusnya 'pending'
    const myApproval = mr.approvals.find(
      (app: any) => app.userid === userId && app.status === "pending"
    );
    if (!myApproval) {
      return false; // Jika tidak ditemukan, jangan tampilkan MR ini
    }

    // 2. Temukan index dari approver saat ini
    const myIndex = mr.approvals.findIndex((app: any) => app.userid === userId);

    // 3. Jika approver pertama (index 0), ini adalah gilirannya.
    if (myIndex === 0) {
      return true;
    }

    // 4. Jika bukan yang pertama, cek apakah semua approver SEBELUMNYA sudah 'approved'
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
