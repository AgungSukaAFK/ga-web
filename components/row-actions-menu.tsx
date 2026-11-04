"use client";

// Kolom Aksi tabel list: selalu tombol titik tiga + dropdown, walau aksinya
// cuma satu, supaya tampilannya sama di semua tabel. Isi menu lewat `children`
// (DropdownMenuItem).

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu({ children }: { children: React.ReactNode }) {
  return (
    // modal={false}: aksi bisa membuka dialog; mode modal menyisakan
    // pointer-events: none di body saat menu tertutup bersamaan.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Buka menu aksi</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
