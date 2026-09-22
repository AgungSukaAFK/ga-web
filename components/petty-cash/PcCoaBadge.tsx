// src/components/petty-cash/PcCoaBadge.tsx
//
// Badge kecil COA (GMI/GIS) satu baris item Pengajuan/Voucher/Deklarasi -
// dipakai di PcItemsEditor, PcDocumentInfoPanel, dan dokumen cetak.

import { Badge } from "@/components/ui/badge";

const COA_COLORS: Record<string, string> = {
  GMI: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  GIS: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
};

export function PcCoaBadge({ coa }: { coa: "GMI" | "GIS" | null | undefined }) {
  if (!coa) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-normal whitespace-nowrap ${COA_COLORS[coa] || ""}`}
    >
      {coa}
    </Badge>
  );
}
