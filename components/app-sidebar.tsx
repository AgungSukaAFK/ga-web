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
import { useNotification } from "@/components/providers/NotificationProvider";
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
  Wallet,
  PlusCircle,
  FileSignature,
  Users,
  Warehouse,
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
    const baseNav: { title: string; url: string; icon: any; badge?: number }[] = [...data.navMain];

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

  // MENU PETTY CASH
  const pettyCashItems = React.useMemo(() => {
    const pcNav = [
      {
        title: "Pengajuan Saya",
        url: "/petty-cash",
        icon: Wallet,
      },
      {
        title: "Buat Pengajuan",
        url: "/petty-cash/buat",
        icon: PlusCircle,
      },
    ];

    if (
      profile?.role === "approver" ||
      profile?.role === "admin" ||
      profile?.department === "Finance" ||
      isGADepartment(profile?.department)
    ) {
      pcNav.push({
        title: "Manajemen PC",
        url: "/petty-cash/management",
        icon: FileSignature,
      });
      pcNav.push({
        title: "Template Approval PC",
        url: "/petty-cash/templates",
        icon: Users,
      });
    }

    return markActive(pcNav);
  }, [profile, markActive]);

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

        {/* MUNCULKAN KEMBALI MENU PETTY CASH */}
        <NavMain label="Petty Cash" items={pettyCashItems} />

        <NavMain label="About" items={markActive(data.navSecondary)} />
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: `https://ui-avatars.com/api/?name=${
                profile?.nama || user.email
              }`,
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
