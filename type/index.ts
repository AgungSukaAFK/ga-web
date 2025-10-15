// --- Tipe Data ---
export interface PurchaseOrderListItem {
  id: number;
  kode_po: string;
  status: string;
  total_price: number;
  created_at: string;
  users_with_profiles: { nama: string } | null;
  material_requests: { kode_mr: string } | null;
}

export interface ApprovedMaterialRequest {
  id: number;
  kode_mr: string;
  remarks: string;
  department: string;
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
  status: "Draft" | "Ordered";
  vendor_details?: {
    name: string;
    address?: string;
    contact_person?: string;
  };
  items: POItem[];
  currency: string;
  discount: number;
  tax: number;
  postage: number;
  total_price: number;
  payment_term: string;
  shipping_address: string;
  notes: string;
  attachments?: any[];
  repeated_from_po_id?: number | null;
}

// Tipe Data BARU untuk hasil pencarian barang
export interface Barang {
  id: number;
  part_number: string;
  part_name: string;
  uom: string;
}

export interface MaterialRequestForPO {
  id: number;
  kode_mr: string;
  orders: { name: string; qty: string; uom: string }[];
}

export interface PurchaseOrderDetail
  extends Omit<PurchaseOrderPayload, "mr_id" | "user_id"> {
  id: number;
  created_at: string;
  updated_at: string;
  mr_id: number | null;
  material_requests: { kode_mr: string } | null;
  users_with_profiles: { nama: string } | null;
}

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
  discussions: {}[];
}

export interface Approval {
  type: string;
  status: string;
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
}

export type User = {
  id: string;
  nama: string;
  email: string;
  role: string;
  department: string;
};

export interface Discussion {
  user_id: string;
  user_name: string;
  message: string;
  timestamp: string;
}
