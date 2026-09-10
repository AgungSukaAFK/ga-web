// src/type/index.ts

export interface Approval {
  type: string;
  status: "pending" | "approved" | "rejected";
  userid: string;
  nama: string;
  email: string;
  role: string;
  department: string;
  processed_at?: string | null;
}

// REVISI: Tambahkan field untuk integrasi Master Barang
export interface Order {
  // --- FIELD LAMA (JANGAN DIUBAH) ---
  name: string;
  qty: string; // Tetap string sesuai kode Anda
  uom: string;
  estimasi_harga: number;
  note: string;
  url: string;
  barang_id?: number | null;
  part_number?: string | null;

  // --- FIELD BARU (TRACKING) - Semuanya Optional (?) ---
  status?: MrItemStatus; // Default nanti: 'Pending'
  po_refs?: string[]; // Array Kode PO, misal ["PO/001"]
  status_note?: string; // Alasan pembatalan/penggantian
  updated_by?: string; // User ID purchasing yang ubah
  updated_at?: string; // Waktu perubahan
  bast_attachments?: Attachment[]; // Bukti BAST per item, diunggah requester
  // Link manual ke PO - dipakai kalau barang yang dibeli disubstitusi/diganti
  // pas belanja (part_number PO beda dari part_number MR asli), jadi matching
  // otomatis by part_number di fetchPoQtyBreakdownForMr gagal detect.
  manual_po_links?: { kode_po: string; qty: number }[];
  // Level fisik/approval/payment per item (terpisah dari `status`) - lihat
  // MrItemLevel. Default 'Open 1' saat item dibuat.
  level?: MrItemLevel;
  payment_issue_note?: string; // Alasan Open 3B (payment issue), opsional
  // Diisi GA saat kirim barang ke requester (status "On Delivery") - dipakai
  // buat bandingin apa yg dikirim GA vs apa yg diterima requester (BAST).
  delivery_info?: DeliveryInfo;
  // Qty item ini yang dipenuhi langsung dari Stok GA (ga_stocks), bukan lewat
  // PO - lihat addStockFulfillment (services/mrService.ts). Kalau qty di
  // sini + qty ter-PO (fetchPoQtyBreakdownForMr) sudah >= qty diminta, item
  // langsung status "Completed"/level "Close" (skip approval/pengiriman/BAST
  // sepenuhnya - lihat handler "Kirim pakai Stok GA" di
  // material-request/[id]/page.tsx).
  stock_fulfillments?: {
    ga_stock_id: number;
    qty: number;
    fulfilled_at: string;
    fulfilled_by: string;
  }[];
}

export type DeliveryType =
  | "Kurir/Ekspedisi Eksternal"
  | "Kendaraan Internal GA"
  | "Diambil Langsung Requester"
  | "Dikirim ke KM 10"
  | "Lainnya";

export interface DeliveryInfo {
  delivery_type: DeliveryType;
  courier?: string; // Nama ekspedisi - wajib kalau delivery_type "Kurir/Ekspedisi Eksternal"
  tracking_number?: string; // No. resi
  note?: string;
  qty_sent: number;
  // Bukti kirim (foto/surat jalan) - wajib min. 1, KECUALI delivery_type
  // "Dikirim ke KM 10" (lihat handleSendToRequester di
  // purchase-order/[id]/page.tsx - untuk tipe ini ekspedisi/resi/bukti
  // sengaja dikosongkan & tidak wajib).
  attachments: Attachment[];
  sent_at: string;
  sent_by: string; // User ID GA yang kirim
  // Diisi kalau info pengiriman ini pernah diedit ulang (GA approver, selama
  // status barang masih "On Delivery") - sent_at/sent_by TETAP dipertahankan
  // sebagai catatan pengiriman awal, ini cuma jejak edit terakhir.
  edited_at?: string;
  edited_by?: string;
}

export type MrItemLevel =
  | "Open 1" // MR dibuat, menunggu approval
  | "Open 2" // MR sudah full approved, menunggu PO
  | "Open 3A" // PO sudah dibuat utk item ini, menunggu vendor kirim
  | "Open 3B" // Sama seperti 3A tapi ada payment issue (ditandai manual)
  | "Open 4" // PO item ini sudah diapprove step Payment Validator
  | "Open 5" // Barang sudah diterima GA
  | "Close"; // Item selesai (BAST sudah diupload)

export interface Attachment {
  url: string;
  name: string;
  type?: "po" | "finance" | "bast" | "invoice" | "quotation" | "delivery";
}

