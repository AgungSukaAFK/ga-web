// src/components/petty-cash/PcCoaCombobox.tsx
//
// Input COA satu company (GMI atau GIS) di form Barang Petty Cash - pilih
// dari daftar COA yang sudah ada ATAU ketik COA baru (Combobox biasa,
// components/combobox.tsx, tidak bisa input bebas - padahal daftar COA GIS
// belum baku). Nilai kosong = barang nonaktif di company tsb, lihat
// PettyCashBarang.coa_gmi/coa_gis di type/index.ts.

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface PcCoaComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}

export function PcCoaCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Pilih atau ketik COA...",
  disabled = false,
}: PcCoaComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const typed = search.trim();
  const canCreate =
    !!typed && !options.some((o) => o.toLowerCase() === typed.toLowerCase());

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0"
      >
        <Command>
          <CommandInput
            placeholder="Cari atau ketik COA baru..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!canCreate && (
              <CommandEmpty>Belum ada COA - ketik untuk menambah.</CommandEmpty>
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  forceMount
                  value={`__create__${typed}`}
                  onSelect={() => select(typed)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Pakai &quot;{typed}&quot;
                </CommandItem>
              </CommandGroup>
            )}
            {options.length > 0 && (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => select(opt)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {value && (
              <CommandGroup>
                <CommandItem
                  forceMount
                  value="__clear__"
                  onSelect={() => select("")}
                  className="text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Kosongkan (nonaktif)
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
