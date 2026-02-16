// src/services/mrService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest, Order, Attachment, Profile } from "@/type";

const supabase = createClient();

// --- HELPER: Normalisasi Data Item MR (Agar status aman) ---
export const normalizeMrOrders = (orders: any[]): Order[] => {
  if (!Array.isArray(orders)) return [];

  return orders.map((item) => ({
    ...item,
    // Inject default value jika field tidak ada
    status: item.status || "Pending",
    po_refs: Array.isArray(item.po_refs) ? item.po_refs : [],
    status_note: item.status_note || "",
  }));
};
// -----------------------------------------------------------

// Peta untuk singkatan departemen (untuk user HO)
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

export const generateMRCode = async (
  department: string,
  lokasi: string,
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

export const uploadAttachment = async (
  file: File,
  kode_mr: string,
): Promise<Attachment> => {
  const filePath = `${kode_mr.replace(/\//g, "-")}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("mr")
    .upload(filePath, file);
  if (error) throw error;
  return { url: data.path, name: file.name };
};

export const removeAttachment = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from("mr").remove([path]);
  if (error) throw error;
};

// services/mrService.ts

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
  company_code: string,
): Promise<MaterialRequest> => {
  const { cost_center, ...restOfData } = formData as any;

  const fixedPriority = calculatePriority(formData.due_date);

  // 3. Susun Payload
  const payload = {
    ...restOfData,
    cost_center_id: formData.cost_center_id,
    userid: userId,
    company_code: company_code,

    // Inject Priority yang sudah dihitung
    prioritas: fixedPriority,

    // Default values
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
    if (error.code === "42703") {
      throw new Error(
        "Kolom 'cost_center_id' tidak ditemukan. Jalankan migrasi database.",
      );
    }
    throw error;
  }

  return data as MaterialRequest;
};

// --- FUNGSI DELETE MR ---
export const deleteMaterialRequest = async (mrId: number) => {
  const supabase = createClient();
  const { error } = await supabase
    .from("material_requests")
    .delete()
    .eq("id", mrId);

  if (error) throw new Error(error.message);
  return true;
};

// --- FUNGSI UPDATE STATUS ITEM ---
export const updateMrItemStatus = async (
  mrId: number,
  partNumber: string,
  updates: {
    status?: string;
    poRef?: string;
    note?: string;
  },
  userId: string,
) => {
  const supabase = createClient();

  const { data: mr, error: fetchError } = await supabase
    .from("material_requests")
    .select("orders")
    .eq("id", mrId)
    .single();

  if (fetchError || !mr) {
    throw new Error("Gagal mengambil data MR untuk update item.");
  }

  const currentOrders = mr.orders as any[];
  const itemIndex = currentOrders.findIndex(
    (item) => item.part_number && item.part_number === partNumber,
  );

  if (itemIndex === -1) {
    return { success: false, message: "Item not found" };
  }

  const itemToUpdate = { ...currentOrders[itemIndex] };

  if (updates.status) itemToUpdate.status = updates.status;
  if (updates.poRef) {
    const currentRefs = Array.isArray(itemToUpdate.po_refs)
      ? itemToUpdate.po_refs
      : [];
    if (!currentRefs.includes(updates.poRef)) {
      itemToUpdate.po_refs = [...currentRefs, updates.poRef];
    }
  }
  if (updates.note !== undefined) itemToUpdate.status_note = updates.note;

  itemToUpdate.updated_by = userId;
  itemToUpdate.updated_at = new Date().toISOString();

  currentOrders[itemIndex] = itemToUpdate;

  const { error: updateError } = await supabase
    .from("material_requests")
    .update({ orders: currentOrders })
    .eq("id", mrId);

  if (updateError)
    throw new Error("Gagal update status item: " + updateError.message);

  return { success: true };
};

// --- FUNGSI FETCH MR BY ID (NORMALIZED) ---
export const fetchMaterialRequestById = async (mrId: number) => {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("material_requests")
    .select(
      `
      *, 
      users_with_profiles!userid(nama, lokasi),
      cost_centers (
        id,
        name,
        code,
        current_budget
      )
    `,
    )
    .eq("id", mrId)
    .single();

  if (error) throw error;

  // Normalisasi orders
  if (data && data.orders) {
    data.orders = normalizeMrOrders(data.orders as any[]);
  }

  return data;
};

export const fetchActiveCostCenters = async (company_code: string) => {
  let query = supabase
    .from("cost_centers")
    .select("id, name, code, current_budget");
  const { data, error } = await query.order("name", { ascending: true });
  if (error) {
    console.error("Error fetching cost centers:", error);
    throw error;
  }
  return data;
};

export const fetchAvailableMRsForPO = async (
  companyCode: string,
  searchQuery: string = "",
) => {
  let query = supabase
    .from("material_requests")
    .select(
      `id, kode_mr, status, remarks, cost_estimation, created_at, department, users_with_profiles (nama)`,
    )
    .order("created_at", { ascending: false })
    .limit(10);

  // LOGIC VISIBILITAS UNTUK PEMBUATAN PO (Disamakan dengan Riwayat MR)
  if (companyCode) {
    if (companyCode === "LOURDES") {
      // LOURDES melihat semua
    } else if (["GMI", "GIS"].includes(companyCode)) {
      // GMI/GIS melihat company mereka + LOURDES
      query = query.in("company_code", [companyCode, "LOURDES"]);
    } else {
      // Default behavior
      query = query.eq("company_code", companyCode);
    }
  }

  if (searchQuery) {
    query = query.or(
      `kode_mr.ilike.%${searchQuery}%,remarks.ilike.%${searchQuery}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching available MRs:", error);
    return [];
  }
  return data;
};

