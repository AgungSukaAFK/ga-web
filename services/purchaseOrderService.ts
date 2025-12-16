// src/services/purchaseOrderService.ts

import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  ApprovedMaterialRequest,
  Barang,
  MaterialRequest,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  PurchaseOrderListItem,
} from "@/type";

const supabase = createClient();

const PAYMENT_VALIDATOR_USER_ID = "06122d13-9918-40ac-9034-41e849c5c3e2";

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

export const fetchPurchaseOrders = async (
  page: number,
  limit: number,
  searchQuery: string | null,
  company_code: string | null,
  statusFilter: string | null,
  minPrice: string | null,
  maxPrice: string | null,
  startDate: string | null,
  endDate: string | null,
  paymentFilter: string | null,
  paymentTermFilter: string | null
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // REVISI: Tambahkan vendor_details ke select
  let query = supabase.from("purchase_orders").select(
    `
      id, kode_po, status, total_price, created_at, company_code, approvals, vendor_details,
      users_with_profiles!user_id (nama), 
      material_requests!mr_id (
        kode_mr,
        users_with_profiles!userid (nama)
      )
    `,
    { count: "exact" }
  );

  if (searchQuery) {
    // 1. Cari MR ID yang cocok terlebih dahulu
    const { data: matchingMRs } = await supabase
      .from("material_requests")
      .select("id")
      .ilike("kode_mr", `%${searchQuery}%`);

    const matchingMrIds = matchingMRs ? matchingMRs.map((mr) => mr.id) : [];

    // 2. Bungkus search term
    const searchTerm = `"%${searchQuery}%"`;

    // 3. Bangun string filter .or()
    // REVISI: Tambahkan pencarian ke vendor_details (JSONB)
    let orFilter = `kode_po.ilike.${searchTerm},status.ilike.${searchTerm}`;

    // Tambahkan pencarian Nama Vendor & Kode Vendor di dalam JSONB
    orFilter += `,vendor_details->>nama_vendor.ilike.${searchTerm}`;
    orFilter += `,vendor_details->>kode_vendor.ilike.${searchTerm}`;

    if (matchingMrIds.length > 0) {
      orFilter += `,mr_id.in.(${matchingMrIds.join(",")})`;
    }

    query = query.or(orFilter);
  }

  // ... (Sisa kode filter sama seperti sebelumnya)
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (minPrice) {
    query = query.gte("total_price", Number(minPrice));
  }
  if (maxPrice) {
    query = query.lte("total_price", Number(maxPrice));
  }
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
  }

  const paymentApprovalObject = `[{"userid": "${PAYMENT_VALIDATOR_USER_ID}", "status": "approved"}]`;
  if (paymentFilter === "paid") {
    query = query.contains("approvals", paymentApprovalObject);
  } else if (paymentFilter === "unpaid") {
    query = query.not("approvals", "cs", paymentApprovalObject);
  }

  if (paymentTermFilter) {
    query = query.ilike("payment_term", `%${paymentTermFilter}%`);
  }

  if (company_code && company_code !== "LOURDES") {
    query = query.eq("company_code", company_code);
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
    rawData?.map((po: any) => ({
      ...po,
      users_with_profiles: Array.isArray(po.users_with_profiles)
        ? po.users_with_profiles[0] ?? null
        : po.users_with_profiles,
      material_requests: Array.isArray(po.material_requests)
        ? po.material_requests[0]
          ? {
              ...po.material_requests[0],
              users_with_profiles: Array.isArray(
                po.material_requests[0].users_with_profiles
              )
                ? po.material_requests[0].users_with_profiles[0] ?? null
                : po.material_requests[0].users_with_profiles,
            }
          : null
        : po.material_requests
        ? {
            ...po.material_requests,
            users_with_profiles: Array.isArray(
              po.material_requests.users_with_profiles
            )
              ? po.material_requests.users_with_profiles[0] ?? null
              : po.material_requests.users_with_profiles,
          }
        : null,
    })) || [];

  return { data: data as PurchaseOrderListItem[], count };
};

export const fetchApprovedMaterialRequests = async (
  searchQuery?: string,
  limit: number = 50
) => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, remarks, department, status, created_at");

  if (searchQuery) {
    const searchTerm = `"%${searchQuery.trim()}%"`;
    query = query.or(
      `kode_mr.ilike.${searchTerm},remarks.ilike.${searchTerm},department.ilike.${searchTerm}`
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching material requests for PO:", error);
    throw error;
  }
  return data as ApprovedMaterialRequest[];
};

export const fetchMaterialRequestById = async (mrId: number) => {
  const { data, error } = await supabase
    .from("material_requests")
    .select(
      `
      *, 
      users_with_profiles!userid(nama),
      cost_centers (
        id,
        name,
        code,
        current_budget
      )
    `
    )
    .eq("id", mrId)
    .single();

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
    | "status"
    | "approvals"
    | "mr_id"
    | "user_id"
    | "company_code"
    | "vendor_details"
  > & { vendor_details: PurchaseOrderPayload["vendor_details"] },
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

  // 1. Insert PO Baru
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  // 2. UPDATE STATUS & LEVEL MR (Logika Baru)
  if (mr_id) {
    const { error: mrError } = await supabase
      .from("material_requests")
      .update({
        status: "On Process", // Menandakan sedang diproses PO (sebagian/full)
        level: "OPEN 3A", // OPEN 3A: Menunggu Kirim (Default)
      })
      .eq("id", mr_id);

    if (mrError) {
      console.error("Gagal update status MR saat buat PO:", mrError);
      // Kita tidak throw error di sini agar PO tetap terbuat, tapi log errornya.
    }
  }

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
        users_with_profiles!userid (nama),
        cost_centers!cost_center_id (name) 
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
      ? data.material_requests[0]
        ? {
            ...data.material_requests[0],
            users_with_profiles: Array.isArray(
              data.material_requests[0].users_with_profiles
            )
              ? data.material_requests[0].users_with_profiles[0] ?? null
              : data.material_requests[0].users_with_profiles,
          }
        : null
      : data.material_requests
      ? {
          ...data.material_requests,
          users_with_profiles: Array.isArray(
            data.material_requests.users_with_profiles
          )
            ? data.material_requests.users_with_profiles[0] ?? null
            : data.material_requests.users_with_profiles,
        }
      : null,
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
    .or(`part_number.ilike."%${query}%",part_name.ilike."%${query}%"`)
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

export const markGoodsAsReceivedByGA = async (mrId: number) => {
  const { data, error } = await supabase
    .from("material_requests")
    .update({
      level: "OPEN 5", // Sesuai Enum: Tiba di WH (Belum Kirim ke Site)
    })
    .eq("id", mrId)
    .select()
    .single();

  if (error) {
    console.error("Error updating MR level:", error);
    throw error;
  }

  return data;
};
