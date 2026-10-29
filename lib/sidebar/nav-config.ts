/**
 * lib/sidebar/nav-config.ts
 *
 * Daftar menu sidebar per hak akses - satu sumber untuk AppSidebar dan
 * global search di top bar (components/topbar/topbar-search.tsx), supaya
 * hasil "Menu" di search selalu sama dengan menu yang memang boleh dibuka
 * user. Badge & status aktif ditambahkan oleh AppSidebar.
 */

import {
  ArchiveRestore,
  BadgeDollarSign,
  BaggageClaim,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  CheckCheck,
  ClipboardList,
  FileBox,
  FileSearch2,
  FileStack,
  FileText,
  HardDrive,
  Headset,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageSquareShare,
  MessagesSquare,
  PackagePlus,
  PackageSearch,
  PiggyBank,
  ShieldAlert,
  Warehouse,
  Workflow,
} from "lucide-react";
import {
  canManageMrTemplate,
  canMonitorPettyCash,
  isGADepartment,
  isITAdmin,
} from "@/lib/constants/departments";

export type NavProfile =
  | { role?: string | null; department?: string | null }
  | null
  | undefined;

export type NavItem = { title: string; url: string; icon: LucideIcon };

export type NavGroup = { label: string; items: NavItem[]; hideable: boolean };

const NAV_ADMIN: NavItem[] = [
  { title: "User Management", url: "/user-management", icon: Bot },
  { title: "MR Management", url: "/mr-management", icon: FileSearch2 },
  { title: "PO Management", url: "/po-management", icon: PackageSearch },
  {
    title: "Cost Center Management",
    url: "/cost-center-management",
    icon: BadgeDollarSign,
  },
  { title: "File Management", url: "/file-management", icon: HardDrive },
  {
    title: "Kode Global Terima Barang",
    url: "/goods-receipt-settings",
    icon: KeyRound,
  },
];

const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Material Request", url: "/material-request", icon: FileBox },
  { title: "Purchase Order", url: "/purchase-order", icon: BaggageClaim },
  { title: "Barang", url: "/barang", icon: Boxes },
  { title: "Vendor", url: "/vendor", icon: Briefcase },
];

const NAV_SECONDARY: NavItem[] = [
  { title: "Dokumentasi", url: "/dokumentasi", icon: BookOpen },
  { title: "Update Web", url: "/update-web", icon: Megaphone },
  { title: "Chat Admin", url: "/chat-admin", icon: Headset },
  { title: "Feedback", url: "/feedback", icon: MessageSquareShare },
  { title: "Tentang App", url: "/tentang-app", icon: Info },
];

function buildMainItems(profile: NavProfile): NavItem[] {
  const baseNav: NavItem[] = [...NAV_MAIN];

  baseNav.splice(1, 0, {
    title: "Notifikasi",
    url: "/notifications",
    icon: Bell,
  });

  const barangIndex = baseNav.findIndex((item) => item.title === "Barang");
  if (barangIndex !== -1) {
    baseNav.splice(barangIndex + 1, 0, {
      title: "Request Barang Baru",
      url: "/request-new-item",
      icon: PackagePlus,
    });
  }

  if (profile?.department === "Purchasing" || profile?.role === "admin") {
    const reqIndex = baseNav.findIndex(
      (item) => item.title === "Request Barang Baru",
    );
    baseNav.splice(reqIndex + 1, 0, {
      title: "Permintaan Barang",
      url: "/item-requests",
      icon: ArchiveRestore,
    });
  }

  // Semua admin (bukan cuma admin IT) - admin bisa dipasang sebagai approver
  // di Template Approval, jadi butuh akses ke antrean approval-nya.
  if (profile?.role === "approver" || profile?.role === "admin") {
    baseNav.splice(1, 0, {
      title: "Approval & Validation",
      url: "/approval-validation",
      icon: CheckCheck,
    });
  }

  // Template Approval (MR/PO): khusus GA/Admin - selalu ditaruh tepat di
  // atas "Approval & Validation" (kalau menu itu ada di sidebar user ini).
  if (isGADepartment(profile?.department) || profile?.role === "admin") {
    const approvalIdx = baseNav.findIndex(
      (item) => item.title === "Approval & Validation",
    );
    baseNav.splice(approvalIdx !== -1 ? approvalIdx : 1, 0, {
      title: "Template Approval",
      url: "/approval-validation/templates",
      icon: Workflow,
    });
  }

  // Template MR: GA level approver / Admin - tepat di bawah "Template
  // Approval".
  if (canManageMrTemplate(profile)) {
    const templateIdx = baseNav.findIndex(
      (item) => item.title === "Template Approval",
    );
    baseNav.splice(templateIdx !== -1 ? templateIdx + 1 : 1, 0, {
      title: "Template MR",
      url: "/mr-template",
      icon: FileStack,
    });
  }

  if (profile?.role === "requester" || isITAdmin(profile)) {
    const mrIndex = baseNav.findIndex(
      (item) => item.title === "Material Request",
    );
    baseNav.splice(mrIndex + 1, 0, {
      title: "MR Saya",
      url: "/mr-saya",
      icon: ClipboardList,
    });
  }

  if (
    profile?.department === "General Manager" ||
    isGADepartment(profile?.department)
  ) {
    baseNav.splice(1, 0, {
      title: "Cost Center Management",
      url: "/cost-center-management",
      icon: BadgeDollarSign,
    });
  }

  // Stok GA: hanya GA & Admin
  if (isGADepartment(profile?.department) || profile?.role === "admin") {
    const barangIdx = baseNav.findIndex((item) => item.title === "Barang");
    const insertAt = barangIdx !== -1 ? barangIdx + 1 : baseNav.length;
    baseNav.splice(insertAt, 0, {
      title: "Stok GA",
      url: "/stok-ga",
      icon: Warehouse,
    });
  }

  return baseNav;
}

