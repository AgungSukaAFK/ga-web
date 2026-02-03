"use client";

import * as React from "react";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
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
import { searchVendors } from "@/services/vendorService";
import { cn } from "@/lib/utils";
import { Vendor } from "@/type";

interface VendorSearchComboboxProps {
  onSelect: (vendorName: string) => void;
  defaultValue?: string;
}

export function VendorSearchCombobox({
  onSelect,
  defaultValue,
}: VendorSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState(defaultValue || "");

  // Debounce Search Logic
  React.useEffect(() => {
    setLoading(true);
    const handler = setTimeout(() => {
      searchVendors(searchQuery).then((data) => {
        setResults(data);
        setLoading(false);
      });
    }, 300); // Delay 300ms agar tidak spam request saat ngetik cepat

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
          {selectedLabel ? selectedLabel : "Cari Vendor..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          {" "}
          {/* Matikan filter client-side bawaan */}
          <CommandInput
            placeholder="Ketik nama atau kode vendor..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mencari...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>Vendor tidak ditemukan.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.nama_vendor} // Value unik
                    onSelect={() => {
                      const label = `${vendor.nama_vendor} (${vendor.kode_vendor})`;
                      setSelectedLabel(label);
                      onSelect(vendor.nama_vendor); // Kirim nama vendor ke parent
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col w-full">
                      <span className="font-semibold">
                        {vendor.nama_vendor}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {vendor.kode_vendor}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedLabel.includes(vendor.nama_vendor)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
