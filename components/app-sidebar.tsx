// src/components/app-sidebar.tsx

"use client";

import * as React from "react";
import { redirect, usePathname, useRouter } from "next/navigation";
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
import { TeamSwitcher } from "@/components/team-switcher";
import { WEB_APPS, WEB_ROLE_LABELS } from "@/lib/constants/web-apps";
import { SidebarSearch } from "@/components/sidebar-search";
import {
  searchMenuItems,
  scoreMenuItem,
  normalizeSearch,
  useSidebarSearch,
} from "@/lib/sidebar/menu-search";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";
import { buildNavGroups } from "@/lib/sidebar/nav-config";
import { AVATAR_UPDATED_EVENT } from "@/lib/avatar";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useUpdateWebBadge } from "@/hooks/use-update-web-badge";
import { useSupportChatBadge } from "@/hooks/use-support-chat-badge";
import { usePcBadge } from "@/hooks/use-pc-badge";
import { GalleryVerticalEnd, SearchX } from "lucide-react";
import Image from "next/image";

const data = {
  teams: [
    {
      name: "Lourdes Autoparts",
      logo: GalleryVerticalEnd,
      plan: "Versi 1.0.0",
    },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { query, setQuery } = useSidebarSearch();

  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);
  // Unread count berasal dari NotificationProvider (satu sumber + realtime).
  const { unreadCount } = useNotification();
  // Badge merah "ada update baru" di menu Update Web - lihat
  // hooks/use-update-web-badge.ts (per akun, hilang setelah dibuka
  // /update-web ATAU postingannya sudah lebih dari 7 hari).
  const { isNew: hasNewUpdateWebPost } = useUpdateWebBadge(user?.id);
  // Badge Chat Admin - lihat hooks/use-support-chat-badge.ts.
  const supportBadge = useSupportChatBadge(user?.id);
  // Badge Petty Cash (antrian approval/Finance & "Perlu Tindakan Anda") -
  // lihat hooks/use-pc-badge.ts utk kenapa di-refresh lewat key ini.
  const pcBadge = usePcBadge(
    user?.id,
    profile,
    `${unreadCount}|${currentPath.startsWith("/petty-cash") ? currentPath : ""}`,
  );

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

  // Daftar menu per hak akses ada di lib/sidebar/nav-config.ts (dipakai
  // juga oleh global search di top bar); di sini tinggal badge & status aktif.
  const baseNavGroups = React.useMemo(() => buildNavGroups(profile), [profile]);

  const navGroups = React.useMemo(() => {
    // Approver PC tidak harus ber-role approver (siapa pun bisa tercantum di
    // Template Approval) - kalau menu Approval-nya tersembunyi, antriannya
    // ikut dihitung di badge Dashboard (panel "Perlu Anda Proses" ada di sana).
    const hasPcApprovalMenu = baseNavGroups.some((g) =>
      g.items.some((item) => item.url === "/petty-cash/approval"),
    );
    const badges: Record<string, number | undefined> = {
      "/notifications": unreadCount,
      "/update-web": hasNewUpdateWebPost ? 1 : undefined,
      "/chat-admin": supportBadge.userUnread || undefined,
      "/chat-admin-management": supportBadge.adminWaiting || undefined,
      "/petty-cash":
        pcBadge.myActions + (hasPcApprovalMenu ? 0 : pcBadge.approvals) ||
        undefined,
      "/petty-cash/approval": pcBadge.approvals || undefined,
    };
    return baseNavGroups.map((g) => ({
      ...g,
      items: markActive(
        g.items.map((item) =>
          item.url in badges ? { ...item, badge: badges[item.url] } : item,
        ),
      ),
    }));
  }, [
    baseNavGroups,
    markActive,
    unreadCount,
    hasNewUpdateWebPost,
    supportBadge.userUnread,
    supportBadge.adminWaiting,
    pcBadge.myActions,
    pcBadge.approvals,
  ]);

  const searching = normalizeSearch(query) !== "";

  // Saat mencari: saring & urutkan tiap grup, grup tanpa hasil disembunyikan.
  const shownGroups = React.useMemo(() => {
    if (!searching) return navGroups.filter((g) => g.items.length > 0);
    return navGroups
      .map((g) => ({ ...g, items: searchMenuItems(g.items, query, g.label) }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, query, searching]);

  const openTopResult = () => {
    if (!searching) return;
    // Hasil paling relevan di antara semua grup.
    let best: { url: string; score: number } | null = null;
    for (const g of navGroups) {
      for (const item of g.items) {
        const score = scoreMenuItem(query, item, g.label);
        if (score > 0 && (!best || score > best.score))
          best = { url: item.url, score };
      }
    }
    if (!best) return;
    if (best.url !== currentPath) setPendingNavUrl(best.url);
    router.push(best.url);
  };

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
        {/* Pindah ke web lain: khusus departemen GA */}
        {isGADepartment(profile?.department) && (
          <TeamSwitcher
            apps={WEB_APPS}
            roleLabel={WEB_ROLE_LABELS[profile?.role]}
          />
        )}
      </SidebarHeader>

      <SidebarSearch
        query={query}
        onQueryChange={setQuery}
        onSubmit={openTopResult}
      />

      <SidebarContent>
        {shownGroups.map((g) => (
          <NavMain
            key={g.label}
            label={g.label}
            items={g.items}
            hideable={g.hideable}
            searching={searching}
          />
        ))}

        {searching && shownGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            <SearchX className="h-6 w-6 opacity-60" />
            <p>
              Tidak ada menu untuk &ldquo;
              <span className="font-medium text-foreground">{query}</span>
              &rdquo;
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Hapus pencarian
            </button>
          </div>
        )}
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
