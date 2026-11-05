// Model "Lacak MR" di halaman detail MR: posisi MR dari dibuat sampai diterima.
//
// Semua fungsi di sini murni (tanpa Supabase). Tampilannya ada di
// components/tracking-card.tsx (adapternya material-request/[id]/MrTrackingCard.tsx).
//
// Aturan penting:
//  - Tahap sesudah approval dihitung PER BARANG lalu digabung, karena tiap
//    barang bisa berada di PO dan tahap yang berbeda.
//  - Tahap hanya ditandai "dilewati" kalau ada buktinya (Stok GA, vendor Site,
//    konfirmasi requester sebelum GA). Data lama tanpa jejak tetap "selesai".
//  - Tanggal hanya diambil dari data tercatat, tidak pernah diperkirakan.
import { Approval, Discussion, MaterialRequest, Order, StoredVendorDetails } from "@/type";
import {
  PO_PRE_APPROVAL_STATUSES,
  PO_RECEIPT_COLUMNS,
  ReceiptPo,
  buildPoLines,
  getRequesterReceivedQty,
  orderPartNumbers,
  stockQty,
  wasConfirmedBeforeGa,
} from "@/lib/requesterReceipt";
import {
  EPS,
  ItemStep,
  OPEN_STATES,
  SETTLED_STATES,
  StepCopy,
  TrackEvent,
  TrackLink,
  TrackState,
  TrackStep,
  TrackTarget,
  TrackTone,
  TrackingLog,
  buildApprovalEvents,
  buildTarget,
  groupBy,
  haltAfterFailure,
  lastEventAt,
  markStopped,
  nextApprover,
  pendingStep,
  rollUpSteps,
  sortEvents,
  toQty,
} from "@/lib/tracking";
import {
  APPROVAL_TYPE_RECEIVER,
  DOC_STATUS_CANCELLED,
  INACTIVE_DOC_STATUSES,
  MR_ITEM_STATUSES,
  getDeliveryTypeLabel,
  isDpBpPaymentTerm,
  isPaymentValidatorApproval,
  isPoPaid,
} from "@/type/enum";

export const PO_TRACKING_COLUMNS = `${PO_RECEIPT_COLUMNS}, created_at, vendor_details, payment_term, dp_paid, bp_paid, cancel_reason`;

export interface TrackingPo extends ReceiptPo {
  created_at: string;
  vendor_details: StoredVendorDetails | null;
  payment_term: string | null;
  dp_paid?: boolean | null;
  bp_paid?: boolean | null;
  cancel_reason?: string | null;
}

export type TrackStepId =
  | "created"
  | "validation"
  | "approval"
  | "po"
  | "payment"
  | "ga"
  | "delivery"
  | "received";

export type ItemStepId = Extract<
  TrackStepId,
  "po" | "payment" | "ga" | "delivery" | "received"
>;

export interface ItemTrack {
  index: number;
  order: Order;
  qty: number;
  receivedQty: number;
  closedLabel: string | null;
  position: string;
  positionState: TrackState;
  steps: ItemStep<ItemStepId>[];
}

type MrStep = TrackStep<TrackStepId>;

export interface MrTracking {
  tone: TrackTone;
  headline: string;
  detail: string | null;
  waitingOn: string | null;
  currentStepId: TrackStepId;
  steps: MrStep[];
  items: ItemTrack[];
  received: { items: number; total: number } | null;
  target: TrackTarget | null;
}

export const ITEM_RANK: Record<string, number> = {
  [MR_ITEM_STATUSES.PENDING]: 0,
  [MR_ITEM_STATUSES.PROCESSING]: 1,
  "PO Created": 1, // data lama
  [MR_ITEM_STATUSES.SHIPPED_BY_VENDOR]: 2,
  [MR_ITEM_STATUSES.DITERIMA_GA]: 3,
  [MR_ITEM_STATUSES.ON_DELIVERY]: 4,
  [MR_ITEM_STATUSES.PENDING_BAST]: 4,
  [MR_ITEM_STATUSES.COMPLETED]: 5,
};

