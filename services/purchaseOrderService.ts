// src/services/purchaseOrderService.ts

import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  ApprovedMaterialRequest,
  Barang,
  MaterialRequest,
  MrConversionRecord,
  PurchaseOrderDetail,
  PurchaseOrderPayload,
  PurchaseOrderListItem,
  Attachment,
  POItem,
  ReceiveRecord,
  ReceiveRecordItem,
} from "@/type";
import {
  normalizeMrOrders,
  updateMrItemStatus,
  recalculateMrStatus,
  recalculateMrLevel,
} from "./mrService";
import {
  PAYMENT_VALIDATOR_USER_ID,
  MR_ITEM_STATUSES,
  isPaymentValidatorApproval,
  getApprovedReceiverStep,
  isPoPaid,
  PO_STATUS_PENDING_RECEIVE,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_FULL_RECEIVED,
} from "@/type/enum";

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
  paymentTermFilter: string | null,
) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // REVISI: Tambahkan vendor_details ke select
  let query = supabase.from("purchase_orders").select(
    `
      id, kode_po, status, total_price, created_at, company_code, approvals, vendor_details, items, is_asset,
      users_with_profiles!user_id (nama),
      material_requests!mr_id (
        kode_mr,
        users_with_profiles!userid (nama)
      )
    `,
    { count: "exact" },
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
        ? (po.users_with_profiles[0] ?? null)
        : po.users_with_profiles,
      material_requests: Array.isArray(po.material_requests)
        ? po.material_requests[0]
          ? {
              ...po.material_requests[0],
              users_with_profiles: Array.isArray(
                po.material_requests[0].users_with_profiles,
              )
                ? (po.material_requests[0].users_with_profiles[0] ?? null)
                : po.material_requests[0].users_with_profiles,
            }
          : null
        : po.material_requests
          ? {
              ...po.material_requests,
              users_with_profiles: Array.isArray(
                po.material_requests.users_with_profiles,
              )
                ? (po.material_requests.users_with_profiles[0] ?? null)
                : po.material_requests.users_with_profiles,
            }
          : null,
    })) || [];

  return { data: data as PurchaseOrderListItem[], count };
};

