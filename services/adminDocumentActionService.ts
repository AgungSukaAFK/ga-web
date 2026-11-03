// src/services/adminDocumentActionService.ts
//
// Aksi Admin dokumen MR & PO (tombol "Aksi Admin" di MR Management & PO
// Management): Batalkan MR, Batalkan PO, Buka Kembali MR, Buka Kembali PO.
// Dulu admin membatalkan dokumen dengan mengubah approval/status manual jadi
// "Rejected" - dibatasi banyak aturan (lihat adminApprovalOverrideService.ts)
// dan item MR-nya tidak ikut dilepas. Di sini admin cukup memilih aksi:
//
//  1. preview*  - baca data terbaru, hitung semua efek lanjutan (PO yang ikut
//     batal, item MR yang balik ke "Menunggu PO", budget) + syarat yang
//     belum terpenuhi (`blockers`). Tidak menulis apa pun.
//  2. runAdminDocumentAction - tulis hasil preview lewat RPC
//     admin_apply_document_action (supabase/migrations/0018_admin_document_actions.sql)
//     dalam SATU transaksi. RPC menolak kalau dokumennya berubah sejak
//     preview, dan mengecek ulang aturan pembatalan di server. Setelahnya:
//     hitung ulang status/level MR, catat log, kirim notifikasi.
//
// Aturan:
//  - Barang yang sudah diterima (receive record/BAST, item MR "Diterima GA"
//    ke atas, atau dipenuhi Stok GA) tidak bisa dibatalkan.
//  - PO yang sudah dibayar boleh dibatalkan dengan catatan refund (wajib).
//  - Batalkan MR = semua PO aktifnya ikut dibatalkan, semua item "Cancelled",
//    budget cost center dikembalikan (trigger handle_mr_budget_deduction).
//  - Batalkan PO = item MR yang tidak lagi penuh ter-cover PO aktif lain
//    balik ke "Menunggu PO" (Open 2) supaya bisa di-PO ulang.
//  - Buka Kembali MR = balik ke status sebelum dibatalkan (MR yang dulu
//    sudah lewat approval balik ke "Waiting PO" - budget dipotong lagi). PO
//    yang ikut dibatalkan TIDAK ikut dibuka.
//  - Buka Kembali PO = jalur approval & pembayaran diulang dari awal.
//  - Tutup Sisa PO (PO yang baru diterima sebagian) = sisa barangnya tidak
//    akan dikirim: PO jadi "Full Received" dengan qty yang sudah diterima,
//    sisanya di MR dipesan ulang (balik ke "Menunggu PO") ATAU ikut ditutup
//    (qty item MR disesuaikan ke yang diterima, budget sisanya dikembalikan).
//  - Tutup Sisa MR = semua yang belum diterima ditutup: PO yang belum
//    diterima sama sekali dibatalkan, PO yang baru diterima sebagian ditutup
//    sisanya, qty item MR disesuaikan ke yang diterima (belum diterima sama
//    sekali = Cancelled), budget sisanya dikembalikan.
//  - Reset Approval ke Step / Approve sampai Step (MR & PO) = shortcut form
//    approval admin - divalidasi & diproses persis sama
//    (planAdmin*ApprovalUpdate / applyAdmin*ApprovalEffects).
//  - Batalkan Status Bayar (PO belum diterima) = step Payment Validator dst.
//    balik pending, DP/Pelunasan belum lunas, item "Dikirim Vendor" balik
//    "Processing".
//  - Batalkan Penerimaan (PO yang barangnya belum dikirim ke requester) =
//    checklist penerimaan dihapus, step Receiver dst. balik pending, item MR
//    balik ke status sebelum diterima.

import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  Order,
  POItem,
  PoClosedRemainder,
  PoClosedRemainderItem,
  ReceiveRecord,
  StoredVendorDetails,
} from "@/type";
import {
  DOC_STATUS_CANCELLED,
  INACTIVE_DOC_STATUSES,
  APPROVAL_TYPE_RECEIVER,
  MR_ITEM_STATUSES,
  PO_STATUS_FULL_RECEIVED,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_PENDING_RECEIVE,
  getApprovedReceiverStep,
  isPaymentValidatorApproval,
  isPoPaid,
} from "@/type/enum";
import {
  MR_PRE_PO_STATUSES,
  deriveApprovalOutcome,
  deriveMrStatus,
  getCurrentTurnIndex,
} from "@/lib/approvalOverride";
import { formatCurrency } from "@/lib/utils";
import {
  NotificationEventType,
  getGAAndFinanceUserIds,
  getGAUserIds,
  sendNotifications,
} from "@/lib/notifications/client";
import {
  normalizeMrOrders,
  recalculateMrLevel,
  recalculateMrStatus,
} from "./mrService";
import {
  PO_ELIGIBLE_MR_STATUSES,
  PoForBreakdown,
  buildPoQtyBreakdown,
} from "./purchaseOrderService";
import { logActivity } from "./logService";
import {
  AdminApprovalPlan,
  AdminPoApprovalPlan,
  applyAdminMrApprovalEffects,
  applyAdminPoApprovalEffects,
  derivePoStatusFromApprovals,
  planAdminMrApprovalUpdate,
  planAdminPoApprovalUpdate,
} from "./adminApprovalOverrideService";

const supabase = createClient();

export type AdminDocumentAction =
  | "cancel_mr"
  | "cancel_po"
  | "reopen_mr"
  | "reopen_po"
  | "close_po_remainder"
  | "close_mr_remainder"
  | "reset_mr_approval"
  | "reset_po_approval"
  | "force_mr_approval"
  | "force_po_approval"
  | "unpay_po"
  | "unreceive_po";

/** Tutup Sisa PO: sisa barang di MR dipesan ulang atau ikut ditutup. */
export type CloseRemainderMrMode = PoClosedRemainder["mr_mode"];

export interface AdminActionOptions {
  mrMode?: CloseRemainderMrMode;
  /** Reset / Approve: step tujuan (index approvals). */
  stepIndex?: number;
}

export interface AdminActionStepOption {
  index: number;
  label: string;
}

export interface AdminActionPoSummary {
  id: number;
  kode_po: string;
  status: string;
  /** Nilai yang dibatalkan: total PO, atau nilai sisa yang ditutup. */
  total_price: number;
  paid: boolean;
  /** true = sisanya ditutup (Tutup Sisa), false = PO dibatalkan. */
  closing: boolean;
}

export interface AdminActionPreview {
  action: AdminDocumentAction;
  /** Kode dokumen yang dikenai aksi (MR atau PO). */
  kode: string;
  /** Tidak kosong = aksi tidak bisa dijalankan. */
  blockers: string[];
  warnings: string[];
  /** Ringkasan efek yang akan terjadi, siap tampil. */
  effects: string[];
  /** PO yang dibatalkan / ditutup sisanya oleh aksi ini. */
  cancelledPos: AdminActionPoSummary[];
  /** Reset / Approve: pilihan step tujuan + yang sedang dipakai preview. */
  steps?: AdminActionStepOption[];
  stepIndex?: number;
  /** Hasil hitungan yang dikirim ke RPC - jangan diubah di UI. */
  commit: CommitPlan;
}

interface CommitPlan {
  mr: {
    id: number;
    kode_mr: string;
    userid: string;
    company_code: string;
    approvals: Approval[];
    expected_status: string;
    expected_orders: unknown;
    status: string;
    orders?: Order[];
    /** Index order -> awal catatan item (alasan ditempel saat dijalankan). */
    orderNotes?: Record<number, string>;
    /** Tutup Sisa: budget yang dikembalikan (estimasi qty yang ditutup). */
    budget_refund?: number;
  } | null;
  pos: {
    id: number;
    kode_po: string;
    user_id: string;
    company_code: string;
    approvals: Approval[];
    paid: boolean;
    expected_status: string;
    status: string;
    approvals_next?: Approval[];
    dp_paid?: boolean;
    bp_paid?: boolean;
    closed_remainder?: Pick<PoClosedRemainder, "items" | "closed_value" | "mr_mode" | "closed_by_name">;
    /** null = checklist penerimaan dihapus (Batalkan Penerimaan). */
    receive_record?: ReceiveRecord | null;
    full_received_at?: string | null;
  }[];
  /** Reset / Approve: disimpan lewat jalur form approval admin, bukan RPC. */
  approval?: ApprovalShortcutCommit;
}

type ApprovalShortcutCommit = { id: number; kode: string; creatorId: string } & (
  | { docType: "mr"; plan: AdminApprovalPlan<Approval> }
  | { docType: "po"; plan: AdminPoApprovalPlan }
);

// ==========================================
// DATA
// ==========================================

interface MrRow {
  id: number;
  kode_mr: string;
  status: string;
  orders: unknown;
  approvals: Approval[] | null;
  userid: string;
  company_code: string;
  cost_center_id: number | null;
  cost_estimation: string | null;
  cancelled_from_status: string | null;
  cancel_reason: string | null;
}

