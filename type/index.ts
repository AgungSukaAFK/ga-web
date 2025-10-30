// src/type.ts

// --- Tipe Data Database (jika Anda menggunakan auto-generation, ini bisa disederhanakan) ---

export interface Approval {
  type: string;
  status: "pending" | "approved" | "rejected";
  userid: string;
  nama: string;
  email: string;
  role: string;
  department: string;
}

export interface Order {
  name: string;
  qty: string;
  uom: string;
  vendor: string;
  vendor_contact: string;
  note: string;
  url: string;
}

export interface Attachment {
  url: string;
  name: string;
  type?: "po" | "finance";
}

export interface Discussion {
  user_id: string;
  user_name: string;
  message: string;
  timestamp: string;
}

export interface Profile {
  id: string; // UUID
  role?: string | null;
  lokasi?: string | null;
  department?: string | null;
  created_at?: string | null;
  nama?: string | null;
  nrp?: string | null;
  company?: string | null;
  email?: string | null;
}

// Tipe alias untuk 'User' dari tabel profiles
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
  discussions: Discussion[]; // Diperbarui dari {}[]
  company_code: string;
  tujuan_site: string;
  cost_center: string;
  // Properti relasi (opsional, tergantung query)
  users_with_profiles?: { nama: string; email?: string } | null;
}

// --- Tipe Data PO ---

export interface POItem {
  barang_id: number;
  part_number: string;
  name: string;
  qty: number;
  uom: string;
  price: number;
  total_price: number;
  vendor_name: string;
}

export interface PurchaseOrderPayload {
  kode_po: string;
  mr_id: number | null;
  user_id: string;
  status:
    | "Pending Validation"
    | "Pending Approval"
    | "Pending BAST"
    | "Completed"
    | "Rejected"
    | "Draft"
    | "Ordered";
  vendor_details?: { name: string; address?: string; contact_person?: string };
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
  attachments?: Attachment[]; // Diperbarui ke tipe Attachment
  approvals?: Approval[];
  repeated_from_po_id?: number | null; // Anda bisa hapus ini jika sudah tidak dipakai
}

// --- Tipe Data View & Helper ---

export interface MaterialRequestListItem {
  id: string; // Atau number jika ID Anda number
  kode_mr: string;
  kategori: string;
  status: string;
  department: string;
  created_at: Date | string; // Bisa Date atau string ISO
  due_date?: Date | string | null; // Opsional dan bisa null
  company_code: string | null; // Ditambahkan untuk MR Management
  users_with_profiles: { nama: string } | null; // Nama requester
}

export interface PurchaseOrderListItem {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  created_at: string;
  company_code: string | null; // Tambahkan company_code
  users_with_profiles: { nama: string } | null;
  material_requests: { kode_mr: string } | null;
}

export interface ApprovedMaterialRequest {
  id: number;
  kode_mr: string;
  remarks: string;
  department: string;
}

export interface Barang {
  id: number;
  created_at: string;
  part_number: string;
  part_name: string | null;
  category: string | null;
  uom: string | null;
  vendor: string | null;
}

export interface MaterialRequestForPO {
  id: number;
  kode_mr: string;
  orders: Order[]; // Diperbarui dari tipe generik
  company_code: string;
  users_with_profiles: { nama: string } | null;
}

// REVISI KRITIS: PurchaseOrderDetail sekarang mencerminkan data yang di-fetch
export interface PurchaseOrderDetail
  extends Omit<PurchaseOrderPayload, "mr_id" | "user_id"> {
  id: number;
  created_at: string;
  updated_at: string;
  mr_id: number | null;

  // Ini adalah pembuat PO (Purchasing)
  users_with_profiles: {
    nama: string;
    email?: string; // Sesuai query
  } | null;

  // Ini adalah data MR yang direferensikan, lengkap dengan data requester-nya
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
    | "Pending BAST"
    | "Completed"
    | "Rejected"
    | "Draft"
    | "Ordered"
    | string; // Fallback untuk status lain
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
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string

  // -- Properti Relasional (dari join) --
  // Ini adalah pembuat PO (Purchasing)
  users_with_profiles?: {
    nama: string;
    email?: string;
  } | null;

  // Ini adalah data MR yang direferensikan
  material_requests?:
    | (MaterialRequest & {
        users_with_profiles: { nama: string } | null;
      })
    | null;
}
