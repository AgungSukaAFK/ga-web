// src/components/petty-cash/PcStatCard.tsx
//
// Kartu ringkasan klik-able di baris atas Dashboard Petty Cash (lihat
// planning-pc.md Bagian 2.2) - dipakai utk 4 angka utama (Pengajuan Aktif,
// Perlu Tindakan Saya, Menunggu Orang Lain, Tercairkan Bulan Ini) di
// PcDashboardClient.tsx. Selalu klik-able (Link kalau `href` diisi) supaya
// tidak sekadar dekoratif - sesuai prinsip "actionable-first" di rencana.

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PcStatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  accent = "default",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  /** "action" dikasih aksen oranye - dipakai khusus kartu "Perlu Tindakan Saya" supaya paling menonjol. */
  accent?: "default" | "action";
  onClick?: () => void;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
        accent === "action"
          ? "border-orange-300 bg-orange-50/60 hover:bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
          : "hover:bg-accent/40",
        (href || onClick) && "cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4",
            accent === "action"
              ? "text-orange-600 dark:text-orange-400"
              : "text-muted-foreground",
          )}
        />
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full w-full text-left">
        {body}
      </button>
    );
  }
  return body;
}
