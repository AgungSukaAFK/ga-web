// src/components/petty-cash/PcEskalasiBadge.tsx
//
// Penanda Pengajuan Eskalasi (PettyCashPengajuan.is_eskalasi) - cuma di
// layar (list, antrian approval, detail), SENGAJA tidak dipakai di
// PrintablePettyCashDocument (eskalasi tidak dicetak).

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PC_ESKALASI_BADGE_CLASS } from "@/type/enum";
import { Siren } from "lucide-react";

export function PcEskalasiBadge({
  show,
  className,
}: {
  show: boolean | null | undefined;
  className?: string;
}) {
  if (!show) return null;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 whitespace-nowrap", PC_ESKALASI_BADGE_CLASS, className)}
      title="Pengajuan eskalasi (GA/Admin) - dibuat walau tarikan sebelumnya belum dideklarasikan, atau ditandai mendesak."
    >
      <Siren className="h-3 w-3" /> Eskalasi
    </Badge>
  );
}
