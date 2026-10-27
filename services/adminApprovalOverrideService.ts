// src/services/adminApprovalOverrideService.ts
//
// Override jalur approval oleh ADMIN (MR Management, PO Management, Kontrol
// Admin Petty Cash). Dulu form admin menyimpan status tiap approver apa
// adanya - status dokumen tidak ikut berubah, efek lanjutan (level item MR,
// item "Dikirim Vendor", dll.) tidak jalan, dan approver berikutnya tidak
// dinotifikasi. Di sini perubahan admin diproses seperti approve/reject
// normal:
//
//  - Maju (pending -> approved/rejected): status & efek lanjutan sama
//    persis dengan alur normal (processMrApproval, handleApprovalAction di
//    purchase-order/[id]/page.tsx, approve*Step Petty Cash).
//  - Mundur (step yang sudah diproses diubah lagi): hanya selama dokumen
//    belum lanjut ke tahap berikutnya (MR belum ada PO, PO belum dibayar/
//    diterima, Pengajuan belum di-Voucher-kan, dst.).
//  - Status manual yang bertentangan dengan jalur approval ditolak (status
//    di luar fase approval tetap bebas, lihat lib/approvalOverride.ts).
//  - Approval di DB berubah sejak form dibuka (approver baru saja approve)
//    -> ditolak, admin muat ulang dulu, supaya tidak menimpa keputusan
//    approver.
//
// MR & PO disimpan oleh halamannya sendiri (form-nya juga menyimpan field
// lain), jadi alurnya plan -> halaman update -> apply effects. Petty Cash
// langsung disimpan di sini (adminUpdatePcApprovals).

import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  PettyCashPengajuanApprover,
  POItem,
  ReceiveRecord,
} from "@/type";
import {
  APPROVAL_TYPE_PAYMENT_APPROVAL,
  APPROVAL_TYPE_RECEIVER,
  PO_STATUS_FULL_RECEIVED,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_PENDING_RECEIVE,
  isDpBpPaymentTerm,
  isPaymentValidatorApproval,
  isPoPaid,
} from "@/type/enum";
import {
  ApprovalChange,
  MR_APPROVAL_PHASE_STATUSES,
  MR_PRE_PO_STATUSES,
  OverrideApprovalStep,
  PC_APPROVAL_PHASE_STATUSES,
  assertSequentialApprovals,
  assertStatusMatchesApprovals,
  deriveApprovalOutcome,
  deriveMrStatus,
  derivePcStatus,
  describeApprovalChanges,
  getApprovalChanges,
  getCurrentTurnIndex,
  isApprovalRollback,
  isSameApprovalChain,
  resolveApprovalPhaseStatus,
  stampProcessedAt,
} from "@/lib/approvalOverride";
import {
  demoteMrItemsAfterApprovalRollback,
  promoteMrItemsAfterFullApproval,
} from "./approvalService";
import {
  deriveReceiveDrivenStatus,
  getFullReceivedStamp,
  markPoItemsShippedByVendor,
} from "./purchaseOrderService";
import { logActivity } from "./logService";
import {
  notifyOnMRApproval,
  notifyOnPOApproval,
  notifyOnPcApproval,
} from "@/lib/notifications/client";

const supabase = createClient();

const staleError = (docLabel: string) =>
  new Error(
    `Data approval/status ${docLabel} ini sudah berubah sejak halaman dibuka (mis. approver baru saja memproses). Muat ulang halaman lalu ulangi perubahan.`,
  );

export interface AdminApprovalPlan<TStep extends OverrideApprovalStep> {
  approvals: TStep[];
  status: string;
  changes: ApprovalChange[];
  previousApprovals: TStep[];
  previousStatus: string;
}

interface AdminOverrideInput<TStep extends OverrideApprovalStep> {
  baselineApprovals: TStep[];
  nextApprovals: TStep[];
  baselineStatus: string;
  requestedStatus: string;
}

