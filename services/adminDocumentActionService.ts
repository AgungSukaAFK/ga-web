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

import { createClient } from "@/lib/supabase/client";
import { Approval, Order, POItem, ReceiveRecord } from "@/type";
import {
  DOC_STATUS_CANCELLED,
  INACTIVE_DOC_STATUSES,
  MR_ITEM_STATUSES,
  PO_STATUS_FULL_RECEIVED,
  PO_STATUS_PARTIAL_RECEIVE,
  getApprovedReceiverStep,
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

const supabase = createClient();

export type AdminDocumentAction =
  | "cancel_mr"
  | "cancel_po"
  | "reopen_mr"
  | "reopen_po";

export interface AdminActionPoSummary {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  paid: boolean;
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
  /** PO yang ikut dibatalkan (cancel_mr) / dibatalkan (cancel_po). */
  cancelledPos: AdminActionPoSummary[];
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
  }[];
}

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
}

const MR_COLUMNS =
  "id, kode_mr, status, orders, approvals, userid, company_code, cost_center_id, cost_estimation, cancelled_from_status, cancel_reason";
const PO_COLUMNS =
  "id, kode_po, mr_id, status, items, approvals, dp_paid, bp_paid, receive_record, goods_receipt, user_id, company_code, total_price, cancel_reason, refund_note";

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
    Partial<Pick<CommitPlan["pos"][number], "approvals_next" | "dp_paid" | "bp_paid">>,
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

export const previewAdminDocumentAction = (
  action: AdminDocumentAction,
  id: number,
): Promise<AdminActionPreview> => {
  switch (action) {
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
};

export const runAdminDocumentAction = async (
  preview: AdminActionPreview,
  input: {
    reason: string;
    /** Catatan refund per id PO - wajib utk PO yang sudah dibayar (cancel_*). */
    refundNotes?: Record<number, string>;
  },
  actor: { id: string; name: string },
): Promise<void> => {
  if (preview.blockers.length) throw new Error(preview.blockers[0]);
  const reason = input.reason.trim();
  if (!reason) throw new Error("Alasan wajib diisi.");

  const { mr, pos } = preview.commit;
  const isCancel = preview.action === "cancel_mr" || preview.action === "cancel_po";
  const refundNotes = input.refundNotes ?? {};
  if (isCancel) {
    const missing = pos.filter((p) => p.paid && !refundNotes[p.id]?.trim());
    if (missing.length) {
      throw new Error(
        `Catatan refund wajib diisi untuk PO yang sudah dibayar: ${missing.map((p) => p.kode_po).join(", ")}.`,
      );
    }
  }

  // Alasan baru diketahui di sini - tempel ke item yang ikut dibatalkan.
  const mrOrders =
    preview.action === "cancel_mr" && mr?.orders
      ? mr.orders.map((o) =>
          o.cancelled_with_mr
            ? {
                ...o,
                status_note: `MR dibatalkan admin: ${reason}`,
                updated_by: actor.id,
                updated_at: new Date().toISOString(),
              }
            : o,
        )
      : mr?.orders;

  const { error } = await supabase.rpc("admin_apply_document_action", {
    p_reason: reason,
    p_mr: mr
      ? {
          id: mr.id,
          expected_status: mr.expected_status,
          expected_orders: mr.expected_orders,
          status: mr.status,
          ...(mrOrders ? { orders: mrOrders } : {}),
        }
      : null,
    p_pos: pos.map((p) => ({
      id: p.id,
      expected_status: p.expected_status,
      status: p.status,
      ...(p.approvals_next ? { approvals: p.approvals_next } : {}),
      ...(p.dp_paid !== undefined ? { dp_paid: p.dp_paid } : {}),
      ...(p.bp_paid !== undefined ? { bp_paid: p.bp_paid } : {}),
      ...(isCancel ? { refund_note: refundNotes[p.id]?.trim() || null } : {}),
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

const notifyAction = async (
  preview: AdminActionPreview,
  reason: string,
  actor: { id: string; name: string },
) => {
  const { mr, pos } = preview.commit;
  const companyCode = mr?.company_code ?? pos[0]?.company_code;
  if (!companyCode) return;

  const isCancel = preview.action === "cancel_mr" || preview.action === "cancel_po";
  const involvesPaidPo = isCancel && pos.some((p) => p.paid);
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

  const isMrAction = preview.action === "cancel_mr" || preview.action === "reopen_mr";
  const type: NotificationEventType = isCancel
    ? isMrAction
      ? "mr_cancelled"
      : "po_cancelled"
    : isMrAction
      ? "mr_reopened"
      : "po_reopened";
  const docName = isMrAction ? "Material Request" : "Purchase Order";
  const resourceId = isMrAction ? mr!.id : pos[0].id;
  const extraPos =
    preview.action === "cancel_mr" && pos.length
      ? ` PO terkait ikut dibatalkan: ${pos.map((p) => p.kode_po).join(", ")}.`
      : "";

  await sendNotifications(
    recipients.filter((id) => id && id !== actor.id),
    {
      actorId: actor.id,
      type,
      title: isCancel ? `${docName} Dibatalkan` : `${docName} Dibuka Kembali`,
      message: isCancel
        ? `${docName} ${preview.kode} dibatalkan oleh admin ${actor.name}. Alasan: ${reason}.${extraPos}`
        : `${docName} ${preview.kode} dibuka kembali oleh admin ${actor.name}. Alasan: ${reason}.`,
      link: isMrAction ? `/material-request/${resourceId}` : `/purchase-order/${resourceId}`,
      resourceId: String(resourceId),
      resourceType: isMrAction ? "material_request" : "purchase_order",
    },
  );
};
