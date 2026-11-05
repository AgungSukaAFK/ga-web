// Model "Lacak PO" di halaman detail PO: posisi PO dari dibuat sampai barangnya
// diterima requester dan pembayarannya beres.
//
// Semua fungsi di sini murni (tanpa Supabase). Tampilannya ada di
// components/tracking-card.tsx (adapternya purchase-order/[id]/PoTrackingCard.tsx).
//
// Aturan penting:
//  - Posisi dibaca dari giliran di jalur approval, bukan dari `status` saja.
//    Template tanpa step "Payment Approval" tetap "Pending Approval" sampai
//    Payment Validator approve, padahal approver biasa sudah selesai semua.
//  - Urutan tahap mengikuti template: Receiver sebelum Payment Validator berarti
//    barang datang dulu (Termin), jadi Pembayaran ditaruh paling akhir.
//  - Pengiriman GA dan konfirmasi requester tercatat per item MR, bukan per PO.
//    Item MR yang dipecah ke beberapa PO memakai angka gabungannya.
//  - Tanggal hanya diambil dari data tercatat, tidak pernah diperkirakan.
import { getAdminActionNote } from "@/lib/approvalOverride";
import { Approval, Order, PurchaseOrderDetail } from "@/type";
import {
  ITEM_RANK,
  ITEM_STEP_COPY,
  ItemContext,
  TrackingPo,
  buildDeliveryStep,
  buildReceivedStep,
} from "@/lib/mrTracking";
import {
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
  TrackState,
  TrackStep,
  TrackTarget,
  TrackTone,
  TrackingLog,
  buildApprovalEvents,
  rejectedCaption,
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
  MR_ITEM_STATUSES,
  PO_STATUS_FULL_RECEIVED,
  isDpBpPaymentTerm,
  isPaymentValidatorApproval,
} from "@/type/enum";

export type PoStepId =
  | "created"
  | "validation"
  | "approval"
  | "payment"
  | "arrival"
  | "delivery"
  | "received";

type PoItemStepId = Extract<PoStepId, "arrival" | "delivery" | "received">;
type PoStep = TrackStep<PoStepId>;

export interface PoItemTrack {
  index: number;
  name: string;
  uom: string;
  qty: number;
  // Qty item MR-nya kalau berbeda dari qty di PO ini (item dipecah ke beberapa PO).
  mrQty: number | null;
  closedQty: number;
  arrivedQty: number;
  statusNote: string | null;
  closedLabel: string | null;
  isLinked: boolean;
  isCompleted: boolean;
  position: string;
  positionState: TrackState;
  steps: ItemStep<PoItemStepId>[];
}

export interface PoTracking {
  tone: TrackTone;
  headline: string;
  detail: string | null;
  waitingOn: string | null;
  currentStepId: PoStepId;
  steps: PoStep[];
  items: PoItemTrack[];
  arrived: { items: number; total: number } | null;
  received: { items: number; total: number } | null;
  target: TrackTarget | null;
}

interface PoLineView {
  part_number: string;
  name: string;
  uom: string;
  arrived: number;
  coverage: number;
  ordered: number;
}

// Hal yang dibaca berulang oleh tiap tahap.
interface PoFlow {
  po: PurchaseOrderDetail;
  approvals: Approval[];
  next: Approval | undefined;
  pv: Approval | undefined;
  receiver: Approval | undefined;
  gate: Approval[];
  isValidated: boolean;
  isGateCleared: boolean;
  isReceiveFirst: boolean;
  canGoodsMove: boolean;
  isSite: boolean;
  place: string;
  requester: string;
  arrivalOwner: string;
}

const isReceiverApproval = (a: Approval) => a.type === APPROVAL_TYPE_RECEIVER;