// Bagian bersama semua jenis dokumen: cek edit bersamaan, urutan approval,
// dan stempel processed_at. `null` = tidak ada perubahan approval/status.
const prepareOverride = <TStep extends OverrideApprovalStep>(
  docLabel: string,
  db: { approvals: TStep[]; status: string },
  input: AdminOverrideInput<TStep>,
) => {
  const approvalsChanged = !isSameApprovalChain(
    input.baselineApprovals,
    input.nextApprovals,
  );
  const statusChanged = input.requestedStatus !== input.baselineStatus;
  if (!approvalsChanged && !statusChanged) return null;

  if (
    (approvalsChanged &&
      !isSameApprovalChain(db.approvals, input.baselineApprovals)) ||
    (statusChanged && db.status !== input.baselineStatus)
  ) {
    throw staleError(docLabel);
  }

  const changes = approvalsChanged
    ? getApprovalChanges(input.baselineApprovals, input.nextApprovals)
    : [];
  if (changes.length) assertSequentialApprovals(input.nextApprovals);

  return {
    changes,
    statusChanged,
    approvals: approvalsChanged
      ? stampProcessedAt(input.baselineApprovals, input.nextApprovals)
      : db.approvals,
  };
};

// Notifikasi setara alur normal: ditolak -> pembuat; giliran pindah ke
// approver lain -> approver itu; semua approve -> pembuat.
const notifyApprovalProgress = (
  previous: OverrideApprovalStep[],
  next: OverrideApprovalStep[],
  send: (args: {
    decision: "approved" | "rejected";
    nextApproverId?: string;
  }) => void,
) => {
  const newlyRejected = next.some(
    (a, i) => a.status === "rejected" && previous[i]?.status !== "rejected",
  );
  if (newlyRejected) return send({ decision: "rejected" });

  const prevTurn = getCurrentTurnIndex(previous);
  const turn = getCurrentTurnIndex(next);
  const prevTurnUser = prevTurn === -1 ? null : previous[prevTurn].userid;
  const turnUser = turn === -1 ? null : next[turn].userid;
  if (turnUser && turnUser !== prevTurnUser) {
    return send({ decision: "approved", nextApproverId: turnUser });
  }
  if (
    deriveApprovalOutcome(next) === "approved" &&
    deriveApprovalOutcome(previous) !== "approved"
  ) {
    send({ decision: "approved" });
  }
};

// ==========================================
// MATERIAL REQUEST
// ==========================================

/**
 * Validasi + hitung approvals & status MR yang akan disimpan form MR
 * Management. Lempar Error (pesan siap tampil) kalau perubahan tidak aman.
 */
export const planAdminMrApprovalUpdate = async (
  mrId: number,
  input: AdminOverrideInput<Approval>,
): Promise<AdminApprovalPlan<Approval>> => {
  const { data: mr, error } = await supabase
    .from("material_requests")
    .select("status, approvals")
    .eq("id", mrId)
    .single();
  if (error || !mr) throw new Error("Gagal mengambil data MR terbaru.");

  const db = {
    status: mr.status as string,
    approvals: (Array.isArray(mr.approvals) ? mr.approvals : []) as Approval[],
  };
  const unchanged: AdminApprovalPlan<Approval> = {
    ...db,
    changes: [],
    previousApprovals: db.approvals,
    previousStatus: db.status,
  };

  const prepared = prepareOverride("MR", db, input);
  if (!prepared) return unchanged;
  const { changes, statusChanged, approvals } = prepared;

  const status = statusChanged
    ? input.requestedStatus
    : resolveApprovalPhaseStatus({
        currentStatus: db.status,
        approvals,
        phaseStatuses: MR_APPROVAL_PHASE_STATUSES,
        derive: deriveMrStatus,
      });

  assertStatusMatchesApprovals({
    docLabel: "MR",
    status,
    expectedStatus: deriveMrStatus(deriveApprovalOutcome(approvals)),
    phaseStatuses: MR_APPROVAL_PHASE_STATUSES,
  });

  const preApproval = MR_PRE_PO_STATUSES as readonly string[];
  if (
    isApprovalRollback(changes) &&
    !(MR_APPROVAL_PHASE_STATUSES as readonly string[]).includes(db.status)
  ) {
    throw new Error(
      `MR ini sudah berstatus "${db.status}" (proses PO berjalan) - approval yang sudah diproses tidak bisa diubah lagi.`,
    );
  }
  // Mundur ke tahap sebelum PO (mis. Waiting PO -> Pending Approval) hanya
  // boleh kalau belum ada PO aktif.
  if (preApproval.includes(status) && !preApproval.includes(db.status)) {
    const { data: activePos } = await supabase
      .from("purchase_orders")
      .select("kode_po")
      .eq("mr_id", mrId)
      .neq("status", "Rejected");
    if (activePos && activePos.length > 0) {
      throw new Error(
        `MR ini sudah punya PO aktif (${activePos.map((p) => p.kode_po).join(", ")}) - tidak bisa dimundurkan ke "${status}".`,
      );
    }
  }

  return {
    approvals,
    status,
    changes,
    previousApprovals: db.approvals,
    previousStatus: db.status,
  };
};

