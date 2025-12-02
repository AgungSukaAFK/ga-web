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

  const markActive = React.useCallback(
    (items: typeof data.navMain) =>
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
    // Jika bukan admin (admin sudah punya di navAdmin), tapi Purchasing/GA
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
