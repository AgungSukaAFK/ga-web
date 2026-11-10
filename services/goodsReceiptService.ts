"use server";

// Server actions untuk fitur Cetak BAST + Scan QR Goods Receipt Confirmation.
// SEMUA fungsi di sini pakai service-role client (createAdminClient) karena
// dipanggil dari halaman publik /goods-receipt/[token] yang jalan TANPA
// sesi Supabase browser (material_requests gak punya RLS anon sama sekali).
// Otorisasi dicek manual di tiap fungsi (bukan lewat RLS) - lihat komentar
// masing-masing.

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  confirmRequesterReceipt,
  fetchReceiptPosForMr,
  matchPoLinesToMrOrders,
  normalizeMrOrders,
} from "./mrService";
import { getReceiptItemStates } from "@/lib/requesterReceipt";
import {
  Attachment,
  GoodsReceipt,
  GoodsReceiptItem,
  Order,
  PhotoCaptureMeta,
} from "@/type";
import { MR_ITEM_STATUSES } from "@/type/enum";

const GOODS_RECEIPT_CODE_KEY = "goods_receipt_global_code";

// UUID service account "Publik (Scan QR)" - lihat
// supabase/migrations/0002_mr_po.sql (asal: goods_receipt_setup.sql). Dipakai sebagai actor/user_id di
// activity_logs & bast_attachments.updated_by kalau konfirmasi datang dari
// scan QR TANPA login (kode global doang) - FK ke auth.users tetap harus
// terisi valid, nama penerima sesungguhnya selalu di goods_receipt.receiver_name.
async function getPublicScanUserId(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "public-scan@internal.garudamart.local")
    .single();
  if (error || !data) {
    throw new Error(
      "Service account 'Publik (Scan QR)' belum di-setup - jalankan supabase/migrations/0002_mr_po.sql (asal: goods_receipt_setup.sql).",
    );
  }
  return data.id;
}

async function logGoodsReceiptActivity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  resourceType: "purchase_order" | "material_request",
  resourceId: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.from("activity_logs").insert([
    {
      user_id: userId,
      action_type: "GOODS_RECEIPT_CONFIRMED",
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      metadata,
    },
  ]);
  if (error) console.error("Gagal log activity goods receipt:", error);
}

// --- PENGATURAN KODE GLOBAL (admin only) ---

export async function getGoodsReceiptSetting(): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", GOODS_RECEIPT_CODE_KEY)
    .maybeSingle();
  if (error) throw new Error("Gagal mengambil kode global: " + error.message);
  return data?.value || "";
}

export async function setGoodsReceiptSetting(
  newCode: string,
  adminUserId: string,
): Promise<void> {
  if (!newCode.trim()) throw new Error("Kode global tidak boleh kosong.");
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      value: newCode.trim(),
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    })
    .eq("key", GOODS_RECEIPT_CODE_KEY);
  if (error) throw new Error("Gagal menyimpan kode global: " + error.message);
}

// --- TOKEN BAST (dipanggil dari halaman detail PO, saat "Cetak BAST" diklik) ---

export async function ensureReceiptToken(poId: number): Promise<string> {
  // Gate tipis: cuma boleh dipanggil dari sesi yang sudah login (halaman
  // detail PO sendiri sudah butuh login) - bukan endpoint publik.
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("purchase_orders")
    .select("receipt_token")
    .eq("id", poId)
    .single();
  if (error || !data) throw new Error("PO tidak ditemukan.");
  if (data.receipt_token) return data.receipt_token;

  const token = crypto.randomUUID();
  const { error: updateError } = await admin
    .from("purchase_orders")
    .update({ receipt_token: token })
    .eq("id", poId);
  if (updateError)
    throw new Error("Gagal membuat token BAST: " + updateError.message);
  return token;
}

// --- HALAMAN PUBLIK /goods-receipt/[token] ---

// Jam server - dipakai halaman scan buat hitung offset jam HP, supaya
// timestamp di watermark foto gak bisa dimanipulasi dengan ganti jam HP.
export async function getServerTime(): Promise<string> {
  return new Date().toISOString();
}

// Metadata foto datang dari client - dibersihkan & dibatasi di sini, bukan
// dipercaya mentah-mentah. Return null kalau koordinatnya gak valid (lokasi
// wajib utk foto dari scan QR).
function sanitizeCaptureMeta(raw: unknown): PhotoCaptureMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const lat = Number(m.latitude);
  const lng = Number(m.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  const capturedAt = new Date(String(m.captured_at || ""));
  const accuracy = Number(m.accuracy_m);
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  return {
    captured_at: Number.isNaN(capturedAt.getTime())
      ? new Date().toISOString()
      : capturedAt.toISOString(),
    latitude: lat,
    longitude: lng,
    accuracy_m: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    address: str(m.address, 500),
    device: str(m.device, 200) || "Tidak diketahui",
  };
}