/** Efek lanjutan setelah form MR Management berhasil menyimpan `plan`. */
export const applyAdminMrApprovalEffects = async (
  plan: AdminApprovalPlan<Approval>,
  ctx: {
    mrId: number;
    kodeMr: string;
    creatorId: string;
    actorId: string;
    actorName: string;
  },
) => {
  const preApproval = MR_PRE_PO_STATUSES as readonly string[];
  if (plan.status === "Waiting PO" && plan.previousStatus !== "Waiting PO") {
    await promoteMrItemsAfterFullApproval(ctx.mrId, ctx.actorId);
  } else if (
    preApproval.includes(plan.status) &&
    !preApproval.includes(plan.previousStatus)
  ) {
    await demoteMrItemsAfterApprovalRollback(ctx.mrId, ctx.actorId);
  }

  if (plan.changes.length || plan.status !== plan.previousStatus) {
    notifyApprovalProgress(plan.previousApprovals, plan.approvals, (args) =>
      notifyOnMRApproval({
        ...args,
        actorId: ctx.actorId,
        creatorId: ctx.creatorId,
        kodeMR: ctx.kodeMr,
        mrId: ctx.mrId,
      }),
    );
    await logActivity(
      ctx.actorId,
      "ADMIN_OVERRIDE_APPROVAL",
      "material_request",
      String(ctx.mrId),
      `Admin ${ctx.actorName} mengubah approval MR ${ctx.kodeMr}${plan.changes.length ? ` (${describeApprovalChanges(plan.approvals, plan.changes)})` : ""}; status ${plan.previousStatus} -> ${plan.status}`,
      {
        changes: plan.changes,
        old_status: plan.previousStatus,
        new_status: plan.status,
      },
    );
  }
};

// ==========================================
// PURCHASE ORDER
// ==========================================

export const PO_APPROVAL_PHASE_STATUSES = [
  "Pending Approval",
  "Pending Payment",
  PO_STATUS_PENDING_RECEIVE,
  PO_STATUS_PARTIAL_RECEIVE,
  PO_STATUS_FULL_RECEIVED,
  "Rejected",
] as const;

// Urutan tahap PO - status yang turun peringkat = mundur (dicek aman).
// "Rejected" & "Ordered" tidak diberi peringkat.
const PO_STATUS_RANK: Record<string, number> = {
  "Pending Validation": 0,
  Draft: 0,
  "Pending Approval": 1,
  "Pending Payment": 2,
  [PO_STATUS_PENDING_RECEIVE]: 3,
  [PO_STATUS_PARTIAL_RECEIVE]: 4,
  [PO_STATUS_FULL_RECEIVED]: 4,
};

/**
 * True kalau status PO tertinggal dari jalur approval-nya (mis. approver
 * terakhir sudah approve tapi status masih "Pending Approval") - dipakai
 * form admin buat kasih peringatan. Status yang lebih maju dari approval
 * (mis. Terima Barang manual) tidak dianggap tertinggal.
 */
