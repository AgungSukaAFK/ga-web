// src/services/mrService.ts

import { createClient } from "@/lib/supabase/client";
import { MaterialRequest, Order, Attachment, Profile } from "@/type";

const supabase = createClient();

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

/**
 * Mengunggah satu file lampiran ke storage.
 */
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
  company_code: string,
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
        "Kolom 'cost_center_id' tidak ditemukan. Jalankan migrasi database (Langkah 1).",
      );
    }
    throw error;
  }

  return data as MaterialRequest;
};

export const fetchActiveCostCenters = async (company_code: string) => {
  let query = supabase
    .from("cost_centers")
    .select("id, name, code, current_budget");

  // if (company_code !== "LOURDES") {
  //   query = query.eq("company_code", company_code);
  // }

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
      `
      id,
      kode_mr,
      status,
      remarks,
      cost_estimation,
      created_at,
      department,
      users_with_profiles (nama)
    `,
    )
    .eq("company_code", companyCode)
    .order("created_at", { ascending: false })
    .limit(10); // Ringan, Max 10

  // Jika ada pencarian
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
  companyCode: string | null,
  statusFilter: string | null,
  startDate: string | null,
  endDate: string | null,
) => {
  const supabase = createClient();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("material_requests").select(
    `
      *,
      users_with_profiles:profiles!fk_material_requests_profiles (nama, email),
      cost_centers (name, code)
    `,
    { count: "exact" },
  );

  // ... (Bagian Filter Company, Search, Status, Tanggal TETAP SAMA, tidak diubah) ...
  if (companyCode && companyCode !== "LOURDES") {
    query = query.eq("company_code", companyCode);
  }
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

  // --- PERUBAHAN DISINI: Normalisasi Data ---
  const normalizedData = data?.map((mr) => ({
    ...mr,
    // Pastikan orders dinormalisasi agar punya status
    orders: normalizeMrOrders(mr.orders as any[]),
  }));

  return { data: normalizedData, count };
};

export const normalizeMrOrders = (orders: any[]): Order[] => {
  if (!Array.isArray(orders)) return [];

  return orders.map((item) => ({
    // Copy semua properti lama (name, qty, dll)
    ...item,

    // Inject default value hanya jika field tersebut tidak ada
    status: item.status || "Pending",
    po_refs: Array.isArray(item.po_refs) ? item.po_refs : [],
    status_note: item.status_note || "",
  }));
};

// src/services/mrService.ts
/**
 * Mengupdate status, po_refs, atau catatan untuk SATU item spesifik di dalam MR.
 * Fungsi ini memanipulasi JSON array 'orders' secara aman.
 * * @param mrId ID Material Request (number)
 * @param partNumber Part Number item yang akan diupdate (identifier utama)
 * @param updates Object berisi field yang mau diubah (status, poRef, note)
 * @param userId ID User yang melakukan perubahan (untuk audit trail)
 */
export const updateMrItemStatus = async (
  mrId: number,
  partNumber: string,
  updates: {
    status?: string; // Menggunakan string agar fleksibel menerima value dari enum
    poRef?: string; // Kode PO baru untuk ditambahkan (jika ada)
    note?: string; // Catatan (alasan ganti/batal)
  },
  userId: string,
) => {
  const supabase = createClient();

  // 1. Ambil data MR saat ini (hanya kolom orders)
  const { data: mr, error: fetchError } = await supabase
    .from("material_requests")
    .select("orders")
    .eq("id", mrId)
    .single();

  if (fetchError || !mr) {
    throw new Error("Gagal mengambil data MR untuk update item.");
  }

  // Casting ke any[] agar mudah dimanipulasi
  const currentOrders = mr.orders as any[];

  // 2. Cari index item berdasarkan part_number
  // Pastikan part_number tidak null sebelum membandingkan
  const itemIndex = currentOrders.findIndex(
    (item) => item.part_number && item.part_number === partNumber,
  );

  if (itemIndex === -1) {
    console.warn(
      `Item dengan Part Number '${partNumber}' tidak ditemukan di MR ID ${mrId}`,
    );
    // Kita return false/null daripada error agar tidak mematikan proses bulk update
    return { success: false, message: "Item not found" };
  }

  // 3. Update data item di memori
  const itemToUpdate = { ...currentOrders[itemIndex] };

  // Update Status
  if (updates.status) {
    itemToUpdate.status = updates.status;
  }

  // Tambahkan PO Ref (Array)
  if (updates.poRef) {
    // Pastikan po_refs berupa array
    const currentRefs = Array.isArray(itemToUpdate.po_refs)
      ? itemToUpdate.po_refs
      : [];

    // Cek duplikasi, hanya masukkan jika belum ada
    if (!currentRefs.includes(updates.poRef)) {
      itemToUpdate.po_refs = [...currentRefs, updates.poRef];
    }
  }

  // Update Note
  if (updates.note !== undefined) {
    itemToUpdate.status_note = updates.note;
  }

  // Update Metadata Audit
  itemToUpdate.updated_by = userId;
  itemToUpdate.updated_at = new Date().toISOString();

  // Kembalikan item yang sudah diupdate ke array
  currentOrders[itemIndex] = itemToUpdate;

  // 4. Simpan kembali JSON array yang sudah dimodifikasi ke Database
  const { error: updateError } = await supabase
    .from("material_requests")
    .update({ orders: currentOrders })
    .eq("id", mrId);

  if (updateError) {
    throw new Error(
      "Gagal menyimpan update status item MR: " + updateError.message,
    );
  }

  return { success: true };
};

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

  // Normalisasi data orders agar punya field status & po_refs
  if (data && data.orders) {
    data.orders = normalizeMrOrders(data.orders as any[]);
  }

  return data;
};
