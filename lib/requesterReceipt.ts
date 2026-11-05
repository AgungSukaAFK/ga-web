// Konfirmasi terima barang langsung dari requester.
//
// Barang bisa sudah di tangan requester walaupun dokumennya belum sampai sana:
// GA belum klik "Terima Barang"/"Kirim ke Requester", atau pembayaran PO belum
// diupdate di sistem. File ini menghitung apa yang boleh dikonfirmasi dan efek
// konfirmasi ke item MR + `receive_record` PO. Semuanya fungsi murni (tanpa
// Supabase) - penyimpanannya di confirmRequesterReceipt, services/mrService.ts.
//
// Aturan penting:
//  - Item dikenali lewat INDEX baris, bukan part_number: satu MR bisa punya
//    part_number kembar, dan ada item lama tanpa part_number.
//  - Status pembayaran PO tidak pernah diubah. PO yang belum lunas tetap
//    "Pending Payment" walaupun itemnya sudah Completed.
//  - PO yang belum selesai approval tidak bisa dikonfirmasi.
import {
  Approval,
  Attachment,
  Order,
  POItem,
  PoClosedRemainder,
  ReceiveRecord,
  ReceiveRecordItem,
  RequesterReceiptAllocation,
  RequesterReceiptEntry,
} from "@/type";
import {
  INACTIVE_DOC_STATUSES,
  MR_ITEM_BAST_ELIGIBLE_STATUSES,
  MR_ITEM_STATUSES,
  PO_STATUS_FULL_RECEIVED,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_PENDING_RECEIVE,
  isPaymentValidatorApproval,
  isPoPaid,
} from "@/type/enum";

const EPS = 1e-6;