export const fetchMaterialRequests = async (
  page: number,
  limit: number,
  searchQuery: string,
  userCompany: string | null, // Context: Perusahaan User Login
  selectedCompanies: string[], // Filter: Checkbox yang dipilih user
  statusFilter: string | null,
  startDate: string | null,
  endDate: string | null,
) => {
  const supabase = createClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("material_requests")
    .select(
      `*, users_with_profiles:profiles!fk_material_requests_profiles (nama, email), cost_centers (name, code)`,
      { count: "exact" },
    );

  // --- LOGIKA VISIBILITAS & FILTER ---
  // 1. Tentukan Scope (Apa yang BOLEH dilihat user)
  let allowedScope: string[] = [];

  if (userCompany === "LOURDES") {
    // Lourdes boleh lihat semua (GMI, GIS, LOURDES, dll)
    // Kita tidak membatasi scope, kecuali user memilih spesifik di filter
    allowedScope = ["ALL"];
  } else if (["GMI", "GIS"].includes(userCompany || "")) {
    // GMI/GIS boleh lihat diri sendiri + LOURDES
    allowedScope = [userCompany!, "LOURDES"];
  } else {
    // Default: Hanya lihat diri sendiri
    allowedScope = userCompany ? [userCompany] : [];
  }

  // 2. Terapkan Filter Checkbox (Intersection dengan Scope)
  if (selectedCompanies.length > 0) {
    if (allowedScope.includes("ALL")) {
      // Jika user LOURDES, langsung pakai apa yang dipilih
      query = query.in("company_code", selectedCompanies);
    } else {
      // Jika user GMI/GIS, pastikan filter yang dipilih valid dalam scope mereka
      // Contoh: User GMI centang "GIS" (ilegal) -> filter ini akan diabaikan
      const validFilters = selectedCompanies.filter((c) =>
        allowedScope.includes(c),
      );

      if (validFilters.length > 0) {
        query = query.in("company_code", validFilters);
      } else {
        // User memilih sesuatu di luar hak aksesnya -> Return kosong
        // Hack: query ID -1 agar hasil kosong
        query = query.eq("id", -1);
      }
    }
  } else {
    // Jika tidak ada filter yang dipilih (Default State), tampilkan sesuai scope default
    if (!allowedScope.includes("ALL")) {
      query = query.in("company_code", allowedScope);
    }
  }
  // ----------------------------------------------

  if (searchQuery) {
    query = query.or(
      `kode_mr.ilike.%${searchQuery}%,remarks.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%,status.ilike.%${searchQuery}%,kategori.ilike.%${searchQuery}%`,
    );
  }
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching MRs:", error);
    throw new Error(error.message);
  }

  const normalizedData = data?.map((mr) => ({
    ...mr,
    orders: normalizeMrOrders(mr.orders as any[]),
  }));

  return { data: normalizedData, count };
};

export const calculatePriority = (
  dueDate: Date | string | undefined | null,
): string => {
  // 1. Validasi: Jika tanggal kosong/invalid, default ke P4 (paling santai)
  if (!dueDate) return "P4";

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset jam hari ini ke 00:00

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0); // Reset jam due date ke 00:00

  // 2. Validasi Tanggal: Jika format salah
  if (isNaN(due.getTime())) return "P4";

  // 3. Hitung Selisih Hari
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 4. LOGIKA BARU (Thresholds)
  // Handle tanggal masa lalu atau hari ini/besok/lusa (<= 2 hari)
  if (diffDays <= 2) return "P0";

  // 3 sampai 10 hari
  if (diffDays <= 10) return "P1";

  // 11 sampai 15 hari
  if (diffDays <= 15) return "P2";

  // 16 sampai 25 hari (Menggabungkan request P3=20 & P3=25)
  if (diffDays <= 25) return "P3";

  // Lebih dari 25 hari (misal 30 hari)
  return "P4";
};