export const ITEM_STEP_COPY: Record<ItemStepId, StepCopy> = {
  po: {
    title: "PO Dibuat",
    upcoming: "Purchasing membuat PO setelah MR disetujui.",
    active: "Menunggu dibuatkan PO",
    partial: "Sebagian barang sudah dibuatkan PO",
  },
  payment: {
    title: "Approval & Bayar PO",
    upcoming: "PO perlu disetujui dan dibayar sebelum vendor mengirim.",
    active: "PO sedang disetujui atau dibayar",
    partial: "Sebagian PO sudah disetujui dan dibayar",
  },
  ga: {
    title: "Tiba di GA",
    upcoming: "Vendor mengirim barang, lalu GA mencatat penerimaannya.",
    active: "Barang sedang menuju GA",
    partial: "Sebagian barang sudah tiba di GA",
  },
  delivery: {
    title: "Dikirim ke Requester",
    upcoming: "GA mengirim barang ke requester setelah barang tiba.",
    active: "Barang menunggu dikirim GA",
    partial: "Sebagian barang sudah dikirim GA",
  },
  received: {
    title: "Barang Diterima",
    upcoming: "Requester mengonfirmasi barang yang sudah sampai.",
    active: "Barang menunggu konfirmasi terima",
    partial: "Sebagian barang sudah diterima",
  },
};

const ITEM_STEP_IDS = Object.keys(ITEM_STEP_COPY) as ItemStepId[];

const addTo = (map: Map<string, number>, key: string, qty: number) =>
  map.set(key, (map.get(key) || 0) + qty);

const poLink = (po: TrackingPo): TrackLink => ({
  label: po.kode_po,
  href: `/purchase-order/${po.id}`,
});

const isSiteVendorPo = (po: TrackingPo) =>
  po.vendor_details?.tipe_vendor === "Site";

// Posisi pembayaran satu PO. "after_receive" = pembayaran memang setelah barang
// diterima (Termin), atau barangnya sudah keburu diterima.
type PoPhase = "approval" | "unpaid" | "after_receive" | "cleared";

const getPoPhase = (po: TrackingPo): PoPhase => {
  if (PO_PRE_APPROVAL_STATUSES.includes(po.status)) return "approval";
  const approvals = po.approvals || [];
  if (!approvals.some((a) => isPaymentValidatorApproval(a))) return "cleared";
  if (isPoPaid(approvals)) return "cleared";
  const isReceiverTurn = nextApprover(approvals)?.type === APPROVAL_TYPE_RECEIVER;
  return isReceiverTurn || po.receive_record ? "after_receive" : "unpaid";
};

const buildPoPaymentEvents = (po: TrackingPo): TrackEvent[] => {
  const approvals = po.approvals || [];
  const events: TrackEvent[] = [];
  if (!PO_PRE_APPROVAL_STATUSES.includes(po.status)) {
    const approved = approvals
      .filter(
        (a) =>
          a.status === "approved" &&
          !isPaymentValidatorApproval(a) &&
          a.type !== APPROVAL_TYPE_RECEIVER,
      )
      .map((a) => a.processed_at)
      .filter((at): at is string => !!at)
      .sort();
    events.push({
      at: approved[approved.length - 1],
      label: `${po.kode_po} disetujui`,
    });
  }
  const paid = approvals.find(
    (a) => a.status === "approved" && isPaymentValidatorApproval(a),
  );
  if (paid) {
    events.push({
      at: paid.processed_at,
      label: `Pembayaran ${po.kode_po} divalidasi`,
      note:
        isDpBpPaymentTerm(po.payment_term) && !po.bp_paid
          ? "DP tercatat, pelunasan menyusul."
          : null,
    });
  }
  return events;
};

export interface ItemContext {
  order: Order;
  qty: number;
  rank: number;
  covered: number;
  stock: number;
  gaQty: number;
  received: number;
  activePos: TrackingPo[];
  deadPos: TrackingPo[];
  requester: string;
}

const qtyOf = (ctx: ItemContext, n: number) =>
  `${n} / ${ctx.qty} ${ctx.order.uom}`;

