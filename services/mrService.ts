// src/services/mrService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest, Order, Attachment, Profile } from "@/type"; // Pastikan path tipe data Anda benar

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
  "Head Office": "HO", // Tambahkan HO jika diperlukan fallback
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
    .select("department, lokasi, company") // Ambil juga company
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

  // REVISI: Logika identifier berdasarkan lokasi
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
    .from("mr") // Pastikan nama bucket Anda adalah 'mr'
    .upload(filePath, file);

  if (error) throw error;

  return { url: data.path, name: file.name };
};

/**
 * Menghapus satu file lampiran dari storage.
 */
export const removeAttachment = async (path: string): Promise<void> => {
  const { error } = await supabase.storage
    .from("mr") // Pastikan nama bucket Anda adalah 'mr'
    .remove([path]);

  if (error) throw error;
};

/**
 * Menyimpan data Material Request baru ke database.
 */
export const createMaterialRequest = async (
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
  company_code: string // Tambahkan company_code
): Promise<MaterialRequest> => {
  const payload = {
    ...formData,
    userid: userId,
    company_code: company_code, // <-- Simpan company_code
    status: "Pending Validation" as const,
    approvals: [],
    discussions: [],
  };

  // Hapus properti yang mungkin tidak ada di skema DB saat insert (jika ada)
  delete (payload as any).lokasi;

  const { data, error } = await supabase
    .from("material_requests")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error creating MR:", error);
    throw error;
  }

  return data as MaterialRequest;
};