export interface DiscussionMention {
  id: string;
  nama: string;
}

export interface Discussion {
  user_id: string;
  user_name: string;
  message: string;
  timestamp: string;
  mentions?: DiscussionMention[];
}

export interface Profile {
  id: string;
  role?: string | null;
  lokasi?: string | null;
  department?: string | null;
  created_at?: string | null;
  nama?: string | null;
  nrp?: string | null;
  company?: string | null;
  email?: string | null;
  is_active?: boolean | null;
}

export type User = Profile;

export interface MaterialRequest {
  id: string;
  userid: string;
  kode_mr: string;
  kategori: string;
  status: string;
  remarks: string;
  cost_estimation: string;
  department: string;
  created_at: Date;
  due_date?: Date;
  orders: Order[];
  approvals: Approval[];
  attachments: Attachment[];
  discussions: Discussion[];
  company_code: string;
  tujuan_site: string;
  cost_center_id: number | null;
  cost_center?: string;
  cost_centers?: {
    name: string;
    current_budget: number;
  } | null;

  prioritas: "P0" | "P1" | "P2" | "P3" | "P4" | null;
  level: string;

  users_with_profiles?: { nama: string; email?: string } | null;

  // Umur MR: stempel sekali pas status pertama kali jadi "Full Received"
  // (lihat recalculateMrStatus, services/mrService.ts) - null kalau belum
  // selesai, atau kalau MR ini sudah Full Received dari sebelum fitur ini
  // ada (data lama, tidak sempat tercatat - lihat formatAge di lib/utils.ts).
  full_received_at?: string | null;
}

export interface POItem {
  barang_id: number;
  part_number: string;
  name: string;
  qty: number;
  uom: string;
  price: number;
  total_price: number;
  vendor_name: string;

  // --- TAMBAHAN BARU ---
  description?: string; // Untuk menampung 'note' dari Order MR
  link?: string; // Untuk menampung 'url' dari Order MR
  is_asset?: boolean; // Dari barang.is_asset - 1 PO tidak boleh campur asset & goods
}

export interface PurchaseOrderPayload {
  kode_po: string;
  mr_id: number | null;
  user_id: string;
  is_asset?: boolean;
  status:
    | "Pending Validation"
    | "Pending Approval"
    | "Pending Payment"
    | "Pending Receive"
    | "Partial Receive"
    | "Full Received"
    | "Rejected"
    | "Draft"
    | "Ordered";
  dp_bp_shipping_type?: "ship_after_dp" | "ship_after_full_payment" | null;
  vendor_details?: StoredVendorDetails;
  items: POItem[];
  currency: string;
  discount: number;
  tax: number;
  postage: number;
  total_price: number;
  payment_term: string;
  shipping_address: string;
  company_code: string;
  notes: string;
  attachments?: Attachment[];
  approvals?: Approval[];
  repeated_from_po_id?: number | null; // fitur ini sudah ditinggalkan
  pph_type?: string | null;
  pph_rate?: number | null;
  pph_amount?: number | null;
  // Harga item di PO ini sudah termasuk PPN atau belum. Kalau true, `tax`
  // TETAP 0 (gak ada nominal tambahan ke total - PPN-nya udah nempel di
  // `price` tiap item), tapi `ppn_rate` tetap disimpan supaya UI (detail +
  // cetak) bisa nampilin info "PPN yang sudah termasuk" = subtotal x
  // ppn_rate% (sekadar informasi, TIDAK mengubah harga/total - lihat
  // diskusi fitur ini).
  tax_included?: boolean | null;
  // Persentase PPN yang dipakai - baik pas `tax_included` true (buat hitung
  // info PPN) maupun false (buat tau tarif yang dipakai ngitung `tax`, gak
  // perlu ditebak dari tax/dpp lagi kayak inferredPpnRate lama). Null utk PO
  // lama sebelum field ini ada, atau saat tax mode manual.
  ppn_rate?: number | null;
  // Progress pembayaran khusus payment_term "DP & Pelunasan" (DP_BP)
  dp_paid?: boolean | null;
  bp_paid?: boolean | null;
  // Riwayat penerimaan barang - satu record yang ditimpa/diedit ulang oleh
  // Receiver (lihat submitReceiveRecord di purchaseOrderService.ts), bukan log
  // bertumpuk. Null selama status masih "Pending Payment"/"Pending Receive"
  // sebelum ada checklist yang disubmit sama sekali.
  receive_record?: ReceiveRecord | null;
  // Umur PO: stempel sekali pas status pertama kali jadi "Full Received"
  // (lihat getFullReceivedStamp, services/purchaseOrderService.ts) - null
  // kalau belum selesai, atau PO ini Full Received dari sebelum fitur ini
  // ada (data lama, tidak sempat tercatat - lihat formatAge di lib/utils.ts).
  full_received_at?: string | null;
  // Token acak dipakai sebagai URL publik `/goods-receipt/<token>` yang
  // di-encode ke QR di BAST cetak - digenerate sekali (lazy, lihat
  // ensureReceiptToken di services/goodsReceiptService.ts), dipakai ulang
  // tiap reprint (tidak dirotasi).
  receipt_token?: string | null;
  // Snapshot konfirmasi penerimaan barang lewat scan QR publik (atau login)
  // - null selama belum ada yang submit. Sekali terisi, PO ini dianggap
  // "sudah diterima" dan token di atas jadi single-use (lihat
  // fetchGoodsReceiptView, services/goodsReceiptService.ts).
  goods_receipt?: GoodsReceipt | null;
}