const buildFlow = (po: PurchaseOrderDetail, requester: string): PoFlow => {
  const approvals = po.approvals || [];
  const pvIndex = approvals.findIndex(isPaymentValidatorApproval);
  const receiverIndex = approvals.findIndex(isReceiverApproval);
  const pv = approvals[pvIndex];
  const receiver = approvals[receiverIndex];
  const gate = approvals.filter(
    (a) => !isPaymentValidatorApproval(a) && !isReceiverApproval(a),
  );

  const isValidated =
    approvals.length > 0 ||
    !["Draft", "Pending Validation", "Rejected", DOC_STATUS_CANCELLED].includes(po.status);

  // Approver sesudah step bayar/terima tidak menahan barang.
  const firstGoodsStep = approvals.findIndex(
    (a) => isPaymentValidatorApproval(a) || isReceiverApproval(a),
  );
  const leadGate = firstGoodsStep === -1 ? gate : approvals.slice(0, firstGoodsStep);
  const isGateCleared =
    approvals.length > 0
      ? leadGate.every((a) => a.status === "approved")
      : isValidated && po.status !== "Pending Approval";

  const isReceiveFirst = pvIndex !== -1 && receiverIndex !== -1 && receiverIndex < pvIndex;
  const isSite = po.vendor_details?.tipe_vendor === "Site";

  return {
    po,
    approvals,
    next: nextApprover(approvals),
    pv,
    receiver,
    gate,
    isValidated,
    isGateCleared,
    isReceiveFirst,
    canGoodsMove:
      isGateCleared && (!pv || isReceiveFirst || pv.status === "approved"),
    isSite,
    place: isSite ? "Site" : "GA",
    requester,
    arrivalOwner: `Vendor & ${isSite ? requester : receiver?.nama || "GA"}`,
  };
};

const arrivalCopy = ({ isSite, place }: PoFlow): StepCopy => ({
  title: `Tiba di ${place}`,
  upcoming: isSite
    ? "Vendor mengirim langsung ke site, lalu requester mencatat penerimaannya."
    : "Vendor mengirim barang, lalu GA mencatat penerimaannya.",
  active: `Barang sedang menuju ${place}`,
  partial: `Sebagian barang sudah tiba di ${place}`,
});

const toLineViews = (po: PurchaseOrderDetail, trackingPo: TrackingPo): PoLineView[] => {
  // Data lama: PO sudah Full Received tanpa `receive_record`.
  const isFullWithoutRecord =
    po.status === PO_STATUS_FULL_RECEIVED && !po.receive_record;
  const items = po.items || [];
  const withPart = items.filter((i) => i.part_number);

  return [
    // buildPoLines mempertahankan urutan item yang punya part number.
    ...buildPoLines(trackingPo).map((line, index) => ({
      part_number: line.part_number,
      name: line.part_name,
      uom: withPart[index].uom || "",
      arrived: isFullWithoutRecord ? line.coverage : line.received,
      coverage: line.coverage,
      ordered: toQty(withPart[index].qty),
    })),
    // Item lama tanpa part number tidak tercatat di `receive_record`.
    ...items
      .filter((i) => !i.part_number)
      .map((item) => ({
        part_number: "",
        name: item.name,
        uom: item.uom || "",
        arrived: po.status === PO_STATUS_FULL_RECEIVED ? toQty(item.qty) : 0,
        coverage: toQty(item.qty),
        ordered: toQty(item.qty),
      })),
  ];
};

// Pasangkan baris PO ke baris MR. Part kembar kebagian baris MR yang berbeda.
const matchOrders = (lines: PoLineView[], orders: Order[], kodePo: string) => {
  const claimed = new Set<number>();
  const claim = (index: number) => {
    if (index === -1) return undefined;
    claimed.add(index);
    return orders[index];
  };
  const isSameItem = (order: Order, line: PoLineView) =>
    line.part_number
      ? orderPartNumbers(order).has(line.part_number)
      : !order.part_number && order.name === line.name;

  return lines.map((line) => {
    const free = orders.findIndex(
      (o, i) => !claimed.has(i) && isSameItem(o, line),
    );
    if (free !== -1) return claim(free);
    const manual = orders.findIndex(
      (o, i) =>
        !claimed.has(i) &&
        (o.manual_po_links || []).some((l) => l.kode_po === kodePo),
    );
    if (manual !== -1) return claim(manual);
    return orders.find((o) => isSameItem(o, line));
  });
};

// Qty PO ini yang berasal dari konfirmasi requester, bukan checklist penerimaan.
const requesterAllocatedQty = (order: Order, po: PurchaseOrderDetail, part: string) =>
  (order.requester_receipts || [])
    .flatMap((r) => r.allocations)
    .filter((a) => a.po_id === po.id && a.part_number === part)
    .reduce((sum, a) => sum + toQty(a.qty), 0);

