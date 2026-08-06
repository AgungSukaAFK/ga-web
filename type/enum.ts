// type/enum.ts

import { Approval } from "@/type";

export const LIMIT_OPTIONS = [10, 25, 50, 100, 1000, 10000];

export const STATUS_OPTIONS = [
  "Pending Validation",
  "On Hold",
  "Pending Approval",
  "Pending Payment",
  "Waiting PO",
  "On Process",
  "Pending Receive",
  "Partial Receive",
  "Full Received",
  "Rejected",
];

// Status PO seputar penerimaan barang - "Pending BAST"/"Completed"/"Pending
// Payment BP" (status PO lama) sudah tidak dipakai lagi, diganti 3 status di
// bawah. Dipakai sebagai konstanta (bukan literal string) di banyak tempat
// (purchase-order/[id]/page.tsx, purchaseOrderService.ts, dashboardService.ts,
// approvalService.ts) supaya tidak typo pas migrasi.
export const PO_STATUS_PENDING_RECEIVE = "Pending Receive";
export const PO_STATUS_PARTIAL_RECEIVE = "Partial Receive";
export const PO_STATUS_FULL_RECEIVED = "Full Received";

// ==========================================
// APPROVAL TYPE (jenis approver di template)
// ==========================================

export const APPROVAL_TYPE_MENGETAHUI = "Mengetahui";
export const APPROVAL_TYPE_MENYETUJUI = "Menyetujui";
export const APPROVAL_TYPE_PAYMENT_APPROVAL = "Payment Approval";
export const APPROVAL_TYPE_PAYMENT_VALIDATOR = "Payment Validator";
// Step approval yang menandakan barang sudah diterima (mis. GA/Warehouse).
// Saat step ber-type ini di-approve, PO diperlakukan sama seperti tombol
// "GA Receive" manual (lihat handleGAReceiveGoods & markGoodsAsReceivedByGA
// di purchase-order/[id]/page.tsx) - tombol manual itu SENGAJA belum dihapus
// dulu supaya bisa dibandingkan/di-trial berdampingan dengan step ini.
export const APPROVAL_TYPE_RECEIVER = "Receiver";

export const APPROVAL_TYPE_OPTIONS = [
  { label: APPROVAL_TYPE_MENGETAHUI, value: APPROVAL_TYPE_MENGETAHUI },
  { label: APPROVAL_TYPE_MENYETUJUI, value: APPROVAL_TYPE_MENYETUJUI },
  {
    label: APPROVAL_TYPE_PAYMENT_APPROVAL,
    value: APPROVAL_TYPE_PAYMENT_APPROVAL,
  },
  {
    label: APPROVAL_TYPE_PAYMENT_VALIDATOR,
    value: APPROVAL_TYPE_PAYMENT_VALIDATOR,
  },
  { label: APPROVAL_TYPE_RECEIVER, value: APPROVAL_TYPE_RECEIVER },
];

// User id "Payment Validator" lama yang di-hardcode. Dipertahankan agar PO lama
// (yang dibayar lewat akun ini, tanpa type Payment Validator) tetap terdeteksi.
export const PAYMENT_VALIDATOR_USER_ID =
  "06122d13-9918-40ac-9034-41e849c5c3e2";

/**
 * Predikat dual dipakai di semua tempat yang perlu tahu apakah sebuah
 * approval adalah step "Payment Validator" (baik PO lama yang di-hardcode
 * lewat user id, maupun PO baru yang pakai type "Payment Validator").
 * Satu-satunya sumber kebenaran untuk kondisi ini — jangan duplikasi
 * pengecekan userid/type di tempat lain, panggil fungsi ini.
 */
export const isPaymentValidatorApproval = (
  app: Pick<Approval, "userid" | "type"> | null | undefined,
): boolean =>
  !!app &&
  (app.userid === PAYMENT_VALIDATOR_USER_ID ||
    app.type === APPROVAL_TYPE_PAYMENT_VALIDATOR);