const toQty = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Qty boleh desimal - bulatkan supaya 0.1 + 0.2 tidak jadi 0.30000000000000004.
const roundQty = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Status PO setelah pembayaran atau checklist penerimaan berubah. Simetris
 * terhadap urutan step "Receiver" vs "Payment Validator": status akhir baru
 * ditentukan begitu keduanya beres.
 * - `paymentJustSettled`: pembayaran baru lunas. Kalau penerimaan sudah
 *   tercatat, langsung pakai hasil checklist-nya - jangan mundur ke "Pending
 *   Receive" dan memaksa orang mengisi checklist yang sama lagi.
 * - `receiveJustSubmitted`: checklist penerimaan baru disubmit.
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
  if (opts.paymentJustSettled) {
    if (isFullMatch !== undefined) {
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

export const PO_RECEIPT_COLUMNS =
  "id, kode_po, status, items, approvals, receive_record, closed_remainder";

export interface ReceiptPo {
  id: number;
  kode_po: string;
  status: string;
  items: POItem[] | null;
  approvals: Approval[] | null;
  receive_record: ReceiveRecord | null;
  closed_remainder: PoClosedRemainder | null;
}

// PO yang belum sah secara approval - barangnya belum boleh dikonfirmasi.
export const PO_PRE_APPROVAL_STATUSES = [
  "Draft",
  "Pending Validation",
  "On Hold",
  "Pending Approval",
];

const isPoActive = (po: ReceiptPo) => !INACTIVE_DOC_STATUSES.includes(po.status);

export const isPoOpenForReceipt = (po: ReceiptPo) =>
  isPoActive(po) && !PO_PRE_APPROVAL_STATUSES.includes(po.status);

// Status item yang fisiknya sudah pasti keluar dari vendor, jadi tidak perlu
// dibatasi qty ter-PO.
const PHYSICALLY_MOVED_STATUSES: string[] = [
  MR_ITEM_STATUSES.DITERIMA_GA,
  ...MR_ITEM_BAST_ELIGIBLE_STATUSES,
];

const RECEIPT_ELIGIBLE_STATUSES: string[] = [
  "PO Created", // data lama, lihat submitReceiveRecord
  MR_ITEM_STATUSES.PROCESSING,
  MR_ITEM_STATUSES.SHIPPED_BY_VENDOR,
  ...PHYSICALLY_MOVED_STATUSES,
];

export const getRequesterReceivedQty = (order: Order) =>
  roundQty(
    (order.requester_receipts || []).reduce((sum, e) => sum + toQty(e.qty), 0),
  );

// Konfirmasi yang melewati langkah GA (item belum dikirim GA ke requester).
export const isGaBypassedStatus = (status: string | undefined) =>
  !MR_ITEM_BAST_ELIGIBLE_STATUSES.includes(status || "");

export const wasConfirmedBeforeGa = (order: Order) =>
  (order.requester_receipts || []).some(
    (e) => !!e.prev_status && isGaBypassedStatus(e.prev_status),
  );

export const orderPartNumbers = (order: Order) =>
  new Set(
    [
      order.part_number,
      ...(order.conversion_history || []).map((c) => c.from_part_number),
    ].filter(Boolean) as string[],
  );

const sharesPart = (a: Set<string>, b: Set<string>) =>
  [...a].some((part) => b.has(part));

export const stockQty = (order: Order) =>
  (order.stock_fulfillments || []).reduce((sum, s) => sum + toQty(s.qty), 0);

interface PoLine {
  part_number: string;
  part_name: string;
  ordered: number;
  received: number;
  // Qty PO yang benar-benar akan dikirim (setelah sisa ditutup admin).
  coverage: number;
}

// Baris `items` PO digabung dengan `receive_record`-nya. Part kembar di satu
// PO diklaim berurutan, sama seperti submitReceiveRecord.
export const buildPoLines = (po: ReceiptPo): PoLine[] => {
  const records = [...(po.receive_record?.items || [])];
  const closed = new Map<string, number>();
  for (const c of po.closed_remainder?.items || []) {
    closed.set(c.part_number, (closed.get(c.part_number) || 0) + toQty(c.closed_qty));
  }
  return (po.items || [])
    .filter((item) => !!item.part_number)
    .map((item) => {
      const recordIndex = records.findIndex(
        (r) => r.part_number === item.part_number,
      );
      const record =
        recordIndex !== -1 ? records.splice(recordIndex, 1)[0] : null;
      const itemQty = toQty(item.qty);
      const closedQty = Math.min(closed.get(item.part_number) || 0, itemQty);
      closed.set(
        item.part_number,
        (closed.get(item.part_number) || 0) - closedQty,
      );
      return {
        part_number: item.part_number,
        part_name: item.name,
        ordered: record ? toQty(record.ordered_qty) : itemQty,
        received: record ? toQty(record.received_qty) : 0,
        coverage: itemQty - closedQty,
      };
    });
};

export type ReceiptStage =
  | "done"
  | "closed"
  | "waiting_po"
  | "waiting_approval"
  | "vendor_process"
  | "vendor_shipping"
  | "at_ga"
  | "on_delivery"
  | "ready";

export interface ReceiptItemState {
  index: number;
  order: Order;
  qty: number;
  received: number;
  remaining: number;
  maxQty: number;
  defaultQty: number;
  canConfirm: boolean;
  stage: ReceiptStage;
  message: string;
}

const describeVendorProcess = (po: ReceiptPo | undefined) =>
  po?.status === "Pending Payment"
    ? `PO ${po.kode_po} belum tercatat lunas`
    : "Sedang diproses vendor";

export const getReceiptItemStates = (
  orders: Order[],
  pos: ReceiptPo[],
): ReceiptItemState[] => {
  const openPos = pos.filter(isPoOpenForReceipt);
  const pendingPo = pos.find(
    (po) => isPoActive(po) && !isPoOpenForReceipt(po),
  );

  // Qty PO per part, dipakai bergiliran supaya baris MR dengan part kembar
  // tidak menghitung qty PO yang sama dua kali.
  const pool = new Map<string, number>();
  for (const po of openPos) {
    for (const line of buildPoLines(po)) {
      pool.set(line.part_number, (pool.get(line.part_number) || 0) + line.coverage);
    }
  }

  return orders.map((order, index) => {
    const status = order.status || "Pending";
    const qty = toQty(order.qty);
    const received = getRequesterReceivedQty(order);
    const remaining = roundQty(Math.max(0, qty - received));
    const parts = orderPartNumbers(order);
    const isClosed =
      status === MR_ITEM_STATUSES.CANCELLED ||
      status === MR_ITEM_STATUSES.REPLACED;

    let covered = stockQty(order);
    const matchedPo = openPos.find((po) =>
      (po.items || []).some((i) => parts.has(i.part_number)),
    );
    let manualPo: ReceiptPo | undefined;
    for (const link of order.manual_po_links || []) {
      const po = openPos.find((p) => p.kode_po === link.kode_po);
      // PO yang part-nya cocok sudah masuk `pool`.
      if (po && !(po.items || []).some((i) => parts.has(i.part_number))) {
        covered += toQty(link.qty);
        manualPo = manualPo || po;
      }
    }
    if (!isClosed) {
      for (const part of parts) {
        const take = Math.min(pool.get(part) || 0, Math.max(0, qty - covered));
        pool.set(part, (pool.get(part) || 0) - take);
        covered += take;
      }
    }

    const base = { index, order, qty, received, remaining };
    const blocked = (stage: ReceiptStage, message: string): ReceiptItemState => ({
      ...base,
      maxQty: 0,
      defaultQty: 0,
      canConfirm: false,
      stage,
      message,
    });

    if (isClosed) return blocked("closed", "Dibatalkan atau diganti");
    if (status === MR_ITEM_STATUSES.COMPLETED) {
      return blocked("done", "Sudah diterima");
    }

    const isMoved = PHYSICALLY_MOVED_STATUSES.includes(status);
    const maxQty =
      !RECEIPT_ELIGIBLE_STATUSES.includes(status)
        ? 0
        : isMoved
          ? remaining
          : roundQty(Math.max(0, Math.min(qty, covered) - received));

    if (maxQty <= EPS) {
      if (pendingPo) {
        return blocked(
          "waiting_approval",
          `PO ${pendingPo.kode_po} masih proses approval`,
        );
      }
      return blocked("waiting_po", "Menunggu PO dibuat Purchasing");
    }

    let stage: ReceiptStage = "vendor_process";
    let message = describeVendorProcess(matchedPo || manualPo);
    if (status === MR_ITEM_STATUSES.SHIPPED_BY_VENDOR) {
      stage = "vendor_shipping";
      message = "Sedang dikirim vendor";
    } else if (status === MR_ITEM_STATUSES.DITERIMA_GA) {
      stage = "at_ga";
      message = "Sudah di GA, belum dikirim ke Anda";
    } else if (status === MR_ITEM_STATUSES.ON_DELIVERY) {
      stage = "on_delivery";
      message = "Dalam pengiriman ke Anda";
    } else if (status === MR_ITEM_STATUSES.PENDING_BAST) {
      stage = "ready";
      message = "Siap dikonfirmasi";
    }

    const unconfirmedSent = roundQty(
      toQty(order.delivery_info?.qty_sent) - received,
    );
    const defaultQty =
      unconfirmedSent > EPS ? Math.min(unconfirmedSent, maxQty) : maxQty;

    return { ...base, maxQty, defaultQty, canConfirm: true, stage, message };
  });
};

export interface ReceiptPoUpdate {
  id: number;
  kode_po: string;
  expected_status: string;
  expected_receive_record: ReceiveRecord | null;
  status: string;
  receive_record: ReceiveRecord | null;
  full_received_at?: string | null;
}

const hasUnsettledPayment = (po: ReceiptPo) =>
  (po.approvals || []).some((a) => isPaymentValidatorApproval(a)) &&
  !isPoPaid(po.approvals);

const buildPoUpdate = (
  po: ReceiptPo,
  lines: PoLine[],
  actor: { id: string; name?: string },
  now: string,
): ReceiptPoUpdate => {
  const items: ReceiveRecordItem[] = lines.map((line) => ({
    part_number: line.part_number,
    part_name: line.part_name,
    ordered_qty: line.ordered,
    received_qty: roundQty(line.received),
  }));
  const isFullMatch = items.every(
    (i) => Math.abs(i.received_qty - i.ordered_qty) <= EPS,
  );
  const status = deriveReceiveDrivenStatus(
    po.approvals,
    (po.approvals || []).some((a) => isPaymentValidatorApproval(a)),
    isFullMatch,
    { receiveJustSubmitted: true },
  );
  return {
    id: po.id,
    kode_po: po.kode_po,
    expected_status: po.status,
    expected_receive_record: po.receive_record,
    status,
    receive_record: {
      items,
      is_full_match: isFullMatch,
      // Catatan GA yang sudah ada dipertahankan sebagai penerima awal.
      received_by: po.receive_record?.received_by ?? actor.id,
      received_by_name:
        po.receive_record?.received_by_name ?? actor.name ?? "",
      received_at: po.receive_record?.received_at ?? now,
      // Tanpa `actor.name` berarti pembatalan - jejak lama tidak ditimpa.
      requester_confirmed_by_name:
        actor.name ?? po.receive_record?.requester_confirmed_by_name,
      requester_confirmed_at: actor.name
        ? now
        : po.receive_record?.requester_confirmed_at,
    },
    ...fullReceivedChange(po.status, status, now),
  };
};

const fullReceivedChange = (
  oldStatus: string,
  newStatus: string,
  now: string,
): { full_received_at?: string | null } => {
  if (newStatus === PO_STATUS_FULL_RECEIVED) {
    return oldStatus === PO_STATUS_FULL_RECEIVED ? {} : { full_received_at: now };
  }
  return oldStatus === PO_STATUS_FULL_RECEIVED ? { full_received_at: null } : {};
};

export interface ReceiptActor {
  id: string;
  name: string;
}

export interface ReceiptEntryInput {
  index: number;
  qty: number;
  attachments: Attachment[];
}

export interface ReceiptPlan {
  orders: Order[];
  poUpdates: ReceiptPoUpdate[];
  completedCount: number;
  partialCount: number;
  bypassedGaCount: number;
}

// Qty yang sudah dianggap sampai di requester utk satu baris MR.
const rowReceivedForPo = (order: Order) =>
  Math.max(
    0,
    (order.status === MR_ITEM_STATUSES.COMPLETED
      ? toQty(order.qty)
      : getRequesterReceivedQty(order)) - stockQty(order),
  );

export const planRequesterReceipt = ({
  orders,
  pos,
  entries,
  actor,
  via,
  now,
  preferPoId,
}: {
  orders: Order[];
  pos: ReceiptPo[];
  entries: ReceiptEntryInput[];
  actor: ReceiptActor;
  via: RequesterReceiptEntry["via"];
  now: string;
  preferPoId?: number;
}): ReceiptPlan => {
  if (entries.length === 0) throw new Error("Pilih minimal satu barang.");
  if (new Set(entries.map((e) => e.index)).size !== entries.length) {
    throw new Error("Ada barang yang terpilih dua kali.");
  }

  const states = getReceiptItemStates(orders, pos);
  const nextOrders = orders.map((order) => ({ ...order }));
  const openPos = pos
    .filter(isPoOpenForReceipt)
    .sort((a, b) =>
      a.id === preferPoId ? -1 : b.id === preferPoId ? 1 : a.id - b.id,
    );
  const linesByPo = new Map(openPos.map((po) => [po.id, buildPoLines(po)]));
  const touchedPoIds = new Set<number>();

  let completedCount = 0;
  let partialCount = 0;
  let bypassedGaCount = 0;

  entries.forEach((entry, entryNumber) => {
    const state = states[entry.index];
    if (!state?.canConfirm) {
      throw new Error(
        `"${state?.order.name || "Barang"}" belum bisa dikonfirmasi: ${
          state?.message || "barang tidak ditemukan"
        }.`,
      );
    }
    const qty = roundQty(toQty(entry.qty));
    if (qty <= EPS) {
      throw new Error(`Qty "${state.order.name}" harus lebih dari 0.`);
    }
    if (qty > state.maxQty + EPS) {
      throw new Error(
        `Qty "${state.order.name}" maksimal ${state.maxQty} ${state.order.uom}.`,
      );
    }
    if (entry.attachments.length === 0) {
      throw new Error(`Bukti penerimaan "${state.order.name}" wajib diunggah.`);
    }

    const order = nextOrders[entry.index];
    const isComplete = state.received + qty >= state.qty - EPS;
    const receipt: RequesterReceiptEntry = {
      id: `${now}-${entryNumber}`,
      qty,
      confirmed_at: now,
      confirmed_by: actor.id,
      confirmed_by_name: actor.name,
      via,
      attachment_urls: entry.attachments.map((a) => a.url),
      allocations: [],
      prev_status: order.status,
      prev_level: order.level,
    };
    order.requester_receipts = [...(order.requester_receipts || []), receipt];
    order.bast_attachments = [
      ...(order.bast_attachments || []),
      ...entry.attachments,
    ];
    order.updated_by = actor.id;
    order.updated_at = now;
    if (isGaBypassedStatus(order.status)) bypassedGaCount += 1;
    if (isComplete) {
      order.status = MR_ITEM_STATUSES.COMPLETED;
      order.level = "Close";
      completedCount += 1;
    } else {
      partialCount += 1;
    }

    // Yang ditulis ke PO cuma selisihnya: qty yang sudah dicatat GA tidak
    // dihitung dua kali.
    const parts = orderPartNumbers(order);
    if (parts.size === 0) return;
    const delivered = nextOrders
      .filter((o) => sharesPart(orderPartNumbers(o), parts))
      .reduce((sum, o) => sum + rowReceivedForPo(o), 0);
    const recordedOnPos = [...linesByPo.values()]
      .flat()
      .filter((line) => parts.has(line.part_number))
      .reduce((sum, line) => sum + line.received, 0);
    let need = roundQty(delivered - recordedOnPos);

    for (const po of openPos) {
      if (need <= EPS) break;
      if (po.closed_remainder) continue; // checklist PO sudah terkunci
      for (const line of linesByPo.get(po.id) || []) {
        if (need <= EPS) break;
        if (!parts.has(line.part_number)) continue;
        const add = Math.min(need, roundQty(line.ordered - line.received));
        if (add <= EPS) continue;
        line.received = roundQty(line.received + add);
        need = roundQty(need - add);
        touchedPoIds.add(po.id);
        receipt.allocations.push({
          po_id: po.id,
          kode_po: po.kode_po,
          part_number: line.part_number,
          qty: add,
          created_record: !po.receive_record,
        });
      }
    }
  });

  return {
    orders: nextOrders,
    poUpdates: openPos
      .filter((po) => touchedPoIds.has(po.id))
      .map((po) => buildPoUpdate(po, linesByPo.get(po.id) || [], actor, now)),
    completedCount,
    partialCount,
    bypassedGaCount,
  };
};

// Kebalikan planRequesterReceipt - hapus satu lampiran bukti. Konfirmasi yang
// semua buktinya sudah terhapus ikut dibatalkan: qty-nya dikurangi dari item
// & PO, dan item yang tadinya selesai kembali ke status sebelum dikonfirmasi.
export const planRemoveReceiptAttachment = ({
  orders,
  pos,
  index,
  attachmentUrl,
  actor,
  now,
}: {
  orders: Order[];
  pos: ReceiptPo[];
  index: number;
  attachmentUrl: string;
  actor: { id: string };
  now: string;
}): Pick<ReceiptPlan, "orders" | "poUpdates"> => {
  const nextOrders = orders.map((order) => ({ ...order }));
  const order = nextOrders[index];
  const allReceipts = order.requester_receipts || [];

  order.bast_attachments = (order.bast_attachments || []).filter(
    (a) => a.url !== attachmentUrl,
  );
  order.updated_by = actor.id;
  order.updated_at = now;

  const undone: RequesterReceiptEntry[] = [];
  const kept: RequesterReceiptEntry[] = [];
  for (const receipt of allReceipts) {
    const urls = receipt.attachment_urls.filter((url) => url !== attachmentUrl);
    if (urls.length === 0) undone.push(receipt);
    else kept.push({ ...receipt, attachment_urls: urls });
  }
  order.requester_receipts = kept;

  if (undone.length === 0) return { orders: nextOrders, poUpdates: [] };

  const stillComplete =
    getRequesterReceivedQty(order) >= toQty(order.qty) - EPS;
  if (order.status === MR_ITEM_STATUSES.COMPLETED && !stillComplete) {
    // Konfirmasi terakhir yang membuat item Completed - status sebelumnya
    // paling baru, karena GA bisa saja bergerak di antara konfirmasi parsial.
    const completing = allReceipts[allReceipts.length - 1];
    order.status = completing.prev_status;
    order.level = completing.prev_level;
  }

  const allocationsByPo = new Map<number, RequesterReceiptAllocation[]>();
  for (const allocation of undone.flatMap((r) => r.allocations)) {
    allocationsByPo.set(allocation.po_id, [
      ...(allocationsByPo.get(allocation.po_id) || []),
      allocation,
    ]);
  }

  const poUpdates: ReceiptPoUpdate[] = [];
  for (const [poId, allocations] of allocationsByPo) {
    const po = pos.find((p) => p.id === poId);
    if (!po || !isPoOpenForReceipt(po) || po.closed_remainder) continue;
    if (!po.receive_record) continue;

    const lines = buildPoLines(po);
    for (const allocation of allocations) {
      let left = allocation.qty;
      for (const line of lines) {
        if (line.part_number !== allocation.part_number) continue;
        const take = Math.min(left, line.received);
        line.received = roundQty(line.received - take);
        left = roundQty(left - take);
      }
    }

    const nothingLeft = lines.every((line) => line.received <= EPS);
    if (nothingLeft && allocations.some((a) => a.created_record)) {
      const status = hasUnsettledPayment(po)
        ? "Pending Payment"
        : PO_STATUS_PENDING_RECEIVE;
      poUpdates.push({
        id: po.id,
        kode_po: po.kode_po,
        expected_status: po.status,
        expected_receive_record: po.receive_record,
        status,
        receive_record: null,
        ...fullReceivedChange(po.status, status, now),
      });
    } else {
      poUpdates.push(buildPoUpdate(po, lines, actor, now));
    }
  }

  return { orders: nextOrders, poUpdates };
};
