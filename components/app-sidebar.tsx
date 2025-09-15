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

const data = {
  navMain: [
    { title: "Dashboard", url: "/dashboard" },
    { title: "Material Request", url: "/material-request" },
    { title: "Purchase Order", url: "/purchase-order" },
    { title: "Barang", url: "/barang" },
  ],
  navSecondary: [
    { title: "Dokumentasi", url: "/dokumentasi" },
    { title: "Feedback", url: "/feedback" },
    { title: "Tentang App", url: "/tentang-app" },
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
      if (!error) setUser(data.user);
      if (!data.user) redirect("auth/login");
      const profileRes = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileRes.data) setProfile(profileRes.data);
    };
    getUser();
  }, [supabase]);

  const markActive = (items: typeof data.navMain) =>
    items.map((item) => ({
      ...item,
      isActive: currentPath === item.url,
    }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div>
          <img src="lourdes.png" alt="lourdes.png" className="drop-shadow-md" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={markActive(data.navMain)} />
        <NavMain label="About" items={markActive(data.navSecondary)} />
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: `https://ui-avatars.com/api/?name=${user.email}`,
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