/**
 * Menentukan apakah sebuah PO sudah "Paid" (deteksi dual):
 *  - PO lama: ada approval `approved` dari user validator hardcoded, ATAU
 *  - PO baru: ada approval `approved` ber-type "Payment Validator".
 */
export const isPoPaid = (
  approvals: Approval[] | null | undefined,
): boolean => {
  if (!Array.isArray(approvals)) return false;
  return approvals.some(
    (app) => app.status === "approved" && isPaymentValidatorApproval(app),
  );
};

/**
 * Approval ber-type "Receiver" (lihat APPROVAL_TYPE_RECEIVER) yang sudah
 * approved di jalur approval sebuah PO - dipakai status engine buat tahu
 * apakah barang sudah pernah di-checklist receiver, terlepas dari urutan
 * step Receiver vs Payment Validator di template (lihat
 * deriveReceiveDrivenStatus di purchaseOrderService.ts).
 */
export const getApprovedReceiverStep = (
  approvals: Approval[] | null | undefined,
): Approval | null => {
  if (!Array.isArray(approvals)) return null;
  return (
    approvals.find(
      (app) => app.type === APPROVAL_TYPE_RECEIVER && app.status === "approved",
    ) ?? null
  );
};

/**
 * Deteksi apakah payment_term sebuah PO adalah jenis "DP & Pelunasan (BP)",
 * mis. "DP 30% - Pelunasan 70%" (lihat purchase-order/create/page.tsx,
 * paymentTermType "DP_BP"). Dipakai untuk munculkan checkbox progress
 * pembayaran DP/BP saat Payment Validator approve, dan untuk filter list PO.
 */
export const isDpBpPaymentTerm = (
  paymentTerm: string | null | undefined,
): boolean => {
  if (!paymentTerm) return false;
  const normalized = paymentTerm.toLowerCase();
  return normalized.includes("dp") && normalized.includes("pelunasan");
};

/**
 * Approval terakhir yang sudah di-approve (bukan yang masih pending).
 * `approvals` berurutan sesuai step approval (lihat pemakaian nextApprover
 * di purchase-order/[id]/page.tsx), jadi approval approved dengan index
 * tertinggi adalah approver terakhir yang sudah menyetujui.
 */
export const getLastApprovedApprover = (
  approvals: Approval[] | null | undefined,
): Approval | null => {
  if (!Array.isArray(approvals)) return null;
  const approved = approvals.filter((app) => app.status === "approved");
  return approved.length > 0 ? approved[approved.length - 1] : null;
};

export interface LevelDefinition {
  value: string;
  label: string;
  group: "OPEN" | "CLOSE";
  description: string;
}

export const MR_LEVELS: LevelDefinition[] = [
  {
    value: "OPEN 1",
    label: "OPEN 1: Menunggu PR WH",
    group: "OPEN",
    description:
      "MR sudah diajukan tapi belum ada approval dari atasan (SPV / Manager)",
  },
  {
    value: "OPEN 2",
    label: "OPEN 2: Menunggu PO SCM",
    group: "OPEN",
    description: "MR sudah open tapi belum dibuatkan PO dari tim SCM",
  },
  {
    value: "OPEN 3A",
    label: "OPEN 3A: Menunggu Kirim (No Payment Issue)",
    group: "OPEN",
    description:
      "Bila barangnya belum dikirimkan dari vendor (No Payment Issue)",
  },
  {
    value: "OPEN 3B",
    label: "OPEN 3B: Menunggu Kirim (Payment Issue)",
    group: "OPEN",
    description:
      "Bila barangnya belum dikirimkan dari vendor (Ada Payment Issue)",
  },
  {
    value: "OPEN 4",
    label: "OPEN 4: Vendor Kirim (Belum Tiba)",
    group: "OPEN",
    description:
      "Bila barang sudah dikirim dari Vendor tapi belum sampai di WH kita",
  },
  {
    value: "OPEN 5",
    label: "OPEN 5: Tiba di WH (Belum Kirim ke Site)",
    group: "OPEN",
    description:
      "Bila barang sudah ada di Warehouse GMI (Bpn/ HO), tapi belum dikirim oleh team WH ke site",
  },
  {
    value: "CLOSE 1",
    label: "CLOSE 1: Kirim ke Site (Belum Diterima)",
    group: "CLOSE",
    description:
      "Bila barang sudah dikirimkan oleh team WH tapi belum diterima oleh team admin WH Site",
  },
  {
    value: "CLOSE 2A",
    label: "CLOSE 2A: Diterima Site (Dokumen Belum Kirim)",
    group: "CLOSE",
    description:
      "Bila barang sudah diterima admin WH Site tapi dokumen tanda terima belum dikirimkan ke HO.",
  },
  {
    value: "CLOSE 2B",
    label: "CLOSE 2B: Diterima Site (Dokumen Terkirim)",
    group: "CLOSE",
    description:
      "Barang sudah diterima oleh ADMIN WH / GA, serta documen tanda terima sudah dikirimkan ke HO",
  },
  {
    value: "CLOSE 3",
    label: "CLOSE 3: Selesai (Update Sistem)",
    group: "CLOSE",
    description:
      "Bila proses CLOSE 2B sudah selesai dan data sudah diupdate di sistem monitoring.",
  },
];