interface PoRow {
  id: number;
  kode_po: string;
  mr_id: number | null;
  status: string;
  items: POItem[] | null;
  approvals: Approval[] | null;
  dp_paid: boolean;
  bp_paid: boolean;
  receive_record: ReceiveRecord | null;
  goods_receipt: unknown;
  user_id: string;
  company_code: string;
  total_price: number;
  cancel_reason: string | null;
  refund_note: string | null;
  closed_remainder: PoClosedRemainder | null;
  vendor_details: StoredVendorDetails | null;
}

const MR_COLUMNS =
  "id, kode_mr, status, orders, approvals, userid, company_code, cost_center_id, cost_estimation, cancelled_from_status, cancel_reason";
const PO_COLUMNS =
  "id, kode_po, mr_id, status, items, approvals, dp_paid, bp_paid, receive_record, goods_receipt, user_id, company_code, total_price, cancel_reason, refund_note, closed_remainder, vendor_details";

const fetchMr = async (mrId: number): Promise<MrRow> => {
  const { data, error } = await supabase
    .from("material_requests")
    .select(MR_COLUMNS)
    .eq("id", mrId)
    .single();
  if (error || !data) throw new Error("Gagal mengambil data MR terbaru.");
  return data as MrRow;
};

const fetchPo = async (poId: number): Promise<PoRow> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(PO_COLUMNS)
    .eq("id", poId)
    .single();
  if (error || !data) throw new Error("Gagal mengambil data PO terbaru.");
  return data as PoRow;
};

const fetchPosOfMr = async (mrId: number): Promise<PoRow[]> => {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(PO_COLUMNS)
    .eq("mr_id", mrId)
    .order("id", { ascending: true });
  if (error) throw new Error("Gagal mengambil data PO milik MR ini.");
  return (data as PoRow[]) || [];
};

// ==========================================
// ATURAN BERSAMA
// ==========================================

// Item MR yang barangnya sudah fisik diterima (GA/requester) - tidak bisa
// dibatalkan / dilepas dari PO-nya.
const RECEIVED_ITEM_STATUSES = new Set<string>([
  MR_ITEM_STATUSES.DITERIMA_GA,
  MR_ITEM_STATUSES.ON_DELIVERY,
  MR_ITEM_STATUSES.PENDING_BAST,
  MR_ITEM_STATUSES.COMPLETED,
]);

// Item yang sudah tidak dihitung lagi (tidak disentuh aksi apa pun).
const CLOSED_ITEM_STATUSES = new Set<string>([
  MR_ITEM_STATUSES.CANCELLED,
  MR_ITEM_STATUSES.REPLACED,
]);

const isActivePo = (po: Pick<PoRow, "status">) =>
  !INACTIVE_DOC_STATUSES.includes(po.status);

const isPoReceived = (po: PoRow) =>
  !!po.receive_record ||
  !!po.goods_receipt ||
  !!getApprovedReceiverStep(po.approvals) ||
  po.status === PO_STATUS_PARTIAL_RECEIVE ||
  po.status === PO_STATUS_FULL_RECEIVED;

const isPoPaidOrPartlyPaid = (po: PoRow) =>
  po.dp_paid || po.bp_paid || isPoPaid(po.approvals);

const toBreakdownPo = (po: PoRow): PoForBreakdown => ({
  id: po.id,
  kode_po: po.kode_po,
  status: po.status,
  items: po.items,
  closed_remainder: po.closed_remainder,
});

const approvedUserIds = (approvals: Approval[] | null | undefined) =>
  (approvals ?? []).filter((a) => a.status === "approved").map((a) => a.userid);

const stockQty = (order: Order) =>
  (order.stock_fulfillments || []).reduce((sum, f) => sum + (Number(f.qty) || 0), 0);

// Qty tiap baris order MR yang ter-cover PO (`pos`) + Stok GA. Baris
// duplikat (part_number sama 2x) berbagi bucket breakdown yang sama - sama
// seperti cara halaman MR menghitungnya.
const coveredQtyByIndex = (orders: Order[], pos: PoForBreakdown[]) => {
  const breakdown = buildPoQtyBreakdown(pos, orders);
  return orders.map((order) => {
    const fromPo = order.part_number
      ? (breakdown[order.part_number] || []).reduce(
          (sum, e) => sum + (Number(e.qty) || 0),
          0,
        )
      : 0;
    return fromPo + stockQty(order);
  });
};

const toPoSummary = (po: PoRow): AdminActionPoSummary => ({
  id: po.id,
  kode_po: po.kode_po,
  status: po.status,
  total_price: Number(po.total_price) || 0,
  paid: isPoPaidOrPartlyPaid(po),
  closing: false,
});

const describePo = (po: PoRow) =>
  `${po.kode_po} (${po.status}${isPoPaidOrPartlyPaid(po) ? ", sudah dibayar" : ""})`;

/**
 * Lepas item MR dari PO yang dibatalkan: link manual ke PO itu dihapus
 * (po_refs tetap sebagai riwayat - badge-nya ikut berwarna "Cancelled"),
 * lalu item yang qty-nya tidak lagi penuh ter-cover PO aktif lain + Stok GA
 * balik ke "Menunggu PO" (Open 2) supaya bisa di-PO ulang.
 */
const releaseMrItems = (
  orders: Order[],
  cancelledCodes: Set<string>,
  activePosBefore: PoForBreakdown[],
  activePosAfter: PoForBreakdown[],
) => {
  const coveredBefore = coveredQtyByIndex(orders, activePosBefore);
  const stripped = orders.map((order) =>
    Array.isArray(order.manual_po_links) &&
    order.manual_po_links.some((l) => cancelledCodes.has(l.kode_po))
      ? {
          ...order,
          manual_po_links: order.manual_po_links.filter(
            (l) => !cancelledCodes.has(l.kode_po),
          ),
        }
      : order,
  );
  const coveredAfter = coveredQtyByIndex(stripped, activePosAfter);
  const releasedNames: string[] = [];

  const next = stripped.map((order, i) => {
    if (coveredAfter[i] === coveredBefore[i]) return order;
    if (CLOSED_ITEM_STATUSES.has(order.status || "")) return order;
    if (RECEIVED_ITEM_STATUSES.has(order.status || "")) return order;
    if (coveredAfter[i] >= Number(order.qty)) return order;
    releasedNames.push(order.name);
    const { payment_issue_note: _drop, ...rest } = order;
    return {
      ...rest,
      status: coveredAfter[i] > 0 ? MR_ITEM_STATUSES.PROCESSING : MR_ITEM_STATUSES.PENDING,
      level: "Open 2" as const,
    };
  });

  return { orders: next, releasedNames };
};

// Status MR setelah PO-nya dibatalkan. Tidak ada PO aktif lagi = balik ke
// "Waiting PO"; masih ada tapi belum semua item ter-cover = "On Process"
// (keduanya masih bisa dibuatkan PO, lihat PO_ELIGIBLE_MR_STATUSES).
// Selebihnya dirapikan recalculateMrStatus setelah simpan.
const mrStatusAfterRelease = (
  status: string,
  hasActivePo: boolean,
  releasedCount: number,
) => {
  if ((MR_PRE_PO_STATUSES as readonly string[]).includes(status)) return status;
  if (status === DOC_STATUS_CANCELLED) return status;
  if (!hasActivePo) return "Waiting PO";
  if (releasedCount > 0 && status !== "Waiting PO") return "On Process";
  return status;
};

// Qty tiap baris order MR yang SUDAH diterima: receive_record semua PO
// aktif + Stok GA, termasuk PO yang masih pakai part_number lama (Konversi
// Barang) - sama seperti fetchReceivedQtyByPartNumber.
const receivedQtyByIndex = (orders: Order[], pos: PoRow[]) => {
  const totals: Record<string, number> = {};
  for (const po of pos) {
    for (const item of po.receive_record?.items || []) {
      if (!item.part_number) continue;
      totals[item.part_number] = (totals[item.part_number] || 0) + (item.received_qty || 0);
    }
  }
  return orders.map((order) => {
    if (!order.part_number) return stockQty(order);
    let received = totals[order.part_number] || 0;
    for (const c of order.conversion_history || []) {
      if (c.from_part_number && c.from_part_number !== order.part_number) {
        received += totals[c.from_part_number] || 0;
      }
    }
    return received + stockQty(order);
  });
};

// Part number PO yang dihitung ke item MR ini (sekarang + identitas lama).
const orderPartNumbers = (order: Order) =>
  new Set(
    [order.part_number, ...(order.conversion_history || []).map((c) => c.from_part_number)].filter(
      Boolean,
    ) as string[],
  );

// Status item MR yang qty-nya sudah penuh diterima - sama seperti
// submitReceiveRecord (vendor Site langsung "Pending BAST").
const receivedItemStatus = (order: Order, pos: PoRow[]) => {
  const pns = orderPartNumbers(order);
  const po = pos.find((p) => (p.receive_record?.items || []).some((i) => pns.has(i.part_number)));
  return po?.vendor_details?.tipe_vendor === "Site"
    ? MR_ITEM_STATUSES.PENDING_BAST
    : MR_ITEM_STATUSES.DITERIMA_GA;
};

const isPoFullyReceived = (po: PoRow) =>
  po.status === PO_STATUS_FULL_RECEIVED || !!po.receive_record?.is_full_match;