const buildArrivalItemStep = (
  flow: PoFlow,
  line: PoLineView,
  order: Order | undefined,
  rank: number,
): Partial<ItemStep> => {
  const { po, isSite, place, canGoodsMove, arrivalOwner } = flow;
  const { arrived, coverage, uom } = line;

  if (arrived >= coverage - EPS) {
    const recorded = order
      ? arrived - requesterAllocatedQty(order, po, line.part_number)
      : arrived;
    return !isSite && order && wasConfirmedBeforeGa(order) && recorded <= EPS
      ? { state: "skipped", caption: "Dikonfirmasi langsung requester" }
      : { state: "done", caption: `Sudah tiba di ${place}` };
  }
  if (arrived > EPS) {
    return {
      state: "partial",
      caption: `Tiba ${arrived} / ${coverage} ${uom}`.trim(),
      owner: arrivalOwner,
    };
  }
  // Data lama: status item sudah maju, tapi penerimaannya tidak tercatat di PO.
  if (rank >= 3) return { state: "done", caption: `Sudah tiba di ${place}` };
  if (!canGoodsMove) return { state: "upcoming", caption: "Belum dikirim vendor" };
  return {
    state: "active",
    caption: rank === 2 ? "Sedang dikirim vendor" : "Menunggu kiriman vendor",
    owner: arrivalOwner,
  };
};

const NOT_LINKED: Partial<ItemStep> = {
  state: "skipped",
  caption: "Tidak terhubung ke item MR",
};

const buildItemTracks = (
  flow: PoFlow,
  trackingPo: TrackingPo,
  lines: PoLineView[],
  matches: (Order | undefined)[],
): PoItemTrack[] => {
  const { po, requester } = flow;
  const hasMr = !!po.material_requests;

  return lines.map((line, index): PoItemTrack => {
    const order = matches[index];
    const status = order?.status || MR_ITEM_STATUSES.PENDING;
    const rank = order ? (ITEM_RANK[status] ?? 0) : 0;
    const orderQty = toQty(order?.qty);
    const closedQty = line.ordered - line.coverage;
    const closedLabel =
      line.coverage <= EPS
        ? "Sisa ditutup"
        : status === MR_ITEM_STATUSES.CANCELLED
          ? "Dibatalkan"
          : status === MR_ITEM_STATUSES.REPLACED
            ? "Diganti"
            : null;

    const toStep = (
      id: PoItemStepId,
      title: string,
      step: Partial<ItemStep>,
    ): ItemStep<PoItemStepId> => ({
      id,
      title,
      state: step.state || "upcoming",
      caption: step.caption || "",
      owner: step.owner,
      events: step.events || [],
      links: [],
    });
    const arrivalTitle = `Tiba di ${flow.place}`;
    const base = {
      index,
      name: line.name,
      uom: line.uom,
      qty: line.coverage,
      mrQty: order && Math.abs(orderQty - line.coverage) > EPS ? orderQty : null,
      closedQty,
      arrivedQty: line.arrived,
      statusNote: order?.status_note || null,
      isLinked: !!order,
      isCompleted: status === MR_ITEM_STATUSES.COMPLETED,
    };

    if (closedLabel) {
      const halted = { state: "halted" as const, caption: closedLabel };
      return {
        ...base,
        closedLabel,
        position: closedLabel,
        positionState: "halted",
        steps: [
          toStep("arrival", arrivalTitle, halted),
          ...(hasMr
            ? [
                toStep("delivery", ITEM_STEP_COPY.delivery.title, halted),
                toStep("received", ITEM_STEP_COPY.received.title, halted),
              ]
            : []),
        ],
      };
    }

    const steps = [
      toStep("arrival", arrivalTitle, buildArrivalItemStep(flow, line, order, rank)),
    ];
    if (hasMr) {
      const ctx: ItemContext | null = order
        ? {
            order,
            qty: orderQty,
            rank,
            covered: line.coverage,
            stock: stockQty(order),
            gaQty: line.arrived,
            received: getRequesterReceivedQty(order),
            activePos: [trackingPo],
            deadPos: [],
            requester,
          }
        : null;

      // Item MR baru "Diterima GA" setelah qty dari semua PO-nya lengkap.
      const waitsOtherPo =
        !!order &&
        rank < 3 &&
        line.arrived >= line.coverage - EPS &&
        orderQty - stockQty(order) > line.coverage + EPS;
      const delivery = ctx ? buildDeliveryStep(ctx) : NOT_LINKED;
      steps.push(
        toStep(
          "delivery",
          ITEM_STEP_COPY.delivery.title,
          waitsOtherPo && delivery.state === "upcoming"
            ? { ...delivery, caption: "Menunggu sisa dari PO lain" }
            : delivery,
        ),
        toStep(
          "received",
          ITEM_STEP_COPY.received.title,
          ctx ? buildReceivedStep(ctx, undefined) : NOT_LINKED,
        ),
      );
    }

    const current =
      steps.find((s) => OPEN_STATES.includes(s.state)) ||
      steps.find((s) => s.state === "upcoming") ||
      steps[steps.length - 1];

    return {
      ...base,
      closedLabel: null,
      position: current.caption,
      positionState: current.state,
      steps,
    };
  });
};

