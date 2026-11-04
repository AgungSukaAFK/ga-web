// src/components/table-pagination-footer.tsx

"use client";

import * as React from "react";
import { CustomPagination } from "@/components/custom-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TablePaginationFooterProps {
  currentPage: number;
  totalItems: number;
  limit: number;
  limitOptions: readonly number[];
  itemLabel: string; // Contoh: "MR", "PO"
  onPageChange: (page: number) => void;
  onLimitChange: (limit: string) => void;
  className?: string;
}

function JumpToPage({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const [value, setValue] = React.useState(String(currentPage));

  // Ikuti halaman aktif saat pindah lewat tombol pagination / back browser
  React.useEffect(() => {
    setValue(String(currentPage));
  }, [currentPage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;

    // Angka di luar rentang dibawa ke halaman terdekat yang valid
    const target = Math.min(Math.max(Number(value), 1), totalPages);
    setValue(String(target));
    if (target !== currentPage) onPageChange(target);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"
    >
      <label htmlFor="jump-to-page">Hal.</label>
      <Input
        id="jump-to-page"
        type="text"
        inputMode="numeric"
        enterKeyHint="go"
        autoComplete="off"
        aria-label={`Lompat ke halaman, 1 sampai ${totalPages}`}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          if (!value) setValue(String(currentPage));
        }}
        className="h-8 w-14 px-2 text-center tabular-nums"
      />
      <span className="tabular-nums">
        / {totalPages.toLocaleString("id-ID")}
      </span>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={!value || Number(value) === currentPage}
      >
        Buka
      </Button>
    </form>
  );
}

export function TablePaginationFooter({
  currentPage,
  totalItems,
  limit,
  limitOptions,
  itemLabel,
  onPageChange,
  onLimitChange,
  className,
}: TablePaginationFooterProps) {
  const totalPages = Math.ceil(totalItems / limit);
  const rangeStart = (currentPage - 1) * limit + 1;
  const rangeEnd = Math.min(currentPage * limit, totalItems);
  const hasRows = rangeStart <= totalItems;

  return (
    // flex-wrap memindahkan grup utuh ke baris baru saat tempat kurang, jadi
    // teksnya tidak terjepit walau lebar konten berubah karena sidebar
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-4 whitespace-nowrap text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Baris</span>
          <Select value={String(limit)} onValueChange={onLimitChange}>
            <SelectTrigger
              aria-label="Jumlah baris per halaman"
              className="h-8 w-[88px] bg-background"
            >
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular-nums">
          {hasRows
            ? `${rangeStart.toLocaleString("id-ID")}–${rangeEnd.toLocaleString("id-ID")}`
            : "0"}{" "}
          dari {totalItems.toLocaleString("id-ID")} {itemLabel}
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <CustomPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            hidePagesOnMobile
            className="mx-0 w-auto"
          />
          <JumpToPage
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
