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
  name: string;
  qty: string;
  uom: string;
  estimasi_harga: number;
  note: string;
  url: string;
  // Field Baru
  barang_id?: number | null;
  part_number?: string | null;
}

export interface Attachment {
  url: string;
  name: string;
  type?: "po" | "finance" | "bast" | "invoice";
}

export interface Discussion {
  user_id: string;
  user_name: string;
  message: string;
  timestamp: string;
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
  repeated_from_po_id?: number | null;
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

export interface Vendor {
  id: number;
  created_at: string;
  kode_vendor: string;
  nama_vendor: string;
  pic_contact_person: string | null;
  alamat: string | null;
  email: string | null;
}

export interface StoredVendorDetails {
  vendor_id: number;
  kode_vendor: string;
  nama_vendor: string;
  alamat: string;
  contact_person: string;
  email: string;
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
    | "Pending BAST"
    | "Completed"
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
  | "info";
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