const isStockOnly = (ctx: ItemContext) =>
  ctx.qty > 0 && ctx.stock >= ctx.qty - EPS;

const isSiteOnly = (ctx: ItemContext) =>
  ctx.activePos.length > 0 && ctx.activePos.every(isSiteVendorPo);

const buildPoStep = (ctx: ItemContext): Partial<ItemStep> => {
  const { order, qty, covered, stock, activePos, deadPos, rank } = ctx;
  const events: TrackEvent[] = activePos.map((po) => ({
    at: po.created_at,
    label: `${po.kode_po} dibuat`,
    note: po.vendor_details?.nama_vendor,
  }));
  for (const entry of order.stock_fulfillments || []) {
    events.push({
      at: entry.fulfilled_at,
      label: `${entry.qty} ${order.uom} dipenuhi dari Stok GA`,
      itemName: order.name,
    });
  }
  for (const po of deadPos) {
    events.push({
      label: `${po.kode_po} ${po.status === "Rejected" ? "ditolak" : "dibatalkan"}`,
      note:
        po.cancel_reason ||
        po.approvals?.find((a) => a.status === "rejected")?.rejection_note,
      tone: "danger",
    });
  }
  const links = activePos.map(poLink);

  if (isStockOnly(ctx)) {
    return { state: "skipped", caption: "Dipenuhi dari Stok GA", events, links };
  }
  if (covered >= qty - EPS || rank >= 2) {
    return { state: "done", caption: "Sudah masuk PO", events, links };
  }
  if (covered > EPS) {
    return {
      state: "partial",
      caption: `${stock > EPS ? "Terpenuhi" : "Ter-PO"} ${qtyOf(ctx, covered)}`,
      owner: "Purchasing",
      events,
      links,
    };
  }
  return {
    state: "active",
    caption:
      deadPos.length > 0 ? "Menunggu PO pengganti" : "Menunggu dibuatkan PO",
    owner: "Purchasing",
    events,
    links,
  };
};

const buildPaymentStep = (ctx: ItemContext): Partial<ItemStep> => {
  const { order, activePos, rank, covered, stock } = ctx;
  if (isStockOnly(ctx)) {
    return { state: "skipped", caption: "Tidak perlu PO" };
  }
  // Part kembar: PO yang ada bisa sudah habis dipakai baris lain.
  if (activePos.length === 0 || (rank < 2 && covered - stock <= EPS)) {
    return rank >= 2
      ? { state: "done", caption: "Selesai" }
      : { state: "upcoming", caption: "Belum ada PO" };
  }

  const events = activePos.flatMap(buildPoPaymentEvents);
  const links = activePos.map(poLink);
  const phases = activePos.map((po) => ({ po, phase: getPoPhase(po) }));
  const waitingApproval = phases.find((p) => p.phase === "approval")?.po;
  const unpaid = phases.find((p) => p.phase === "unpaid")?.po;
  const hasProgress = phases.some((p) => p.phase !== "approval");
  const owner = (po: TrackingPo) => nextApprover(po.approvals)?.nama || "Approver PO";

  if (order.level === "Open 3B") {
    return {
      state: "blocked",
      caption: "Ada kendala pembayaran",
      owner: "Purchasing & Finance",
      events: [
        ...events,
        { label: "Ditandai ada kendala pembayaran", note: order.payment_issue_note, tone: "warning" },
      ],
      links,
    };
  }
  if (waitingApproval) {
    return {
      state: hasProgress ? "partial" : "active",
      caption: `${waitingApproval.kode_po} menunggu approval`,
      owner: owner(waitingApproval),
      events,
      links,
    };
  }
  if (unpaid && rank < 3) {
    return {
      state: "active",
      caption: `${unpaid.kode_po} menunggu pembayaran`,
      owner: owner(unpaid),
      events,
      links,
    };
  }
  if (phases.some((p) => p.phase !== "cleared")) {
    return { state: "deferred", caption: "Pembayaran menyusul", events, links };
  }
  return { state: "done", caption: "PO disetujui", events, links };
};