/**
 * Hitung penutupan sisa satu PO dari receive_record-nya: barang yang qty
 * diterimanya kurang dari pesanan, checklist baru (ordered = received ->
 * full match), dan status PO berikutnya (Partial Receive -> Full Received;
 * "Pending Payment" tetap, nanti lunas langsung Full Received).
 */
const planPoClose = (po: PoRow, mrMode: CloseRemainderMrMode, actorName: string) => {
  const record = po.receive_record!;
  const priceByPn = new Map((po.items || []).map((i) => [i.part_number, Number(i.price) || 0]));
  const items: PoClosedRemainderItem[] = record.items
    .filter((i) => (i.received_qty || 0) < i.ordered_qty)
    .map((i) => ({
      part_number: i.part_number,
      name: i.part_name,
      ordered_qty: i.ordered_qty,
      received_qty: i.received_qty || 0,
      closed_qty: i.ordered_qty - (i.received_qty || 0),
      price: priceByPn.get(i.part_number) ?? 0,
    }));
  const closedValue = items.reduce((sum, i) => sum + i.closed_qty * i.price, 0);
  const status =
    po.status === PO_STATUS_PARTIAL_RECEIVE ? PO_STATUS_FULL_RECEIVED : po.status;
  const commit = poCommit(po, {
    status,
    closed_remainder: { items, closed_value: closedValue, mr_mode: mrMode, closed_by_name: actorName },
    receive_record: {
      ...record,
      items: record.items.map((i) => ({ ...i, ordered_qty: i.received_qty || 0 })),
      is_full_match: true,
    },
    ...(status === PO_STATUS_FULL_RECEIVED ? { full_received_at: new Date().toISOString() } : {}),
  });
  const summary: AdminActionPoSummary = {
    ...toPoSummary(po),
    total_price: closedValue,
    closing: true,
  };
  const breakdownAfter: PoForBreakdown = {
    ...toBreakdownPo(po),
    closed_remainder: { items } as PoClosedRemainder,
  };
  return { items, closedValue, status, commit, summary, breakdownAfter };
};

const describeClosedItems = (items: PoClosedRemainderItem[]) =>
  items.map((i) => `${i.name} (${i.closed_qty} dari ${i.ordered_qty})`).join(", ");

const closeNote = (order: Order, nextQty: number) =>
  nextQty > 0
    ? `Sisa ditutup admin (qty ${order.qty_before_close ?? order.qty} -> ${nextQty})`
    : "Sisa ditutup admin (belum ada yang diterima)";

const emptyPreview = (
  action: AdminDocumentAction,
  kode: string,
): AdminActionPreview => ({
  action,
  kode,
  blockers: [],
  warnings: [],
  effects: [],
  cancelledPos: [],
  commit: { mr: null, pos: [] },
});


const mrCommit = (
  mr: MrRow,
  next: { status: string; orders?: Order[] },
): NonNullable<CommitPlan["mr"]> => ({
  id: mr.id,
  kode_mr: mr.kode_mr,
  userid: mr.userid,
  company_code: mr.company_code,
  approvals: mr.approvals ?? [],
  expected_status: mr.status,
  expected_orders: mr.orders ?? null,
  ...next,
});

const poCommit = (
  po: PoRow,
  next: Pick<CommitPlan["pos"][number], "status"> &
    Partial<
      Pick<
        CommitPlan["pos"][number],
        | "approvals_next"
        | "dp_paid"
        | "bp_paid"
        | "closed_remainder"
        | "receive_record"
        | "full_received_at"
      >
    >,
): CommitPlan["pos"][number] => ({
  id: po.id,
  kode_po: po.kode_po,
  user_id: po.user_id,
  company_code: po.company_code,
  approvals: po.approvals ?? [],
  paid: isPoPaidOrPartlyPaid(po),
  expected_status: po.status,
  ...next,
});

// ==========================================
// PREVIEW
// ==========================================

export const previewCancelMr = async (mrId: number): Promise<AdminActionPreview> => {
  const [mr, pos] = await Promise.all([fetchMr(mrId), fetchPosOfMr(mrId)]);
  const preview = emptyPreview("cancel_mr", mr.kode_mr);
  if (mr.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("MR ini sudah dibatalkan.");
    return preview;
  }

  const orders = normalizeMrOrders(mr.orders as any[]);
  const receivedItems = orders.filter(
    (o) =>
      !CLOSED_ITEM_STATUSES.has(o.status || "") &&
      (RECEIVED_ITEM_STATUSES.has(o.status || "") || stockQty(o) > 0),
  );
  if (receivedItems.length) {
    preview.blockers.push(
      `Barang sudah diterima / dipenuhi Stok GA: ${receivedItems.map((o) => o.name).join(", ")}. MR yang barangnya sudah diterima tidak bisa dibatalkan.`,
    );
  }

  const activePos = pos.filter(isActivePo);
  const receivedPos = activePos.filter(isPoReceived);
  if (receivedPos.length) {
    preview.blockers.push(
      `Barang PO ${receivedPos.map((p) => p.kode_po).join(", ")} sudah dicatat diterima - MR tidak bisa dibatalkan.`,
    );
  }

  const nextOrders = orders.map((o) =>
    CLOSED_ITEM_STATUSES.has(o.status || "")
      ? o
      : {
          ...o,
          status: MR_ITEM_STATUSES.CANCELLED,
          cancelled_with_mr: true,
        },
  );
  const cancelledItemCount = nextOrders.filter((o) => o.cancelled_with_mr).length;

  preview.cancelledPos = activePos.map(toPoSummary);
  preview.commit = {
    mr: mrCommit(mr, { status: DOC_STATUS_CANCELLED, orders: nextOrders }),
    pos: activePos.map((po) => poCommit(po, { status: DOC_STATUS_CANCELLED })),
  };

  preview.effects.push(`Status MR ${mr.status} -> ${DOC_STATUS_CANCELLED}.`);
  if (cancelledItemCount) {
    preview.effects.push(`${cancelledItemCount} item MR jadi "Cancelled".`);
  }
  if (activePos.length) {
    preview.effects.push(
      `PO ikut dibatalkan: ${activePos.map(describePo).join(", ")}.`,
    );
  }

  const refund = await fetchNetBudgetDeduction(mr.id);
  if (refund > 0) {
    preview.effects.push(
      `Budget cost center dikembalikan ${formatCurrency(refund)}.`,
    );
  }
  if (preview.cancelledPos.some((p) => p.paid)) {
    preview.warnings.push(
      "Ada PO yang sudah dibayar - isi catatan refund untuk tiap PO tersebut.",
    );
  }
  return preview;
};

export const previewCancelPo = async (poId: number): Promise<AdminActionPreview> => {
  const po = await fetchPo(poId);
  const preview = emptyPreview("cancel_po", po.kode_po);
  if (po.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("PO ini sudah dibatalkan.");
    return preview;
  }
  if (isPoReceived(po)) {
    preview.blockers.push(
      "Barang PO ini sudah dicatat diterima - PO tidak bisa dibatalkan.",
    );
  }

  preview.cancelledPos = [toPoSummary(po)];
  preview.effects.push(`Status PO ${po.status} -> ${DOC_STATUS_CANCELLED}.`);
  if (isPoPaidOrPartlyPaid(po)) {
    preview.warnings.push(
      "PO ini sudah dibayar (sebagian/penuh) - catatan refund wajib diisi.",
    );
  }

  let mrPlan: CommitPlan["mr"] = null;
  if (po.mr_id) {
    const [mr, pos] = await Promise.all([fetchMr(po.mr_id), fetchPosOfMr(po.mr_id)]);
    if (mr.status !== DOC_STATUS_CANCELLED) {
      const activeBefore = pos.filter(isActivePo).map(toBreakdownPo);
      const activeAfter = activeBefore.filter((p) => p.id !== po.id);
      const { orders, releasedNames } = releaseMrItems(
        normalizeMrOrders(mr.orders as any[]),
        new Set([po.kode_po]),
        activeBefore,
        activeAfter,
      );
      const status = mrStatusAfterRelease(
        mr.status,
        activeAfter.length > 0,
        releasedNames.length,
      );
      mrPlan = mrCommit(mr, { status, orders });
      if (releasedNames.length) {
        preview.effects.push(
          `Item MR ${mr.kode_mr} balik ke "Menunggu PO": ${releasedNames.join(", ")}.`,
        );
      }
      if (status !== mr.status) {
        preview.effects.push(`Status MR ${mr.kode_mr} ${mr.status} -> ${status}.`);
      }
    }
  }

  preview.commit = {
    mr: mrPlan,
    pos: [poCommit(po, { status: DOC_STATUS_CANCELLED })],
  };
  return preview;
};

// Status MR saat dibuka kembali. MR yang dulu dibatalkan setelah lewat
// approval (Waiting PO ke atas) balik ke "Waiting PO" - PO-nya sudah ikut
// dibatalkan, jadi mulai lagi dari pembuatan PO.
const mrReopenStatus = (mr: MrRow) => {
  const from = mr.cancelled_from_status;
  if (from && (MR_PRE_PO_STATUSES as readonly string[]).includes(from)) return from;
  if (from) return "Waiting PO";
  return deriveMrStatus(deriveApprovalOutcome(mr.approvals)) ?? "Pending Validation";
};