export const isPoStatusBehindApprovals = (
  status: string,
  approvals: Approval[],
  receiveRecord: PoReceiveSnapshot,
): string | null => {
  const expected = derivePoStatusFromApprovals(approvals, receiveRecord);
  if (!expected || expected === status) return null;
  if (expected === "Rejected") return expected;
  const current = PO_STATUS_RANK[status];
  return current !== undefined && PO_STATUS_RANK[expected] > current
    ? expected
    : null;
};

type PoReceiveSnapshot = Pick<ReceiveRecord, "is_full_match"> | null | undefined;

// Status PO setelah step `index` di-approve - cermin handleApprovalAction &
// handleSubmitReceive (purchase-order/[id]/page.tsx).
const applyPoApprovedStep = (
  status: string,
  approvals: Approval[],
  index: number,
  receiveRecord: PoReceiveSnapshot,
): string => {
  const step = approvals[index];
  const hasPaymentValidator = approvals.some((a) =>
    isPaymentValidatorApproval(a),
  );
  if (step.type === APPROVAL_TYPE_RECEIVER) {
    // Step Receiver selalu lewat checklist terima (submitReceiveRecord).
    if (!receiveRecord) return status;
    const paymentSettled = !hasPaymentValidator || isPoPaid(approvals);
    if (!paymentSettled) return "Pending Payment";
    return receiveRecord.is_full_match
      ? PO_STATUS_FULL_RECEIVED
      : PO_STATUS_PARTIAL_RECEIVE;
  }
  if (isPaymentValidatorApproval(step)) {
    return deriveReceiveDrivenStatus(
      approvals,
      true,
      receiveRecord?.is_full_match,
      { paymentJustSettled: true },
    );
  }
  if (step.type === APPROVAL_TYPE_PAYMENT_APPROVAL) return "Pending Payment";
  if (approvals.every((a) => a.status === "approved")) {
    return PO_STATUS_PENDING_RECEIVE;
  }
  return status;
};

/**
 * Status PO hasil perubahan approval admin. Maju = diputar ulang step demi
 * step dari status sekarang (sama seperti approver menekan Setujui satu per
 * satu). Mundur = dihitung ulang dari awal jalur (aman karena mundur cuma
 * boleh sebelum PO dibayar/diterima).
 */
export const computePoStatusAfterApprovalChange = ({
  currentStatus,
  baselineApprovals,
  nextApprovals,
  receiveRecord,
}: {
  currentStatus: string;
  baselineApprovals: Approval[];
  nextApprovals: Approval[];
  receiveRecord: PoReceiveSnapshot;
}): string => {
  const changes = getApprovalChanges(baselineApprovals, nextApprovals);
  if (!changes.length) return currentStatus;
  if (isApprovalRollback(changes)) {
    return derivePoStatusFromApprovals(nextApprovals, receiveRecord) ?? currentStatus;
  }
  let status = currentStatus;
  const applied = baselineApprovals.map((a) => ({ ...a }));
  for (const change of changes) {
    applied[change.index] = nextApprovals[change.index];
    if (change.to === "rejected") return "Rejected";
    status = applyPoApprovedStep(status, applied, change.index, receiveRecord);
  }
  return status;
};

/** Status PO yang konsisten dengan jalur approval (diputar dari awal). */
export const derivePoStatusFromApprovals = (
  approvals: Approval[],
  receiveRecord: PoReceiveSnapshot,
): string | null => {
  if (!approvals.length) return null;
  if (approvals.some((a) => a.status === "rejected")) return "Rejected";
  let status = "Pending Approval";
  const applied: Approval[] = approvals.map((a) => ({ ...a, status: "pending" }));
  approvals.forEach((a, i) => {
    if (a.status !== "approved") return;
    applied[i] = a;
    status = applyPoApprovedStep(status, applied, i, receiveRecord);
  });
  // Terima Barang manual (template tanpa step Receiver) sesudah lunas.
  if (receiveRecord && status === PO_STATUS_PENDING_RECEIVE) {
    status = receiveRecord.is_full_match
      ? PO_STATUS_FULL_RECEIVED
      : PO_STATUS_PARTIAL_RECEIVE;
  }
  return status;
};