export const DATA_LEVEL = MR_LEVELS.map((l) => ({
  label: l.label,
  value: l.value,
}));

export const MR_ITEM_STATUSES = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PO_CREATED: "PO Created",
  PENDING_BAST: "Pending BAST",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REPLACED: "Replaced",
} as const;

export const MR_ITEM_STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Processing: "Proses PO",
  "PO Created": "Sudah PO",
  "Pending BAST": "Menunggu BAST",
  Completed: "BAST Selesai",
  Cancelled: "Dibatalkan",
  Replaced: "Diganti",
};

export const MR_ITEM_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-800 border-gray-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  "PO Created": "bg-green-50 text-green-700 border-green-200",
  "Pending BAST": "bg-orange-50 text-orange-700 border-orange-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
  Replaced: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

// Level fisik/approval/payment per item MR - terpisah dari MR_ITEM_STATUSES
// (yang track progress dokumen PO/BAST). Lihat MrItemLevel di type/index.ts.
export const MR_ITEM_LEVELS: Record<string, string> = {
  "Open 1": "Open 1: Menunggu Approval",
  "Open 2": "Open 2: Menunggu PO",
  "Open 3A": "Open 3A: Menunggu Kirim Vendor",
  "Open 3B": "Open 3B: Payment Issue",
  "Open 4": "Open 4: Payment Validator Approved",
  "Open 5": "Open 5: Diterima GA",
  Close: "Close: Selesai",
};

export const MR_ITEM_LEVEL_COLORS: Record<string, string> = {
  "Open 1": "bg-gray-100 text-gray-800 border-gray-200",
  "Open 2": "bg-sky-50 text-sky-700 border-sky-200",
  "Open 3A": "bg-blue-50 text-blue-700 border-blue-200",
  "Open 3B": "bg-red-50 text-red-700 border-red-200",
  "Open 4": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Open 5": "bg-orange-50 text-orange-700 border-orange-200",
  Close: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

// ==========================================
// ENUM & KOSNTANTA PETTY CASH
// ==========================================

export const PETTY_CASH_TYPE_OPTIONS = [
  "Reimbursement",
  "Cash Advance",
  "Pembayaran Langsung",
  "Transport & Perjalanan",
  "Entertain & Konsumsi",
  "Lainnya",
] as const;

export const PETTY_CASH_STATUS_OPTIONS = [
  "Pending Validation",
  "In Approval",
  "Cash Distributed",
  "Pending Settlement",
  "Settled",
  "Rejected",
] as const;

export const PETTY_CASH_STATUS_COLORS: Record<string, string> = {
  "Pending Validation": "bg-slate-100 text-slate-700 border-slate-300",
  "In Approval": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Cash Distributed": "bg-blue-50 text-blue-700 border-blue-200",
  "Pending Settlement": "bg-purple-50 text-purple-700 border-purple-200",
  Settled: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};
