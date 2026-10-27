"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarGroupVisibility } from "@/lib/sidebar/menu-visibility";
import { setPendingNavUrl, usePendingNavUrl } from "@/lib/sidebar/nav-pending";

type NavItem = {
  label?: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  badge?: number;
  items?: {
    title: string;
    url: string;
  }[];
};

export function NavMain({
  items,
  label = "Menu",
  hideable = true,
  searching = false,
}: {
  label?: string;
  items: NavItem[];
  /**
   * Kalau false, tombol "Atur" tidak muncul & semua item selalu tampil -
   * dipakai utk grup "About" yang wajib selalu tampil semua (lihat
   * app-sidebar.tsx).
   */
  hideable?: boolean;
  /**
   * Sedang mode pencarian: `items` sudah disaring & diurutkan oleh
   * app-sidebar.tsx, jadi tampilkan apa adanya (termasuk menu yang
   * disembunyikan lewat "Atur") & sembunyikan tombol "Atur".
   */
  searching?: boolean;
}) {
  const pathname = usePathname();
  const pendingUrl = usePendingNavUrl();
  const { isMobile, setOpenMobile } = useSidebar();
  const { hiddenUrls, toggleUrl } = useSidebarGroupVisibility(label);
  // Popover Radix baru dirender setelah mount: id aria-controls dari useId
  // bisa beda antara SSR & klien (hydration mismatch), jadi sebelum mount
  // cukup tampilkan tombol biasa yang tampilannya sama.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const aturButtonClass =
    "group-data-[collapsible=icon]:hidden mr-1 h-6 shrink-0 px-2 text-[11px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const showAtur = hideable && !searching;
  const visibleItems = showAtur
    ? items.filter((item) => !hiddenUrls.includes(item.url))
    : items;

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        {showAtur && items.length > 0 && !mounted && (
          <Button variant="ghost" size="sm" className={aturButtonClass}>
            Atur
          </Button>
        )}
        {showAtur && items.length > 0 && mounted && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={aturButtonClass}
              >
                Atur
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="mb-2 space-y-1">
                <p className="text-sm font-medium leading-none">
                  Atur menu {label}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pilih menu yang ingin ditampilkan. Pengaturan ini hanya
                  tersimpan di perangkat ini.
                </p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const hidden = hiddenUrls.includes(item.url);
                  return (
                    <label
                      key={item.url}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={!hidden}
                        onCheckedChange={(checked) =>
                          toggleUrl(item.url, checked !== true)
                        }
                      />
                      {item.icon && (
                        <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="grow truncate">{item.title}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <SidebarMenu>
        {visibleItems.map((item) => {
          const isPending = pendingUrl === item.url;
          // Selama ada navigasi berjalan, highlight pindah ke menu yang
          // diklik supaya terasa responsif.
          const isActive = pendingUrl ? isPending : item.isActive;
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <Link
                  href={item.url}
                  aria-busy={isPending || undefined}
                  onClick={(e) => {
                    // Buka di tab baru / klik tengah: tidak ada navigasi di
                    // tab ini, jadi jangan tampilkan loading.
                    if (
                      e.defaultPrevented ||
                      e.button !== 0 ||
                      e.metaKey ||
                      e.ctrlKey ||
                      e.shiftKey ||
                      e.altKey
                    )
                      return;
                    if (isMobile) setOpenMobile(false);
                    if (item.url !== pathname) setPendingNavUrl(item.url);
                  }}
                  className={cn(
                    "w-full flex gap-4 items-center rounded-md px-3 py-2 transition-colors hover:bg-accent active:scale-[0.98] active:bg-accent",
                    isActive && "bg-primary/5",
                    isPending && "bg-primary/10",
                  )}
                >
                  {item.icon && (
                    <div className="relative shrink-0 h-4 w-4">
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <item.icon className="h-4 w-4" />
                      )}
                      {!!item.badge && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="grow text-left">{item.title}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