const buildGaStep = (
  ctx: ItemContext,
  paymentState: TrackState | undefined,
): Partial<ItemStep> => {
  const { order, qty, rank, gaQty, activePos } = ctx;
  if (isStockOnly(ctx)) return { state: "skipped", caption: "Dari Stok GA" };
  if (isSiteOnly(ctx)) {
    return { state: "skipped", caption: "Vendor Site kirim langsung" };
  }

  const events: TrackEvent[] = activePos
    .filter((po) => po.receive_record && gaQty > EPS)
    .map((po) => ({
      at: po.receive_record?.received_at,
      label: `Barang ${po.kode_po} diterima`,
      note: po.receive_record?.received_by_name,
    }));

  const bypassed = wasConfirmedBeforeGa(order);
  if (bypassed && gaQty <= EPS && rank === 5) {
    return { state: "skipped", caption: "Dikonfirmasi langsung requester" };
  }
  if (rank >= 3) return { state: "done", caption: "Sudah tiba di GA", events };
  if (gaQty > EPS && gaQty < qty - EPS) {
    return {
      state: "partial",
      caption: `Tiba ${qtyOf(ctx, gaQty)}`,
      owner: "Vendor & GA",
      events,
    };
  }
  if (rank === 2) {
    return { state: "active", caption: "Sedang dikirim vendor", owner: "Vendor" };
  }
  if (paymentState === "done" || paymentState === "deferred") {
    return { state: "active", caption: "Menunggu kiriman vendor", owner: "Vendor" };
  }
  return { state: "upcoming", caption: "Belum dikirim vendor" };
};

export const buildDeliveryStep = (ctx: ItemContext): Partial<ItemStep> => {
  const { order, qty, rank, received } = ctx;
  if (isStockOnly(ctx)) return { state: "skipped", caption: "Dari Stok GA" };

  const info = order.delivery_info;
  if (info) {
    const via = [getDeliveryTypeLabel(info.delivery_type), info.courier]
      .filter(Boolean)
      .join(" - ");
    const events: TrackEvent[] = [
      {
        at: info.sent_at,
        label: `Dikirim ${info.qty_sent} ${order.uom}`,
        note: [via, info.tracking_number && `Resi ${info.tracking_number}`]
          .filter(Boolean)
          .join(" · "),
        itemName: order.name,
      },
    ];
    const sent = toQty(info.qty_sent);
    return rank < 5 && sent < qty - EPS && received < qty - EPS
      ? {
          state: "partial",
          caption: `Terkirim ${qtyOf(ctx, sent)}`,
          owner: "GA",
          events,
        }
      : { state: "done", caption: "Sudah dikirim GA", events };
  }

  if (isSiteOnly(ctx)) {
    return { state: "skipped", caption: "Vendor Site kirim langsung" };
  }
  if (rank === 5 && wasConfirmedBeforeGa(order)) {
    return { state: "skipped", caption: "Dikonfirmasi langsung requester" };
  }
  if (rank >= 4) return { state: "done", caption: "Sudah dikirim" };
  if (rank === 3) {
    return { state: "active", caption: "Menunggu dikirim GA", owner: "GA" };
  }
  return { state: "upcoming", caption: "Belum dikirim" };
};

export const buildReceivedStep = (
  ctx: ItemContext,
  paymentState: TrackState | undefined,
): Partial<ItemStep> => {
  const { order, rank, received, requester } = ctx;
  const events: TrackEvent[] = (order.requester_receipts || []).map((r) => ({
    at: r.confirmed_at,
    label: `Diterima ${r.qty} ${order.uom}`,
    note: `${r.confirmed_by_name}${r.via === "scan_qr" ? " lewat scan QR BAST" : ""}`,
    itemName: order.name,
  }));

  if (rank === 5) {
    if (events.length === 0) {
      const stockAt = order.stock_fulfillments?.at(-1)?.fulfilled_at;
      events.push({
        at: stockAt || order.updated_at,
        label: stockAt ? "Dipenuhi dari Stok GA" : "Barang dikonfirmasi diterima",
        itemName: order.name,
      });
    }
    return { state: "done", caption: "Sudah diterima", events };
  }
  if (received > EPS) {
    return {
      state: "partial",
      caption: `Diterima ${qtyOf(ctx, received)}`,
      owner: requester,
      events,
    };
  }
  if (rank === 4) {
    return { state: "active", caption: "Menunggu konfirmasi terima", owner: requester };
  }
  if (isSiteOnly(ctx) && (paymentState === "done" || paymentState === "deferred")) {
    return { state: "active", caption: "Vendor mengirim langsung", owner: "Vendor" };
  }
  return { state: "upcoming", caption: "Belum diterima" };
};

