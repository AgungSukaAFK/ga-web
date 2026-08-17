// src/type/file-management.ts
// Type untuk halaman admin /file-management (cleanup Supabase Storage).

export type StorageBucketSource = "legacy" | "vps";

export type AttachmentDocType =
  | "material_request"
  | "material_request_bast"
  | "purchase_order"
  | "petty_cash"
  | "petty_cash_settlement"
  | "orphan";

export interface AttachmentEntry {
  // Key unik gabungan bucket+path, dipakai sebagai row id di UI.
  id: string;
  source: AttachmentDocType;
  bucket: StorageBucketSource;
  path: string;
  url: string;
  viewUrl: string;
  fileName: string;
  size: number | null;
  missing: boolean;
  uploadedAt: string | null;
  documentId: string | number | null;
  documentCode: string | null;
  documentHref: string | null;
}

export interface AttachmentFilters {
  page: number;
  limit: number;
  search: string;
  docType: AttachmentDocType | "all";
  bucket: StorageBucketSource | "all";
  startDate: string;
  endDate: string;
  sortBy: "date" | "size" | "name";
  sortDir: "asc" | "desc";
}

export interface AttachmentQueryResult {
  rows: AttachmentEntry[];
  total: number;
  stats: {
    legacyBucketTotalBytes: number;
    legacyBucketTotalCount: number;
    vpsBucketTotalBytes: number;
    vpsBucketTotalCount: number;
    orphanTotalBytes: number;
    orphanTotalCount: number;
  };
}

export interface DeleteRequestItem {
  id: string;
  source: AttachmentDocType;
  bucket: StorageBucketSource;
  path: string;
  url: string;
  documentId: string | number | null;
}

export interface DeleteResultItem {
  id: string;
  success: boolean;
  message?: string;
}
