"use client";

// Tombol "Download Data (Excel)" halaman list: dropdown pilihan Semua data /
// Sesuai filter, masing-masing dengan jumlah dokumennya. Total "Semua data"
// dihitung saat menu dibuka supaya halaman tidak menambah query tiap dimuat.

import { useState } from "react";
import {
  ChevronDown,
  Database,
  Filter,
  Loader2,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ExcelDownloadMode = "all" | "filtered";

export function ExcelDownloadMenu({
  itemLabel,
  filteredCount,
  fetchAllCount,
  onDownload,
  isExporting,
}: {
  itemLabel: string; // Contoh: "PO", "MR"
  filteredCount: number;
  fetchAllCount: () => Promise<number>;
  onDownload: (mode: ExcelDownloadMode) => void;
  isExporting: boolean;
}) {
  const [allCount, setAllCount] = useState<number | "loading" | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    setAllCount("loading");
    fetchAllCount()
      .then(setAllCount)
      .catch(() => setAllCount(null));
  };

  const countText = (count: number) =>
    `(${count.toLocaleString("id-ID")} ${itemLabel})`;

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={isExporting}
          className="w-full md:w-auto"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Newspaper className="mr-2 h-4 w-4" />
          )}
          {isExporting ? "Menyiapkan data..." : "Download Data (Excel)"}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Export ke Excel</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDownload("all")}>
          <Database className="mr-2 h-4 w-4" />
          Semua data
          {allCount === "loading" ? (
            <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
          ) : (
            allCount !== null && ` ${countText(allCount)}`
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={filteredCount === 0}
          onClick={() => onDownload("filtered")}
        >
          <Filter className="mr-2 h-4 w-4" />
          Sesuai filter {countText(filteredCount)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
