// src/components/petty-cash/PcPrintMenu.tsx
//
// Tombol "Cetak" dokumen Petty Cash dengan 2 pilihan - kolom tanda tangan
// berisi QR verifikasi, atau kolom kosong utk tanda tangan basah (lihat
// prop signatureMode di PrintablePettyCashDocument).
//
// PcDownloadMenu = versi yang bisa dipasang di LUAR halaman detail (baris
// tabel, modal rantai dokumen): membuka halaman detail di tab baru dengan
// `?print=qr|wet`, lalu halaman itu langsung memicu dialog cetak/Save as
// PDF lewat usePcPrintFromQuery - jadi dokumen cetaknya tetap satu sumber
// (PrintablePettyCashDocument di tiap halaman `[id]`), bukan disalin ke
// tiap list.

"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, Download, PenLine, Printer, QrCode } from "lucide-react";

export type PcPrintMode = "qr" | "wet";

const PRINT_OPTIONS: {
  mode: PcPrintMode;
  icon: React.ElementType;
  title: string;
  hint: string;
}[] = [
  {
    mode: "qr",
    icon: QrCode,
    title: "dengan QR",
    hint: "Tanda tangan diganti QR verifikasi digital",
  },
  {
    mode: "wet",
    icon: PenLine,
    title: "tanpa QR",
    hint: "Sediakan ruang untuk tanda tangan basah",
  },
];

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
        {PRINT_OPTIONS.map(({ mode, icon: Icon, title, hint }) => (
          <DropdownMenuItem key={mode} onSelect={() => onPrint(mode)}>
            <Icon className="h-4 w-4 mr-2" />
            <div>
              <p className="font-medium">Cetak {title}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Tombol Download PDF utk dokumen Petty Cash di luar halaman detailnya.
 * `href` = halaman detail dokumen (mis. `/petty-cash/voucher/12`).
 * `iconOnly` utk kolom Aksi tabel yang sempit.
 */
export function PcDownloadMenu({
  href,
  iconOnly = false,
  className,
}: {
  href: string;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={iconOnly ? "icon" : "sm"}
          className={cn(iconOnly && "h-8 w-8", className)}
          title="Download PDF"
          aria-label="Download PDF"
        >
          <Download className="h-4 w-4" />
          {!iconOnly && (
            <>
              Download
              <ChevronDown className="opacity-60" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Download PDF (dibuka di tab baru)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRINT_OPTIONS.map(({ mode, icon: Icon, title, hint }) => (
          <DropdownMenuItem key={mode} asChild>
            <a
              href={`${href}?print=${mode}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon className="h-4 w-4 mr-2" />
              <div>
                <p className="font-medium">PDF {title}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pasangan PcDownloadMenu di halaman detail `[id]`: kalau dibuka dengan
 * `?print=qr|wet`, panggil `onPrint` sekali begitu dokumennya `ready`.
 * Param dibuang dari URL dulu supaya refresh tidak memicu cetak lagi.
 */
export function usePcPrintFromQuery(
  ready: boolean,
  onPrint: (mode: PcPrintMode) => void,
) {
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!ready || handledRef.current) return;
    const mode = searchParams.get("print");
    if (mode !== "qr" && mode !== "wet") return;
    handledRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    onPrint(mode);
  }, [ready, searchParams]);
}