// Hasil konfirmasi fisik penerimaan barang - diisi lewat halaman publik
// /goods-receipt/[token] (scan QR di BAST cetak) begitu barang sampai ke
// requester. Per-PO (bukan per-item MR) karena satu item MR bisa dipecah ke
// >1 PO - qty & foto yang dikonfirmasi di sini spesifik utk pengiriman PO
// ini saja.
export interface GoodsReceiptItem {
  part_number: string;
  qty_received: number;
  photos: Attachment[];
}

export interface GoodsReceipt {
  receiver_name: string;
  confirmed_at: string;
  confirmed_via: "login" | "public_code";
  confirmed_by_user_id: string;
  items: GoodsReceiptItem[];
}

export interface ReceiveRecordItem {
  part_number: string;
  part_name: string;
  ordered_qty: number;
  received_qty: number;
}

export interface ReceiveRecord {
  items: ReceiveRecordItem[];
  is_full_match: boolean;
  received_by: string;
  received_by_name: string;
  received_at: string;
}

export interface MaterialRequestListItem {
  id: string;
  kode_mr: string;
  cost_estimation: string;
  kategori: string;
  status: string;
  department: string;
  tujuan_site: string;
  orders: Order[];
  approvals: Approval[];
  attachments: Attachment[];
  created_at: Date | string;
  due_date?: Date | string | null;
  company_code: string | null;
  users_with_profiles: { nama: string } | null;

  prioritas: "P0" | "P1" | "P2" | "P3" | "P4" | null;
  level: string;
  full_received_at?: string | null;
}

export interface PurchaseOrderListItem {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  created_at: string;
  company_code: string | null;
  approvals: Approval[] | null;
  users_with_profiles: { nama: string } | null;
  material_requests: {
    kode_mr: string;
    users_with_profiles: { nama: string } | null;
  } | null;
  vendor_details?: StoredVendorDetails | any;
  payment_term?: string | null;
  dp_paid?: boolean | null;
  bp_paid?: boolean | null;
  dp_bp_shipping_type?: "ship_after_dp" | "ship_after_full_payment" | null;
  items?: POItem[];
  is_asset?: boolean | null;
  // Umur PO - lihat komentar full_received_at di MaterialRequest.
  full_received_at?: string | null;
}

export interface ApprovedMaterialRequest {
  id: number;
  kode_mr: string;
  remarks: string;
  department: string;
  status: string; // REVISI: Added status
  created_at: string; // REVISI: Added created_at
}

export interface Barang {
  id: number;
  created_at: string;
  part_number: string;
  part_name: string | null;
  category: string | null;
  uom: string | null;
  vendor: string | null;
  is_asset: boolean;
  last_purchase_price?: number | null;
  link?: string | null;
}

// Katalog barang KHUSUS Petty Cash - tabel `petty_cash_barang`, terpisah total
// dari `barang` (katalog MR/PO utama, lihat interface Barang di atas). Hanya
// admin/departemen GA yang boleh menambah/ubah/hapus (lihat
// supabase/petty-cash-barang-setup.sql & isGADepartment).
export interface PettyCashBarang {
  id: number;
  part_number: string | null;
  part_name: string;
  category: string | null;
  uom: string | null;
  vendor: string | null;
  last_purchase_price: number | null;
  link: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  // Relasi opsional saat di-join (lihat fetchPettyCashBarang)
  created_by_profile?: { nama: string | null } | null;
  updated_by_profile?: { nama: string | null } | null;
}

