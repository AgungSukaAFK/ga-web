// type/enum.ts

import { Approval, PcApprovalType } from "@/type";

export const LIMIT_OPTIONS = [10, 25, 50, 100, 1000, 10000];

export const VENDOR_TIPE_OPTIONS = ["HO", "Branch", "Site"] as const;

export const VENDOR_TIPE_LABELS: Record<string, string> = {
  HO: "Head Office",
  Branch: "Branch",
  Site: "Site",
};

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

// Warna badge "PO Refs" (referensi PO di tabel tracking MR item) - dikelompokkan
// jadi 4 kategori visual: masih proses approval/payment/kirim (biru), partial
// receive (kuning), full received (hijau), ditolak (merah). Status yang tidak
// terdaftar di sini (harusnya tidak ada) fallback ke kategori "proses".
const BLUE_BADGE =
  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800";

export const PO_REF_STATUS_COLORS: Record<string, string> = {
  "Pending Validation": BLUE_BADGE,
  "On Hold": BLUE_BADGE,
  "Pending Approval": BLUE_BADGE,
  "Pending Payment": BLUE_BADGE,
  "Waiting PO": BLUE_BADGE,
  "On Process": BLUE_BADGE,
  "Pending Receive": BLUE_BADGE,
  [PO_STATUS_PARTIAL_RECEIVE]:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  [PO_STATUS_FULL_RECEIVED]:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
  Rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};
export const PO_REF_STATUS_COLOR_DEFAULT = BLUE_BADGE;

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

// Kata kunci nama vendor yang dianggap marketplace - pembelian lewat sini
// PPN-nya dianggap flat 0% (bukan "termasuk", beneran gak ada PPN), beda
// dari vendor lain yang defaultnya dianggap harga sudah termasuk PPN 11%
// (lihat isMarketplaceVendor & pemakaiannya di VendorSearchCombobox pada
// purchase-order/create, purchase-order/edit, po-management/edit).
const MARKETPLACE_VENDOR_KEYWORDS = ["tokopedia", "tokped", "shopee", "shope"];

/**
 * Deteksi apakah nama vendor mengarah ke marketplace (Tokopedia/Shopee, dkk,
 * case-insensitive, toleran typo umum). Dipakai buat auto-set default PPN
 * pas vendor dipilih di form PO - marketplace = PPN 0% flat, vendor lain =
 * default dianggap harga sudah termasuk PPN 11% (bisa di-override manual).
 */
export const isMarketplaceVendor = (
  vendorName: string | null | undefined,
): boolean => {
  if (!vendorName) return false;
  const normalized = vendorName.toLowerCase();
  return MARKETPLACE_VENDOR_KEYWORDS.some((kw) => normalized.includes(kw));
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

// "PO Created" SUDAH TIDAK DIPAKAI LAGI sebagai status barang MR (dilebur ke
// "Processing" - baik item yang baru sebagian ke-cover PO maupun yang sudah
// penuh ke-cover PO sama-sama "Processing" sekarang; sinyal "sudah penuh
// ke-cover PO, tinggal nunggu kirim" dipindah ke field `level` - "Open 3A"
// ke atas berarti sudah penuh, lihat recalculateMrStatus di mrService.ts).
export const MR_ITEM_STATUSES = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  // Payment Validator baru approve PO ini (bukti pembayaran sudah ada) -
  // barang mulai dikirim vendor ke HO/Branch/Site, TAPI belum ada yang
  // nerima secara fisik (belum "Diterima GA"/langsung "On Delivery" utk
  // vendor Site). Dipasang di handleApprovalAction & handleEditDpBpPayment,
  // purchase-order/[id]/page.tsx, di titik yang sama dengan bump level ke
  // "Open 4" - supaya jelas bedanya sama "Processing" biasa (yang bisa
  // berarti "masih nunggu di-PO-kan" ATAU "sudah di-PO-kan tapi belum
  // dibayar").
  SHIPPED_BY_VENDOR: "Dikirim Vendor",
  DITERIMA_GA: "Diterima GA",
  ON_DELIVERY: "On Delivery",
  PENDING_BAST: "Pending BAST",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REPLACED: "Replaced",
} as const;

export const MR_ITEM_STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Processing: "Proses PO",
  "Dikirim Vendor": "Dikirim dari Vendor",
  "Diterima GA": "Diterima GA",
  "On Delivery": "Dalam Pengiriman",
  "Pending BAST": "Pending Terima User",
  Completed: "Barang Diterima User",
  Cancelled: "Dibatalkan",
  Replaced: "Diganti",
};

// Default/fallback badge (mis. status legacy "PO Created" yang sudah tidak
// dipakai lagi tapi masih bisa muncul di data lama) - HARUS selalu bawa
// text+border sendiri, jangan cuma bg. Badge variant="outline" nyetel
// text-foreground (ngikut tema) sebagai base; kalau fallback cuma kasih bg
// tanpa text override, di dark mode text-foreground jadi nyaris putih di
// atas bg-gray-100 yang tetap terang -> teksnya ketutupan/ga kebaca.
export const MR_ITEM_STATUS_COLOR_DEFAULT =
  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";

export const MR_ITEM_STATUS_COLORS: Record<string, string> = {
  Pending: MR_ITEM_STATUS_COLOR_DEFAULT,
  Processing:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  "Dikirim Vendor":
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
  "Diterima GA":
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  "On Delivery":
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  "Pending BAST":
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  Completed:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  Cancelled:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  Replaced:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
};