const buildValidationStep = (flow: PoFlow, logs: TrackingLog[]): PoStep => {
  const { po, isValidated } = flow;
  const events: TrackEvent[] = [];
  for (const log of logs) {
    if (log.action_type === "VALIDATE_PO") {
      events.push({
        at: log.created_at,
        label: "Divalidasi GA",
        note: log.users_with_profiles?.nama,
      });
    } else if (log.action_type === "REJECT_PO_VALIDATION") {
      events.push({
        at: log.created_at,
        label: "Ditolak GA",
        note: log.metadata?.rejection_reason,
        tone: "danger",
      });
    }
  }
  const sorted = sortEvents(events);
  const base = {
    id: "validation" as const,
    title: "Validasi GA",
    events: sorted,
    links: [],
    breakdown: [],
    at: lastEventAt(sorted),
  };

  if (isValidated) {
    return {
      ...base,
      state: "done",
      caption: "Sudah divalidasi",
      summary: "GA sudah memeriksa PO dan menetapkan jalur approval.",
    };
  }
  if (po.status === "Rejected") {
    return {
      ...base,
      state: "failed",
      caption: "Ditolak GA",
      summary: "PO ditolak saat validasi.",
    };
  }
  if (po.status === "Pending Validation") {
    return {
      ...base,
      state: "active",
      caption: "Menunggu GA",
      summary: "GA memeriksa PO dan menetapkan jalur approval.",
      owner: "GA",
    };
  }
  return {
    ...base,
    state: "upcoming",
    caption: po.status === "Draft" ? "Belum diajukan" : "Belum sampai sini",
    summary: "PO belum diajukan ke GA.",
  };
};

const buildApprovalStep = (flow: PoFlow): PoStep => {
  const { gate, next, isValidated, isGateCleared, approvals } = flow;
  const events = buildApprovalEvents(gate, next);
  const total = gate.length;
  const approvedCount = gate.filter((a) => a.status === "approved").length;
  const rejected = gate.find((a) => a.status === "rejected");
  const pending = gate.find((a) => a.status === "pending");
  const base = {
    id: "approval" as const,
    title: "Approval PO",
    events,
    links: [],
    breakdown: [],
    at: lastEventAt(events),
  };

  if (rejected) {
    return {
      ...base,
      state: "failed",
      caption: rejectedCaption(rejected),
      summary: "PO ditolak di jalur approval.",
    };
  }
  if (!isValidated) {
    return {
      ...base,
      state: "upcoming",
      caption: "Belum sampai sini",
      summary: "Setelah divalidasi GA, PO disetujui berurutan oleh setiap approver.",
    };
  }
  if (!isGateCleared) {
    return {
      ...base,
      state: "active",
      caption: `${approvedCount} / ${total} disetujui`,
      summary: "PO disetujui berurutan oleh setiap approver.",
      owner: pending?.nama,
    };
  }
  if (pending) {
    return {
      ...base,
      state: "deferred",
      caption: `${total - approvedCount} approval tersisa`,
      summary: "Approver ini ada di akhir jalur, jadi tidak menahan barang.",
      owner: pending.nama,
    };
  }
  if (approvals.length > 0 && total === 0) {
    return {
      ...base,
      state: "skipped",
      caption: "Tidak ada di jalur ini",
      summary: "Jalur approval PO ini tidak punya approver sebelum pembayaran.",
    };
  }
  return {
    ...base,
    state: "done",
    caption: total > 0 ? `${total} approver setuju` : "Sudah disetujui",
    summary: "Semua approver sudah menyetujui PO.",
  };
};