export interface GaStock {
  id: number;
  barang_id: number;
  company_code: string;
  quantity: number;
  location: string | null;
  note: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
  updated_by?: string | null;
  // Hasil join ke master barang
  barang?: {
    part_number: string;
    part_name: string | null;
    uom: string | null;
    category: string | null;
  } | null;
}

export interface Vendor {
  id: number;
  created_at: string;
  kode_vendor: string;
  nama_vendor: string;
  pic_contact_person: string | null;
  alamat: string | null;
  email: string | null;
  tipe_vendor: "HO" | "Branch" | "Site" | null;
}

export interface StoredVendorDetails {
  vendor_id: number;
  kode_vendor: string;
  nama_vendor: string;
  alamat: string;
  contact_person: string;
  email: string;
  // Snapshot dari Vendor.tipe_vendor pas PO dibuat - dipakai buat nentuin
  // alur penerimaan barang (lihat "canReceiveGoods" di purchase-order/[id]/page.tsx):
  // HO/Branch tetap lewat GA, Site langsung ke requester tanpa proses terima GA.
  tipe_vendor?: "HO" | "Branch" | "Site" | null;
}

export interface MaterialRequestForPO {
  id: number;
  kode_mr: string;
  orders: Order[];
  company_code: string;
  users_with_profiles: { nama: string } | null;
  prioritas: "P0" | "P1" | "P2" | "P3" | "P4" | null;
  level: string;
}

export interface PurchaseOrderDetail extends Omit<
  PurchaseOrderPayload,
  "mr_id" | "user_id" | "vendor_details" | "items"
> {
  id: number;
  created_at: string;
  updated_at: string;
  user_id: string; // UUID pembuat PO (di-select via "*", dipakai utk notifikasi)
  mr_id: number | null;
  vendor_details: StoredVendorDetails | null;
  users_with_profiles: {
    nama: string;
    email?: string;
  } | null;
  items: POItem[];
  material_requests:
    | (MaterialRequest & {
        users_with_profiles: { nama: string } | null;
      })
    | null;
}

export interface PurchaseOrder {
  id: number;
  kode_po: string;
  mr_id: number | null;
  user_id: string;
  status:
    | "Pending Validation"
    | "Pending Approval"
    | "Pending Payment"
    | "Pending Receive"
    | "Partial Receive"
    | "Full Received"
    | "Rejected"
    | "Draft"
    | "Ordered"
    | string;
  vendor_details: {
    name: string;
    address?: string;
    contact_person?: string;
  } | null;
  items: POItem[];
  currency: string;
  discount: number | null;
  tax: number | null;
  postage: number | null;
  total_price: number;
  payment_term: string | null;
  shipping_address: string | null;
  company_code: string;
  notes: string | null;
  attachments: Attachment[] | null;
  approvals: Approval[] | null;
  created_at: string;
  updated_at: string;

  // Progress pembayaran khusus payment_term "DP & Pelunasan" (DP_BP)
  dp_paid?: boolean | null;
  bp_paid?: boolean | null;
  receive_record?: ReceiveRecord | null;

  pph_type?: string | null; // Jenis PPH (misal: "pph21_npwp")
  pph_rate?: number | null; // Persentase (misal: 1.5)
  pph_amount?: number | null; // Nominal Rupiah

  // Lihat komentar di PurchaseOrderPayload - sama persis.
  tax_included?: boolean | null;
  ppn_rate?: number | null;

  users_with_profiles?: {
    nama: string;
    email?: string;
  } | null;

  material_requests?:
    | (MaterialRequest & {
        users_with_profiles: { nama: string } | null;
      })
    | null;
}

