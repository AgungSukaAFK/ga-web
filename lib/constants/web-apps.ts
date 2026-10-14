// lib/constants/web-apps.ts

import type { LucideIcon } from "lucide-react";
import { FileBox, ListChecks, Package, Truck } from "lucide-react";

export type WebApp = {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: LucideIcon;
  /** True untuk web yang sedang dibuka (web GA ini). */
  current?: boolean;
};

/** Base URL web GOA (Asset, Fleet, GOA). */
export const GOA_URL = (
  process.env.NEXT_PUBLIC_GOA_URL || "https://goa.lourdes.cloud"
).replace(/\/$/, "");

/**
 * Daftar web di Team Switcher sidebar (khusus akun departemen GA). Urutan &
 * tampilannya disamakan dengan module switcher di web GOA.
 */
export const WEB_APPS: WebApp[] = [
  {
    id: "ga-web",
    name: "GA Web",
    description: "Material Request & PO",
    url: "/dashboard",
    icon: FileBox,
    current: true,
  },
  {
    id: "asset",
    name: "Asset",
    description: "Aset, peminjaman & mutasi",
    url: `${GOA_URL}/asset`,
    icon: Package,
  },
  {
    id: "fleet",
    name: "Fleet",
    description: "Armada, booking & P2H",
    url: `${GOA_URL}/fleet`,
    icon: Truck,
  },
  {
    id: "goa",
    name: "GOA",
    description: "Tugas & KPI tim GA",
    url: `${GOA_URL}/goa`,
    icon: ListChecks,
  },
];

/** Label role user di web ini, tampil di samping nama "GA Web". */
export const WEB_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  approver: "Approver",
  requester: "Requester",
};
