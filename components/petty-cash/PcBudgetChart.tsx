// src/components/petty-cash/PcBudgetChart.tsx
//
// Widget Budget di Dashboard Petty Cash (planning-pc.md Bagian 2.2/2.3).
// Tiap budget ditampilkan sebagai baris progres (label, % terpakai, bar,
// nominal). Dulu mode lintas departemen (admin/GA) pakai bar chart Recharts
// horizontal, tapi label budget panjang ("Budget IT Head Office (GMI) (IT)")
// saling tindih di sumbu Y - daftar progres lebih terbaca & muat banyak baris.

"use client";

import { cn, formatCurrency } from "@/lib/utils";

export interface PcBudgetRow {
  label: string;
  used: number;
  total: number;
}

const pctUsed = (row: PcBudgetRow) =>
  row.total > 0 ? Math.min(100, Math.round((row.used / row.total) * 100)) : 0;

const colorForPct = (pct: number) => {
  if (pct >= 85) return "#dc2626"; // merah - hampir habis
  if (pct >= 60) return "#f59e0b"; // amber - waspada
  return "#16a34a"; // hijau - aman
};

function BudgetProgressRow({ row }: { row: PcBudgetRow }) {
  const pct = pctUsed(row);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 break-words text-sm font-medium">
          {row.label}
        </span>
        <span
          className={cn(
            "shrink-0 whitespace-nowrap text-sm font-bold",
            pct >= 85
              ? "text-red-600 dark:text-red-400"
              : pct >= 60
                ? "text-amber-600 dark:text-amber-400"
                : "text-green-600 dark:text-green-400",
          )}
        >
          {pct}% terpakai
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: colorForPct(pct) }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Terpakai {formatCurrency(row.used)}</span>
        <span>Sisa {formatCurrency(Math.max(0, row.total - row.used))}</span>
      </div>
    </div>
  );
}

export function PcBudgetChart({ rows }: { rows: PcBudgetRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada Budget Petty Cash aktif untuk ditampilkan.
      </p>
    );
  }

  if (rows.length === 1) return <BudgetProgressRow row={rows[0]} />;

  // Urut dari yang paling banyak terpakai supaya budget yang menipis di atas.
  const sorted = [...rows].sort((a, b) => pctUsed(b) - pctUsed(a));

  return (
    <ul className="flex max-h-[320px] flex-col divide-y overflow-y-auto pr-1">
      {sorted.map((row, i) => (
        <li key={`${row.label}-${i}`} className="py-3 first:pt-0 last:pb-0">
          <BudgetProgressRow row={row} />
        </li>
      ))}
    </ul>
  );
}