export const fetchApprovedMaterialRequests = async (
  searchQuery?: string,
  limit: number = 50,
) => {
  let query = supabase
    .from("material_requests")
    .select("id, kode_mr, remarks, department, status, created_at");

  if (searchQuery) {
    const searchTerm = `"%${searchQuery.trim()}%"`;
    query = query.or(
      `kode_mr.ilike.${searchTerm},remarks.ilike.${searchTerm},department.ilike.${searchTerm}`,
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
  // Pastikan createClient dipanggil jika belum ada di scope global file ini
  const supabase = createClient();

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
    `,
    )
    .eq("id", mrId)
    .single();

  if (error) throw error;

  // --- PERUBAHAN DISINI: Normalisasi Data ---
  if (data && data.orders) {
    data.orders = normalizeMrOrders(data.orders as any[]);
  }

  return data;
};

export const generatePoCode = async (
  company_code: string,
  lokasi: string,
  identifierOverride?: string,
): Promise<string> => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentYearYY = currentYear.toString().slice(-2);
  const currentMonthRoman = toRoman(now.getMonth() + 1);

  const prefix = company_code || "GMI";

  // FIX 1: Filter nomor PO terakhir berdasarkan company_code
  const { data: lastPo, error } = await supabase
    .from("purchase_orders")
    .select("kode_po")
    .eq("company_code", prefix)
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
    "GIS BPN": "GISBPN",
    "Site Manado": "MND",
    "Site DIZA": "DIZ",
    "Site PIK": "PIK",
    "Site BGE": "BGE",
    "Head Office": "HO",
  };

  // identifierOverride dipakai saat PO ditautkan ke MR - segmen lokasi PO
  // harus PERSIS sama dengan yang ada di kode_mr (lihat pemanggil di
  // purchase-order/create/page.tsx), bukan dihitung ulang dari tujuan_site
  // via lokasiAbbreviations di sini, karena generateMRCode di mrService.ts
  // punya branching khusus (pakai deptAbbreviations) saat tujuan_site MR-nya
  // "Head Office" - kalau dihitung ulang di sini hasilnya bisa beda ("HO")
  // dari yang sebenarnya tertulis di kode_mr (kode departemen).
  const identifier =
    identifierOverride || lokasiAbbreviations[lokasi] || lokasi;

  return `${prefix}/PO/${currentMonthRoman}/${currentYearYY}/${identifier}/${nextNumber}`;
};

export interface PoQtyBreakdownEntry {
  kode_po: string;
  po_status: string;
  qty: number;
  is_manual?: boolean;
}

// Ringkasan qty per part_number dari semua PO (selain yang Rejected) yang
// terhubung ke satu MR (1 PO cuma bisa merujuk 1 mr_id, jadi cukup query by
// mr_id). Dipakai utk mengecek qty MR item yang terpenuhi kumulatif dari
// >1 PO (pembelian parsial), baik oleh createPurchaseOrder maupun oleh UI
// pengelolaan status item di halaman detail MR.
//
// Selain matching otomatis by part_number, ikut merge `manual_po_links` yang
// tersimpan di tiap item Order MR (utk kasus barang disubstitusi pas beli,
// jadi part_number PO-nya beda dari part_number MR asli - lihat
// addManualPoLink di mrService.ts).
export const fetchPoQtyBreakdownForMr = async (
  mrId: number,
): Promise<Record<string, PoQtyBreakdownEntry[]>> => {
  const [posResult, mrResult] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("kode_po, status, items")
      .eq("mr_id", mrId)
      .neq("status", "Rejected"),
    supabase
      .from("material_requests")
      .select("orders")
      .eq("id", mrId)
      .single(),
  ]);

  const { data, error } = posResult;
  if (error || !data) return {};

  const poStatusByCode = new Map(data.map((po) => [po.kode_po, po.status]));

  const breakdown: Record<string, PoQtyBreakdownEntry[]> = {};
  for (const po of data) {
    const items: POItem[] = Array.isArray(po.items) ? po.items : [];
    for (const item of items) {
      if (!item.part_number) continue;
      if (!breakdown[item.part_number]) breakdown[item.part_number] = [];
      breakdown[item.part_number].push({
        kode_po: po.kode_po,
        po_status: po.status,
        qty: item.qty,
      });
    }
  }

  const orders = (mrResult.data?.orders as any[]) || [];
  for (const order of orders) {
    if (!order.part_number || !Array.isArray(order.manual_po_links)) continue;
    for (const link of order.manual_po_links) {
      if (!breakdown[order.part_number]) breakdown[order.part_number] = [];
      // Hindari dobel-hitung kalau kode_po yang sama kebetulan juga
      // ke-detect otomatis (part_number sebenarnya cocok).
      if (
        breakdown[order.part_number].some(
          (e) => e.kode_po === link.kode_po && !e.is_manual,
        )
      ) {
        continue;
      }
      breakdown[order.part_number].push({
        kode_po: link.kode_po,
        po_status: poStatusByCode.get(link.kode_po) || "—",
        qty: link.qty,
        is_manual: true,
      });
    }
  }

  // Item yang pernah "Konversi Barang" (lihat mr-management/edit/[id]/page.tsx)
  // bisa punya PO lama yang SENGAJA tidak ikut dikonversi - PO itu masih
  // pakai part_number LAMA. Supaya qty-nya tetap ke-hitung sebagai bagian
  // dari item ini (bukan hilang), gabungkan entry di bawah part_number lama
  // ke bucket part_number SEKARANG.
  for (const order of orders) {
    if (!order.part_number || !Array.isArray(order.conversion_history)) {
      continue;
    }
    for (const record of order.conversion_history as MrConversionRecord[]) {
      const oldPn = record.from_part_number;
      if (!oldPn || oldPn === order.part_number) continue;
      const oldEntries = breakdown[oldPn];
      if (!oldEntries || oldEntries.length === 0) continue;
      if (!breakdown[order.part_number]) breakdown[order.part_number] = [];
      for (const entry of oldEntries) {
        if (
          breakdown[order.part_number].some(
            (e) => e.kode_po === entry.kode_po,
          )
        ) {
          continue;
        }
        breakdown[order.part_number].push(entry);
      }
    }
  }

  return breakdown;
};

// Daftar PO milik satu MR (dipakai utk picker "link manual ke PO").
export const fetchPosForMr = async (
  mrId: number,
): Promise<{ id: number; kode_po: string; status: string; is_asset: boolean }[]> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, kode_po, status, is_asset")
    .eq("mr_id", mrId)
    .neq("status", "Rejected")
    .order("id", { ascending: false });

  if (error || !data) return [];
  return data;
};

export interface PoForConversion {
  id: number;
  kode_po: string;
  status: string;
  items: POItem[];
  receive_record: ReceiveRecord | null;
  discount: number | null;
  postage: number | null;
  tax: number | null;
  tax_included: boolean | null;
  ppn_rate: number | null;
  pph_rate: number | null;
  total_price: number;
}

// Cari PO (punya MR ini, selain Rejected) yang item-nya masih pakai
// `partNumber` yang diberikan - dipakai fitur "Konversi Barang" di
// mr-management/edit/[id]/page.tsx utk menemukan PO mana saja yang perlu
// ditawarkan ikut dikonversi atau tetap pakai identitas lama.
export const fetchPosForMrItemPartNumber = async (
  mrId: number,
  partNumber: string,
): Promise<PoForConversion[]> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, kode_po, status, items, receive_record, discount, postage, tax, tax_included, ppn_rate, pph_rate, total_price",
    )
    .eq("mr_id", mrId)
    .neq("status", "Rejected");

  if (error || !data) return [];

  return (data as PoForConversion[]).filter((po) =>
    (po.items || []).some((item) => item.part_number === partNumber),
  );
};

// Hitung ulang tax/pph/total_price PO dari `items` (dipakai setelah item-nya
// diubah harga lewat fitur "Konversi Barang") - mirror rumus di
// purchase-order/edit/[id]/page.tsx (subtotal -> DPP -> PPN -> PPH -> grand
// total). `ppn_rate` null berarti mode tax manual (nominal `tax` dibiarkan
// apa adanya, tidak dihitung ulang dari persentase).
export const recomputePoFinancials = (
  po: Pick<
    PoForConversion,
    "items" | "discount" | "postage" | "tax" | "tax_included" | "ppn_rate" | "pph_rate"
  >,
): { tax: number; pph_amount: number; total_price: number } => {
  const subtotal = po.items.reduce(
    (acc, item) => acc + item.qty * item.price,
    0,
  );
  const taxableAmount = Math.max(0, subtotal - (po.discount || 0));

  let tax: number;
  if (po.tax_included) {
    tax = 0;
  } else if (po.ppn_rate != null) {
    tax = taxableAmount * (po.ppn_rate / 100);
  } else {
    tax = po.tax || 0;
  }

  const pphAmount = (taxableAmount * (po.pph_rate || 0)) / 100;
  const totalPrice = taxableAmount - pphAmount + tax + (po.postage || 0);

  return { tax, pph_amount: pphAmount, total_price: totalPrice };
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
  company_code: string,
) => {
  // Status PO Asset ditentukan manual oleh purchasing lewat checkbox "Ini
  // adalah PO Aset" saat bikin PO (poData.is_asset), bukan lagi auto-derive
  // dari is_asset item (data master Barang).
  const payload = {
    ...poData,
    mr_id,
    user_id,
    company_code,
    status: "Pending Validation" as const,
    approvals: [],
    is_asset: !!poData.is_asset,
  };

  // FIX BUG DUPLIKAT NOMOR: payload.kode_po di titik ini masih cuma PREVIEW
  // dari generatePoCode (dihitung read-then-write, bisa bentrok kalau ada
  // user LAIN dari lokasi berbeda submit bersamaan - lihat
  // supabase/document-number-counters-setup.sql). Nomor FINAL yang benar-
  // benar dipakai direbut atomic di sini lewat next_document_number() (row
  // lock Postgres) SEBELUM insert pertama, supaya tidak pernah collide walau
  // segmen lokasinya beda.
  const currentYear = new Date().getFullYear();
  const claimNextPoNumber = async () => {
    const { data: seq, error: seqError } = await supabase.rpc(
      "next_document_number",
      { p_doc_type: "PO", p_company_code: company_code, p_year: currentYear },
    );
    if (seqError) throw seqError;
    const parts = payload.kode_po.split("/");
    parts[parts.length - 1] = String(seq);
    payload.kode_po = parts.join("/");
  };
  await claimNextPoNumber();

  let newPo;
  let attempts = 0;
  const maxAttempts = 5;

  // FIX 2: Mekanisme Auto-Retry (jaring pengaman langka - insert normalnya
  // sudah dijamin unik lewat next_document_number di atas)
  while (attempts < maxAttempts) {
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert([payload])
      .select()
      .single();

    if (error) {
      // 23505 adalah kode error PostgreSQL untuk duplikasi data (Unique Constraint)
      if (error.code === "23505" && error.message.includes("kode_po")) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(
            "Sistem sedang sibuk dan terjadi bentrok nomor PO. Silakan coba submit ulang.",
          );
        }

        await claimNextPoNumber();
        continue;
      }
      throw error;
    }

    newPo = data;
    break; // Berhasil insert, keluar dari loop
  }

  // 2. Update Harga Barang (Last Purchase Price)
  if (poData.items && poData.items.length > 0) {
    const updatePricePromises = poData.items.map(async (item) => {
      if (item.barang_id && item.price > 0) {
        return supabase
          .from("barang")
          .update({ last_purchase_price: item.price })
          .eq("id", item.barang_id);
      }
    });

    try {
      await Promise.all(updatePricePromises);
    } catch (err) {
      console.error("Gagal update harga master barang:", err);
    }
  }

  // 3. UPDATE STATUS ITEM DI MR TERKAIT
  // Sequential (bukan Promise.all): updateMrItemStatus baca-ubah-tulis seluruh
  // array `orders` per panggilan, jadi kalau dijalankan paralel untuk item-item
  // dari PO yang sama, update bisa saling menimpa (lost update).
  if (mr_id && newPo && poData.items && poData.items.length > 0) {
    const { data: mrBeforeUpdate } = await supabase
      .from("material_requests")
      .select("orders")
      .eq("id", mr_id)
      .single();
    const originalOrders = normalizeMrOrders(
      (mrBeforeUpdate?.orders as any[]) || [],
    );

    // Sudah termasuk newPo (baru saja di-insert di atas), jadi kalau item
    // ini sebelumnya juga sempat di-order parsial lewat PO lain, qty-nya
    // di sini sudah kumulatif dari semua PO terkait.
    const poBreakdown = await fetchPoQtyBreakdownForMr(mr_id);

    for (const poItem of poData.items) {
      if (!poItem.part_number) continue;
      const originalOrder = originalOrders.find(
        (o) => o.part_number === poItem.part_number,
      );
      const cumulativeQty = (poBreakdown[poItem.part_number] || []).reduce(
        (sum, entry) => sum + (entry.qty || 0),
        0,
      );
      // Status item MR SELALU "Processing" begitu masuk PO (baik qty-nya
      // baru terpenuhi sebagian maupun sudah penuh - "PO Created" sebagai
      // status terpisah sudah tidak dipakai lagi). Sinyal "qty sudah penuh
      // ke-cover PO" dipindah ke `level` (Open 3A) di bawah - itu yang
      // dipakai recalculateMrStatus buat nentuin item ini sudah "linked".
      const isQtyFulfilled =
        !!originalOrder && cumulativeQty >= Number(originalOrder.qty);
      // Level Open 3A cuma dipasang begitu qty terpenuhi penuh - dan jangan
      // timpa kalau item ini sudah ditandai "Open 3B" (payment issue) secara
      // manual.
      const nextLevel =
        isQtyFulfilled && originalOrder?.level !== "Open 3B"
          ? "Open 3A"
          : undefined;
      try {
        await updateMrItemStatus(
          mr_id,
          poItem.part_number,
          {
            status: "Processing",
            level: nextLevel,
            poRef: newPo.kode_po,
          },
          user_id,
        );
      } catch (err) {
        console.error(
          `Gagal update status item MR untuk Part ${poItem.part_number}:`,
          err,
        );
      }
    }
  }

  // 4. HITUNG ULANG STATUS & LEVEL MR DARI AGREGAT ITEM
  if (mr_id) {
    await recalculateMrStatus(mr_id);
    await recalculateMrLevel(mr_id);
  }

  return newPo;
};

export const fetchPurchaseOrderById = async (
  id: number,
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
    `,
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
      ? (data.users_with_profiles[0] ?? null)
      : data.users_with_profiles,
    material_requests: Array.isArray(data.material_requests)
      ? data.material_requests[0]
        ? {
            ...data.material_requests[0],
            users_with_profiles: Array.isArray(
              data.material_requests[0].users_with_profiles,
            )
              ? (data.material_requests[0].users_with_profiles[0] ?? null)
              : data.material_requests[0].users_with_profiles,
          }
        : null
      : data.material_requests
        ? {
            ...data.material_requests,
            users_with_profiles: Array.isArray(
              data.material_requests.users_with_profiles,
            )
              ? (data.material_requests.users_with_profiles[0] ?? null)
              : data.material_requests.users_with_profiles,
          }
        : null,
  };

  return transformedData as PurchaseOrderDetail;
};

export const updatePurchaseOrder = async (
  id: number,
  poData: Partial<PurchaseOrderPayload>,
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
    .select("*, last_purchase_price")
    .or(`part_number.ilike."%${query}%",part_name.ilike."%${query}%"`)
    .limit(10);

  if (error) {
    console.error("Error searching barang:", error);
    return [];
  }
  return data;
};

// Ambil flag is_asset utk sekumpulan barang_id sekaligus (dipakai saat
// mapping item MR -> item PO, karena Order MR tidak menyimpan is_asset-nya
// sendiri, cuma barang_id).
export const fetchBarangAssetFlags = async (
  barangIds: number[],
): Promise<Record<number, boolean>> => {
  const uniqueIds = [...new Set(barangIds)].filter((id) => !!id);
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("barang")
    .select("id, is_asset")
    .in("id", uniqueIds);

  if (error) {
    console.error("Error fetching barang asset flags:", error);
    return {};
  }

  return Object.fromEntries(data.map((b) => [b.id, !!b.is_asset]));
};

export const validatePurchaseOrder = async (
  id: number,
  approvals: Approval[],
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

/**
 * Menentukan status PO berikutnya seputar penerimaan barang, secara
 * simetris terhadap urutan step "Receiver" vs "Payment Validator" di
 * template approval-nya (urutannya beda-beda tergantung jalur pembayaran -
 * Cash/DP&BP-setelah-lunas taruh Payment Validator duluan, Termin/DP&BP-
 * setelah-DP taruh Receiver duluan - lihat po-receive-record-setup.sql).
 * Dipanggil dari 2 sisi: begitu step Payment Validator selesai disetujui,
 * dan begitu checklist Receiver disubmit (baik lewat step approval Receiver
 * maupun tombol GA Receive manual).
 *
 * - `paymentJustSettled`: true kalau baru saja menyelesaikan sisi
 *   pembayaran (dp_paid && bp_paid sesuai payment_term, atau approve biasa
 *   utk non-DP&BP).
 * - `receiveJustSubmitted`: true kalau baru saja submit checklist receiver.
 * Salah satu harus true (dipanggil dari salah satu sisi), tidak keduanya.
 */
export const deriveReceiveDrivenStatus = (
  approvals: Approval[] | null | undefined,
  hasPaymentValidatorStep: boolean,
  isFullMatch: boolean | undefined,
  opts: { paymentJustSettled?: boolean; receiveJustSubmitted?: boolean },
):
  | typeof PO_STATUS_PENDING_RECEIVE
  | "Pending Payment"
  | typeof PO_STATUS_FULL_RECEIVED
  | typeof PO_STATUS_PARTIAL_RECEIVE => {
  const receiverApproved = !!getApprovedReceiverStep(approvals);

  if (opts.paymentJustSettled) {
    if (receiverApproved && isFullMatch !== undefined) {
      return isFullMatch ? PO_STATUS_FULL_RECEIVED : PO_STATUS_PARTIAL_RECEIVE;
    }
    return PO_STATUS_PENDING_RECEIVE;
  }

  // receiveJustSubmitted
  const paymentSettled = !hasPaymentValidatorStep || isPoPaid(approvals);
  if (paymentSettled) {
    return isFullMatch ? PO_STATUS_FULL_RECEIVED : PO_STATUS_PARTIAL_RECEIVE;
  }
  return "Pending Payment";
};

/**
 * Payload tambahan buat stempel "umur PO" (full_received_at) - dipanggil di
 * SEMUA titik yang nulis status PO hasil deriveReceiveDrivenStatus (di sini
 * & purchase-order/[id]/page.tsx), biar konsisten. Cuma nyetel field itu pas
 * transisi PERTAMA kali ke Full Received - lihat formatAge di lib/utils.ts.
 */
export const getFullReceivedStamp = (
  oldStatus: string | null | undefined,
  newStatus: string,
): { full_received_at?: string } =>
  newStatus === PO_STATUS_FULL_RECEIVED && oldStatus !== PO_STATUS_FULL_RECEIVED
    ? { full_received_at: new Date().toISOString() }
    : {};

// Total qty yang SUDAH diterima GA per part_number, dijumlah dari
// `receive_record` semua PO (selain Rejected & selain `excludePoId`) yang
// terhubung ke MR ini. Dipakai submitReceiveRecord buat nentuin item MR
// "Diterima GA" berdasarkan qty GABUNGAN dari SEMUA PO-nya - bukan cuma qty
// di 1 PO - soalnya 1 item MR bisa dipecah ke >1 PO (mirror pola yang sama
// dgn fetchPoQtyBreakdownForMr, cuma versi qty yang SUDAH diterima, bukan
// qty yang di-PO-kan).
export const fetchReceivedQtyByPartNumber = async (
  mrId: number,
  excludePoId?: number,
): Promise<Record<string, number>> => {
  let query = supabase
    .from("purchase_orders")
    .select("id, receive_record")
    .eq("mr_id", mrId)
    .neq("status", "Rejected");
  if (excludePoId) query = query.neq("id", excludePoId);

  const [{ data, error }, mrResult] = await Promise.all([
    query,
    supabase.from("material_requests").select("orders").eq("id", mrId).single(),
  ]);
  if (error || !data) return {};

  const totals: Record<string, number> = {};
  for (const po of data) {
    const record = po.receive_record as ReceiveRecord | null;
    if (!record?.items) continue;
    for (const item of record.items) {
      if (!item.part_number) continue;
      totals[item.part_number] =
        (totals[item.part_number] || 0) + (item.received_qty || 0);
    }
  }

  // Sama seperti fetchPoQtyBreakdownForMr: gabungkan qty yang sudah diterima
  // di bawah part_number LAMA (PO yang sengaja tidak ikut "Konversi Barang")
  // ke bucket part_number SEKARANG, supaya perhitungan "sudah diterima
  // semua?" tetap benar walau identitas item berubah di tengah jalan.
  const orders = (mrResult.data?.orders as any[]) || [];
  for (const order of orders) {
    if (!order.part_number || !Array.isArray(order.conversion_history)) {
      continue;
    }
    for (const record of order.conversion_history as MrConversionRecord[]) {
      const oldPn = record.from_part_number;
      if (!oldPn || oldPn === order.part_number) continue;
      if (totals[oldPn] === undefined) continue;
      totals[order.part_number] = (totals[order.part_number] || 0) + totals[oldPn];
    }
  }
  return totals;
};

/**
 * Submit/edit checklist penerimaan barang (Receiver) - dipakai baik dari
 * step approval "Receiver" maupun tombol GA Receive manual (disatukan,
 * lihat po-receive-record-setup.sql). Menimpa `receive_record` PO ini
 * (bukan log bertumpuk - "sampai terpenuhi" berarti diedit di tempat),
 * menandai item MR "Diterima GA" kalau qty gabungan dari SEMUA PO terkait
 * (bukan cuma PO ini) udah cukup, kalau belum tetap "Processing", lalu set
 * status PO lewat deriveReceiveDrivenStatus.
 */
export const submitReceiveRecord = async (
  po: Pick<
    PurchaseOrderDetail,
    "id" | "mr_id" | "items" | "approvals" | "vendor_details" | "status"
  >,
  userId: string,
  userName: string,
  receivedQtyByPartNumber: Record<string, number>,
): Promise<ReceiveRecord> => {
  if (!po.mr_id) throw new Error("PO ini tidak terhubung ke MR.");

  // Vendor tipe Site kirim langsung ke site tanpa lewat GA - jadi begitu
  // requester sendiri yang konfirmasi terima (checklist ini), item yang
  // qty-nya sudah penuh langsung "On Delivery" (siap di-BAST), TIDAK
  // singgah di "Diterima GA" dulu (yang nunggu GA klik "Kirim ke Requester"
  // - langkah itu gak relevan buat vendor Site karena gak ada GA di tengah).
  const isSiteVendor = po.vendor_details?.tipe_vendor === "Site";

  const items: ReceiveRecordItem[] = (po.items || [])
    .filter((item) => !!item.part_number)
    .map((item) => ({
      part_number: item.part_number,
      part_name: item.name,
      ordered_qty: item.qty,
      received_qty: receivedQtyByPartNumber[item.part_number] ?? 0,
    }));
  const isFullMatch = items.every((i) => i.received_qty === i.ordered_qty);

  const receiveRecord: ReceiveRecord = {
    items,
    is_full_match: isFullMatch,
    received_by: userId,
    received_by_name: userName,
    received_at: new Date().toISOString(),
  };

  const { data: mrRow } = await supabase
    .from("material_requests")
    .select("orders")
    .eq("id", po.mr_id)
    .single();
  const orders = normalizeMrOrders((mrRow?.orders as any[]) || []);

  // Qty yang sudah diterima dari PO LAIN (belum termasuk submission ini,
  // yang baru ke-save ke DB di akhir fungsi) - dipakai buat cek qty
  // gabungan lintas PO, bukan cuma qty di PO ini (lihat 1 item MR bisa
  // dipecah ke >1 PO).
  const receivedFromOtherPos = await fetchReceivedQtyByPartNumber(
    po.mr_id,
    po.id,
  );

  for (const item of items) {
    const order = orders.find((o) => o.part_number === item.part_number);
    // Item yang belum linked ke PO ini (mis. sudah Cancelled/Completed dari
    // PO lain) dilewati supaya tidak ketimpa - sama seperti guard lama.
    // "PO Created" di sini cuma backward-compat buat data lama yang belum
    // sempat dimigrasikan ke "Processing" (lihat migrate-legacy-mr-po.mjs) -
    // item baru tidak akan pernah ditulis dengan status ini lagi.
    // "Dikirim Vendor" WAJIB ada di sini - itu status normal item begitu
    // Payment Validator approve (lihat markItemsShippedByVendor,
    // purchase-order/[id]/page.tsx), yaitu PERSIS status item saat checklist
    // receive ini disubmit pertama kali. Kalau ketinggalan, item-nya
    // di-skip terus (guard ini nolak), jadi klik "Terima Barang" jadi
    // no-op - status item gak pernah pindah ke "Diterima GA"/"On Delivery".
    if (
      (order?.status as string | undefined) !== "PO Created" &&
      order?.status !== MR_ITEM_STATUSES.SHIPPED_BY_VENDOR &&
      order?.status !== MR_ITEM_STATUSES.PROCESSING &&
      order?.status !== MR_ITEM_STATUSES.DITERIMA_GA &&
      order?.status !== MR_ITEM_STATUSES.PENDING_BAST
    ) {
      continue;
    }
    // Qty total yg diminta di item MR-nya (bukan cuma qty di PO ini) -
    // dibandingin ke qty gabungan yg sudah diterima dari SEMUA PO terkait,
    // termasuk submission ini.
    const totalRequestedQty = Number(order?.qty) || item.ordered_qty;
    const cumulativeReceivedQty =
      (receivedFromOtherPos[item.part_number] || 0) + item.received_qty;
    const isItemFullyReceived = cumulativeReceivedQty >= totalRequestedQty;
    try {
      await updateMrItemStatus(
        po.mr_id,
        item.part_number,
        {
          // "Diterima GA" - GA baru terima dari vendor (qty GABUNGAN dari
          // semua PO terkait sudah cukup), BELUM dikirim ke requester (beda
          // momen dgn dulu yg langsung "Pending BAST"). Kalau item ini
          // dipecah ke >1 PO dan baru sebagian yg datang, status TETAP
          // "Processing" sampai semua PO-nya selesai diterima. Baru pindah
          // ke "On Delivery" saat GA klik "Kirim ke Requester" (lihat
          // sendItemsToRequester, services/mrService.ts).
          status: isItemFullyReceived
            ? isSiteVendor
              ? MR_ITEM_STATUSES.ON_DELIVERY
              : MR_ITEM_STATUSES.DITERIMA_GA
            : MR_ITEM_STATUSES.PROCESSING,
          level: "Open 5",
        },
        userId,
      );
    } catch (err) {
      console.error(
        `Gagal update status item MR (receive) untuk Part ${item.part_number}:`,
        err,
      );
    }
  }

  await supabase
    .from("material_requests")
    .update({ level: "OPEN 5" })
    .eq("id", po.mr_id);
  await recalculateMrStatus(po.mr_id);
  await recalculateMrLevel(po.mr_id);

  const hasPaymentValidatorStep = (po.approvals || []).some((a) =>
    isPaymentValidatorApproval(a),
  );
  const newStatus = deriveReceiveDrivenStatus(
    po.approvals,
    hasPaymentValidatorStep,
    isFullMatch,
    { receiveJustSubmitted: true },
  );

  const { error: poError } = await supabase
    .from("purchase_orders")
    .update({
      receive_record: receiveRecord,
      status: newStatus,
      ...getFullReceivedStamp(po.status, newStatus),
    })
    .eq("id", po.id);
  if (poError) throw poError;

  return receiveRecord;
};

/**
 * Mengunggah file attachment (Invoice, BAST, dll) ke bucket 'po'.
 */
export const uploadPoAttachment = async (
  file: File,
  kode_po: string,
  type: "po" | "finance" | "bast" | "invoice",
): Promise<Attachment> => {
  // Ganti slash di kode_po dengan dash agar aman di URL
  const safeKode = kode_po.replace(/\//g, "-");
  const filePath = `${safeKode}/${Date.now()}_${file.name}`;

  // Upload ke bucket 'po' (Pastikan bucket ini ada di Supabase Storage)
  const { data, error } = await supabase.storage
    .from("po")
    .upload(filePath, file);

  if (error) throw error;

  return { url: data.path, name: file.name, type };
};

/**
 * Menambahkan attachment baru ke dalam list attachments PO yang sudah ada.
 */
export const addAttachmentToPo = async (
  poId: number,
  newAttachment: Attachment,
) => {
  // 1. Ambil data attachments saat ini
  const { data: po, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("attachments")
    .eq("id", poId)
    .single();

  if (fetchError) throw fetchError;

  // 2. Gabungkan dengan attachment baru
  const currentAttachments = (po.attachments as Attachment[]) || [];
  const updatedAttachments = [...currentAttachments, newAttachment];

  // 3. Update database
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ attachments: updatedAttachments })
    .eq("id", poId)
    .select()
    .single();

  if (error) throw error;
  return data;
};
