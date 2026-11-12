"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { fetchTopPoItems, type TopPoItem } from "@/services/dashboardInsightService";
import {
  INSIGHT_EMPTY_TEXT,
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

const MAX_LABEL = 22;

const formatShortRupiah = (value: number): string => {
  const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${fmt(value / 1e9)} M`;
  if (abs >= 1e6) return `${fmt(value / 1e6)} jt`;
  if (abs >= 1e3) return `${fmt(value / 1e3)} rb`;
  return fmt(value);
};

type ChartRow = TopPoItem & { label: string };

const PoItemTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload as ChartRow;
  return (
    <div className="max-w-[280px] rounded-lg border bg-background p-2 shadow-md">
      <div className="grid grid-cols-1 gap-1">
        <span className="text-sm font-semibold">{item.item_name || "-"}</span>
        {item.part_number && (
          <span className="text-[0.7rem] uppercase text-muted-foreground">
            {item.part_number}
          </span>
        )}
        <span className="text-sm font-bold" style={{ color: "var(--color-po)" }}>
          Nilai: {formatCurrency(item.total_value)}
        </span>
        <span className="text-xs">Jumlah PO: {item.po_count}</span>
        <span className="text-xs">
          Qty: {item.total_qty.toLocaleString("id-ID")}{" "}
          {item.uom ? item.uom : "(satuan beragam)"}
        </span>
      </div>
    </div>
  );
};

export function TopPoItemsCard({ className, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, (input) => fetchTopPoItems(input, 10));

  const chartData: ChartRow[] = (data || []).map((item) => {
    const name = item.item_name || item.part_number || "-";
    return {
      ...item,
      label: name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL)}…` : name,
    };
  });

  return (
    <Content
      size="md"
      title="Barang dengan Belanja Terbesar (PO)"
      description="Total nilai barang di PO (sebelum pajak & diskon), periode terpilih."
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : error ? (
        <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
      ) : chartData.length === 0 ? (
        <InsightMessage>{INSIGHT_EMPTY_TEXT}</InsightMessage>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatShortRupiah}
            />
            <YAxis
              type="category"
              dataKey="label"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={160}
            />
            <Tooltip content={<PoItemTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="total_value" name="Nilai" fill="var(--color-po)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Content>
  );
}
