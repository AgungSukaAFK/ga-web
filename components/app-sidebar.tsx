// src/components/app-sidebar.tsx

"use client";

import * as React from "react";
import { redirect, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
import { AVATAR_UPDATED_EVENT } from "@/lib/avatar";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useUpdateWebBadge } from "@/hooks/use-update-web-badge";
import {
  GalleryVerticalEnd,
  Bot,
  LayoutDashboard,
  FileBox,
  BaggageClaim,
  Boxes,
  BookOpen,
  MessageSquareShare,
  Info,
  CheckCheck,
  FileSearch2,
  PackageSearch,
  BadgeDollarSign,
  Briefcase,
  PackagePlus,
  ArchiveRestore,
  Bell,
  PlusCircle,
  FileSignature,
  Users,
  Warehouse,
  HardDrive,
  ClipboardList,
  Workflow,
  KeyRound,
  FileText,
  ShieldAlert,
  PiggyBank,
  Megaphone,
} from "lucide-react";
import Image from "next/image";

const data = {
  teams: [
    {
      name: "Lourdes Autoparts",
      logo: GalleryVerticalEnd,
      plan: "Versi 1.0.0",
    },
  ],
  navAdmin: [
    {
      title: "User Management",
      url: "/user-management",
      icon: Bot,
    },
    {
      title: "MR Management",
      url: "/mr-management",
      icon: FileSearch2,
    },
    {
      title: "PO Management",
      url: "/po-management",
      icon: PackageSearch,
    },
    {
      title: "Cost Center Management",
      url: "/cost-center-management",
      icon: BadgeDollarSign,
    },
    {
      title: "File Management",
      url: "/file-management",
      icon: HardDrive,
    },
    {
      title: "Kode Global Terima Barang",
      url: "/goods-receipt-settings",
      icon: KeyRound,
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Material Request",
      url: "/material-request",
      icon: FileBox,
    },
    {
      title: "Purchase Order",
      url: "/purchase-order",
      icon: BaggageClaim,
    },
    {
      title: "Barang",
      url: "/barang",
      icon: Boxes,
    },
    {
      title: "Vendor",
      url: "/vendor",
      icon: Briefcase,
    },
  ],
  navSecondary: [
    {
      title: "Dokumentasi",
      url: "/dokumentasi",
      icon: BookOpen,
    },
    {
      title: "Update Web",
      url: "/update-web",
      icon: Megaphone,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: MessageSquareShare,
    },
    {
      title: "Tentang App",
      url: "/tentang-app",
      icon: Info,
    },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const supabase = createClient();

  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);
  // Unread count berasal dari NotificationProvider (satu sumber + realtime).
  const { unreadCount } = useNotification();
  // Badge merah "ada update baru" di menu Update Web - lihat
  // hooks/use-update-web-badge.ts (per akun, hilang setelah dibuka
  // /update-web ATAU postingannya sudah lebih dari 7 hari).
  const { isNew: hasNewUpdateWebPost } = useUpdateWebBadge(user?.id);

  React.useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!data.user && !error) {
        redirect("/auth/login");
      }
      if (data.user) {
        setUser(data.user);
        const profileRes = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();
        if (profileRes.data) setProfile(profileRes.data);
      }
    };
    getUser();
  }, [supabase]);

  React.useEffect(() => {
    const onAvatarUpdated = (e: Event) => {
      const url = (e as CustomEvent<string | null>).detail;
      setProfile((prev: any) => (prev ? { ...prev, avatar_url: url } : prev));
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);
    return () =>
      window.removeEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);
  }, []);

  // LOGIKA BARU ANTI-DOUBLE ACTIVE (Longest Match Routing)
  const markActive = React.useCallback(
    (items: any[]): any[] => {
      // 1. Cari path di grup ini yang paling spesifik / paling panjang cocok dengan currentPath
      let bestMatchUrl = "";
      items.forEach((item) => {
        if (
          currentPath === item.url ||
          currentPath.startsWith(item.url + "/")
        ) {
          if (item.url.length > bestMatchUrl.length) {
            bestMatchUrl = item.url;
          }
        }
      });

      // 2. Beri status isActive HANYA pada yang memenangkan bestMatch
      return items.map((item) => ({
        ...item,
        isActive: item.url === bestMatchUrl && bestMatchUrl !== "",
        // Jika punya submenu (nested), berlakukan filter yang sama
        items: item.items ? markActive(item.items) : undefined,
      }));
    },
    [currentPath],
  );

  const mainNavItems = React.useMemo(() => {
    const baseNav: { title: string; url: string; icon: any; badge?: number }[] =
      [...data.navMain];

    baseNav.splice(1, 0, {
      title: "Notifikasi",
      url: "/notifications",
      icon: Bell,
      badge: unreadCount,
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

    if (profile?.role === "approver") {
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

    if (profile?.role === "requester") {
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

    return markActive(baseNav);
  }, [profile, markActive, unreadCount]);

  // MENU PETTY CASH (revisi "Rombak Petty Cash") - disederhanakan jadi 8
  // item saja, tiap item disaring sesuai hak akses: Manajemen Petty Cash =
  // admin only; Manajemen Budget, Barang Petty Cash, & Template Approval =
  // admin/GA; Approval Petty Cash = admin/approver; sisanya (Dashboard,
  // Pengajuan Saya, Deklarasi) self-service terbuka utk semua.
  const pettyCashItems = React.useMemo(() => {
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
        visible: isAdmin,
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
        title: "Deklarasi",
        url: "/petty-cash/deklarasi",
        icon: FileText,
        visible: true,
      },
    ];

    return markActive(
      pcNav.filter((item) => item.visible).map(({ visible, ...rest }) => rest),
    );
  }, [profile, markActive]);

  const navSecondaryItems = React.useMemo(() => {
    const items = data.navSecondary.map((item) =>
      item.url === "/update-web"
        ? { ...item, badge: hasNewUpdateWebPost ? 1 : undefined }
        : item,
    );
    return markActive(items);
  }, [markActive, hasNewUpdateWebPost]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div>
          <Image
            src="/lourdes-logo.webp"
            alt="Lourdes Autoparts"
            width={500}
            height={300}
            style={{ width: "100%", height: "auto" }}
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {profile?.role === "admin" && (
          <NavMain label="Admin" items={markActive(data.navAdmin)} />
        )}

        <NavMain items={mainNavItems} />

        <NavMain label="Petty Cash" items={pettyCashItems} />

        <NavMain label="About" items={navSecondaryItems} hideable={false} />
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: profile?.avatar_url || "",
              email: user.email || "",
              name: profile?.nama || "-",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