const toItemStep = (
  id: ItemStepId,
  step: Partial<ItemStep>,
): ItemStep<ItemStepId> => ({
  id,
  title: ITEM_STEP_COPY[id].title,
  state: step.state || "upcoming",
  caption: step.caption || "",
  owner: step.owner,
  events: step.events || [],
  links: step.links || [],
});

const buildItemTracks = (
  orders: Order[],
  pos: TrackingPo[],
  requester: string,
): ItemTrack[] => {
  const isInactive = (po: TrackingPo) => INACTIVE_DOC_STATUSES.includes(po.status);
  const livePos = pos.filter((po) => !isInactive(po));

  // Qty PO dipakai bergiliran supaya baris MR dengan part kembar tidak
  // menghitung qty yang sama dua kali (sama seperti getReceiptItemStates).
  const coverage = new Map<string, number>();
  const gaReceived = new Map<string, number>();
  for (const po of livePos) {
    for (const line of buildPoLines(po)) {
      addTo(coverage, line.part_number, line.coverage);
      addTo(gaReceived, line.part_number, line.received);
    }
  }
  // `receive_record` juga berisi qty konfirmasi requester, jadi dikeluarkan
  // supaya yang tersisa memang qty yang tercatat GA.
  for (const order of orders) {
    for (const receipt of order.requester_receipts || []) {
      for (const allocation of receipt.allocations) {
        addTo(gaReceived, allocation.part_number, -allocation.qty);
      }
    }
  }

  return orders.map((order, index) => {
    const status = order.status || MR_ITEM_STATUSES.PENDING;
    const qty = toQty(order.qty);
    const receivedQty = getRequesterReceivedQty(order);
    const closedLabel =
      status === MR_ITEM_STATUSES.CANCELLED
        ? "Dibatalkan"
        : status === MR_ITEM_STATUSES.REPLACED
          ? "Diganti"
          : null;

    if (closedLabel) {
      return {
        index,
        order,
        qty,
        receivedQty,
        closedLabel,
        position: closedLabel,
        positionState: "halted",
        steps: ITEM_STEP_IDS.map((id) =>
          toItemStep(id, { state: "halted", caption: closedLabel }),
        ),
      };
    }

    const parts = orderPartNumbers(order);
    const isLinked = (po: TrackingPo) =>
      (po.items || []).some((i) => parts.has(i.part_number)) ||
      (order.manual_po_links || []).some((l) => l.kode_po === po.kode_po) ||
      (order.po_refs || []).includes(po.kode_po);
    const linked = pos.filter(isLinked);

    const stock = stockQty(order);
    let covered = stock;
    for (const link of order.manual_po_links || []) {
      const po = livePos.find((p) => p.kode_po === link.kode_po);
      if (po && !(po.items || []).some((i) => parts.has(i.part_number))) {
        covered += toQty(link.qty);
      }
    }
    let gaQty = 0;
    for (const part of parts) {
      const takeCover = Math.min(coverage.get(part) || 0, Math.max(0, qty - covered));
      addTo(coverage, part, -takeCover);
      covered += takeCover;
      const takeGa = Math.min(
        Math.max(0, gaReceived.get(part) || 0),
        Math.max(0, qty - gaQty),
      );
      addTo(gaReceived, part, -takeGa);
      gaQty += takeGa;
    }

    const ctx: ItemContext = {
      order,
      qty,
      rank: ITEM_RANK[status] ?? 0,
      covered,
      stock,
      gaQty,
      received: receivedQty,
      activePos: linked.filter((po) => !isInactive(po)),
      deadPos: linked.filter(isInactive),
      requester,
    };

    const payment = buildPaymentStep(ctx);
    const steps = [
      toItemStep("po", buildPoStep(ctx)),
      toItemStep("payment", payment),
      toItemStep("ga", buildGaStep(ctx, payment.state)),
      toItemStep("delivery", buildDeliveryStep(ctx)),
      toItemStep("received", buildReceivedStep(ctx, payment.state)),
    ];
    const current =
      steps.find((s) => OPEN_STATES.includes(s.state)) ||
      steps.find((s) => s.state === "upcoming") ||
      steps[steps.length - 1];

    return {
      index,
      order,
      qty,
      receivedQty,
      closedLabel: null,
      position: current.caption,
      positionState: current.state,
      steps,
    };
  });
};