export async function verifyGoodsReceiptCode(code: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", GOODS_RECEIPT_CODE_KEY)
    .maybeSingle();
  return !!data?.value && data.value === code;
}

export interface GoodsReceiptItemView {
  // Index baris item MR (sebagai string) - kunci input di halaman scan QR.
  // Bukan part_number, karena MR bisa punya part_number kembar.
  key: string;
  part_number: string;
  name: string;
  uom: string;
  qty_mr: number;
  qty_po: number;
  qty_dikirim: number;
  is_site_vendor: boolean;
}

export interface GoodsReceiptView {
  kode_po: string;
  kode_mr: string;
  requester_nama: string;
  vendor_name: string;
  already_received: boolean;
  received_info: { receiver_name: string; confirmed_at: string } | null;
  items: GoodsReceiptItemView[];
}

const isMrItemInPO = (order: Order, poItems: { part_number: string }[]) =>
  !!order.part_number && poItems.some((pi) => pi.part_number === order.part_number);

const isOrderOpen = (order: Order) =>
  order.status !== MR_ITEM_STATUSES.COMPLETED &&
  order.status !== MR_ITEM_STATUSES.CANCELLED &&
  order.status !== MR_ITEM_STATUSES.REPLACED;

// Baris item MR (beserta index-nya) yang masih bisa dikonfirmasi lewat PO ini.
const getEligibleOrders = (mrOrders: Order[], poItems: { part_number: string }[]) =>
  mrOrders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => isMrItemInPO(order, poItems) && isOrderOpen(order));

export async function fetchGoodsReceiptView(
  token: string,
): Promise<GoodsReceiptView | null> {
  const admin = createAdminClient();
  const { data: po, error } = await admin
    .from("purchase_orders")
    .select(
      `
      id, kode_po, mr_id, items, vendor_details, receive_record, goods_receipt,
      material_requests!mr_id ( kode_mr, orders, users_with_profiles!userid ( nama ) )
    `,
    )
    .eq("receipt_token", token)
    .maybeSingle();

  if (error || !po || !po.mr_id) return null;

  const mr = Array.isArray(po.material_requests)
    ? po.material_requests[0]
    : po.material_requests;
  if (!mr) return null;

  const poItems: any[] = Array.isArray(po.items) ? po.items : [];
  const mrOrders = normalizeMrOrders((mr as any).orders || []);
  const isSiteVendor =
    (po.vendor_details as any)?.tipe_vendor === "Site";
  const receiveRecordItems: { part_number: string; received_qty: number }[] =
    (po.receive_record as any)?.items || [];
  const requesterNama =
    (Array.isArray((mr as any).users_with_profiles)
      ? (mr as any).users_with_profiles[0]
      : (mr as any).users_with_profiles
    )?.nama || "N/A";
  const vendorName = (po.vendor_details as any)?.nama_vendor || "N/A";

  const eligibleOrders = getEligibleOrders(mrOrders, poItems);

  if (po.goods_receipt || eligibleOrders.length === 0) {
    const gr = po.goods_receipt as GoodsReceipt | null;
    return {
      kode_po: po.kode_po,
      kode_mr: (mr as any).kode_mr,
      requester_nama: requesterNama,
      vendor_name: vendorName,
      already_received: true,
      received_info: gr
        ? { receiver_name: gr.receiver_name, confirmed_at: gr.confirmed_at }
        : null,
      items: [],
    };
  }

  // Baris PO & baris receive_record milik tiap baris MR - dipasangkan per
  // baris (bukan cari part_number pertama) supaya part_number kembar
  // menampilkan qty-nya masing-masing.
  const poLines = poItems.filter((pi) => !!pi.part_number);
  const lineOrderIndices = matchPoLinesToMrOrders(
    mrOrders,
    poLines.map((pi) => pi.part_number),
    po.kode_po,
  );
  const records = [...receiveRecordItems];
  const lineRecords = poLines.map((pi) => {
    const i = records.findIndex((r) => r.part_number === pi.part_number);
    return i !== -1 ? records.splice(i, 1)[0] : undefined;
  });

  const items: GoodsReceiptItemView[] = eligibleOrders.map(({ order, index }) => {
    const lineIndex = lineOrderIndices.indexOf(index);
    const poItem =
      lineIndex !== -1
        ? poLines[lineIndex]
        : poItems.find((pi) => pi.part_number === order.part_number);
    const receiveRecordEntry =
      lineIndex !== -1
        ? lineRecords[lineIndex]
        : receiveRecordItems.find((i) => i.part_number === order.part_number);
    const qtyDikirim =
      order.delivery_info?.qty_sent ??
      receiveRecordEntry?.received_qty ??
      poItem?.qty ??
      Number(order.qty) ??
      0;
    return {
      key: String(index),
      part_number: order.part_number as string,
      name: order.name,
      uom: order.uom,
      qty_mr: Number(order.qty) || 0,
      qty_po: poItem?.qty || 0,
      qty_dikirim: qtyDikirim,
      is_site_vendor: isSiteVendor,
    };
  });

  return {
    kode_po: po.kode_po,
    kode_mr: (mr as any).kode_mr,
    requester_nama: requesterNama,
    vendor_name: vendorName,
    already_received: false,
    received_info: null,
    items,
  };
}

