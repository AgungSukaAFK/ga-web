"use client";

// Kotak search halaman list. Placeholder dibuat pendek; daftar lengkap yang
// bisa dicari ada di ikon bantuan supaya tidak terpotong di layar sempit.

import { CircleHelp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ListSearchInput({
  value,
  onChange,
  placeholder,
  searchableFields,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchableFields: readonly string[];
}) {
  return (
    <div className="relative flex-grow">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="pl-10 pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Lihat yang bisa dicari"
            className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <p className="font-medium">Bisa dicari berdasarkan</p>
          <ul className="mt-2 grid list-inside list-disc grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
            {searchableFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Cukup ketik sebagian kata, huruf besar atau kecil sama saja.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