const rollUpItemStep = (id: ItemStepId, items: ItemTrack[]) =>
  rollUpSteps(
    id,
    ITEM_STEP_COPY[id],
    items.map((item) => item.steps.find((s) => s.id === id)!),
  );

const buildValidationEvents = (
  logs: TrackingLog[],
  discussions: Discussion[],
): TrackEvent[] => {
  const events: TrackEvent[] = [];
  for (const log of logs) {
    const actor = log.users_with_profiles?.nama;
    if (log.action_type === "VALIDATE_MR") {
      events.push({ at: log.created_at, label: "Divalidasi GA", note: actor });
    } else if (log.action_type === "HOLD_MR") {
      events.push({
        at: log.created_at,
        label: "Ditahan GA untuk perbaikan",
        note: log.metadata?.instruction,
        tone: "warning",
      });
    } else if (log.action_type === "RESUBMIT_MR") {
      events.push({ at: log.created_at, label: "Diperbaiki dan diajukan ulang" });
    } else if (log.action_type === "REJECT_MR") {
      events.push({
        at: log.created_at,
        label: "Ditolak GA",
        note: log.metadata?.reason,
        tone: "danger",
      });
    }
  }
  if (events.some((e) => e.tone)) return sortEvents(events);

  // Log tidak terbaca: arahan & alasan tetap ada di catatan diskusi.
  for (const d of discussions) {
    if (d.user_name?.startsWith("[HOLD]")) {
      events.push({
        at: d.timestamp,
        label: "Ditahan GA untuk perbaikan",
        note: d.message.split("Arahan: ")[1] || d.message,
        tone: "warning",
      });
    } else if (d.message?.startsWith("MR Ditolak oleh GA")) {
      events.push({
        at: d.timestamp,
        label: "Ditolak GA",
        note: d.message.split("alasan: ")[1] || d.message,
        tone: "danger",
      });
    }
  }
  return sortEvents(events);
};

const buildValidationStep = (
  mr: MaterialRequest,
  events: TrackEvent[],
  requester: string,
): MrStep => {
  const base = { id: "validation" as const, title: "Validasi GA", links: [], breakdown: [], events };
  const holds = events.filter((e) => e.tone === "warning").length;
  const lastAt = lastEventAt(events);

  if (mr.status === "Draft") {
    return { ...base, state: "upcoming", caption: "Belum diajukan", summary: "MR belum diajukan ke GA." };
  }
  if (mr.status === "Pending Validation") {
    return {
      ...base,
      state: "active",
      caption: holds > 0 ? "Diajukan ulang" : "Menunggu GA",
      summary: "GA memeriksa MR dan menentukan Cost Center serta jalur approval.",
      owner: "GA",
    };
  }
  if (mr.status === "On Hold") {
    return {
      ...base,
      state: "blocked",
      caption: "Perlu diperbaiki",
      summary: "MR ditahan GA. Setelah diperbaiki, MR diajukan ulang untuk divalidasi.",
      owner: requester,
      at: lastAt,
    };
  }
  const rejectedByApprover = (mr.approvals || []).some((a) => a.status === "rejected");
  if (mr.status === "Rejected" && !rejectedByApprover) {
    return { ...base, state: "failed", caption: "Ditolak GA", summary: "MR ditolak saat validasi.", at: lastAt };
  }
  if (mr.status === DOC_STATUS_CANCELLED && (mr.approvals || []).length === 0) {
    return { ...base, state: "upcoming", caption: "", summary: "" };
  }
  return {
    ...base,
    state: "done",
    caption: holds > 0 ? `Selesai, revisi ${holds}x` : "Sudah divalidasi",
    summary: "MR sudah diperiksa GA dan diteruskan ke jalur approval.",
    at: lastAt,
  };
};