export interface AdminPoApprovalPlan extends AdminApprovalPlan<Approval> {
  // Kolom tambahan yang ikut disimpan (dp_paid/bp_paid, full_received_at).
  extraPayload: Record<string, unknown>;
  // Jalankan markPoItemsShippedByVendor (Payment Validator baru approve).
  markItemsShipped: boolean;
  mrId: number | null;
  items: POItem[];
}

/**
 * Validasi + hitung approvals, status, & kolom pembayaran PO yang akan
 * disimpan form PO Management. Lempar Error kalau perubahan tidak aman.
 */
export const planAdminPoApprovalUpdate = async (
  poId: number,
  input: AdminOverrideInput<Approval>,
): Promise<AdminPoApprovalPlan> => {
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "status, approvals, receive_record, payment_term, dp_bp_shipping_type, dp_paid, bp_paid, mr_id, items",
    )
    .eq("id", poId)
    .single();
  if (error || !po) throw new Error("Gagal mengambil data PO terbaru.");

  const db = {
    status: po.status as string,
    approvals: (Array.isArray(po.approvals) ? po.approvals : []) as Approval[],
  };
  const receiveRecord = po.receive_record as ReceiveRecord | null;
  const base = {
    mrId: (po.mr_id as number | null) ?? null,
    items: (po.items as POItem[]) || [],
    previousApprovals: db.approvals,
    previousStatus: db.status,
  };

  const prepared = prepareOverride("PO", db, input);
  if (!prepared) {
    return {
      ...db,
      ...base,
      changes: [],
      extraPayload: {},
      markItemsShipped: false,
    };
  }
  const { changes, statusChanged, approvals } = prepared;

  const receiverApproved = changes.find(
    (c) =>
      c.to === "approved" && approvals[c.index].type === APPROVAL_TYPE_RECEIVER,
  );
  if (receiverApproved) {
    throw new Error(
      `Step Receiver (${approvals[receiverApproved.index].nama}) hanya bisa di-approve lewat checklist "Terima Barang" di halaman detail PO, supaya qty barang yang diterima tercatat.`,
    );
  }

  const isRollback = isApprovalRollback(changes);
  if (isRollback && !(PO_APPROVAL_PHASE_STATUSES as readonly string[]).includes(db.status)) {
    throw new Error(
      `PO ini berstatus "${db.status}" - approval yang sudah diproses tidak bisa diubah lagi.`,
    );
  }

  const computed = computePoStatusAfterApprovalChange({
    currentStatus: db.status,
    baselineApprovals: input.baselineApprovals,
    nextApprovals: approvals,
    receiveRecord,
  });
  const status = statusChanged ? input.requestedStatus : computed;

  assertStatusMatchesApprovals({
    docLabel: "PO",
    status,
    expectedStatus: changes.length
      ? computed
      : derivePoStatusFromApprovals(approvals, receiveRecord),
    phaseStatuses: PO_APPROVAL_PHASE_STATUSES,
  });

  // Mundur hanya sebelum PO dibayar / barangnya diterima.
  const goesBack =
    isRollback ||
    (PO_STATUS_RANK[status] !== undefined &&
      PO_STATUS_RANK[db.status] !== undefined &&
      PO_STATUS_RANK[status] < PO_STATUS_RANK[db.status]);
  if (goesBack) {
    if (isPoPaid(db.approvals)) {
      throw new Error(
        "PO ini sudah dibayar (Payment Validator sudah approve) - approval/status tidak bisa dimundurkan.",
      );
    }
    if (receiveRecord) {
      throw new Error(
        "Barang PO ini sudah dicatat diterima - approval/status tidak bisa dimundurkan.",
      );
    }
  }
  // PO yang ditolak dihidupkan lagi: pastikan barangnya belum dibuatkan PO
  // pengganti, supaya tidak dobel.
  if (db.status === "Rejected" && status !== "Rejected" && base.mrId) {
    const { data: otherPos } = await supabase
      .from("purchase_orders")
      .select("kode_po, items")
      .eq("mr_id", base.mrId)
      .neq("id", poId)
      .neq("status", "Rejected");
    const partNumbers = new Set(
      base.items.map((i) => i.part_number).filter(Boolean),
    );
    const overlapping = (otherPos ?? []).filter((p) =>
      ((p.items as POItem[]) || []).some((i) => partNumbers.has(i.part_number)),
    );
    if (overlapping.length) {
      throw new Error(
        `Barang di PO ini sudah dibuatkan PO lain (${overlapping.map((p) => p.kode_po).join(", ")}) - PO yang ditolak tidak bisa dihidupkan lagi.`,
      );
    }
  }

  // Admin approve Payment Validator = pembayaran dianggap lunas sesuai skema
  // DP & Pelunasan PO ini (sama seperti centang di dialog DP/BP).
  const paymentValidatorJustApproved = changes.some(
    (c) =>
      c.from === "pending" &&
      c.to === "approved" &&
      isPaymentValidatorApproval(approvals[c.index]),
  );
  const extraPayload: Record<string, unknown> = {
    ...getFullReceivedStamp(db.status, status),
  };
  if (paymentValidatorJustApproved && isDpBpPaymentTerm(po.payment_term)) {
    extraPayload.dp_paid = true;
    if (po.dp_bp_shipping_type !== "ship_after_dp") extraPayload.bp_paid = true;
  }
  // Status yang nyangkut (PV sudah approved, status masih sebelum Pending
  // Receive) dimajukan manual - efek "Dikirim Vendor" ikut dijalankan.
  const receiveRank = PO_STATUS_RANK[PO_STATUS_PENDING_RECEIVE];
  const catchesUpPastPayment =
    isPoPaid(approvals) &&
    (PO_STATUS_RANK[db.status] ?? receiveRank) < receiveRank &&
    (PO_STATUS_RANK[status] ?? 0) >= receiveRank;

  return {
    approvals,
    status,
    changes,
    ...base,
    extraPayload,
    markItemsShipped: paymentValidatorJustApproved || catchesUpPastPayment,
  };
};

