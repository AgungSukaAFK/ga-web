"use client";

import { useState } from "react";
import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchTopItems, type TopItem } from "@/services/dashboardInsightService";
import { formatQtyUom } from "./insight-detail";
import { ItemDetailDialog } from "./item-detail-dialog";
import {
  INSIGHT_EMPTY_TEXT,
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

export function TopItemsCard({ className, periodLabel, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, (input) => fetchTopItems(input, 10));
  const [selected, setSelected] = useState<TopItem | null>(null);

  return (
    <Content
      size="md"
      title="Top Barang"
      description={`Barang yang paling sering diminta di MR, beserta realisasi PO-nya (${periodLabel}). Klik baris untuk detail.`}
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : error ? (
        <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
      ) : !data || data.length === 0 ? (
        <InsightMessage>{INSIGHT_EMPTY_TEXT}</InsightMessage>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead>Kode ATK</TableHead>
                <TableHead className="text-right">Jml MR</TableHead>
                <TableHead className="text-right">Qty MR</TableHead>
                <TableHead className="text-right">Jml PO</TableHead>
                <TableHead className="text-right">Qty PO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow
                  key={item.item_key}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => setSelected(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(item);
                    }
                  }}
                >
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="truncate font-semibold" title={item.item_name ?? undefined}>
                      {item.item_name || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.uom || "-"}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {item.part_number || "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.mr_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatQtyUom(item.mr_qty, item.mr_uom)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.po_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {item.po_count ? formatQtyUom(item.po_qty, item.po_uom) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ItemDetailDialog
        item={selected}
        range={range}
        periodLabel={periodLabel}
        onClose={() => setSelected(null)}
      />
    </Content>
  );
}
