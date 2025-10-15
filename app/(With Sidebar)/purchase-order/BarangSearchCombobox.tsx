// src/app/(With Sidebar)/purchase-order/BarangSearchCombobox.tsx

"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { searchBarang } from "@/services/purchaseOrderService";
import { Barang } from "@/type";

interface BarangSearchComboboxProps {
  onSelect: (barang: Barang) => void;
}

export function BarangSearchCombobox({ onSelect }: BarangSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<Barang[]>([]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      searchBarang(searchQuery).then(setResults);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          Cari Part Number / Nama Barang...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput
            placeholder="Ketik untuk mencari..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {results.map((barang) => (
                <CommandItem
                  key={barang.id}
                  value={`${barang.part_number} - ${barang.part_name}`}
                  onSelect={() => {
                    onSelect(barang);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{barang.part_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {barang.part_number}
                    </span>
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