/** Efek lanjutan setelah form PO Management berhasil menyimpan `plan`. */
export const applyAdminPoApprovalEffects = async (
  plan: AdminPoApprovalPlan,
  ctx: {
    poId: number;
    kodePo: string;
    creatorId: string;
    actorId: string;
    actorName: string;
  },
) => {
  if (plan.markItemsShipped && plan.mrId) {
    await markPoItemsShippedByVendor(plan.mrId, plan.items, ctx.actorId);
  }

  if (plan.changes.length || plan.status !== plan.previousStatus) {
    notifyApprovalProgress(plan.previousApprovals, plan.approvals, (args) =>
      notifyOnPOApproval({
        ...args,
        actorId: ctx.actorId,
        creatorId: ctx.creatorId,
        kodePO: ctx.kodePo,
        poId: ctx.poId,
      }),
    );
    await logActivity(
      ctx.actorId,
      "ADMIN_OVERRIDE_APPROVAL",
      "purchase_order",
      String(ctx.poId),
      `Admin ${ctx.actorName} mengubah approval PO ${ctx.kodePo}${plan.changes.length ? ` (${describeApprovalChanges(plan.approvals, plan.changes)})` : ""}; status ${plan.previousStatus} -> ${plan.status}`,
      {
        changes: plan.changes,
        old_status: plan.previousStatus,
        new_status: plan.status,
        ...plan.extraPayload,
      },
    );
  }
};