const buildPaymentEvents = ({ po, pv }: PoFlow, logs: TrackingLog[]): TrackEvent[] => {
  const events: TrackEvent[] = [];
  for (const log of logs) {
    if (log.action_type !== "UPDATE_PAYMENT_DP_BP") continue;
    events.push({
      at: log.created_at,
      label: `DP ${log.metadata?.dp_paid ? "lunas" : "belum"}, pelunasan ${log.metadata?.bp_paid ? "lunas" : "belum"}`,
      note: log.users_with_profiles?.nama,
    });
  }
  const pvAdminNote = pv ? getAdminActionNote(pv) : null;
  if (pv?.status === "approved") {
    events.push({
      at: pv.processed_at,
      label:
        isDpBpPaymentTerm(po.payment_term) && po.dp_paid && !po.bp_paid
          ? "DP divalidasi"
          : "Pembayaran divalidasi",
      note: pvAdminNote ?? pv.nama,
      byAdmin: !!pvAdminNote,
    });
  }
  if (pv?.status === "rejected") {
    events.push({
      at: pv.processed_at,
      label: pvAdminNote ?? `Ditolak ${pv.nama}`,
      note: pv.rejection_note,
      tone: "danger",
      byAdmin: !!pvAdminNote,
    });
  }
  return sortEvents(events);
};

const buildPaymentStep = (
  flow: PoFlow,
  logs: TrackingLog[],
  linkedOrders: Order[],
): PoStep => {
  const { po, pv, next, isValidated, isReceiveFirst, approvals } = flow;
  const events = buildPaymentEvents(flow, logs);
  const term = po.payment_term ? `Term pembayaran: ${po.payment_term}.` : "";
  const base = {
    id: "payment" as const,
    title: "Pembayaran",
    events,
    links: [],
    breakdown: [],
    at: lastEventAt(events),
  };
  const issue = linkedOrders.find((o) => o.level === "Open 3B");

  if (pv?.status === "rejected") {
    return {
      ...base,
      state: "failed",
      caption: rejectedCaption(pv),
      summary: "Pembayaran PO ditolak.",
    };
  }
  if (issue && pv?.status !== "approved") {
    return {
      ...base,
      state: "blocked",
      caption: "Ada kendala pembayaran",
      summary: term,
      owner: "Purchasing & Finance",
      events: [
        ...events,
        {
          label: "Ditandai ada kendala pembayaran",
          note: issue.payment_issue_note,
          tone: "warning",
        },
      ],
    };
  }
  if (!isValidated) {
    return {
      ...base,
      state: "upcoming",
      caption: "Belum sampai sini",
      summary: `Urutan bayar dan terima barang mengikuti jalur yang ditetapkan GA. ${term}`.trim(),
    };
  }
  if (!pv) {
    return approvals.length > 0
      ? {
          ...base,
          state: "skipped",
          caption: "Tidak ada di jalur ini",
          summary: "Jalur approval PO ini tidak punya tahap validasi pembayaran.",
        }
      : { ...base, state: "done", caption: "Sudah diproses", summary: term };
  }

  const isDpBp = isDpBpPaymentTerm(po.payment_term);
  if (pv.status === "approved") {
    return isDpBp && po.dp_paid && !po.bp_paid
      ? {
          ...base,
          state: "deferred",
          caption: "Pelunasan menyusul",
          summary: `DP sudah lunas dan barang boleh dikirim. ${term}`.trim(),
          owner: pv.nama,
        }
      : {
          ...base,
          state: "done",
          caption: "Sudah dibayar",
          summary: term || "Pembayaran PO sudah divalidasi.",
        };
  }

  if (isDpBp && po.dp_paid) {
    return {
      ...base,
      state: "partial",
      caption: "DP lunas, menunggu pelunasan",
      summary: `Barang dikirim setelah DP dan pelunasan lunas. ${term}`.trim(),
      owner: pv.nama,
    };
  }
  if (next === pv) {
    return po.receive_record && !isReceiveFirst
      ? {
          ...base,
          state: "deferred",
          caption: "Pembayaran menyusul",
          summary: `Barang sudah sampai, pembayarannya belum tercatat. ${term}`.trim(),
          owner: pv.nama,
        }
      : {
          ...base,
          state: "active",
          caption: "Menunggu pembayaran",
          summary: term || "Finance memvalidasi pembayaran PO.",
          owner: pv.nama,
        };
  }
  return {
    ...base,
    state: "upcoming",
    caption: isReceiveFirst ? "Setelah barang diterima" : "Belum sampai sini",
    summary: isReceiveFirst
      ? `Pembayaran dilakukan setelah barang diterima. ${term}`.trim()
      : `Setelah approval selesai, Finance memvalidasi pembayaran. ${term}`.trim(),
  };
};

