// src/components/petty-cash/PcPrintMenu.tsx
//
// Tombol "Cetak" dokumen Petty Cash dengan 2 pilihan - kolom tanda tangan
// berisi QR verifikasi, atau kolom kosong utk tanda tangan basah (lihat
// prop signatureMode di PrintablePettyCashDocument).

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, PenLine, Printer, QrCode } from "lucide-react";

export type PcPrintMode = "qr" | "wet";

export function PcPrintMenu({
  onPrint,
}: {
  onPrint: (mode: PcPrintMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Printer className="h-4 w-4 mr-1" /> Cetak
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onPrint("qr")}>
          <QrCode className="h-4 w-4 mr-2" />
          <div>
            <p className="font-medium">Cetak dengan QR</p>
            <p className="text-xs text-muted-foreground">
              Tanda tangan diganti QR verifikasi digital
            </p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPrint("wet")}>
          <PenLine className="h-4 w-4 mr-2" />
          <div>
            <p className="font-medium">Cetak tanpa QR</p>
            <p className="text-xs text-muted-foreground">
              Sediakan ruang untuk tanda tangan basah
            </p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