export const previewReopenMr = async (mrId: number): Promise<AdminActionPreview> => {
  const mr = await fetchMr(mrId);
  const preview = emptyPreview("reopen_mr", mr.kode_mr);
  if (mr.status !== DOC_STATUS_CANCELLED) {
    preview.blockers.push("Hanya MR yang berstatus Cancelled yang bisa dibuka kembali.");
    return preview;
  }

  const status = mrReopenStatus(mr);
  const itemLevel: Order["level"] = status === "Waiting PO" ? "Open 2" : "Open 1";
  const current = normalizeMrOrders(mr.orders as any[]);
  const restored = current.filter((o) => o.cancelled_with_mr).length;
  const orders = current.map((o) => {
    if (!o.cancelled_with_mr) return o;
    const { cancelled_with_mr: _drop, ...rest } = o;
    return { ...rest, status: MR_ITEM_STATUSES.PENDING, status_note: "", level: itemLevel };
  });

  preview.commit = { mr: mrCommit(mr, { status, orders }), pos: [] };
  preview.effects.push(`Status MR ${DOC_STATUS_CANCELLED} -> ${status}.`);
  if (restored) preview.effects.push(`${restored} item MR aktif lagi ("Menunggu").`);
  if (mr.cancel_reason) {
    preview.warnings.push(`Alasan pembatalan dulu: ${mr.cancel_reason}`);
  }
  if (status === "Waiting PO") {
    const estimation = Number(mr.cost_estimation) || 0;
    if (mr.cost_center_id && estimation > 0) {
      preview.effects.push(
        `Budget cost center dipotong lagi ${formatCurrency(estimation)}.`,
      );
    }
  }
  const { data: cancelledPos } = await supabase
    .from("purchase_orders")
    .select("kode_po")
    .eq("mr_id", mr.id)
    .eq("status", DOC_STATUS_CANCELLED);
  if (cancelledPos?.length) {
    preview.warnings.push(
      `PO yang dulu ikut dibatalkan (${cancelledPos.map((p) => p.kode_po).join(", ")}) tetap Cancelled - buka satu per satu dari PO Management kalau masih dipakai.`,
    );
  }
  return preview;
};

export const previewReopenPo = async (poId: number): Promise<AdminActionPreview> => {
  const po = await fetchPo(poId);
  const preview = emptyPreview("reopen_po", po.kode_po);
  if (po.status !== DOC_STATUS_CANCELLED) {
    preview.blockers.push("Hanya PO yang berstatus Cancelled yang bisa dibuka kembali.");
    return preview;
  }

  const approvals = (po.approvals ?? []).map((a) => ({
    ...a,
    status: "pending" as const,
    processed_at: null,
  }));
  const status = approvals.length ? "Pending Approval" : "Pending Validation";

  let mrPlan: CommitPlan["mr"] = null;
  if (po.mr_id) {
    const [mr, pos] = await Promise.all([fetchMr(po.mr_id), fetchPosOfMr(po.mr_id)]);
    if (!PO_ELIGIBLE_MR_STATUSES.includes(mr.status)) {
      preview.blockers.push(
        mr.status === DOC_STATUS_CANCELLED
          ? `MR ${mr.kode_mr} masih Cancelled - buka kembali MR-nya dulu.`
          : `MR ${mr.kode_mr} berstatus "${mr.status}" - belum/tidak bisa dibuatkan PO.`,
      );
    } else {
      const orders = normalizeMrOrders(mr.orders as any[]);
      const activeOthers = pos.filter((p) => isActivePo(p) && p.id !== po.id).map(toBreakdownPo);
      const withThis = [...activeOthers, toBreakdownPo(po)];
      const coveredWithout = coveredQtyByIndex(orders, activeOthers);
      const coveredWith = coveredQtyByIndex(orders, withThis);

      const conflicts: string[] = [];
      const nextOrders = orders.map((order, i) => {
        if (coveredWith[i] === coveredWithout[i]) return order;
        if (CLOSED_ITEM_STATUSES.has(order.status || "")) {
          conflicts.push(`${order.name} (item sudah ${order.status})`);
          return order;
        }
        if (coveredWith[i] > Number(order.qty)) {
          conflicts.push(`${order.name} (qty sudah ter-cover PO lain / Stok GA)`);
          return order;
        }
        if (RECEIVED_ITEM_STATUSES.has(order.status || "")) return order;
        const refs = order.po_refs || [];
        return {
          ...order,
          status: MR_ITEM_STATUSES.PROCESSING,
          po_refs: refs.includes(po.kode_po) ? refs : [...refs, po.kode_po],
          level:
            coveredWith[i] >= Number(order.qty) && order.level !== "Open 3B"
              ? ("Open 3A" as const)
              : order.level,
        };
      });
      if (conflicts.length) {
        preview.blockers.push(
          `Barang PO ini sudah tidak bisa dipakai lagi: ${conflicts.join(", ")}.`,
        );
      }
      mrPlan = mrCommit(mr, { status: mr.status, orders: nextOrders });
      preview.effects.push(`Item MR ${mr.kode_mr} ditautkan lagi ke PO ini.`);

      // Link manual (barang substitusi) dihapus saat PO dibatalkan - barang
      // yang part_number-nya tidak cocok ke item MR mana pun tidak ikut
      // tertaut otomatis.
      const knownPartNumbers = new Set(
        orders.flatMap((o) => [
          o.part_number,
          ...(o.conversion_history || []).map((c) => c.from_part_number),
        ]),
      );
      const unmatched = (po.items || []).filter(
        (i) => i.part_number && !knownPartNumbers.has(i.part_number),
      );
      if (unmatched.length) {
        preview.warnings.push(
          `Barang PO ini tidak cocok otomatis ke item MR: ${unmatched.map((i) => i.name).join(", ")}. Tautkan ulang lewat "Link manual ke PO" di halaman MR.`,
        );
      }
    }
  }

  preview.commit = {
    mr: mrPlan,
    pos: [
      poCommit(po, { status, approvals_next: approvals, dp_paid: false, bp_paid: false }),
    ],
  };
  preview.effects.push(`Status PO ${DOC_STATUS_CANCELLED} -> ${status}.`);
  if (approvals.length) {
    preview.effects.push("Jalur approval diulang dari step pertama.");
  }
  if (po.dp_paid || po.bp_paid) {
    preview.effects.push("Status pembayaran DP/Pelunasan di-reset ke belum lunas.");
  }
  if (po.refund_note) {
    preview.warnings.push(`Catatan refund saat dibatalkan: ${po.refund_note}`);
  }
  if (po.cancel_reason) {
    preview.warnings.push(`Alasan pembatalan dulu: ${po.cancel_reason}`);
  }
  return preview;
};

