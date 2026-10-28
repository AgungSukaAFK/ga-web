// src/components/petty-cash/PcPenggunaBudgetField.tsx
//
// Field "Pengguna Budget" di Input Pengajuan - checkbox "saya sendiri"
// (default), kalau dicentang-lepas requester wajib mencari user lain yang
// memakai dana ini. Pengguna Budget TIDAK ikut approval, cuma tercantum
// namanya (lihat komentar pengguna_budget_* di PettyCashPengajuan,
// type/index.ts). Pencarian pakai searchUsersForMention (services/
// userService.ts) - sama dengan tag @ di diskusi, bisa dipakai semua role.

"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { UserAvatar } from "@/components/user-avatar";
import { searchUsersForMention } from "@/services/userService";
import { User } from "@/type";

export interface PcPenggunaBudget {
  id: string;
  nama: string;
  department: string | null;
}

interface PcPenggunaBudgetFieldProps {
  isSelf: boolean;
  onIsSelfChange: (isSelf: boolean) => void;
  selected: PcPenggunaBudget | null;
  onSelect: (user: PcPenggunaBudget) => void;
  // User yang sedang login - tidak ditampilkan di hasil pencarian (sudah
  // diwakili checkbox "saya sendiri").
  selfId?: string | null;
}

export function PcPenggunaBudgetField({
  isSelf,
  onIsSelfChange,
  selected,
  onSelect,
  selfId,
}: PcPenggunaBudgetFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<User[]>([]);

  React.useEffect(() => {
    if (isSelf) return;
    const handler = setTimeout(() => {
      searchUsersForMention(searchQuery).then(setResults);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, isSelf]);

  return (
    <div className="flex flex-col gap-2">
      <Label>
        Pengguna Budget <span className="text-red-500">*</span>
      </Label>
      <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
        <Checkbox
          checked={isSelf}
          onCheckedChange={(checked) => onIsSelfChange(checked === true)}
        />
        Saya sendiri yang menggunakan budget ini
      </label>
      {!isSelf && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            >
              {selected ? (
                <span className="flex min-w-0 items-center gap-2">
                  {/* profileCard off - avatar-nya <button>, tidak boleh
                      bersarang di dalam tombol trigger ini. */}
                  <UserAvatar
                    userId={selected.id}
                    name={selected.nama}
                    className="h-5 w-5"
                    fallbackClassName="text-[9px]"
                    profileCard={false}
                  />
                  <span className="truncate">
                    {selected.nama}
                    {selected.department && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({selected.department})
                      </span>
                    )}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Cari user pengguna budget...
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Ketik nama atau email..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>User tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  {results
                    .filter((u) => u.id !== selfId)
                    .map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => {
                          onSelect({
                            id: user.id,
                            nama: user.nama || user.email || "User",
                            department: user.department || null,
                          });
                          setOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <UserAvatar
                          userId={user.id}
                          name={user.nama}
                          className="h-7 w-7"
                          fallbackClassName="text-[10px]"
                          profileCard={false}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {user.nama || user.email}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[user.department, user.email]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      <p className="text-xs text-muted-foreground">
        {isSelf
          ? "Hilangkan centang jika dana ini dipakai orang lain."
          : "Pengguna budget hanya tercantum namanya di dokumen & hasil cetak - tidak ikut approval."}
      </p>
    </div>
  );
}