// Barang berstatus salah satu dari ini artinya siap di-upload BAST-nya oleh
// requester - "Pending BAST" dipertahankan buat data lama (lihat komentar di
// MrItemStatus, type/index.ts) yang belum sempat lewat status "On Delivery".
export const MR_ITEM_BAST_ELIGIBLE_STATUSES = ["On Delivery", "Pending BAST"];

export const DELIVERY_TYPE_OPTIONS = [
  "Kurir/Ekspedisi Eksternal",
  "Kendaraan Internal GA",
  "Diambil Langsung Requester",
  "Lainnya",
] as const;

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

export const MR_ITEM_LEVEL_COLOR_DEFAULT = MR_ITEM_STATUS_COLOR_DEFAULT;

export const MR_ITEM_LEVEL_COLORS: Record<string, string> = {
  "Open 1": MR_ITEM_LEVEL_COLOR_DEFAULT,
  "Open 2":
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  "Open 3A":
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  "Open 3B":
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  "Open 4":
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
  "Open 5":
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  Close:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
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
  "Pending Validation":
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  "In Approval":
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
  "Cash Distributed":
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  "Pending Settlement":
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
  Settled:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  Rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};
export const PETTY_CASH_STATUS_COLOR_DEFAULT =
  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";

// Kategori untuk katalog Barang Petty Cash (lihat petty_cash_barang &
// PettyCashBarangClient.tsx) - beda dari kategori barang MR/PO utama.
export const PETTY_CASH_BARANG_KATEGORI_OPTIONS = [
  "Kebutuhan Dapur",
  "Rutin Bulanan",
  "Operasional",
  "Sewa",
  "BBM",
  "E-Tol",
  "Maintenance Building",
  "Maintenance Kendaraan",
  "ATK",
  "Ongkos Kirim",
  "Kebutuhan Kantor",
] as const;

// Daftar satuan (UoM) umum - dipakai combobox search di form Barang Petty
// Cash. Sengaja generik (bukan cuma barang fisik) karena kategori seperti
// "Sewa"/"Rutin Bulanan" butuh satuan waktu (Jam/Bulan/Tahun), bukan cuma
// satuan kemasan/berat/volume.
export const UOM_OPTIONS = [
  "Pcs",
  "Unit",
  "Set",
  "Pack",
  "Box",
  "Dus",
  "Lusin",
  "Kodi",
  "Rim",
  "Roll",
  "Lembar",
  "Pasang",
  "Botol",
  "Galon",
  "Kaleng",
  "Sak",
  "Karung",
  "Paket",
  "Gram",
  "Kg",
  "Ton",
  "Ml",
  "Liter",
  "Cm",
  "Meter",
  "Km",
  "M2",
  "Menit",
  "Jam",
  "Hari",
  "Minggu",
  "Bulan",
  "Tahun",
  "Trip",
  "Orang",
] as const;

// Status "Input Pengajuan" Petty Cash (petty_cash_pengajuan, item-based) -
// text bebas di DB (bukan check constraint), daftar di sini akan bertambah
// seiring tahap Pengajuan Voucher/Claim Voucher/Deklarasi dibangun.
export const PC_PENGAJUAN_STATUS_OPTIONS = [
  "In Approval",
  "Approved",
  "Rejected",
] as const;

export const PC_PENGAJUAN_STATUS_COLORS: Record<string, string> = {
  "In Approval":
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
  Approved:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  Rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};
export const PC_PENGAJUAN_STATUS_COLOR_DEFAULT =
  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";

// Status Pengajuan Voucher Petty Cash (petty_cash_voucher) - mirip
// PC_PENGAJUAN_STATUS_OPTIONS tapi ada tahap tambahan "Permintaan Klaim"
// (requester ajukan klaim pencairan begitu Voucher-nya "Approved", lihat
// submitVoucherClaim di services/pettyCashVoucherService.ts) yang tidak
// dipunyai Pengajuan - makanya dipisah, bukan reuse PC_PENGAJUAN_STATUS_*.
export const PC_VOUCHER_STATUS_OPTIONS = [
  "In Approval",
  "Approved",
  "Permintaan Klaim",
  "Rejected",
] as const;

export const PC_VOUCHER_STATUS_COLORS: Record<string, string> = {
  "In Approval":
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
  Approved:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  "Permintaan Klaim":
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  Rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
};
export const PC_VOUCHER_STATUS_COLOR_DEFAULT =
  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";

// Tipe approval Template Approval Petty Cash - lihat komentar PcApprovalType
// di type/index.ts untuk urutan tahapannya. Dipakai sebagai field wajib di
// PcApprovalTemplate (services/pcApprovalTemplateService.ts) supaya tiap
// template eksplisit menandakan untuk tahap apa dia dipakai.
export const PC_APPROVAL_TYPE_PENGAJUAN: PcApprovalType = "Approval Pengajuan";
export const PC_APPROVAL_TYPE_VOUCHER: PcApprovalType = "Approval Voucher";
export const PC_APPROVAL_TYPE_DEKLARASI: PcApprovalType = "Approval Deklarasi";

export const PC_APPROVAL_TYPE_OPTIONS: PcApprovalType[] = [
  PC_APPROVAL_TYPE_PENGAJUAN,
  PC_APPROVAL_TYPE_VOUCHER,
  PC_APPROVAL_TYPE_DEKLARASI,
];

export const PC_APPROVAL_TYPE_COLORS: Record<string, string> = {
  [PC_APPROVAL_TYPE_PENGAJUAN]:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  [PC_APPROVAL_TYPE_VOUCHER]:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
  [PC_APPROVAL_TYPE_DEKLARASI]:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800",
};
export const PC_APPROVAL_TYPE_COLOR_DEFAULT =
  "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
