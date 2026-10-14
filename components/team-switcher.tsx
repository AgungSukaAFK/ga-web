"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { WebApp } from "@/lib/constants/web-apps";

// Tampilan disamakan dengan module switcher di web GOA
// (components/shell/module-switcher.tsx di repo GOA).
export function TeamSwitcher({
  apps,
  roleLabel,
}: {
  apps: WebApp[];
  /** Role user di web ini; web GOA tidak menampilkan role dari sini. */
  roleLabel?: string;
}) {
  const { isMobile } = useSidebar();
  const activeApp = apps.find((app) => app.current);

  if (apps.length === 0) return null;

  const roleOf = (app: WebApp) => (app.current ? roleLabel : undefined);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {activeApp ? (
                  <activeApp.icon className="size-4" />
                ) : (
                  <ChevronsUpDown className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeApp?.name ?? "Pilih modul"}
                </span>
                <span className="truncate text-xs">
                  {activeApp
                    ? [activeApp.description, roleOf(activeApp)]
                        .filter(Boolean)
                        .join(" · ")
                    : apps.map((app) => app.name).join(", ")}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Modul
            </DropdownMenuLabel>
            {apps.map((app, index) => {
              const role = roleOf(app);
              return (
                <DropdownMenuItem key={app.id} asChild className="gap-2 p-2">
                  <a href={app.url}>
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <app.icon className="size-3.5 shrink-0" />
                    </div>
                    <div className="grid flex-1 leading-tight">
                      <span className="truncate">{app.name}</span>
                      {role && (
                        <span className="truncate text-xs text-muted-foreground">
                          {role}
                        </span>
                      )}
                    </div>
                    {app.current ? (
                      <Check className="ml-auto size-4" />
                    ) : (
                      <DropdownMenuShortcut>{index + 1}</DropdownMenuShortcut>
                    )}
                  </a>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