const buildArrivalEvents = ({ po, receiver }: PoFlow): TrackEvent[] => {
  const events: TrackEvent[] = [];
  const record = po.receive_record;
  const receiverAdminNote = receiver ? getAdminActionNote(receiver) : null;
  if (record) {
    events.push({
      at: record.received_at,
      label: record.is_full_match
        ? "Penerimaan dicatat lengkap"
        : "Penerimaan dicatat sebagian",
      note: receiverAdminNote ?? record.received_by_name,
      byAdmin: !!receiverAdminNote,
    });
    if (record.requester_confirmed_by_name) {
      events.push({
        at: record.requester_confirmed_at,
        label: "Dikonfirmasi requester",
        note: record.requester_confirmed_by_name,
      });
    }
    if (receiver?.status === "pending") {
      events.push({ label: `Menunggu ${receiver.nama} (Receiver)`, waiting: true });
    }
  }
  if (receiver?.status === "rejected") {
    events.push({
      at: receiver.processed_at,
      label: receiverAdminNote ?? `Ditolak ${receiver.nama} (Receiver)`,
      note: receiver.rejection_note,
      tone: "danger",
      byAdmin: !!receiverAdminNote,
    });
  }
  const closed = po.closed_remainder;
  if (closed) {
    events.push({
      at: closed.closed_at,
      label: "Sisa PO ditutup",
      note: [closed.closed_by_name, closed.reason].filter(Boolean).join(": "),
      tone: "warning",
    });
  }
  return events;
};

// Konfirmasi lama lewat QR tidak punya `requester_receipts` di item MR.
const buildQrReceiptEvents = (
  po: PurchaseOrderDetail,
  linkedOrders: Order[],
): TrackEvent[] => {
  const receipt = po.goods_receipt;
  const isOnItem = linkedOrders.some((o) =>
    (o.requester_receipts || []).some((r) => r.via === "scan_qr"),
  );
  if (!receipt || isOnItem) return [];
  return [
    {
      at: receipt.confirmed_at,
      label: "Dikonfirmasi lewat scan QR BAST",
      note: receipt.receiver_name,
    },
  ];
};

