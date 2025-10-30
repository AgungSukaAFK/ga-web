// src/services/mrService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest, Order, Attachment, Profile } from "@/type";

const supabase = createClient();

// Peta untuk singkatan departemen (untuk user HO)
const deptAbbreviations: { [key: string]: string } = {
  "General Affair": "GA",
  Marketing: "MKT",
  Produksi: "PRO",
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

// Peta singkatan lokasi (untuk user Non-HO)
const lokasiAbbreviations: { [key: string]: string } = {
  "Tanjung Enim": "TE",
  Balikpapan: "BPN",
  "Site BA": "BA",
  "Site TAL": "TAL",
  "Site MIP": "MIP",
  "Site MIFA": "MFA",
  "Site BIB": "BIB",
  "Site AMI": "AMI",
  "Site Tabang": "TBG",
  "Head Office": "HO",
};

const toRoman = (num: number): string => {
  const romanMap: { [key: string]: string } = {
    "1": "I",
    "2": "II",
    "3": "III",
    "4": "IV",
    "5": "V",
    "6": "VI",
    "7": "VII",
    "8": "VIII",
    "9": "IX",
    "10": "X",
    "11": "XI",
    "12": "XII",
  };
  return romanMap[String(num)] || "";
};

/**
 * Mengambil profil (department, lokasi, company) user yang sedang login.
 */
export const getActiveUserProfile = async (): Promise<Profile | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User tidak ditemukan.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("department, lokasi, company")
    .eq("id", user.id)
    .single();

  if (error) throw new Error("Gagal mengambil profil user: " + error.message);
  return profile as Profile | null;
};

/**
 * Membuat Kode MR baru berdasarkan profil user.
 */
export const generateMRCode = async (
  department: string,
  lokasi: string
): Promise<string> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearYY = currentYear.toString().slice(-2);
  const currentMonthRoman = toRoman(now.getMonth() + 1);

  const { data: lastMr, error } = await supabase
    .from("material_requests")
    .select("kode_mr")
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching last MR of the year:", error);
    throw new Error("Gagal men-generate Kode MR.");
  }

  let nextNumber = 1;
  if (lastMr) {
    try {
      const parts = lastMr.kode_mr.split("/");
      const lastNumberStr = parts[parts.length - 1];
      if (lastNumberStr) nextNumber = parseInt(lastNumberStr, 10) + 1;
    } catch (e) {
      console.error("Error parsing last MR code:", e);
    }
  }

  const identifier =
    lokasi === "Head Office"
      ? deptAbbreviations[department] || department
      : lokasiAbbreviations[lokasi] || lokasi;

  return `GMI/MR/${currentMonthRoman}/${currentYearYY}/${identifier}/${nextNumber}`;
};

/**
 * Mengunggah satu file lampiran ke storage.
 */
export const uploadAttachment = async (
  file: File,
  kode_mr: string
): Promise<Attachment> => {
  const filePath = `${kode_mr.replace(/\//g, "-")}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from("mr")
    .upload(filePath, file);

  if (error) throw error;

  return { url: data.path, name: file.name };
};

/**
 * Menghapus satu file lampiran dari storage.
 */
export const removeAttachment = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from("mr").remove([path]);

  if (error) throw error;
};

/**
 * Menyimpan data Material Request baru ke database.
 */
export const createMaterialRequest = async (
  // REVISI: Pastikan tipe formData sekarang MUNGKIN memiliki cost_center_id
  formData: Omit<
    MaterialRequest,
    | "id"
    | "created_at"
    | "approvals"
    | "discussions"
    | "userid"
    | "company_code"
  >,
  userId: string,
  company_code: string
): Promise<MaterialRequest> => {
  // Hapus properti 'cost_center' (text) jika masih ada di state
  // Dan pastikan 'cost_center_id' (number) yang dikirim
  const { cost_center, ...restOfData } = formData as any;

  const payload = {
    ...restOfData,
    cost_center_id: formData.cost_center_id, // Pastikan ini terkirim
    userid: userId,
    company_code: company_code,
    status: "Pending Validation" as const,
    approvals: [],
    discussions: [],
  };

  const { data, error } = await supabase
    .from("material_requests")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error creating MR:", error);
    // Cek error spesifik jika kolom 'cost_center_id' tidak ada
    if (error.code === "42703") {
      // "column ... does not exist"
      throw new Error(
        "Kolom 'cost_center_id' tidak ditemukan. Jalankan migrasi database (Langkah 1)."
      );
    }
    throw error;
  }

  return data as MaterialRequest;
};

/**
 * Mengambil daftar Cost Center yang aktif (misal budget > 0)
 */
export const fetchActiveCostCenters = async (company_code: string) => {
  let query = supabase
    .from("cost_centers")
    .select("id, name, code, current_budget")
    .gt("current_budget", 0); // Hanya tampilkan yg budgetnya masih ada

  if (company_code !== "LOURDES") {
    query = query.eq("company_code", company_code);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) {
    console.error("Error fetching cost centers:", error);
    throw error;
  }
  return data;
};