export const previewClosePoRemainder = async (
  poId: number,
  mrMode: CloseRemainderMrMode,
  actorName: string,
): Promise<AdminActionPreview> => {
  const po = await fetchPo(poId);
  const preview = emptyPreview("close_po_remainder", po.kode_po);
  if (po.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("PO ini sudah dibatalkan.");
    return preview;
  }
  if (po.closed_remainder) {
    preview.blockers.push("Sisa PO ini sudah pernah ditutup.");
    return preview;
  }
  if (!po.receive_record) {
    preview.blockers.push(
      'Belum ada barang PO ini yang diterima - pakai "Batalkan PO" kalau seluruhnya tidak jadi.',
    );
    return preview;
  }
  if (isPoFullyReceived(po)) {
    preview.blockers.push("Barang PO ini sudah diterima penuh - tidak ada sisa untuk ditutup.");
    return preview;
  }

  const close = planPoClose(po, mrMode, actorName);
  if (!close.items.length) {
    preview.blockers.push("Tidak ada sisa barang yang belum diterima.");
    return preview;
  }
  preview.cancelledPos = [close.summary];
  preview.effects.push(
    `Sisa barang tidak dikirim: ${describeClosedItems(close.items)} - senilai ${formatCurrency(close.closedValue)}.`,
  );
  if (close.status !== po.status) {
    preview.effects.push(`Status PO ${po.status} -> ${close.status}.`);
  }
  preview.effects.push("Checklist penerimaan PO ini dikunci.");
  if (close.summary.paid) {
    preview.warnings.push(
      "PO ini sudah dibayar - isi catatan refund / penyesuaian tagihan untuk sisa yang ditutup.",
    );
  }

  let mrPlan: CommitPlan["mr"] = null;
  if (po.mr_id) {
    const [mr, pos] = await Promise.all([fetchMr(po.mr_id), fetchPosOfMr(po.mr_id)]);
    if (mr.status !== DOC_STATUS_CANCELLED) {
      const active = pos.filter(isActivePo);
      const before = active.map(toBreakdownPo);
      const after = active.map((p) => (p.id === po.id ? close.breakdownAfter : toBreakdownPo(p)));
      const orders = normalizeMrOrders(mr.orders as any[]);

      if (mrMode === "reorder") {
        const released = releaseMrItems(orders, new Set(), before, after);
        const status = mrStatusAfterRelease(mr.status, true, released.releasedNames.length);
        mrPlan = mrCommit(mr, { status, orders: released.orders });
        if (released.releasedNames.length) {
          preview.effects.push(
            `Sisa item MR ${mr.kode_mr} balik ke "Menunggu PO" untuk dipesan ulang: ${released.releasedNames.join(", ")}.`,
          );
        }
        if (status !== mr.status) {
          preview.effects.push(`Status MR ${mr.kode_mr} ${mr.status} -> ${status}.`);
        }
      } else {
        const coveredBefore = coveredQtyByIndex(orders, before);
        const coveredAfter = coveredQtyByIndex(orders, after);
        const received = receivedQtyByIndex(orders, active);
        const orderNotes: Record<number, string> = {};
        const adjusted: string[] = [];
        let budget = 0;
        const nextOrders = orders.map((order, i) => {
          const qty = Number(order.qty) || 0;
          const reduction = Math.max(0, Math.min(coveredBefore[i], qty) - coveredAfter[i]);
          if (!reduction) return order;
          if (CLOSED_ITEM_STATUSES.has(order.status || "")) return order;
          if (RECEIVED_ITEM_STATUSES.has(order.status || "")) return order;
          const nextQty = qty - reduction;
          budget += reduction * (Number(order.estimasi_harga) || 0);
          orderNotes[i] = closeNote(order, nextQty);
          adjusted.push(`${order.name} (${qty} -> ${nextQty})`);
          if (nextQty <= 0) return { ...order, status: MR_ITEM_STATUSES.CANCELLED };
          const fullyReceived = received[i] >= nextQty;
          return {
            ...order,
            qty: String(nextQty),
            qty_before_close: order.qty_before_close ?? order.qty,
            ...(fullyReceived
              ? { status: receivedItemStatus(order, active), level: "Open 5" as const }
              : {}),
          };
        });
        mrPlan = {
          ...mrCommit(mr, { status: mr.status, orders: nextOrders }),
          orderNotes,
          budget_refund: budget,
        };
        if (adjusted.length) {
          preview.effects.push(
            `Qty item MR ${mr.kode_mr} disesuaikan ke yang diterima: ${adjusted.join(", ")}.`,
          );
        }
        await pushBudgetRefundEffect(preview, mr.id, budget);
      }

      const manual = orders.filter((o) =>
        (o.manual_po_links || []).some((l) => l.kode_po === po.kode_po),
      );
      if (manual.length) {
        preview.warnings.push(
          `Item MR tertaut manual ke PO ini (${manual.map((o) => o.name).join(", ")}) tidak ikut disesuaikan otomatis - cek qty link manualnya di halaman MR.`,
        );
      }
    }
  }

  preview.commit = { mr: mrPlan, pos: [close.commit] };
  return preview;
};

export const previewCloseMrRemainder = async (
  mrId: number,
  actorName: string,
): Promise<AdminActionPreview> => {
  const [mr, pos] = await Promise.all([fetchMr(mrId), fetchPosOfMr(mrId)]);
  const preview = emptyPreview("close_mr_remainder", mr.kode_mr);
  if (mr.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("MR ini sudah dibatalkan.");
    return preview;
  }
  if (!PO_ELIGIBLE_MR_STATUSES.includes(mr.status)) {
    preview.blockers.push(
      `MR berstatus "${mr.status}" - Tutup Sisa hanya untuk MR yang sedang diproses PO. MR yang belum masuk tahap PO dibatalkan lewat "Batalkan MR".`,
    );
    return preview;
  }

  const active = pos.filter(isActivePo);
  const toCancel: PoRow[] = [];
  const toClose: ReturnType<typeof planPoClose>[] = [];
  for (const po of active) {
    if (isPoFullyReceived(po)) continue;
    if (po.receive_record) {
      toClose.push(planPoClose(po, "close", actorName));
    } else if (isPoReceived(po)) {
      preview.blockers.push(
        `PO ${po.kode_po} tercatat diterima tapi tanpa checklist qty - isi checklist "Terima Barang"-nya dulu.`,
      );
    } else {
      toCancel.push(po);
    }
  }

  const cancelledCodes = new Set(toCancel.map((p) => p.kode_po));
  const orders = normalizeMrOrders(mr.orders as any[]).map((order) =>
    (order.manual_po_links || []).some((l) => cancelledCodes.has(l.kode_po))
      ? {
          ...order,
          manual_po_links: order.manual_po_links!.filter((l) => !cancelledCodes.has(l.kode_po)),
        }
      : order,
  );
  const closingCodes = new Set(toClose.map((c) => c.commit.kode_po));
  const manualToClosing = orders.filter((o) =>
    (o.manual_po_links || []).some((l) => closingCodes.has(l.kode_po)),
  );
  if (manualToClosing.length) {
    preview.warnings.push(
      `Item MR tertaut manual ke PO yang ditutup (${manualToClosing.map((o) => o.name).join(", ")}) - qty yang diterimanya tidak terbaca otomatis, cek hasilnya di halaman MR.`,
    );
  }

  const received = receivedQtyByIndex(orders, active);
  const orderNotes: Record<number, string> = {};
  const adjusted: string[] = [];
  const cancelledItems: string[] = [];
  let budget = 0;
  const nextOrders = orders.map((order, i) => {
    if (CLOSED_ITEM_STATUSES.has(order.status || "")) return order;
    if (RECEIVED_ITEM_STATUSES.has(order.status || "")) return order;
    const qty = Number(order.qty) || 0;
    const got = Math.min(received[i], qty);
    if (got >= qty) return order;
    budget += (qty - got) * (Number(order.estimasi_harga) || 0);
    orderNotes[i] = closeNote(order, got);
    if (got <= 0) {
      cancelledItems.push(order.name);
      return { ...order, status: MR_ITEM_STATUSES.CANCELLED };
    }
    adjusted.push(`${order.name} (${qty} -> ${got})`);
    return {
      ...order,
      qty: String(got),
      qty_before_close: order.qty_before_close ?? order.qty,
      status: receivedItemStatus(order, active),
      level: "Open 5" as const,
    };
  });

  const stillActive = nextOrders.filter((o) => !CLOSED_ITEM_STATUSES.has(o.status || ""));
  if (!adjusted.length && !cancelledItems.length && !toCancel.length && !toClose.length) {
    preview.blockers.push("Tidak ada sisa yang bisa ditutup - semua item sudah diterima.");
  } else if (!stillActive.length) {
    preview.blockers.push(
      'Belum ada barang MR ini yang diterima sama sekali - pakai "Batalkan MR" (budget dikembalikan penuh).',
    );
  }
  if (preview.blockers.length) return preview;

  const status = mr.status === "Waiting PO" ? "On Process" : mr.status;
  preview.commit = {
    mr: { ...mrCommit(mr, { status, orders: nextOrders }), orderNotes, budget_refund: budget },
    pos: [
      ...toClose.map((c) => c.commit),
      ...toCancel.map((po) => poCommit(po, { status: DOC_STATUS_CANCELLED })),
    ],
  };
  preview.cancelledPos = [...toClose.map((c) => c.summary), ...toCancel.map(toPoSummary)];

  if (adjusted.length) {
    preview.effects.push(`Qty item disesuaikan ke yang diterima: ${adjusted.join(", ")}.`);
  }
  if (cancelledItems.length) {
    preview.effects.push(`Item belum diterima sama sekali jadi "Cancelled": ${cancelledItems.join(", ")}.`);
  }
  for (const c of toClose) {
    preview.effects.push(
      `Sisa PO ${c.commit.kode_po} ditutup: ${describeClosedItems(c.items)} - senilai ${formatCurrency(c.closedValue)}${c.status !== c.commit.expected_status ? ` (status -> ${c.status})` : ""}.`,
    );
  }
  if (toCancel.length) {
    preview.effects.push(
      `PO yang belum diterima sama sekali dibatalkan: ${toCancel.map(describePo).join(", ")}.`,
    );
  }
  if (toCancel.some((p) => p.status === PO_STATUS_PENDING_RECEIVE)) {
    preview.warnings.push(
      "Ada PO berstatus Pending Receive (barang mungkin sedang dikirim vendor) yang ikut dibatalkan - pastikan vendor sudah dikabari.",
    );
  }
  if (preview.cancelledPos.some((p) => p.paid)) {
    preview.warnings.push(
      "Ada PO yang sudah dibayar - isi catatan refund / penyesuaian tagihan untuk tiap PO tersebut.",
    );
  }
  await pushBudgetRefundEffect(preview, mr.id, budget);
  return preview;
};

// Budget yang benar-benar dikembalikan RPC = estimasi qty yang ditutup,
// maksimal potongan bersih MR.
const pushBudgetRefundEffect = async (
  preview: AdminActionPreview,
  mrId: number,
  estimate: number,
) => {
  if (estimate <= 0) return;
  const net = await fetchNetBudgetDeduction(mrId);
  const refund = Math.min(estimate, net);
  if (refund > 0) {
    preview.effects.push(
      `Budget cost center dikembalikan ${formatCurrency(refund)} (estimasi harga qty yang ditutup).`,
    );
  }
};

// ==========================================
// FASE 3 - SHORTCUT APPROVAL & KOREKSI
// ==========================================

