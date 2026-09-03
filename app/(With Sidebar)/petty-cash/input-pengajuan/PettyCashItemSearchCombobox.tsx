// src/app/(With Sidebar)/petty-cash/input-pengajuan/PettyCashItemSearchCombobox.tsx
//
// Mirip BarangSearchCombobox.tsx (purchase-order/) tapi nyari dari katalog
// petty_cash_barang, bukan barang MR/PO utama.

"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchPettyCashBarang } from "@/services/pettyCashBarangService";
import { PettyCashBarang } from "@/type";
import { formatCurrency } from "@/lib/utils";

interface PettyCashItemSearchComboboxProps {
  onSelect: (barang: PettyCashBarang) => void;
}

export function PettyCashItemSearchCombobox({
  onSelect,
}: PettyCashItemSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<PettyCashBarang[]>([]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      searchPettyCashBarang(searchQuery).then(setResults);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          Cari barang dari katalog Petty Cash...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0">
        <Command>
          <CommandInput
            placeholder="Ketik nama, kode, atau kategori..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              Barang tidak ditemukan di katalog. Coba tambah manual.
            </CommandEmpty>
            <CommandGroup>
              {results.map((barang) => (
                <CommandItem
                  key={barang.id}
                  value={`${barang.part_number || ""} ${barang.part_name}`}
                  onSelect={() => {
                    onSelect(barang);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">
                        {barang.part_name}
                      </span>
                      {barang.last_purchase_price ? (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatCurrency(barang.last_purchase_price)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {barang.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {barang.category}
                        </Badge>
                      )}
                      {barang.uom && <span>{barang.uom}</span>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