export interface CostCenter {
  id: number;
  name: string;
  code: string | null;
  company_code: string;
  initial_budget: number;
  current_budget: number;
  is_active?: boolean;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface CostCenterHistory {
  id: number;
  cost_center_id: number;
  mr_id: number | null;
  user_id: string | null;
  change_amount: number;
  previous_budget: number;
  new_budget: number;
  description: string;
  created_at: string | Date;

  material_requests?: {
    kode_mr: string;
  } | null;
  profiles?: {
    nama: string;
  } | null;
}

export interface ItemRequest {
  id: number;
  created_at: string;
  requester_id: string;
  proposed_name: string;
  proposed_category: string;
  proposed_uom: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  processed_by: string | null;
  users_with_profiles?: {
    nama: string;
    email: string;
    department: string;
  } | null;
}

export type NotificationType =
  | "mention"
  | "approval_mr"
  | "approval_po"
  | "info"
  | "mr_submitted"
  | "mr_validated"
  | "mr_approved_step"
  | "mr_fully_approved"
  | "mr_rejected"
  | "po_submitted"
  | "po_validated"
  | "po_approved_step"
  | "po_fully_approved"
  | "po_rejected"
  | "pc_submitted"
  | "pc_routed"
  | "pc_approved_step"
  | "pc_fully_approved"
  | "pc_rejected";
export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  type: NotificationType;
  title: string;
  message: string;
  resource_id?: string;
  resource_type?: "material_request" | "purchase_order";
  link: string;
  is_read: boolean;
}

export type MrItemStatus =
  | "Pending"
  // Sedang diproses - baik masih sebagian ke-cover PO, sudah PENUH ke-cover
  // PO (tinggal nunggu vendor kirim - cek `level` "Open 3A" ke atas untuk
  // bedain dari yang masih sebagian), maupun hasil checklist Receiver yang
  // qty-nya belum sesuai. "PO Created" (status terpisah dulu) sudah tidak
  // dipakai lagi, dilebur ke sini.
  | "Processing"
  // Payment Validator baru approve PO ini - barang mulai dikirim vendor,
  // TAPI belum ada yang nerima secara fisik (belum "Diterima GA"/langsung
  // "On Delivery" utk vendor Site). Lihat MR_ITEM_STATUSES.SHIPPED_BY_VENDOR,
  // type/enum.ts.
  | "Dikirim Vendor"
  | "Diterima GA" // Barang sudah diterima GA dari vendor, belum dikirim ke requester
  | "On Delivery" // GA sudah kirim ke requester, tinggal nunggu requester terima & upload BAST
  // Legacy - dipakai sebelum ada pemisahan "Diterima GA"/"On Delivery" (GA
  // terima & "siap di-BAST" dianggap 1 momen). Data lama yang masih di status
  // ini TETAP bisa di-upload BAST-nya (lihat pengecekan status di halaman MR/
  // MR Management) - status baru tidak akan set nilai ini lagi.
  | "Pending BAST"
  | "Completed" // Requester sudah upload BAST utk item ini
  | "Cancelled" // Dibatalkan oleh Purchasing
  | "Replaced"; // Diganti dengan barang lain

// ==========================================
// KEBUTUHAN MODUL PETTY CASH (STANDALONE)
// ==========================================

// Rekening bank tersimpan milik user (privat, lihat
// supabase/petty-cash-reimbursement-bank-account-setup.sql) - dikelola dari
// halaman Profile, dipilih (atau quick-add) saat membuat pengajuan Petty
// Cash tipe "Reimbursement".
export interface BankAccount {
  id: number;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export type PettyCashType = "Reimbursement" | "Cash Advance";

export type PettyCashStatus =
  | "Pending Validation"
  | "In Approval"
  | "Cash Distributed"
  | "Pending Settlement"
  | "Settled"
  | "Rejected";
export interface PettyCashRequest {
  id: number;
  kode_pc: string;
  user_id: string;
  company_code: string;
  department: string;
  cost_center_id: number | null;
  type: PettyCashType;
  amount: number;
  actual_amount: number | null;
  purpose: string;
  status: PettyCashStatus;
  discussions: any[];
  approvals: Approval[];
  attachments: Attachment[];
  settlement_attachments: Attachment[];
  needed_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;

  // Snapshot rekening tujuan - cuma keisi utk type "Reimbursement" (lihat
  // supabase/petty-cash-reimbursement-bank-account-setup.sql)
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder_name: string | null;