const approvalStepLabel = (a: Approval, i: number) =>
  `Step ${i + 1} - ${a.nama || "?"}${a.type ? ` (${a.type})` : ""} - ${a.status}`;

// Step i dst. yang sudah diproses dikembalikan ke pending.
const resetApprovalsFrom = (approvals: Approval[], from: number): Approval[] =>
  approvals.map((a, i) =>
    i >= from && a.status !== "pending" ? { ...a, status: "pending", processed_at: null } : a,
  );

export const previewApprovalShortcut = async (
  docType: "mr" | "po",
  kind: "reset" | "force",
  id: number,
  stepIndex?: number,
): Promise<AdminActionPreview> => {
  const row =
    docType === "mr"
      ? await fetchMr(id).then((mr) => ({
          kode: mr.kode_mr,
          status: mr.status,
          approvals: mr.approvals ?? [],
          creatorId: mr.userid,
        }))
      : await fetchPo(id).then((po) => ({
          kode: po.kode_po,
          status: po.status,
          approvals: po.approvals ?? [],
          creatorId: po.user_id,
        }));
  const action: AdminDocumentAction = `${kind}_${docType}_approval`;
  const preview = emptyPreview(action, row.kode);
  const { approvals } = row;
  if (row.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push('Dokumen ini dibatalkan - pakai "Buka Kembali" dulu.');
    return preview;
  }
  // Status di luar fase approval tidak ikut dihitung ulang dari approval -
  // validasi GA/Purchasing tetap lewat alurnya sendiri.
  if (!approvals.length || row.status === "Pending Validation") {
    preview.blockers.push(
      "Dokumen ini belum divalidasi / belum punya jalur approval - validasi dulu lewat alur normal.",
    );
    return preview;
  }

  let options: number[];
  const firstOpen = approvals.findIndex((a) => a.status !== "approved");
  if (kind === "reset") {
    options = approvals
      .map((_, i) => i)
      .filter((i) => approvals.slice(i).some((a) => a.status !== "pending"));
    if (!options.length) {
      preview.blockers.push("Belum ada step yang diproses - tidak ada yang bisa di-reset.");
      return preview;
    }
  } else {
    if (firstOpen === -1) {
      preview.blockers.push("Semua step sudah approved.");
      return preview;
    }
    // Step Receiver cuma lewat checklist Terima Barang (qty tercatat).
    const receiverIdx =
      docType === "po"
        ? approvals.findIndex((a, i) => i >= firstOpen && a.type === APPROVAL_TYPE_RECEIVER)
        : -1;
    const limit = receiverIdx === -1 ? approvals.length : receiverIdx;
    options = [];
    for (let i = firstOpen; i < limit; i++) options.push(i);
    if (!options.length) {
      preview.blockers.push(
        'Giliran berikutnya step Receiver - approve lewat checklist "Terima Barang" di halaman detail PO supaya qty barang tercatat.',
      );
      return preview;
    }
  }
  preview.steps = options.map((i) => ({ index: i, label: approvalStepLabel(approvals[i], i) }));
  // Default paling kecil efeknya: reset step terakhir yang diproses /
  // approve satu step (giliran sekarang).
  const chosen =
    stepIndex !== undefined && options.includes(stepIndex)
      ? stepIndex
      : kind === "reset"
        ? options[options.length - 1]
        : options[0];
  preview.stepIndex = chosen;

  const next =
    kind === "reset"
      ? resetApprovalsFrom(approvals, chosen)
      : approvals.map((a, i) =>
          i >= firstOpen && i <= chosen ? { ...a, status: "approved" as const } : a,
        );
  const input = {
    baselineApprovals: approvals,
    nextApprovals: next,
    baselineStatus: row.status,
    requestedStatus: row.status,
  };

  let approval: ApprovalShortcutCommit;
  try {
    approval =
      docType === "mr"
        ? { docType, id, kode: row.kode, creatorId: row.creatorId, plan: await planAdminMrApprovalUpdate(id, input) }
        : { docType, id, kode: row.kode, creatorId: row.creatorId, plan: await planAdminPoApprovalUpdate(id, input) };
  } catch (err: any) {
    preview.blockers.push(err.message);
    return preview;
  }
  const { plan } = approval;
  for (const c of plan.changes) {
    preview.effects.push(`${approvals[c.index].nama || `Step ${c.index + 1}`} (step ${c.index + 1}): ${c.from} -> ${c.to}.`);
  }
  if (plan.status !== plan.previousStatus) {
    preview.effects.push(`Status ${plan.previousStatus} -> ${plan.status}.`);
  }
  if (approval.docType === "mr") {
    const pre = MR_PRE_PO_STATUSES as readonly string[];
    if (plan.status === "Waiting PO" && plan.previousStatus !== "Waiting PO") {
      preview.effects.push('Item MR siap dibuatkan PO ("Menunggu PO"), budget cost center dipotong.');
    } else if (pre.includes(plan.status) && !pre.includes(plan.previousStatus)) {
      preview.effects.push("Item MR kembali ke tahap approval, potongan budget cost center dikembalikan.");
    }
  } else {
    if (approval.plan.extraPayload.dp_paid) {
      preview.effects.push("Pembayaran DP/Pelunasan ditandai lunas.");
    }
    if (approval.plan.markItemsShipped) {
      preview.effects.push('Item MR yang di-cover PO ini jadi "Dikirim Vendor".');
    }
  }
  if (kind === "force") {
    preview.warnings.push(
      "Step di-approve atas nama approver-nya - tercatat di log sebagai override admin & approver berikutnya dinotifikasi seperti biasa.",
    );
    if (plan.changes.some((c) => isPaymentValidatorApproval(approvals[c.index]))) {
      preview.warnings.push("Step Payment Validator ikut di-approve = PO dianggap sudah dibayar.");
    }
  }
  if (!plan.changes.length) {
    preview.blockers.push("Tidak ada perubahan approval.");
  }
  preview.commit = { mr: null, pos: [], approval };
  return preview;
};

export const previewUnpayPo = async (poId: number): Promise<AdminActionPreview> => {
  const po = await fetchPo(poId);
  const preview = emptyPreview("unpay_po", po.kode_po);
  if (po.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("PO ini sudah dibatalkan.");
    return preview;
  }
  if (!isPoPaidOrPartlyPaid(po)) {
    preview.blockers.push("PO ini belum tercatat dibayar.");
    return preview;
  }
  if (isPoReceived(po) || po.closed_remainder) {
    preview.blockers.push(
      'Barang PO ini sudah dicatat diterima - pakai "Batalkan Penerimaan" dulu (status bayar ikut dibatalkan kalau step bayarnya setelah Receiver).',
    );
    return preview;
  }

  const approvals = po.approvals ?? [];
  const pvIdx = approvals.findIndex(isPaymentValidatorApproval);
  const next = pvIdx === -1 ? approvals : resetApprovalsFrom(approvals, pvIdx);
  const status = derivePoStatusFromApprovals(next, null) ?? "Pending Payment";

  let mrPlan: CommitPlan["mr"] = null;
  if (po.mr_id) {
    const [mr, pos] = await Promise.all([fetchMr(po.mr_id), fetchPosOfMr(po.mr_id)]);
    if (mr.status !== DOC_STATUS_CANCELLED) {
      const pns = new Set((po.items || []).map((i) => i.part_number).filter(Boolean));
      // Item yang juga di-cover PO lain yang sudah dibayar tetap "Dikirim Vendor".
      const paidElsewhere = new Set(
        pos
          .filter((p) => p.id !== po.id && isActivePo(p) && isPoPaid(p.approvals))
          .flatMap((p) => (p.items || []).map((i) => i.part_number)),
      );
      const reverted: string[] = [];
      const orders = normalizeMrOrders(mr.orders as any[]).map((order) => {
        const own = [...orderPartNumbers(order)];
        if (order.status !== MR_ITEM_STATUSES.SHIPPED_BY_VENDOR) return order;
        if (!own.some((pn) => pns.has(pn)) || own.some((pn) => paidElsewhere.has(pn))) return order;
        reverted.push(order.name);
        return {
          ...order,
          status: MR_ITEM_STATUSES.PROCESSING,
          level: order.level === "Open 4" ? ("Open 3A" as const) : order.level,
        };
      });
      if (reverted.length) {
        mrPlan = mrCommit(mr, { status: mr.status, orders });
        preview.effects.push(`Item MR ${mr.kode_mr} "Dikirim Vendor" balik ke "Processing": ${reverted.join(", ")}.`);
      }
    }
  }

  preview.commit = {
    mr: mrPlan,
    pos: [poCommit(po, { status, approvals_next: next, dp_paid: false, bp_paid: false })],
  };
  const resetSteps = next.filter((a, i) => a.status !== approvals[i].status);
  if (resetSteps.length) {
    preview.effects.push(`Step kembali pending: ${resetSteps.map((a) => a.nama).join(", ")}.`);
  }
  preview.effects.push("DP / Pelunasan ditandai belum lunas.");
  if (status !== po.status) preview.effects.push(`Status PO ${po.status} -> ${status}.`);
  preview.warnings.push(
    "Lampiran bukti bayar (Finance) tidak dihapus - hapus manual di form kalau memang salah unggah.",
  );
  return preview;
};

