"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";

import {
  SidebarGroup,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/**
 * Kotak pencarian menu di sidebar. Saat sidebar diciutkan (mode ikon),
 * tampil sebagai tombol ikon yang membuka sidebar & langsung fokus ke input.
 */
export function SidebarSearch({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** Enter -> buka hasil teratas. */
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setOpen } = useSidebar();

  return (
    <SidebarGroup className="py-0">
      <div className="relative group-data-[collapsible=icon]:hidden">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <SidebarInput
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            } else if (e.key === "Escape" && query) {
              e.preventDefault();
              onQueryChange("");
            }
          }}
          placeholder="Cari menu..."
          aria-label="Cari menu"
          className="pl-8 pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Hapus pencarian"
            title="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={query ? `Cari menu: "${query}"` : "Cari menu"}
            isActive={!!query}
            onClick={() => {
              setOpen(true);
              // Tunggu animasi buka sidebar agar input sudah terlihat.
              window.setTimeout(() => inputRef.current?.focus(), 220);
            }}
          >
            <Search />
            <span>Cari menu</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
