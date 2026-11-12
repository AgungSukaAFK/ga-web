"use client";

import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fetchTopMrItems, type TopMrItem } from "@/services/dashboardInsightService";
import {
  INSIGHT_EMPTY_TEXT,
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

const isStockCandidate = (item: TopMrItem) =>
  item.stock_qty === 0 && item.department_count >= 2;

function StockBadge({ item }: { item: TopMrItem }) {
  if (!item.in_catalog) return <Badge variant="outline">Non-katalog</Badge>;
  if (!item.stock_qty) return <Badge variant="destructive">Tidak ada stok</Badge>;
  return (
    <Badge variant="secondary">
      Stok: {item.stock_qty.toLocaleString("id-ID")}
    </Badge>
  );
}

export function TopMrItemsCard({ className, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, (input) => fetchTopMrItems(input, 10));

  return (
    <Content
      size="md"
      title="Barang Paling Sering Diminta (MR)"
      description="Berdasarkan jumlah MR yang memuat barang tersebut, periode terpilih."
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : error ? (
        <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
      ) : !data || data.length === 0 ? (
        <InsightMessage>{INSIGHT_EMPTY_TEXT}</InsightMessage>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Jumlah MR</TableHead>
                  <TableHead className="text-right">Dept</TableHead>
                  <TableHead>Stok GA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow
                    key={item.item_key}
                    className={cn(isStockCandidate(item) && "bg-destructive/5")}
                  >
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-semibold" title={item.item_name ?? undefined}>
                        {item.item_name || "-"}
                      </div>
                      {item.part_number && (
                        <div className="truncate text-xs text-muted-foreground">
                          {item.part_number}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.mr_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.department_count}
                    </TableCell>
                    <TableCell>
                      <StockBadge item={item} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Baris berwarna = diminta ≥2 departemen tapi stok GA kosong (kandidat untuk distok).
          </p>
        </>
      )}
    </Content>
  );
}