const buildApprovalStep = (mr: MaterialRequest, isPreApproval: boolean): MrStep => {
  const approvals = mr.approvals || [];
  const total = approvals.length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejected = approvals.find((a) => a.status === "rejected");
  const next = nextApprover(approvals);
  const events = buildApprovalEvents(approvals, next);
  const base = {
    id: "approval" as const,
    title: "Approval MR",
    events,
    links: [],
    breakdown: [],
    at: lastEventAt(events),
  };

  if (rejected) {
    return {
      ...base,
      state: "failed",
      caption: `Ditolak ${rejected.nama}`,
      summary: "MR ditolak di jalur approval.",
    };
  }
  if (mr.status === "Pending Approval") {
    return {
      ...base,
      state: "active",
      caption: `${approvedCount} / ${total} disetujui`,
      summary: "MR disetujui berurutan oleh setiap approver.",
      owner: next?.nama,
    };
  }
  if (isPreApproval && !(mr.status === DOC_STATUS_CANCELLED && total > 0 && approvedCount === total)) {
    return {
      ...base,
      state: "upcoming",
      caption: "Belum sampai sini",
      summary: "Setelah divalidasi GA, MR disetujui berurutan oleh setiap approver.",
    };
  }
  return {
    ...base,
    state: "done",
    caption: total > 0 ? `${total} approver setuju` : "Sudah disetujui",
    summary: "Semua approver sudah menyetujui MR.",
  };
};

const HEADLINES: Partial<Record<TrackStepId, Record<"active" | "partial", string>>> = {
  po: { active: "Menunggu dibuatkan PO", partial: "Sebagian barang sudah dibuatkan PO" },
  payment: { active: "PO sedang disetujui atau dibayar", partial: "Sebagian PO sudah disetujui dan dibayar" },
  ga: { active: "Barang sedang menuju GA", partial: "Sebagian barang sudah tiba di GA" },
  delivery: { active: "Barang menunggu dikirim GA", partial: "Sebagian barang sudah dikirim GA" },
  received: { active: "Barang menunggu konfirmasi terima", partial: "Sebagian barang sudah diterima" },
};

