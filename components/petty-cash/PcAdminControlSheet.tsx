// src/components/petty-cash/PcAdminControlSheet.tsx
//
// Tombol "Kontrol Admin" di header halaman detail dokumen Petty Cash
// (`[id]/page.tsx`) yang membuka drawer berisi panel admin
// (PcAdminOverridePanel / PcAdminSubVoucherPanel) - SENGAJA tidak lagi
// tampil inline di bawah dokumen supaya tidak mengganggu tampilan dokumen
// sehari-hari. Pemanggil tetap yang menjaga `isAdmin` sebelum me-render
// komponen ini (proteksi UI saja, proteksi sebenarnya di RLS/RPC).

"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShieldAlert } from "lucide-react";

export function PcAdminControlSheet({
  kode,
  children,
}: {
  kode: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
        >
          <ShieldAlert /> Kontrol Admin
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-10 sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-4 w-4" /> Kontrol Admin
          </SheetTitle>
          <SheetDescription className="[overflow-wrap:anywhere]">
            {kode} - hanya terlihat oleh admin. Perubahan di sini langsung
            berlaku ke dokumen.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:px-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