export async function submitGoodsReceipt(
  token: string,
  formData: FormData,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient();

  const { data: po, error: poError } = await admin
    .from("purchase_orders")
    .select(
      `
      id, kode_po, mr_id, items, goods_receipt,
      material_requests!mr_id ( orders )
    `,
    )
    .eq("receipt_token", token)
    .maybeSingle();

  if (poError || !po || !po.mr_id) {
    return { success: false, message: "PO tidak ditemukan." };
  }

  const mr = Array.isArray(po.material_requests)
    ? po.material_requests[0]
    : po.material_requests;
  const poItems: any[] = Array.isArray(po.items) ? po.items : [];
  const mrOrders = normalizeMrOrders((mr as any)?.orders || []);
  const eligibleOrders = getEligibleOrders(mrOrders, poItems);

  if (po.goods_receipt || eligibleOrders.length === 0) {
    return {
      success: false,
      message: "PO ini sudah dikonfirmasi diterima sebelumnya.",
    };
  }

  // Resolusi identitas SELALU di server, JANGAN pernah percaya klaim dari
  // client (mis. userId/confirmedVia yang dikirim di body request) - kalau
  // ada sesi asli, pakai itu; kalau tidak, kode global WAJIB re-diverifikasi
  // di sini juga (bukan cuma di step verify terpisah sebelumnya di UI, yang
  // hasilnya bisa dipalsukan client).
  const serverSupabase = await createServerClient();
  const {
    data: { user: sessionUser },
  } = await serverSupabase.auth.getUser();

  let receiverName: string;
  let confirmedVia: "login" | "public_code";
  let actorUserId: string;

  if (sessionUser) {
    const { data: profile } = await admin
      .from("profiles")
      .select("nama")
      .eq("id", sessionUser.id)
      .single();
    receiverName = profile?.nama || sessionUser.email || "Unknown";
    confirmedVia = "login";
    actorUserId = sessionUser.id;
  } else {
    const code = String(formData.get("code") || "");
    const isValid = await verifyGoodsReceiptCode(code);
    if (!isValid) return { success: false, message: "Kode global salah." };

    const rawName = String(formData.get("receiver_name") || "").trim();
    if (!rawName) return { success: false, message: "Nama penerima wajib diisi." };
    receiverName = rawName
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    confirmedVia = "public_code";
    actorUserId = await getPublicScanUserId(admin);
  }

  const itemsJson = formData.get("items_json");
  if (!itemsJson) return { success: false, message: "Data item tidak lengkap." };
  // `key` = index baris item MR (lihat GoodsReceiptItemView.key). Halaman
  // versi lama yang masih terbuka di browser belum mengirim `key` - fallback
  // ke part_number.
  let submittedItems: { key?: string; part_number: string; qty_received: number }[];
  try {
    submittedItems = JSON.parse(String(itemsJson));
  } catch {
    return { success: false, message: "Data item tidak valid." };
  }

  // Foto tiap item di-upload LANGSUNG dari browser ke storage VPS SEBELUM
  // submit ini dipanggil (lihat app/goods-receipt/[token]/page.tsx +
  // createSignedUploadUrlPublic) - bytes foto tidak lewat body Server Action
  // ini sama sekali, cuma URL hasil upload yang dikirim lewat `photos_json`.
  // Ini WAJIB karena Vercel Serverless Functions punya hard limit body
  // request 4.5MB yang tidak bisa dinaikkan - kalau beberapa foto item
  // digabung jadi satu FormData besar (pola lama), gampang kelewat limit itu.
  const photosJson = formData.get("photos_json");
  if (!photosJson) return { success: false, message: "Data foto tidak lengkap." };
  let submittedPhotos: Record<
    string,
    { url: string; name: string; meta?: unknown }
  >;
  try {
    submittedPhotos = JSON.parse(String(photosJson));
  } catch {
    return { success: false, message: "Data foto tidak valid." };
  }

  // Pasangkan tiap baris MR yang eligible ke input-nya - per baris (index),
  // BUKAN per part_number: baris dgn part_number kembar punya qty & foto
  // sendiri, dan baris yang qty-nya 0 tidak boleh ikut diselesaikan hanya
  // karena kembarannya sudah diterima.
  const hasKeys = submittedItems.some((i) => i.key !== undefined);
  const usedLegacy = new Set<number>();
  const inputs: {
    order: Order;
    index: number;
    item: (typeof submittedItems)[number] | undefined;
    photo: { url: string; name: string; meta?: unknown } | undefined;
  }[] = eligibleOrders.map(({ order, index }) => {
    if (hasKeys) {
      const key = String(index);
      return {
        order,
        index,
        item: submittedItems.find((i) => i.key === key),
        photo: submittedPhotos[key],
      };
    }
    const legacyIndex = submittedItems.findIndex(
      (i, n) => !usedLegacy.has(n) && i.part_number === order.part_number,
    );
    if (legacyIndex !== -1) usedLegacy.add(legacyIndex);
    return {
      order,
      index,
      item: legacyIndex !== -1 ? submittedItems[legacyIndex] : undefined,
      photo: submittedPhotos[order.part_number as string],
    };
  });

  for (const { order, item, photo } of inputs) {
    const pn = order.part_number;
    if (!item || !Number.isFinite(item.qty_received) || item.qty_received < 0) {
      return { success: false, message: `Qty untuk item ${pn} belum diisi dengan benar.` };
    }
    // Barang yang belum datang (qty 0) tidak punya foto dan tidak diselesaikan.
    if (item.qty_received === 0) continue;
    if (!photo?.url) {
      return { success: false, message: `Foto untuk item ${pn} wajib diunggah.` };
    }
    if (!sanitizeCaptureMeta(photo.meta)) {
      return {
        success: false,
        message: `Lokasi foto item ${pn} tidak valid. Aktifkan lokasi lalu foto ulang.`,
      };
    }
  }

  // Jalur yang sama dengan konfirmasi di halaman MR, supaya item, status MR, dan
  // receive_record PO selalu bergerak bersama.
  const receiptStates = getReceiptItemStates(
    mrOrders,
    await fetchReceiptPosForMr(po.mr_id, admin),
  );
  const goodsReceiptItems: GoodsReceiptItem[] = [];
  const receiptEntries: { index: number; qty: number; attachments: Attachment[] }[] = [];
  for (const { order, index, item, photo } of inputs) {
    if (!item || item.qty_received <= 0 || !photo?.url) continue;

    const state = receiptStates[index];
    if (!state?.canConfirm) {
      return {
        success: false,
        message: `Item ${order.part_number} belum bisa dikonfirmasi: ${state?.message || "tidak ditemukan"}.`,
      };
    }

    const photoAttachment: Attachment = {
      name: photo.name,
      url: photo.url,
      type: "bast",
    };
    receiptEntries.push({
      index,
      qty: Math.min(item.qty_received, state.maxQty),
      attachments: [photoAttachment],
    });
    goodsReceiptItems.push({
      part_number: order.part_number as string,
      order_index: index,
      qty_received: item.qty_received,
      photos: [photoAttachment],
      capture_meta: sanitizeCaptureMeta(photo.meta) ?? undefined,
    });
  }

  if (receiptEntries.length === 0) {
    return { success: false, message: "Isi qty minimal satu barang yang diterima." };
  }

  try {
    await confirmRequesterReceipt({
      mrId: po.mr_id,
      entries: receiptEntries,
      actor: { id: actorUserId, name: receiverName },
      via: "scan_qr",
      preferPoId: po.id,
      client: admin as any,
    });
  } catch (err: any) {
    return { success: false, message: err.message };
  }

  const goodsReceipt: GoodsReceipt = {
    receiver_name: receiverName,
    confirmed_at: new Date().toISOString(),
    confirmed_via: confirmedVia,
    confirmed_by_user_id: actorUserId,
    items: goodsReceiptItems,
  };

  const { error: updateError } = await admin
    .from("purchase_orders")
    .update({ goods_receipt: goodsReceipt })
    .eq("id", po.id);
  if (updateError) {
    return {
      success: false,
      message: "Gagal menyimpan konfirmasi: " + updateError.message,
    };
  }

  const via = confirmedVia === "login" ? "login" : "scan QR (kode global)";
  const description = `${receiverName} (${via}) mengonfirmasi penerimaan barang untuk PO ${po.kode_po}`;
  const metadata = {
    items: goodsReceiptItems.map((i) => ({
      part_number: i.part_number,
      qty_received: i.qty_received,
      capture_meta: i.capture_meta,
    })),
    confirmed_via: confirmedVia,
  };
  await logGoodsReceiptActivity(
    admin,
    actorUserId,
    "purchase_order",
    String(po.id),
    description,
    metadata,
  );
  await logGoodsReceiptActivity(
    admin,
    actorUserId,
    "material_request",
    String(po.mr_id),
    description,
    { ...metadata, po_id: po.id },
  );

  return { success: true };
}
