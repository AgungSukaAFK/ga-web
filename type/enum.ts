// type/enum.ts

export const LIMIT_OPTIONS = [10, 25, 50, 100, 1000, 10000];

export const STATUS_OPTIONS = [
  "Pending Validation",
  "Pending Approval",
  "Pending BAST",
  "Waiting PO",
  "Completed",
  "Rejected",
];

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
  CANCELLED: "Cancelled",
  REPLACED: "Replaced",
} as const;

export const MR_ITEM_STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Processing: "Proses PO",
  "PO Created": "Sudah PO",
  Cancelled: "Dibatalkan",
  Replaced: "Diganti",
};

export const MR_ITEM_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-800 border-gray-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  "PO Created": "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
  Replaced: "bg-yellow-50 text-yellow-700 border-yellow-200",
};