/** Index step Receiver yang sedang giliran, -1 kalau giliran bukan Receiver. */
export const getReceiverTurnIndex = (
  approvals: Approval[] | null | undefined,
): number => {
  const list = approvals ?? [];
  const turn = getCurrentTurnIndex(list);
  return turn !== -1 && list[turn].type === APPROVAL_TYPE_RECEIVER ? turn : -1;
};

// ==========================================
// PETTY CASH (Pengajuan / Voucher / Deklarasi)
// ==========================================

export type PcOverrideDocType = "pengajuan" | "voucher" | "deklarasi";

const PC_TABLE: Record<PcOverrideDocType, string> = {
  pengajuan: "petty_cash_pengajuan",
  voucher: "petty_cash_voucher",
  deklarasi: "petty_cash_deklarasi",
};

const PC_KODE_FIELD: Record<PcOverrideDocType, string> = {
  pengajuan: "kode_pengajuan",
  voucher: "kode_voucher",
  deklarasi: "kode_deklarasi",
};

const PC_LABEL: Record<PcOverrideDocType, string> = {
  pengajuan: "Pengajuan",
  voucher: "Voucher",
  deklarasi: "Deklarasi",
};

interface PcRow {
  id: number;
  status: string;
  approvals: PettyCashPengajuanApprover[];
  user_id: string;
  kode: string;
  pengajuan_id?: number;
  voucher_id?: number;
  sub_voucher_id?: number | null;
}

const countRows = async (
  table: string,
  apply: (q: any) => any,
): Promise<number> => {
  const { count, error } = await apply(
    supabase.from(table).select("id", { count: "exact", head: true }),
  );
  if (error) throw error;
  return count ?? 0;
};

// Mundur (step yang sudah diproses diubah) hanya selama belum ada dokumen
// turunan yang bergantung pada status lama.
const assertPcRollbackSafe = async (
  docType: PcOverrideDocType,
  row: PcRow,
  nextStatus: string,
) => {
  const label = PC_LABEL[docType];
  if (!(PC_APPROVAL_PHASE_STATUSES as readonly string[]).includes(row.status)) {
    throw new Error(
      `${label} ini sudah berstatus "${row.status}" - approval yang sudah diproses tidak bisa diubah lagi.`,
    );
  }
  const leavesApproved = row.status === "Approved" && nextStatus !== "Approved";
  const revivesRejected = row.status === "Rejected" && nextStatus !== "Rejected";

  if (docType === "pengajuan" && leavesApproved) {
    const vouchers = await countRows("petty_cash_voucher", (q) =>
      q.eq("pengajuan_id", row.id).neq("status", "Rejected"),
    );
    if (vouchers > 0) {
      throw new Error(
        "Pengajuan ini sudah dibuatkan Voucher - approval tidak bisa dimundurkan.",
      );
    }
  }

  if (docType === "voucher") {
    if (leavesApproved) {
      const draws = await countRows("petty_cash_sub_voucher", (q) =>
        q.eq("voucher_id", row.id),
      );
      if (draws > 0) {
        throw new Error(
          "Voucher ini sudah ada tarikan dana (Sub-Voucher) - approval tidak bisa dimundurkan.",
        );
      }
    }
    if (revivesRejected) {
      const others = await countRows("petty_cash_voucher", (q) =>
        q
          .eq("pengajuan_id", row.pengajuan_id)
          .neq("id", row.id)
          .neq("status", "Rejected"),
      );
      if (others > 0) {
        throw new Error(
          "Pengajuan induknya sudah punya Voucher pengganti yang aktif - Voucher yang ditolak ini tidak bisa dihidupkan lagi.",
        );
      }
      const { data: pengajuan } = await supabase
        .from("petty_cash_pengajuan")
        .select("status")
        .eq("id", row.pengajuan_id)
        .single();
      if (pengajuan?.status !== "Approved") {
        throw new Error(
          "Pengajuan induknya belum/tidak lagi Approved - Voucher ini tidak bisa dihidupkan lagi.",
        );
      }
    }
  }

  if (docType === "deklarasi") {
    if (leavesApproved) {
      const { data: voucher } = await supabase
        .from("petty_cash_voucher")
        .select("status")
        .eq("id", row.voucher_id)
        .single();
      if (voucher?.status === "Selesai") {
        throw new Error(
          "Voucher induknya sudah Selesai (ditutup oleh Deklarasi yang disetujui) - approval tidak bisa dimundurkan.",
        );
      }
      if (row.sub_voucher_id) {
        const refunds = await countRows("petty_cash_pengembalian", (q) =>
          q.eq("sub_voucher_id", row.sub_voucher_id).neq("status", "Ditolak"),
        );
        if (refunds > 0) {
          throw new Error(
            "Sudah ada Pengembalian Dana Lebih dari tarikan ini - approval Deklarasi tidak bisa dimundurkan.",
          );
        }
      }
    }
    if (revivesRejected && row.sub_voucher_id) {
      const others = await countRows("petty_cash_deklarasi", (q) =>
        q
          .eq("sub_voucher_id", row.sub_voucher_id)
          .neq("id", row.id)
          .neq("status", "Rejected"),
      );
      if (others > 0) {
        throw new Error(
          "Tarikan ini sudah punya Deklarasi pengganti yang aktif - Deklarasi yang ditolak ini tidak bisa dihidupkan lagi.",
        );
      }
    }
  }
};

