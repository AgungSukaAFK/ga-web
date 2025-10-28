// src/services/purchaseOrderService.ts

import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  ApprovedMaterialRequest,
  Barang,
  MaterialRequest,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  PurchaseOrderListItem
} from "@/type";

const supabase = createClient();

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

// --- Fungsi-fungsi ---
export const fetchPurchaseOrders = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  company_code: string | null // <-- Tambahkan parameter company_code
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("purchase_orders").select(
    `
      id, kode_po, status, total_price, created_at, company_code,
      users_with_profiles!user_id (nama), 
      material_requests!mr_id (kode_mr)
    `,
    { count: "exact" }
  );

  if (searchQuery) {
    const searchTerm = `%${searchQuery}%`;
    query = query.or(
      `kode_po.ilike.${searchTerm},status.ilike.${searchTerm},material_requests.kode_mr.ilike.${searchTerm}`
    );
  }

  // REVISI: Terapkan filter company_code
  // Jika company_code ada dan BUKAN LOURDES, filter berdasarkan kode tersebut
  if (company_code && company_code !== "LOURDES") {
    query = query.eq("company_code", company_code);
  }
  // Jika 'LOURDES' atau null, jangan filter (RLS akan menangani jika LOURDES)

  const {
    data: rawData,
    error,
    count,
  } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching purchase orders:", error);
    throw error;
  }

  const data =
    rawData?.map((po) => ({
      ...po,
      users_with_profiles: Array.isArray(po.users_with_profiles)
        ? po.users_with_profiles[0] ?? null
        : po.users_with_profiles,
      material_requests: Array.isArray(po.material_requests)
        ? po.material_requests[0] ?? null
        : po.material_requests,
    })) || [];

  return { data: data as PurchaseOrderListItem[], count };
};

export const fetchApprovedMaterialRequests = async (searchQuery?: string) => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, remarks, department")
    .eq("status", "Waiting PO");

  if (searchQuery) {
    const searchTerm = `%${searchQuery.trim()}%`;
    query = query.or(
      `kode_mr.ilike.${searchTerm},remarks.ilike.${searchTerm},department.ilike.${searchTerm}`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching approved material requests:", error);
    throw error;
  }
  return data as ApprovedMaterialRequest[];
};

export const fetchMaterialRequestById = async (mrId: number) => {
  const { data, error } = await supabase
    .from("material_requests")
    .select("*, users_with_profiles!userid(nama)")
    .eq("id", mrId)
    .single<
      MaterialRequest & { users_with_profiles: { nama: string } | null }
    >();

  if (error) throw error;
  return data;
};

export const generatePoCode = async (
  company_code: string,
  lokasi: string
): Promise<string> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearYY = currentYear.toString().slice(-2);
  const currentMonthRoman = toRoman(now.getMonth() + 1);

  const { data: lastPo, error } = await supabase
    .from("purchase_orders")
    .select("kode_po")
    .gte("created_at", `${currentYear}-01-01T00:00:00Z`)
    .lt("created_at", `${currentYear + 1}-01-01T00:00:00Z`)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  let nextNumber = 1;
  if (lastPo) {
    try {
      const lastNum = parseInt(lastPo.kode_po.split("/").pop() || "0");
      nextNumber = isNaN(lastNum) ? 1 : lastNum + 1;
    } catch (e) {
      console.error("Gagal parse kode PO terakhir:", e);
    }
  }

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

  const identifier = lokasiAbbreviations[lokasi] || lokasi;
  const prefix = company_code || "GMI";

  return `${prefix}/PO/${currentMonthRoman}/${currentYearYY}/${identifier}/${nextNumber}`;
};

export const createPurchaseOrder = async (
  poData: Omit<
    PurchaseOrderPayload,
    "status" | "approvals" | "mr_id" | "user_id" | "company_code"
  >,
  mr_id: number | null,
  user_id: string,
  company_code: string
) => {
  const payload = {
    ...poData,
    mr_id,
    user_id,
    company_code,
    status: "Pending Validation" as const,
    approvals: [],
  };
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchPurchaseOrderById = async (
  id: number
): Promise<PurchaseOrderDetail | null> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      *, 
      material_requests!mr_id (
        *, 
        users_with_profiles!userid (nama)
      ), 
      users_with_profiles!user_id (nama, email)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching PO details:", error);
    throw error;
  }

  const transformedData = {
    ...data,
    users_with_profiles: Array.isArray(data.users_with_profiles)
      ? data.users_with_profiles[0] ?? null
      : data.users_with_profiles,
    material_requests: Array.isArray(data.material_requests)
      ? data.material_requests[0] ?? null
      : data.material_requests,
  };

  return transformedData as PurchaseOrderDetail;
};

export const updatePurchaseOrder = async (
  id: number,
  poData: Partial<PurchaseOrderPayload>
) => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .update(poData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const searchBarang = async (query: string): Promise<Barang[]> => {
  if (!query) return [];

  const { data, error } = await supabase
    .from("barang")
    .select("*")
    .or(`part_number.ilike.%${query}%,part_name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error("Error searching barang:", error);
    return [];
  }
  return data;
};

export const validatePurchaseOrder = async (
  id: number,
  approvals: Approval[]
) => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ approvals, status: "Pending Approval" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const closePoWithBast = async (id: number, attachments: any[]) => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ attachments, status: "Completed" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
