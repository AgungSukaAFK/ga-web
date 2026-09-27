// src/components/petty-cash/PcActivityFeed.tsx
//
// Feed "Aktivitas Terbaru" di Dashboard Petty Cash - dirakit murni dari
// timestamp yang sudah ada di rantai dokumen (buildActivityFeed,
// services/pettyCashDashboardService.ts), TANPA query/tabel log terpisah.
// Filter chip cepat per jenis dokumen - lihat planning-pc.md Bagian 2.2.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Receipt, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  PcActivityEvent,
} from "@/services/pettyCashDashboardService";

const typeMeta: Record<
  PcActivityEvent["type"],
  { label: string; icon: typeof FileText }
> = {
  pengajuan: { label: "Pengajuan", icon: FileText },
  voucher: { label: "Voucher", icon: Receipt },
  tarikan: { label: "Tarikan Dana", icon: Wallet },
  deklarasi: { label: "Deklarasi", icon: CheckCircle2 },
};

const iconFor = (event: PcActivityEvent) => {
  if (event.label.toLowerCase().includes("ditolak")) return XCircle;
  if (event.label.toLowerCase().includes("disetujui") || event.label.toLowerCase().includes("tuntas") || event.label.toLowerCase().includes("dibayar"))
    return CheckCircle2;
  return typeMeta[event.type].icon;
};

export function PcActivityFeed({ events }: { events: PcActivityEvent[] }) {
  const [filter, setFilter] = useState<"all" | PcActivityEvent["type"]>("all");

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.type === filter)),
    [events, filter],
  );

  const chips: { key: "all" | PcActivityEvent["type"]; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "pengajuan", label: "Pengajuan" },
    { key: "voucher", label: "Voucher" },
    { key: "tarikan", label: "Tarikan" },
    { key: "deklarasi", label: "Deklarasi" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              filter === chip.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Belum ada aktivitas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {filtered.map((event) => {
            const Icon = iconFor(event);
            return (
              <li key={event.id}>
                <Link
                  href={event.href}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">
                      {event.label}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {event.kode}
                      </span>
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground"
                  >
                    {formatRelativeTime(event.timestamp)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