/**
 * Override status & approvals dokumen Petty Cash oleh admin (dijamin di
 * level RLS oleh policy *_update_admin). Status ikut dihitung ulang dari
 * jalur approval; efek lanjutan Deklarasi "Approved" (menutup Voucher)
 * jalan lewat trigger DB seperti approve normal.
 */
export const adminUpdatePcApprovals = async (
  docType: PcOverrideDocType,
  id: number,
  input: AdminOverrideInput<PettyCashPengajuanApprover>,
): Promise<void> => {
  const label = PC_LABEL[docType];
  const extraColumns =
    docType === "voucher"
      ? ", pengajuan_id"
      : docType === "deklarasi"
        ? ", voucher_id, sub_voucher_id"
        : "";
  const { data, error } = await supabase
    .from(PC_TABLE[docType])
    .select(`id, status, approvals, user_id, ${PC_KODE_FIELD[docType]}${extraColumns}`)
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`Gagal mengambil data ${label} terbaru.`);
  const raw = data as any;
  const row: PcRow = {
    ...raw,
    approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
    kode: raw[PC_KODE_FIELD[docType]],
  };

  const prepared = prepareOverride(label, row, input);
  if (!prepared) return;
  const { changes, statusChanged, approvals } = prepared;

  const status = statusChanged
    ? input.requestedStatus
    : resolveApprovalPhaseStatus({
        currentStatus: row.status,
        approvals,
        phaseStatuses: PC_APPROVAL_PHASE_STATUSES,
        derive: derivePcStatus,
      });

  assertStatusMatchesApprovals({
    docLabel: label,
    status,
    expectedStatus: derivePcStatus(deriveApprovalOutcome(approvals)),
    phaseStatuses: PC_APPROVAL_PHASE_STATUSES,
  });

  // Mundur = step yang sudah diproses diubah, atau status turun dari
  // Approved/Selesai/Rejected (Selesai -> Approved & maju dari In Approval
  // tidak dihitung mundur).
  const statusRegresses =
    row.status !== status &&
    (row.status === "Rejected" ||
      ((row.status === "Approved" || row.status === "Selesai") &&
        (status === "In Approval" || status === "Rejected")));
  if (isApprovalRollback(changes) || statusRegresses) {
    await assertPcRollbackSafe(docType, row, status);
  }

  const { error: updateError } = await supabase
    .from(PC_TABLE[docType])
    .update({ status, approvals, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw updateError;

  notifyApprovalProgress(row.approvals, approvals, (args) =>
    notifyOnPcApproval({
      ...args,
      docType,
      docId: id,
      kode: row.kode,
      creatorId: row.user_id,
    }),
  );
};