  // Field relasi (saat di-join dengan tabel lain)
  users_with_profiles?: { nama: string; email?: string } | null;
  cost_centers?: { name: string; current_budget: number } | null;
}

export interface PettyCashPayload {
  company_code: string;
  department: string;
  cost_center_id: number;
  type: PettyCashType;
  amount: number;
  purpose: string;
  needed_date: string;
  attachments: Attachment[];
  // Cuma dikirim saat type "Reimbursement" (lihat buat/page.tsx)
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder_name?: string;
}

export interface PettyCashSettlementPayload {
  actual_amount: number;
  settlement_attachments: Attachment[];
}

// ==========================================
// INPUT PENGAJUAN PETTY CASH (BARU, item-based, terpisah dari
// PettyCashRequest lump-sum di atas) - tabel `petty_cash_pengajuan`. Bagian
// dari rangkaian Pengajuan -> Approval Pengajuan -> Pengajuan Voucher ->
// Approval Voucher -> Claim Voucher -> Deklarasi -> Approval Deklarasi.
// ==========================================

// Tahap approval yang bisa dipilih untuk sebuah Template Approval Petty Cash
// (lihat PcApprovalTemplate, services/pcApprovalTemplateService.ts) - satu
// template cuma berlaku untuk SATU tahap di rangkaian di atas. Baru
// "Approval Pengajuan" yang sudah dipakai (Input Pengajuan) - "Approval
// Voucher"/"Approval Deklarasi" disiapkan tipenya duluan supaya templatenya
// bisa dibuat sebelum alur Voucher/Deklarasi-nya sendiri jadi.
export type PcApprovalType =
  | "Approval Pengajuan"
  | "Approval Voucher"
  | "Approval Deklarasi";

export interface PettyCashPengajuanItem {
  // null = barang manual (tidak ada di katalog petty_cash_barang), lihat
  // PettyCashItemSearchCombobox.tsx.
  barang_id: number | null;
  part_name: string;
  category: string | null;
  uom: string | null;
  qty: number;
  unit_price: number;
  subtotal: number;
  note: string | null;
}

// Approver di jalur persetujuan pengajuan - diisi otomatis dari Template
// Approval Petty Cash yang auto-terapkan sesuai departemen (lihat
// resolvePcAutoTemplate di services/pcApprovalTemplateService.ts). Sengaja
// didefinisikan ulang di sini (bukan import PcApprover dari service) supaya
// layer type/ tidak balik bergantung ke services/.
export interface PettyCashPengajuanApprover {
  userid: string;
  nama: string;
  department: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  processed_at?: string | null;
}

export interface PettyCashPengajuan {
  id: number;
  kode_pengajuan: string;
  user_id: string;
  company_code: string;
  department: string;
  cost_center_id: number | null;
  needed_date: string | Date;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  total_amount: number;
  attachments: Attachment[];
  status: string;
  approvals: PettyCashPengajuanApprover[];
  discussions: any[];
  created_at: string | Date;
  created_by: string | null;
  updated_at: string | Date;
  updated_by: string | null;

  // Field relasi (saat di-join dengan tabel lain)
  users_with_profiles?: { nama: string; email?: string } | null;
  cost_centers?: { name: string; current_budget: number } | null;
  // Voucher yang sudah dibuat dari Pengajuan ini (kalau ada) - dipakai utk
  // filter "belum di-voucher-kan" (lihat fetchApprovedPengajuanForVoucher,
  // services/pettyCashVoucherService.ts). Satu Pengajuan cuma boleh punya
  // SATU Voucher (unique pengajuan_id di DB), jadi arraynya panjang 0 atau 1.
  petty_cash_voucher?: { id: number }[] | null;
}

// ==========================================
// PENGAJUAN VOUCHER PETTY CASH - tabel `petty_cash_voucher`. Satu Voucher =
// SNAPSHOT persis dari satu PettyCashPengajuan yang sudah berstatus
// "Approved" (item/qty/harga/catatan/lampiran di-copy apa adanya, tidak bisa
// diubah requester) - lihat createVoucherFromPengajuan,
// services/pettyCashVoucherService.ts. Jalur approval-nya sendiri terpisah
// dari jalur approval Pengajuan-nya (auto-terapkan dari Template Approval
// dengan approval_type "Approval Voucher").
// ==========================================

export interface PettyCashVoucher {
  id: number;
  kode_voucher: string;
  pengajuan_id: number;
  user_id: string;
  company_code: string;
  department: string;
  cost_center_id: number | null;
  needed_date: string | Date;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  total_amount: number;
  attachments: Attachment[];
  status: string;
  approvals: PettyCashPengajuanApprover[];
  discussions: any[];
  created_at: string | Date;
  created_by: string | null;
  updated_at: string | Date;
  updated_by: string | null;

  // Field relasi (saat di-join dengan tabel lain)
  users_with_profiles?: { nama: string; email?: string } | null;
  cost_centers?: { name: string; current_budget: number } | null;
  petty_cash_pengajuan?: { kode_pengajuan: string } | null;
}
