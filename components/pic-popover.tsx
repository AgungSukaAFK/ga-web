"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Loader2, UserRound } from "lucide-react";

/** Akun seed demo (lihat supabase/scripts/seed-demo-users.mjs) - bukan PIC
 * sungguhan, jadi tidak ditampilkan di daftar. */
const isDemoAccount = (email: string | null) =>
  !!email && email.toLowerCase().endsWith("@demo.com");

interface PicPopoverProps {
  label: string;
  title: string;
  emptyMessage: string;
  departments: readonly string[];
  /** Kalau diisi, daftar dibatasi ke company ini (dan LOURDES). Kalau
   * dikosongkan, tidak ada filter company sama sekali (dipakai buat GA yang
   * validasi lintas company). */
  companyScope?: string[];
}

interface PicUser {
  id: string;
  nama: string | null;
  email: string | null;
  department: string | null;
  company: string | null;
}

export function PicPopover({
  label,
  title,
  emptyMessage,
  departments,
  companyScope,
}: PicPopoverProps) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<PicUser[]>([]);

  const handleOpenChange = async (open: boolean) => {
    if (!open || loaded) return;
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("profiles")
      .select("id, nama, email, department, company")
      .in("department", departments)
      .eq("role", "approver")
      .eq("is_active", true);

    if (companyScope) query = query.in("company", companyScope);

    const { data } = await query.order("company").order("nama");

    setUsers((data || []).filter((u) => !isDemoAccount(u.email)));
    setLoaded(true);
    setLoading(false);
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={(e) => e.stopPropagation()}
        >
          <UserRound className="h-3 w-3" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold">{title}</p>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{u.nama || "Tanpa nama"}</p>
                  {u.company && (
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 text-[10px]"
                    >
                      {u.company}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{u.email}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