export const buildPoTracking = ({
  po,
  logs,
  isRequester,
  now,
}: {
  po: PurchaseOrderDetail;
  logs: TrackingLog[];
  isRequester: boolean;
  now: Date;
}): PoTracking => {
  const mr = po.material_requests;
  const requesterName = mr?.users_with_profiles?.nama || "Requester";
  const requester = isRequester ? "Anda" : requesterName;
  const flow = buildFlow(po, requester);
  const isCancelled = po.status === DOC_STATUS_CANCELLED;
  const isRejected = po.status === "Rejected";

  const trackingPo: TrackingPo = {
    ...po,
    approvals: po.approvals ?? null,
    receive_record: po.receive_record ?? null,
    closed_remainder: po.closed_remainder ?? null,
  };
  const orders = (mr?.orders || []) as Order[];
  const lines = toLineViews(po, trackingPo);
  const matches = matchOrders(lines, orders, po.kode_po);
  const linkedOrders = matches.filter((order): order is Order => !!order);
  const items = buildItemTracks(flow, trackingPo, lines, matches);
  const activeItems = items.filter((item) => !item.closedLabel);

  const rollUp = (id: PoItemStepId, copy: StepCopy) =>
    flow.isValidated
      ? rollUpSteps(
          id,
          copy,
          activeItems.map((item) => item.steps.find((s) => s.id === id)!),
        )
      : pendingStep(id, copy);

  const arrivalBase = rollUp("arrival", arrivalCopy(flow));
  const arrivalEvents = sortEvents(buildArrivalEvents(flow));
  const arrivalStep: PoStep = {
    ...arrivalBase,
    events: arrivalEvents,
    at: lastEventAt(arrivalEvents),
    owner:
      arrivalBase.owner ||
      (po.receive_record && flow.receiver?.status === "pending"
        ? flow.receiver.nama
        : undefined),
    ...(flow.receiver?.status === "rejected" && {
      state: "failed",
      caption: rejectedCaption(flow.receiver),
      summary: "PO ditolak saat penerimaan barang.",
      owner: undefined,
    }),
  };

  const createdAt = new Date(po.created_at).toISOString();
  const creator = po.users_with_profiles?.nama || "Purchasing";
  const createdStep: PoStep = {
    id: "created",
    title: "PO Dibuat",
    state: "done",
    caption: creator,
    summary: `PO dibuat oleh ${creator}.`,
    at: createdAt,
    events: [
      {
        at: createdAt,
        label: "PO dibuat",
        note: po.vendor_details?.nama_vendor
          ? `Vendor: ${po.vendor_details.nama_vendor}`
          : null,
      },
    ],
    links: mr
      ? [{ label: mr.kode_mr, href: `/material-request/${mr.id}` }]
      : [],
    breakdown: [],
  };

  const paymentStep = buildPaymentStep(flow, logs, linkedOrders);
  const goodsSteps: PoStep[] = [arrivalStep];
  if (mr) {
    const receivedBase = rollUp("received", ITEM_STEP_COPY.received);
    goodsSteps.push(rollUp("delivery", ITEM_STEP_COPY.delivery), {
      ...receivedBase,
      events: sortEvents([
        ...receivedBase.events,
        ...buildQrReceiptEvents(po, linkedOrders),
      ]),
    });
  }

  let steps: PoStep[] = [
    createdStep,
    buildValidationStep(flow, logs),
    buildApprovalStep(flow),
    ...(flow.isReceiveFirst
      ? [...goodsSteps, paymentStep]
      : [paymentStep, ...goodsSteps]),
  ];

  if (isCancelled) {
    steps = markStopped(steps, "PO", "Dibatalkan", [
      {
        at: po.cancelled_at,
        label: "PO dibatalkan admin",
        note: po.cancel_reason,
        tone: "danger",
      },
    ]);
  } else if (isRejected && !steps.some((s) => s.state === "failed")) {
    // Status diubah di luar jalur approval, jadi tidak ada baris yang ditolak.
    steps = markStopped(steps, "PO", "Ditolak", []);
  } else {
    steps = haltAfterFailure(steps);
  }

  const openSteps = steps.filter((s) => OPEN_STATES.includes(s.state));
  const followUp = steps.find((s) => s.state === "deferred" && s.owner);
  const current =
    steps.find((s) => s.state === "failed") ||
    openSteps[0] ||
    followUp ||
    steps.find((s) => s.state === "upcoming") ||
    steps[steps.length - 1];

  const hasItems = activeItems.length > 0;
  const linkedItems = activeItems.filter((item) => item.isLinked).length;
  const receivedItems = activeItems.filter((item) => item.isCompleted).length;
  const arrivedItems = activeItems.filter((item) =>
    SETTLED_STATES.includes(item.steps[0].state),
  ).length;
  const isGoodsDone =
    hasItems &&
    goodsSteps.every((s) => SETTLED_STATES.includes(s.state));
  const isFinished =
    isGoodsDone && openSteps.length === 0 && !followUp && !flow.next;

  // "Vendor & GA" dan "GA" dari dua tahap cukup ditulis "Vendor, GA".
  const owners = [
    ...new Set(openSteps.flatMap((s) => s.owner?.split(" & ") || [])),
  ];
  let waitingOn: string | null =
    owners.join(", ") || followUp?.owner || flow.next?.nama || null;

  let tone: TrackTone = "progress";
  let headline: string;
  let detail: string | null = null;

  const positions = groupBy(
    activeItems
      .filter((item) => !item.isCompleted)
      .map((item) => ({ label: item.position, state: item.positionState })),
  );
  // Satu barang tanpa angka parsial sudah terwakili headline.
  const positionDetail =
    activeItems.length > 1
      ? positions.map((p) => `${p.count} barang: ${p.label}`).join(" · ")
      : current.state === "partial"
        ? positions[0]?.label || null
        : null;
  const closedNote = po.closed_remainder
    ? `Sisa PO ditutup ${po.closed_remainder.closed_by_name}: ${po.closed_remainder.reason}`
    : null;

  if (isCancelled) {
    tone = "failed";
    headline = "PO dibatalkan";
    detail = po.cancel_reason || null;
    waitingOn = null;
  } else if (isRejected) {
    tone = "failed";
    headline =
      current.id === "validation"
        ? "PO ditolak GA"
        : current.caption === "Ditolak"
          ? "PO ditolak"
          : current.caption;
    detail =
      current.events.findLast((e) => e.tone === "danger")?.note ||
      (current.id === "validation" && po.notes?.split("alasan: ")[1]) ||
      null;
    waitingOn = null;
  } else if (po.status === "Draft") {
    headline = "PO belum diajukan";
    waitingOn = creator;
  } else if (po.status === "Pending Validation") {
    headline = "Menunggu validasi GA";
    detail = current.summary;
  } else if (current.id === "approval" && current.state === "active") {
    headline = current.owner
      ? `Menunggu persetujuan ${current.owner}`
      : "Menunggu persetujuan";
    detail = `Approval ${current.caption}.`;
  } else if (!hasItems) {
    tone = "failed";
    headline = "Semua barang dibatalkan atau ditutup";
    waitingOn = null;
  } else if (isFinished) {
    tone = "success";
    headline = mr
      ? "PO selesai, semua barang sudah diterima"
      : "PO selesai, barang sudah diterima";
    detail = closedNote;
    waitingOn = null;
  } else if (isGoodsDone && current.id === "payment" && current.state === "deferred") {
    headline = "Barang sudah diterima, pembayaran menyusul";
    detail = current.caption;
  } else if (isGoodsDone && flow.next && flow.next !== flow.pv) {
    headline = `Barang sudah diterima, menunggu persetujuan ${flow.next.nama}`;
  } else {
    if (current.state === "blocked") tone = "attention";
    const copy: Partial<Record<PoStepId, Record<"active" | "partial", string>>> = {
      payment: {
        active: "Menunggu pembayaran",
        partial: "DP sudah lunas, menunggu pelunasan",
      },
      arrival: {
        active: activeItems.some((i) => i.position === "Sedang dikirim vendor")
          ? "Barang sedang dikirim vendor"
          : "Menunggu kiriman vendor",
        partial: `Sebagian barang sudah tiba di ${flow.place}`,
      },
      delivery: {
        active: ITEM_STEP_COPY.delivery.active,
        partial: ITEM_STEP_COPY.delivery.partial,
      },
      received: {
        active: ITEM_STEP_COPY.received.active,
        partial: ITEM_STEP_COPY.received.partial,
      },
    };
    headline =
      current.state === "blocked"
        ? "Ada kendala pembayaran PO"
        : current.state === "upcoming" && positions.length === 1
          ? positions[0].label
          : copy[current.id]?.[current.state === "partial" ? "partial" : "active"] ||
            current.title;
    detail =
      current.state === "blocked"
        ? current.events.findLast((e) => e.tone === "warning")?.note || null
        : current.id === "payment"
          ? current.summary
          : positionDetail;
    if (detail === headline) detail = null;
    if (closedNote) detail = detail ? `${detail} · ${closedNote}` : closedNote;
  }

  const isTerminal = isCancelled || isRejected;
  const showGoods = !isTerminal && (flow.canGoodsMove || !!po.receive_record);

  return {
    tone,
    headline,
    detail,
    waitingOn,
    currentStepId: current.id,
    steps,
    items: showGoods ? items : [],
    arrived:
      showGoods && hasItems ? { items: arrivedItems, total: activeItems.length } : null,
    received:
      showGoods && linkedItems > 0 ? { items: receivedItems, total: linkedItems } : null,
    target:
      mr && tone !== "failed" ? buildTarget(mr, isGoodsDone, now) : null,
  };
};
