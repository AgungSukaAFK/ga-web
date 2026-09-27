// src/components/petty-cash/PcBudgetChart.tsx
//
// Widget Budget di Dashboard Petty Cash (planning-pc.md Bagian 2.2/2.3).
// Dua mode tampilan:
// - 1 baris (requester biasa, budget departemen+site sendiri) -> panel
//   progres sederhana, tanpa chart (angka tunggal tidak butuh chart).
// - >1 baris (admin/GA, lintas departemen) -> bar chart horizontal
//   (Recharts, lewat components/ui/chart.tsx) supaya gampang bandingkan
//   departemen mana yang sisa budgetnya menipis.

"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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

const chartConfig = {
  pct: { label: "Terpakai (%)", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PcBudgetChart({ rows }: { rows: PcBudgetRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada Budget Petty Cash aktif untuk ditampilkan.
      </p>
    );
  }

  if (rows.length === 1) {
    const row = rows[0];
    const pct = pctUsed(row);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{row.label}</span>
          <span
            className={cn(
              "text-sm font-bold",
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

  const data = rows
    .map((row) => ({ ...row, pct: pctUsed(row) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[220px] w-full"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 12 }}
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={96}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="w-48"
              formatter={(value, _name, item) => {
                const row = item.payload as (typeof data)[number];
                return (
                  <div className="flex w-full flex-col gap-0.5">
                    <span className="font-medium">{row.label}</span>
                    <span>{value}% terpakai</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(row.used)} / {formatCurrency(row.total)}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="pct" radius={4}>
          {data.map((row) => (
            <Cell key={row.label} fill={colorForPct(row.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
