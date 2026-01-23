// components/app-sidebar.tsx

"use client";

import * as React from "react";
import { redirect, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
// Tambahkan import Bell
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
  Bell, // <-- Import Icon Bell
} from "lucide-react";
import Image from "next/image";

// ... (data constant tetap sama) ...
const data = {
  // ... data navMain, teams, dll tetap sama
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
  // State untuk jumlah notifikasi
  const [unreadCount, setUnreadCount] = React.useState(0);

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

        // --- FETCH NOTIFIKASI AWAL ---
        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.user.id)
          .eq("is_read", false);
        setUnreadCount(count || 0);

        // --- REALTIME LISTENER ---
        const channel = supabase
          .channel("sidebar-notif-count")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${data.user.id}`,
            },
            () => {
              // Jika ada notif baru masuk, tambah counter
              setUnreadCount((prev) => prev + 1);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };
    getUser();
  }, [supabase]);

  const markActive = React.useCallback(
    (items: any[]) =>
      items.map((item) => ({
        ...item,
        isActive:
          currentPath === item.url ||
          (item.url !== "/dashboard" && currentPath.startsWith(item.url)),
      })),
    [currentPath]
  );

  const mainNavItems = React.useMemo(() => {
    const baseNav = [...data.navMain];

    // --- SISIPKAN MENU NOTIFIKASI ---
    // Kita taruh di urutan kedua (setelah Dashboard) atau paling atas
    baseNav.splice(1, 0, {
      title: `Notifikasi ${unreadCount > 0 ? `(${unreadCount})` : ""}`,
      url: "/notifications",
      icon: Bell,
      // Tambahkan highlight visual jika ada notif (opsional, tergantung komponen NavMain support badge atau tidak)
    });

    // ... (Logika role existing tetap sama) ...

    // 1. Fitur Request Barang Baru (Requester)
    const barangIndex = baseNav.findIndex((item) => item.title === "Barang");
    if (barangIndex !== -1) {
      baseNav.splice(barangIndex + 1, 0, {
        title: "Request Barang Baru",
        url: "/request-new-item",
        icon: PackagePlus,
      });
    }

    // 2. Fitur Incoming Requests (Purchasing/Admin)
    if (profile?.department === "Purchasing" || profile?.role === "admin") {
      const reqIndex = baseNav.findIndex(
        (item) => item.title === "Request Barang Baru"
      );
      baseNav.splice(reqIndex + 1, 0, {
        title: "Permintaan Barang",
        url: "/item-requests",
        icon: ArchiveRestore,
      });
    }

    // 3. Fitur Approval (Approver)
    if (profile?.role === "approver") {
      baseNav.splice(1, 0, {
        title: "Approval & Validation",
        url: "/approval-validation",
        icon: CheckCheck,
      });
    }

    // 4. Fitur Cost Center (GA / GM)
    if (
      profile?.department === "General Manager" ||
      profile?.department === "General Affair"
    ) {
      baseNav.splice(1, 0, {
        title: "Cost Center Management",
        url: "/cost-center-management",
        icon: BadgeDollarSign,
      });
    }

    // 5. Fitur MR Management (Purchasing & GA)
    if (
      profile?.role !== "admin" &&
      (profile?.department === "Purchasing" ||
        profile?.department === "General Affair")
    ) {
      baseNav.push({
        title: "MR Management",
        url: "/mr-management",
        icon: FileSearch2,
      });
    }

    return markActive(baseNav);
  }, [profile, markActive, unreadCount]); // Tambahkan unreadCount ke dependency

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
