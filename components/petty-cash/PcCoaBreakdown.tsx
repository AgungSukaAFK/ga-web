// src/components/petty-cash/PcCoaBreakdown.tsx
//
// Subtotal per COA (GMI/GIS) - cuma dirender kalau baris item sebuah
// dokumen memang campuran GMI+GIS (paling relevan buat akun Lourdes yang
// boleh mencampur COA dalam satu Pengajuan). Kalau semua baris satu COA
// yang sama, komponen ini sengaja tidak menampilkan apa-apa - breakdown
// cuma berguna kalau ada campuran utk dibandingkan.

import { formatCurrency } from "@/lib/utils";
import { PcCoaBadge } from "./PcCoaBadge";

interface PcCoaBreakdownProps {
  items: { coa: "GMI" | "GIS" | null; subtotal: number }[];
}

export function PcCoaBreakdown({ items }: PcCoaBreakdownProps) {
  const totals = new Map<string, number>();
  for (const it of items) {
    const key = it.coa ?? "-";
    totals.set(key, (totals.get(key) ?? 0) + it.subtotal);
  }
  const entries = Array.from(totals.entries());
  if (entries.length <= 1) return null;

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Rincian per COA
      </p>
      {entries.map(([coa, amount]) => (
        <div key={coa} className="flex items-center justify-between text-sm">
          {coa === "-" ? (
            <span className="text-muted-foreground text-xs">
              Belum ditentukan
            </span>
          ) : (
            <PcCoaBadge coa={coa as "GMI" | "GIS"} />
          )}
          <span className="font-medium">{formatCurrency(amount)}</span>
        </div>
      ))}
    </div>
  );
}