export const previewUnreceivePo = async (poId: number): Promise<AdminActionPreview> => {
  const po = await fetchPo(poId);
  const preview = emptyPreview("unreceive_po", po.kode_po);
  if (po.status === DOC_STATUS_CANCELLED) {
    preview.blockers.push("PO ini sudah dibatalkan.");
    return preview;
  }
  if (po.closed_remainder) {
    preview.blockers.push("Sisa PO ini sudah ditutup - penerimaannya tidak bisa dibatalkan.");
    return preview;
  }
  if (po.goods_receipt) {
    preview.blockers.push(
      "Barang PO ini sudah dikonfirmasi diterima requester (scan QR) - penerimaannya tidak bisa dibatalkan.",
    );
    return preview;
  }
  if (!po.receive_record && !getApprovedReceiverStep(po.approvals)) {
    preview.blockers.push("PO ini belum punya catatan penerimaan barang.");
    return preview;
  }

  const approvals = po.approvals ?? [];
  const rIdx = approvals.findIndex((a) => a.type === APPROVAL_TYPE_RECEIVER);
  const next = rIdx === -1 ? approvals : resetApprovalsFrom(approvals, rIdx);
  const resetsPayment =
    rIdx !== -1 &&
    approvals.some((a, i) => i > rIdx && a.status === "approved" && isPaymentValidatorApproval(a));
  const status = derivePoStatusFromApprovals(next, null) ?? PO_STATUS_PENDING_RECEIVE;
  const paidAfter = next.length ? isPoPaid(next) : true;

  let mrPlan: CommitPlan["mr"] = null;
  if (po.mr_id) {
    const [mr, pos] = await Promise.all([fetchMr(po.mr_id), fetchPosOfMr(po.mr_id)]);
    if (mr.status !== DOC_STATUS_CANCELLED) {
      const pns = new Set((po.items || []).map((i) => i.part_number).filter(Boolean));
      const orders = normalizeMrOrders(mr.orders as any[]);
      const others = pos.filter((p) => p.id !== po.id && isActivePo(p));
      const receivedOther = receivedQtyByIndex(orders, others);
      const sent: string[] = [];
      const reverted: string[] = [];
      const nextOrders = orders.map((order, i) => {
        if (![...orderPartNumbers(order)].some((pn) => pns.has(pn))) return order;
        if (receivedOther[i] >= (Number(order.qty) || 0)) return order;
        const st = order.status || "";
        if (
          st === MR_ITEM_STATUSES.ON_DELIVERY ||
          st === MR_ITEM_STATUSES.COMPLETED ||
          (st === MR_ITEM_STATUSES.PENDING_BAST && (order.bast_attachments || []).length > 0)
        ) {
          sent.push(`${order.name} (${st})`);
          return order;
        }
        const wasReceived =
          st === MR_ITEM_STATUSES.DITERIMA_GA ||
          st === MR_ITEM_STATUSES.PENDING_BAST ||
          order.level === "Open 5";
        if (!wasReceived || CLOSED_ITEM_STATUSES.has(st)) return order;
        reverted.push(order.name);
        return {
          ...order,
          status: paidAfter ? MR_ITEM_STATUSES.SHIPPED_BY_VENDOR : MR_ITEM_STATUSES.PROCESSING,
          level: paidAfter ? ("Open 4" as const) : ("Open 3A" as const),
        };
      });
      if (sent.length) {
        preview.blockers.push(
          `Barang sudah dikirim ke requester / di-BAST: ${sent.join(", ")} - penerimaan tidak bisa dibatalkan.`,
        );
        return preview;
      }
      if (reverted.length) {
        mrPlan = mrCommit(mr, { status: mr.status, orders: nextOrders });
        preview.effects.push(
          `Item MR ${mr.kode_mr} balik ke "${paidAfter ? "Dikirim Vendor" : "Processing"}": ${reverted.join(", ")}.`,
        );
      }
    }
  }

  preview.commit = {
    mr: mrPlan,
    pos: [
      poCommit(po, {
        status,
        approvals_next: next,
        receive_record: null,
        full_received_at: null,
        ...(resetsPayment ? { dp_paid: false, bp_paid: false } : {}),
      }),
    ],
  };
  preview.effects.push("Checklist penerimaan barang dihapus - isi ulang lewat \"Terima Barang\".");
  const resetSteps = next.filter((a, i) => a.status !== approvals[i].status);
  if (resetSteps.length) {
    preview.effects.push(`Step kembali pending: ${resetSteps.map((a) => a.nama).join(", ")}.`);
  }
  if (status !== po.status) preview.effects.push(`Status PO ${po.status} -> ${status}.`);
  if (resetsPayment) {
    preview.warnings.push(
      "Step Payment Validator ada SETELAH Receiver di PO ini - status bayarnya ikut dibatalkan (DP / Pelunasan belum lunas).",
    );
  }
  return preview;
};

export const previewAdminDocumentAction = (
  action: AdminDocumentAction,
  id: number,
  actor: { name: string },
  options: AdminActionOptions = {},
): Promise<AdminActionPreview> => {
  switch (action) {
    case "reset_mr_approval":
      return previewApprovalShortcut("mr", "reset", id, options.stepIndex);
    case "reset_po_approval":
      return previewApprovalShortcut("po", "reset", id, options.stepIndex);
    case "force_mr_approval":
      return previewApprovalShortcut("mr", "force", id, options.stepIndex);
    case "force_po_approval":
      return previewApprovalShortcut("po", "force", id, options.stepIndex);
    case "unpay_po":
      return previewUnpayPo(id);
    case "unreceive_po":
      return previewUnreceivePo(id);
    case "close_po_remainder":
      return previewClosePoRemainder(id, options.mrMode ?? "reorder", actor.name);
    case "close_mr_remainder":
      return previewCloseMrRemainder(id, actor.name);
    case "cancel_mr":
      return previewCancelMr(id);
    case "cancel_po":
      return previewCancelPo(id);
    case "reopen_mr":
      return previewReopenMr(id);
    case "reopen_po":
      return previewReopenPo(id);
  }
};

// Potongan bersih budget MR ini (positif = yang akan dikembalikan trigger).
const fetchNetBudgetDeduction = async (mrId: number): Promise<number> => {
  const { data, error } = await supabase
    .from("cost_center_history")
    .select("change_amount")
    .eq("mr_id", mrId);
  if (error || !data) return 0;
  const net = data.reduce((sum, r) => sum + (Number(r.change_amount) || 0), 0);
  return net < 0 ? -net : 0;
};

// ==========================================
// JALANKAN
// ==========================================

const ACTION_LABEL: Record<AdminDocumentAction, string> = {
  cancel_mr: "membatalkan MR",
  cancel_po: "membatalkan PO",
  reopen_mr: "membuka kembali MR",
  reopen_po: "membuka kembali PO",
  close_po_remainder: "menutup sisa PO",
  close_mr_remainder: "menutup sisa MR",
  reset_mr_approval: "me-reset approval MR",
  reset_po_approval: "me-reset approval PO",
  force_mr_approval: "meng-approve (override) MR",
  force_po_approval: "meng-approve (override) PO",
  unpay_po: "membatalkan status bayar PO",
  unreceive_po: "membatalkan penerimaan barang PO",
};

// Aksi yang menghentikan (sebagian) dokumen - catatan refund PO yang sudah
// dibayar wajib, Finance ikut dikabari.
const STOP_ACTIONS = new Set<AdminDocumentAction>([
  "cancel_mr",
  "cancel_po",
  "close_po_remainder",
  "close_mr_remainder",
]);

