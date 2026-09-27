// src/components/petty-cash/PcActionNeededList.tsx
//
// Panel "Perlu Tindakan Anda" - realisasi paling konkret dari 3 "titik
// senyap" di planning-pc.md Bagian 1.3 (Pengajuan Disetujui tapi belum
// diajukan Voucher, Voucher Disetujui tapi belum ditarik dananya, dana
// sudah cair tapi belum diajukan Deklarasi). Tiap baris punya tombol aksi
// yang deep-link LANGSUNG ke halaman yang menangani aksinya, bukan cuma
// badge pasif - lihat buildActionItems, services/pettyCashDashboardService.ts.

import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PcActionItem } from "@/services/pettyCashDashboardService";

export function PcActionNeededList({ items }: { items: PcActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
        <PartyPopper className="h-8 w-8" />
        <p className="text-sm font-medium text-foreground">
          Tidak ada yang perlu ditindaklanjuti
        </p>
        <p className="max-w-xs text-xs">
          Semua Pengajuan Petty Cash Anda sedang menunggu pihak lain atau
          sudah tuntas.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {items.map(({ pengajuan, status, ctaLabel, ctaHref }) => (
        <li
          key={pengajuan.id}
          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {pengajuan.kode_pengajuan}
              </span>
              <Badge className={`${status.badgeClass} whitespace-nowrap`}>
                {status.label}
              </Badge>
              {status.detail && (
                <span className="text-xs text-muted-foreground">
                  {status.detail}
                </span>
              )}
            </div>
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {pengajuan.notes || "Tanpa catatan"} ·{" "}
              {formatCurrency(pengajuan.total_amount)}
            </span>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
