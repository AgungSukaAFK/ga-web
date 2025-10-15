// src/services/purchaseOrderService.ts

import { createClient } from "@/lib/supabase/client";
import {
  ApprovedMaterialRequest,
  Barang,
  MaterialRequestForPO,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
} from "@/type";

const supabase = createClient();

// --- Fungsi-fungsi ---
export const fetchPurchaseOrders = async (
  page: number,
  limit: number,
  searchQuery?: string | null
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from("purchase_orders").select(
    `
      id, kode_po, status, total_price, created_at,
      users_with_profiles (nama), 
      material_requests (kode_mr)
    `,
    { count: "exact" }
  );

  if (searchQuery) {
    const searchTerm = `%${searchQuery}%`;
    query = query.or(
      `kode_po.ilike.${searchTerm},status.ilike.${searchTerm},material_requests.kode_mr.ilike.${searchTerm}`
    );
  }

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

  return { data, count };
};

export const fetchApprovedMaterialRequests = async (searchQuery?: string) => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, remarks, department")
    .eq("status", "Approved");

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
    .select("id, kode_mr, orders")
    .eq("id", mrId)
    .single<MaterialRequestForPO>();

  if (error) throw error;
  return data;
};

export const generatePoCode = async (): Promise<string> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("kode_po")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Unexpected error generating PO code:", error);
    throw error;
  }

  const currentYear = new Date().getFullYear().toString().slice(-2);
  let nextNumber = 1;

  if (data) {
    try {
      const lastNum = parseInt(data.kode_po.split("/").pop() || "0");
      nextNumber = isNaN(lastNum) ? 1 : lastNum + 1;
    } catch (e) {
      console.error("Gagal parse kode PO terakhir, memulai dari 1:", e);
      nextNumber = 1;
    }
  }

  return `GMI/PO/${currentYear}/${nextNumber}`;
};

export const createPurchaseOrder = async (poData: PurchaseOrderPayload) => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert([poData])
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
    .select(`*, material_requests (kode_mr), users_with_profiles (nama)`)
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
    .select("id, part_number, part_name, uom")
    .or(`part_number.ilike.%${query}%,part_name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error("Error searching barang:", error);
    return [];
  }
  return data;
};
