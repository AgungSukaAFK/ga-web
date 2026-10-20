// lib/constants/mr.ts

import { ComboboxData } from "@/components/combobox";

/** Pilihan kategori Material Request (dipakai Buat MR & Template MR). */
export const MR_KATEGORI_OPTIONS: ComboboxData = [
  { label: "New Item", value: "New Item" },
  { label: "Replace Item", value: "Replace Item" },
  { label: "Fix & Repair", value: "Fix & Repair" },
  { label: "Upgrade", value: "Upgrade" },
];

/** Kategori MR yang wajib menyertakan lampiran saat diajukan. */
export const WAJIB_LAMPIRAN_KATEGORI = ["Replace Item", "Fix & Repair", "Upgrade"];
