"use client";

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
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { fetchTopVendors } from "@/services/dashboardInsightService";
import {
  INSIGHT_EMPTY_TEXT,
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

export function TopVendorsCard({ className, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, (input) => fetchTopVendors(input, 10));

  const maxValue = data && data.length ? Math.max(data[0].total_value, 1) : 1;

  return (
    <Content
      size="md"
      title="Top Vendor"
      description="Berdasarkan total nilai PO (termasuk pajak), periode terpilih."
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
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Jumlah PO</TableHead>
                <TableHead className="text-right">Total Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((vendor, index) => {
                const pct = Math.max(0, Math.min(100, (vendor.total_value / maxValue) * 100));
                return (
                  <TableRow key={`${vendor.vendor_name}-${index}`}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate font-semibold" title={vendor.vendor_name}>
                        {vendor.vendor_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        PO terakhir: {formatDateFriendly(vendor.last_po_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{vendor.po_count}</TableCell>
                    <TableCell className="min-w-[140px] text-right">
                      <div className="tabular-nums">{formatCurrency(vendor.total_value)}</div>
                      <div className="mt-1 h-1.5 rounded bg-muted">
                        <div
                          className="ml-auto h-1.5 rounded bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Content>
  );
}
