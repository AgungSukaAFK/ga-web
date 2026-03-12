// src/services/pettyCashService.ts

import { createClient } from "@/lib/supabase/client";
import { PettyCashPayload, PettyCashRequest, PettyCashStatus } from "@/type";

const supabase = createClient();

// Helper function untuk mengubah bulan menjadi angka Romawi
const toRoman = (num: number): string => {
  const roman = [
    "",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  return roman[num] || num.toString();
};

// Peta untuk singkatan departemen (Disamakan dengan MR & PO)
const deptAbbreviations: { [key: string]: string } = {
  "General Affair": "GA",
  "Human Resource": "HR",
  "Human Resources": "HR",
  Marketing: "MKT",
  Produksi: "PROD",
  K3: "HSE",
  Finance: "FIN",
  IT: "IT",
  Logistik: "LOG",
  Purchasing: "PUR",
  Warehouse: "WH",
  Service: "SVC",
  "General Manager": "GM",
  "Executive Manager": "EM",
  "Boards of Director": "BOD",
};

/**
 * Generate Kode Petty Cash yang Dinamis & Unik per Company
 * Format: {COMPANY}/PC/{BULAN_ROMAWI}/{TAHUN}/{DEPT}/{URUTAN}
 */
export const generatePCCode = async (
  company_code: string,
  department: string,
): Promise<string> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearYY = currentYear.toString().slice(-2);
  const currentMonthRoman = toRoman(now.getMonth() + 1);

  // LOGIKA BARU: Gunakan singkatan standar, jika tidak ada di daftar, baru potong 3 huruf
  const deptIdentifier = department
    ? deptAbbreviations[department] || department.substring(0, 3).toUpperCase()
    : "GA";

  const prefix = company_code || "GMI";

  const { data: lastPc, error } = await supabase
    .from("petty_cash_requests")
    .select("kode_pc")
    .eq("company_code", prefix)
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching last PC of the year:", error);
    throw new Error("Gagal men-generate Kode Petty Cash.");
  }

  let nextNumber = 1;
  if (lastPc) {
    try {
      const parts = lastPc.kode_pc.split("/");
      const lastNumberStr = parts[parts.length - 1];
      if (lastNumberStr) nextNumber = parseInt(lastNumberStr, 10) + 1;
    } catch (e) {
      console.error("Error parsing last PC code:", e);
    }
  }

  return `${prefix}/PC/${currentMonthRoman}/${currentYearYY}/${deptIdentifier}/${nextNumber}`;
};

/**
 * Membuat Dokumen Petty Cash Baru (Dengan Auto-Retry Anti Duplikat)
 */
export const createPettyCash = async (
  payload: PettyCashPayload,
  userId: string,
): Promise<PettyCashRequest> => {
  let attempts = 0;
  const maxAttempts = 5;

  let currentPcCode = await generatePCCode(
    payload.company_code,
    payload.department,
  );

  while (attempts < maxAttempts) {
    const dbPayload = {
      ...payload,
      kode_pc: currentPcCode,
      user_id: userId,
      status: "Pending Validation" as PettyCashStatus,
      approvals: [],
      discussions: [],
    };

    const { data, error } = await supabase
      .from("petty_cash_requests")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      // 23505 = Unique Constraint Violation (Race Condition)
      if (error.code === "23505" && error.message.includes("kode_pc")) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor PC. Silakan coba submit ulang.",
          );
        }
        // Generate ulang kode dengan nomor terbaru
        currentPcCode = await generatePCCode(
          payload.company_code,
          payload.department,
        );
        continue;
      }
      console.error("Error creating Petty Cash:", error);
      throw error;
    }

    return data as PettyCashRequest;
  }

  throw new Error("Gagal membuat Petty Cash.");
};

/**
 * Mengambil daftar Petty Cash milik User yang sedang login
 */
export const fetchMyPettyCash = async (
  userId: string,
): Promise<PettyCashRequest[]> => {
  const { data, error } = await supabase
    .from("petty_cash_requests")
    .select("*, cost_centers!cost_center_id(name, current_budget)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as PettyCashRequest[];
};

/**
 * Mengambil daftar Petty Cash untuk Halaman Manajemen & Approval
 */
export const fetchManagementPettyCash = async (
  userCompany: string,
): Promise<PettyCashRequest[]> => {
  let query = supabase
    .from("petty_cash_requests")
    .select(
      "*, users_with_profiles!user_id(nama, email), cost_centers!cost_center_id(name)",
    )
    .order("created_at", { ascending: false });

  if (userCompany === "LOURDES") {
    // LOURDES melihat semua
  } else if (["GMI", "GIS"].includes(userCompany)) {
    query = query.in("company_code", [userCompany, "LOURDES"]);
  } else if (userCompany) {
    query = query.eq("company_code", userCompany);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as PettyCashRequest[];
};

/**
 * Mengambil Detail 1 Data Petty Cash
 */
export const getPettyCashById = async (
  id: number,
): Promise<PettyCashRequest | null> => {
  const { data, error } = await supabase
    .from("petty_cash_requests")
    .select(
      "*, users_with_profiles!user_id(nama, email, department), cost_centers!cost_center_id(name, current_budget)",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as PettyCashRequest;
};

/**
 * Update Status Petty Cash
 */
export const updatePettyCashStatus = async (
  id: number,
  status: PettyCashStatus,
  approvalsData?: any[],
) => {
  const payload: any = { status };
  if (approvalsData) {
    payload.approvals = approvalsData;
  }

  const { error } = await supabase
    .from("petty_cash_requests")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
};