export const buildMrTracking = ({
  mr,
  pos,
  logs,
  isOwner,
  now,
}: {
  mr: MaterialRequest;
  pos: TrackingPo[];
  logs: TrackingLog[];
  isOwner: boolean;
  now: Date;
}): MrTracking => {
  const requesterName = mr.users_with_profiles?.nama || "Requester";
  const requester = isOwner ? "Anda" : requesterName;
  const isCancelled = mr.status === DOC_STATUS_CANCELLED;
  const isRejected = mr.status === "Rejected";
  const isPreApproval = [
    "Draft",
    "Pending Validation",
    "On Hold",
    "Pending Approval",
    "Rejected",
    DOC_STATUS_CANCELLED,
  ].includes(mr.status);

  const validationEvents = buildValidationEvents(logs, mr.discussions || []);
  const items = isPreApproval ? [] : buildItemTracks(mr.orders || [], pos, requester);
  const activeItems = items.filter((item) => !item.closedLabel);

  const createdStep: MrStep = {
    id: "created",
    title: "MR Dibuat",
    state: "done",
    caption: requesterName,
    summary: `MR diajukan oleh ${requesterName}.`,
    at: new Date(mr.created_at).toISOString(),
    events: [{ at: new Date(mr.created_at).toISOString(), label: "MR dibuat", note: requesterName }],
    links: [],
    breakdown: [],
  };

  let steps: MrStep[] = [
    createdStep,
    buildValidationStep(mr, validationEvents, requester),
    buildApprovalStep(mr, isPreApproval),
    ...ITEM_STEP_IDS.map((id) =>
      isPreApproval
        ? pendingStep(id, ITEM_STEP_COPY[id])
        : rollUpItemStep(id, activeItems),
    ),
  ];

  if (isCancelled) {
    steps = steps.map((step) =>
      step.id === "po" && pos.length > 0
        ? { ...step, state: "done", caption: "PO sempat dibuat" }
        : step,
    );
    steps = markStopped(steps, "MR", "Dibatalkan", [
      { at: mr.cancelled_at, label: "MR dibatalkan admin", note: mr.cancel_reason, tone: "danger" },
    ]);
  } else {
    steps = haltAfterFailure(steps);
  }

  const current =
    steps.find((s) => s.state === "failed") ||
    steps.find((s) => OPEN_STATES.includes(s.state)) ||
    steps.find((s) => s.state === "upcoming") ||
    steps[steps.length - 1];

  const receivedItems = activeItems.filter(
    (item) => item.order.status === MR_ITEM_STATUSES.COMPLETED,
  ).length;
  const allReceived = activeItems.length > 0 && receivedItems === activeItems.length;
  const received = isPreApproval
    ? null
    : { items: receivedItems, total: activeItems.length };

  let tone: TrackTone = "progress";
  let headline: string;
  let detail: string | null = null;
  let waitingOn = current.owner || null;

  const lastNote = (tone: TrackEvent["tone"]) =>
    [...validationEvents].reverse().find((e) => e.tone === tone)?.note || null;

  if (isCancelled) {
    tone = "failed";
    headline = "MR dibatalkan";
    detail = mr.cancel_reason || null;
    waitingOn = null;
  } else if (isRejected) {
    tone = "failed";
    headline = current.id === "approval" ? current.caption : "MR ditolak GA";
    detail =
      mr.approvals?.find((a) => a.status === "rejected")?.rejection_note ||
      lastNote("danger");
    waitingOn = null;
  } else if (mr.status === "On Hold") {
    tone = "attention";
    headline = "MR ditahan GA dan perlu diperbaiki";
    detail = lastNote("warning");
  } else if (mr.status === "Draft") {
    headline = "MR belum diajukan";
    waitingOn = requester;
  } else if (mr.status === "Pending Validation") {
    headline = "Menunggu validasi GA";
    detail = current.summary;
  } else if (mr.status === "Pending Approval") {
    headline = waitingOn ? `Menunggu persetujuan ${waitingOn}` : "Menunggu persetujuan";
    detail = `Approval ${current.caption}.`;
  } else if (activeItems.length === 0) {
    tone = "failed";
    headline = "Semua barang dibatalkan atau diganti";
    waitingOn = null;
  } else if (allReceived) {
    tone = "success";
    headline = "Semua barang sudah diterima";
    waitingOn = null;
  } else {
    if (current.state === "blocked") tone = "attention";
    const copy = HEADLINES[current.id];
    headline =
      receivedItems > 0
        ? `${receivedItems} dari ${activeItems.length} barang sudah diterima`
        : current.state === "blocked"
          ? "Ada kendala pembayaran PO"
          : current.id === "received" && current.owner === "Vendor"
            ? "Barang sedang dikirim vendor"
            : copy?.[current.state === "partial" ? "partial" : "active"] || current.title;
    const positions = groupBy(
      activeItems
        .filter((item) => item.order.status !== MR_ITEM_STATUSES.COMPLETED)
        .map((item) => ({ label: item.position, state: item.positionState })),
    );
    detail =
      activeItems.length > 1
        ? positions.map((p) => `${p.count} barang: ${p.label}`).join(" · ")
        : positions[0]?.label || null;
    if (detail === headline) detail = null;
  }

  return {
    tone,
    headline,
    detail,
    waitingOn,
    currentStepId: current.id,
    steps,
    items,
    received,
    target:
      tone === "failed" ? null : buildTarget(mr, allReceived, now),
  };
};