// MENU PETTY CASH (revisi "Rombak Petty Cash") - disederhanakan jadi 8
// item saja, tiap item disaring sesuai hak akses: Manajemen Petty Cash =
// admin/GA/Finance (monitoring + Download Excel; aksi ubah data tetap admin
// only, lihat canMonitorPettyCash); Manajemen Budget, Barang Petty Cash, &
// Template Approval = admin/GA; Approval Petty Cash = admin/approver;
// sisanya (Dashboard, Pengajuan Saya, Deklarasi) self-service terbuka utk
// semua.
function buildPettyCashItems(profile: NavProfile): NavItem[] {
  const isAdmin = profile?.role === "admin";
  const isGA = isGADepartment(profile?.department);
  const isApprover = profile?.role === "approver";
  const canManagePc = isAdmin || isGA;
  const canApprovePc = isAdmin || isApprover;

  const pcNav = [
    {
      title: "Dashboard Petty Cash",
      url: "/petty-cash",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      title: "Manajemen Petty Cash",
      url: "/petty-cash/management",
      icon: ShieldAlert,
      visible: canMonitorPettyCash(profile),
    },
    {
      title: "Manajemen Budget",
      url: "/petty-cash/budgeting",
      icon: PiggyBank,
      visible: canManagePc,
    },
    {
      title: "Barang Petty Cash",
      url: "/petty-cash/barang",
      icon: Boxes,
      visible: canManagePc,
    },
    {
      title: "Template Approval",
      url: "/petty-cash/template-approval",
      icon: Workflow,
      visible: canManagePc,
    },
    {
      title: "Approval Petty Cash",
      url: "/petty-cash/approval",
      icon: CheckCheck,
      visible: canApprovePc,
    },
    {
      title: "Pengajuan Saya",
      url: "/petty-cash/pengajuan-saya",
      icon: ClipboardList,
      visible: true,
    },
    {
      // Template barang pribadi tiap user (bukan katalog bersama), dipakai
      // lewat "Pakai Template" di Input Pengajuan.
      title: "Template Pengajuan",
      url: "/petty-cash/template-pengajuan",
      icon: FileStack,
      visible: true,
    },
    {
      title: "Deklarasi",
      url: "/petty-cash/deklarasi",
      icon: FileText,
      visible: true,
    },
  ];

  return pcNav.filter((item) => item.visible).map(({ visible, ...rest }) => rest);
}

function buildAdminItems(profile: NavProfile): NavItem[] {
  if (profile?.role !== "admin") return [];
  const items = [...NAV_ADMIN];
  // Feedback User: khusus admin departemen IT (sama dgn RLS `feedbacks`).
  if (isITAdmin(profile)) {
    items.push({
      title: "Inbox Chat Admin",
      url: "/chat-admin-management",
      icon: Inbox,
    });
    items.push({
      title: "Feedback User",
      url: "/feedback-management",
      icon: MessagesSquare,
    });
  }
  return items;
}

/** Grup menu sidebar (urutan tampil) sesuai hak akses `profile`. */
export function buildNavGroups(profile: NavProfile): NavGroup[] {
  return [
    { label: "Admin", items: buildAdminItems(profile), hideable: true },
    { label: "Menu", items: buildMainItems(profile), hideable: true },
    { label: "Petty Cash", items: buildPettyCashItems(profile), hideable: true },
    { label: "About", items: [...NAV_SECONDARY], hideable: false },
  ];
}