export const runAdminDocumentAction = async (
  preview: AdminActionPreview,
  input: {
    reason: string;
    /** Catatan refund per id PO - wajib utk PO yang sudah dibayar (batal / tutup sisa). */
    refundNotes?: Record<number, string>;
  },
  actor: { id: string; name: string },
): Promise<void> => {
  if (preview.blockers.length) throw new Error(preview.blockers[0]);
  const reason = input.reason.trim();
  if (!reason) throw new Error("Alasan wajib diisi.");

  if (preview.commit.approval) {
    await runApprovalShortcut(preview, preview.commit.approval, reason, actor);
    return;
  }

  const { mr, pos } = preview.commit;
  const isStop = STOP_ACTIONS.has(preview.action);
  const refundNotes = input.refundNotes ?? {};
  if (isStop) {
    const missing = pos.filter((p) => p.paid && !refundNotes[p.id]?.trim());
    if (missing.length) {
      throw new Error(
        `Catatan refund wajib diisi untuk PO yang sudah dibayar: ${missing.map((p) => p.kode_po).join(", ")}.`,
      );
    }
  }

  // Alasan baru diketahui di sini - tempel ke item yang ikut dibatalkan /
  // ditutup sisanya.
  const stamp = { updated_by: actor.id, updated_at: new Date().toISOString() };
  const mrOrders = mr?.orders?.map((o, i) => {
    if (preview.action === "cancel_mr" && o.cancelled_with_mr) {
      return { ...o, status_note: `MR dibatalkan admin: ${reason}`, ...stamp };
    }
    const note = mr.orderNotes?.[i];
    return note ? { ...o, status_note: `${note}: ${reason}`, ...stamp } : o;
  });

  const { error } = await supabase.rpc("admin_apply_document_action", {
    p_reason: reason,
    p_mr: mr
      ? {
          id: mr.id,
          expected_status: mr.expected_status,
          expected_orders: mr.expected_orders,
          status: mr.status,
          ...(mrOrders ? { orders: mrOrders } : {}),
          ...(mr.budget_refund ? { budget_refund: mr.budget_refund } : {}),
        }
      : null,
    p_pos: pos.map((p) => ({
      id: p.id,
      expected_status: p.expected_status,
      status: p.status,
      ...(p.approvals_next ? { approvals: p.approvals_next } : {}),
      ...(p.dp_paid !== undefined ? { dp_paid: p.dp_paid } : {}),
      ...(p.bp_paid !== undefined ? { bp_paid: p.bp_paid } : {}),
      ...(p.closed_remainder
        ? {
            closed_remainder: {
              ...p.closed_remainder,
              refund_note: refundNotes[p.id]?.trim() || null,
            },
          }
        : isStop
          ? { refund_note: refundNotes[p.id]?.trim() || null }
          : {}),
      ...(p.receive_record !== undefined ? { receive_record: p.receive_record } : {}),
      ...(p.full_received_at !== undefined ? { full_received_at: p.full_received_at } : {}),
    })),
  });
  if (error) {
    if (error.message.includes("DOC_CHANGED")) {
      throw new Error(
        "Data dokumen ini sudah berubah sejak dialog dibuka (mis. ada yang baru memproses). Tutup dialog lalu coba lagi.",
      );
    }
    throw new Error(error.message);
  }

  // Status/level MR turunan item - dirapikan seperti alur normal.
  if (mr && mr.status !== DOC_STATUS_CANCELLED) {
    await recalculateMrStatus(mr.id);
    await recalculateMrLevel(mr.id);
  }

  await logAction(preview, reason, refundNotes, actor);
  await notifyAction(preview, reason, actor).catch((err) =>
    console.error("[AdminDocumentAction] notifikasi gagal:", err),
  );
};

// Reset / Approve - simpan seperti form approval admin (status dicek belum
// berubah sejak preview), lalu efek lanjutan + notifikasi approval normal.
const runApprovalShortcut = async (
  preview: AdminActionPreview,
  approval: ApprovalShortcutCommit,
  reason: string,
  actor: { id: string; name: string },
) => {
  const { plan } = approval;
  const payload = {
    approvals: plan.approvals,
    status: plan.status,
    ...(approval.docType === "po" ? approval.plan.extraPayload : {}),
  };
  const { data, error } = await supabase
    .from(approval.docType === "mr" ? "material_requests" : "purchase_orders")
    .update(payload)
    .eq("id", approval.id)
    .eq("status", plan.previousStatus)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      "Data dokumen ini sudah berubah sejak dialog dibuka (mis. ada yang baru memproses). Tutup dialog lalu coba lagi.",
    );
  }

  const ctx = { creatorId: approval.creatorId, actorId: actor.id, actorName: actor.name };
  if (approval.docType === "mr") {
    await applyAdminMrApprovalEffects(approval.plan, {
      ...ctx,
      mrId: approval.id,
      kodeMr: approval.kode,
    });
  } else {
    await applyAdminPoApprovalEffects(approval.plan, {
      ...ctx,
      poId: approval.id,
      kodePo: approval.kode,
    });
  }
  await logActivity(
    actor.id,
    `ADMIN_${preview.action.toUpperCase()}`,
    approval.docType === "mr" ? "material_request" : "purchase_order",
    String(approval.id),
    `Admin ${actor.name} ${ACTION_LABEL[preview.action]} ${preview.kode}. Alasan: ${reason}`,
    { reason, effects: preview.effects, old_status: plan.previousStatus, new_status: plan.status },
  );
};

const logAction = async (
  preview: AdminActionPreview,
  reason: string,
  refundNotes: Record<number, string>,
  actor: { id: string; name: string },
) => {
  const { mr, pos } = preview.commit;
  const actionType = `ADMIN_${preview.action.toUpperCase()}`;
  const summary = `Admin ${actor.name} ${ACTION_LABEL[preview.action]} ${preview.kode}. Alasan: ${reason}`;
  const metadata = { reason, effects: preview.effects };

  if (mr) {
    await logActivity(actor.id, actionType, "material_request", String(mr.id), summary, {
      ...metadata,
      old_status: mr.expected_status,
      new_status: mr.status,
    });
  }
  for (const po of pos) {
    await logActivity(actor.id, actionType, "purchase_order", String(po.id), summary, {
      ...metadata,
      old_status: po.expected_status,
      new_status: po.status,
      ...(refundNotes[po.id] ? { refund_note: refundNotes[po.id] } : {}),
    });
  }
};

const MR_ACTIONS = new Set<AdminDocumentAction>(["cancel_mr", "reopen_mr", "close_mr_remainder"]);

// Reset / Approve tidak di sini - notifikasinya lewat alur approval normal.
const NOTIFICATION_COPY: Partial<
  Record<AdminDocumentAction, { type: NotificationEventType; title: string; verb: string }>
> = {
  unpay_po: {
    type: "po_payment_reverted",
    title: "Status Bayar Dibatalkan",
    verb: "dibatalkan status bayarnya (DP / Pelunasan belum lunas)",
  },
  unreceive_po: {
    type: "po_receipt_reverted",
    title: "Penerimaan Barang Dibatalkan",
    verb: "dibatalkan catatan penerimaan barangnya",
  },
  cancel_mr: { type: "mr_cancelled", title: "Dibatalkan", verb: "dibatalkan" },
  cancel_po: { type: "po_cancelled", title: "Dibatalkan", verb: "dibatalkan" },
  reopen_mr: { type: "mr_reopened", title: "Dibuka Kembali", verb: "dibuka kembali" },
  reopen_po: { type: "po_reopened", title: "Dibuka Kembali", verb: "dibuka kembali" },
  close_mr_remainder: {
    type: "mr_remainder_closed",
    title: "Sisa Ditutup",
    verb: "ditutup sisanya (yang belum diterima tidak dilanjutkan)",
  },
  close_po_remainder: {
    type: "po_remainder_closed",
    title: "Sisa Ditutup",
    verb: "ditutup sisanya (sisa barang tidak dikirim)",
  },
};

const notifyAction = async (
  preview: AdminActionPreview,
  reason: string,
  actor: { id: string; name: string },
) => {
  const { mr, pos } = preview.commit;
  const companyCode = mr?.company_code ?? pos[0]?.company_code;
  if (!companyCode) return;

  const copy = NOTIFICATION_COPY[preview.action];
  if (!copy) return;
  const isStop = STOP_ACTIONS.has(preview.action);
  const involvesPaidPo =
    (isStop && pos.some((p) => p.paid)) ||
    preview.action === "unpay_po" ||
    preview.action === "unreceive_po";
  const staff = involvesPaidPo
    ? await getGAAndFinanceUserIds(companyCode)
    : await getGAUserIds(companyCode);

  // Pembuat + approver yang sudah approve (+ approver yang giliran berikutnya
  // saat dibuka kembali) - sama seperti pihak yang dikabari alur normal.
  const recipients = [...staff];
  if (mr) {
    recipients.push(mr.userid, ...approvedUserIds(mr.approvals));
  }
  for (const po of pos) {
    recipients.push(po.user_id, ...approvedUserIds(po.approvals));
  }
  if (preview.action === "reopen_mr" && mr?.status === "Pending Approval") {
    const turn = getCurrentTurnIndex(mr.approvals);
    if (turn !== -1) recipients.push(mr.approvals[turn].userid);
  }
  if (preview.action === "reopen_po" && pos[0]?.approvals_next?.length) {
    recipients.push(pos[0].approvals_next[0].userid);
  }

  const isMrAction = MR_ACTIONS.has(preview.action);
  const { type, title, verb } = copy;
  const docName = isMrAction ? "Material Request" : "Purchase Order";
  const resourceId = isMrAction ? mr!.id : pos[0].id;
  const cancelledPoCodes = pos
    .filter((p) => p.status === DOC_STATUS_CANCELLED && !p.closed_remainder)
    .map((p) => p.kode_po);
  const closedPoCodes = pos.filter((p) => p.closed_remainder).map((p) => p.kode_po);
  const extraPos =
    (isMrAction && cancelledPoCodes.length
      ? ` PO terkait dibatalkan: ${cancelledPoCodes.join(", ")}.`
      : "") +
    (isMrAction && closedPoCodes.length
      ? ` Sisa PO ditutup: ${closedPoCodes.join(", ")}.`
      : "");

  await sendNotifications(
    recipients.filter((id) => id && id !== actor.id),
    {
      actorId: actor.id,
      type,
      title: `${docName} ${title}`,
      message: `${docName} ${preview.kode} ${verb} oleh admin ${actor.name}. Alasan: ${reason}.${extraPos}`,
      link: isMrAction ? `/material-request/${resourceId}` : `/purchase-order/${resourceId}`,
      resourceId: String(resourceId),
      resourceType: isMrAction ? "material_request" : "purchase_order",
    },
  );
};
