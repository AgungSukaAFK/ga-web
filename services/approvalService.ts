// src/services/approvalService.ts

import { createClient } from "@/lib/supabase/client";
import { Approval, MaterialRequest, PurchaseOrder } from "@/type"; // REVISI: Impor PurchaseOrder

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
    // REVISI: Tambahkan join ke cost_centers
    .select(
      "*, users_with_profiles!userid(nama), cost_centers!cost_center_id(name, current_budget)",
    )
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
  userId: string,
): Promise<MaterialRequest[]> => {
  const { data: allPendingMRs, error } = await supabase
    .from("material_requests")
    // REVISI: Tambahkan join ke cost_centers
    .select(
      "*, users_with_profiles!userid(nama), cost_centers!cost_center_id(name, current_budget)",
    )
    .eq("status", "Pending Approval");

  if (error) {
    console.error("Error fetching all pending MRs:", error);
    throw error;
  }

  if (!allPendingMRs) return [];

  const myTurnMRs = allPendingMRs.filter((mr) => {
    if (!mr.approvals) return false; // Pengaman jika approvals null

    // REVISI: Logika findIndex diubah untuk mencari task pending pertama
    const myApprovalIndex = mr.approvals.findIndex(
      (app: any) => app.userid === userId && app.status === "pending",
    );

    if (myApprovalIndex === -1) {
      return false; // User tidak punya task pending di MR ini
    }

    // Cek apakah semua approver SEBELUM task pending ini sudah 'approved'
    const isMyTurn = mr.approvals
      .slice(0, myApprovalIndex)
      .every((app: any) => app.status === "approved");

    return isMyTurn;
  });

  return myTurnMRs as MaterialRequest[];
};

/**
 * Mengambil semua Purchase Order berstatus 'Draft' yang dibuat oleh user tertentu.
 */
export const fetchMyDraftPOs = async (userId: string) => {
  // ... (fungsi ini tetap sama)
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
  userId: string,
): Promise<PurchaseOrder[]> => {
  // ... (fungsi ini tetap sama)
  const { data: allPendingPOs, error } = await supabase
    .from("purchase_orders")
    .select(
      "*, users_with_profiles!user_id(nama), material_requests!mr_id(kode_mr)",
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

    // REVISI: Logika findIndex diubah untuk mencari task pending pertama
    const myApprovalIndex = po.approvals.findIndex(
      (app: any) => app.userid === userId && app.status === "pending",
    );

    if (myApprovalIndex === -1) {
      return false; // User tidak punya task pending di PO ini
    }

    // Cek apakah semua approver SEBELUM task pending ini sudah 'approved'
    const isMyTurn = po.approvals
      .slice(0, myApprovalIndex)
      .every((app: any) => app.status === "approved");

    return isMyTurn;
  });

  return myTurnPOs as PurchaseOrder[];
};

// Pastikan import tetap ada di atas file
// import { createClient } from "@/lib/supabase/client";
// import { Approval, MaterialRequest, PurchaseOrder } from "@/type";

export const processMrApproval = async (
  mrId: number,
  userId: string,
  decision: "approved" | "rejected",
  approvalsList: Approval[],
) => {
  const { data: mr, error: fetchError } = await supabase
    .from("material_requests")
    .select("approvals, status, level")
    .eq("id", mrId)
    .single();

  if (fetchError || !mr) {
    throw new Error("Gagal mengambil data MR terbaru untuk validasi.");
  }

  // Gunakan data dari DB sebagai referensi utama
  const dbApprovals = mr.approvals as Approval[];

  const myIndex = dbApprovals.findIndex(
    (a) => a.userid === userId && a.status === "pending",
  );

  if (myIndex === -1) {
    const alreadyApproved = dbApprovals.find(
      (a) => a.userid === userId && a.status !== "pending",
    );
    if (alreadyApproved) {
      return { success: true, newStatus: mr.status, newLevel: mr.level };
    }
    throw new Error("User tidak memiliki akses approval aktif pada MR ini.");
  }

  const updatedApprovals = [...dbApprovals];
  updatedApprovals[myIndex] = {
    ...updatedApprovals[myIndex],
    status: decision,
    processed_at: new Date().toISOString(),
  };

  let newStatus = mr.status;
  let newLevel = mr.level;

  if (decision === "rejected") {
    newStatus = "Rejected";
  } else {
    // KUNCI PERBAIKAN:
    // Kita cek array 'updatedApprovals' yang LENGKAP dari DB.
    // Cek apakah SEMUA orang statusnya sudah 'approved'
    const isAllApproved = updatedApprovals.every(
      (a) => a.status === "approved",
    );

    // Jika TRUE (semua sudah approve), baru ubah jadi Waiting PO
    if (isAllApproved) {
      newStatus = "Waiting PO";
      newLevel = "OPEN 2"; // Naik ke level SCM
    } else {
      // Jika belum semua, status tetap Pending Approval
      newStatus = "Pending Approval";
    }
  }

  // ------------------------------------------------------------------
  // LANGKAH 5: UPDATE DATABASE
  // ------------------------------------------------------------------
  const payload: any = {
    approvals: updatedApprovals,
    status: newStatus,
  };

  if (newLevel) {
    payload.level = newLevel;
  }

  const { error } = await supabase
    .from("material_requests")
    .update(payload)
    .eq("id", mrId);

  if (error) throw error;

  return { success: true, newStatus, newLevel };
};
