"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import {
  fetchTopVendors,
  fetchVendorDetail,
  type InsightRangeInput,
  type TopVendor,
} from "@/services/dashboardInsightService";
import {
  DetailStat,
  DetailTableWrap,
  InsightDetailDialog,
  formatQtyUom,
  formatShortDate,
  useDetailData,
} from "./insight-detail";
import {
  INSIGHT_EMPTY_TEXT,
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

function VendorDetailDialog({
  vendor,
  range,
  periodLabel,
  onClose,
}: {
  vendor: TopVendor | null;
  range: InsightRangeInput;
  periodLabel: string;
  onClose: () => void;
}) {
  const key = vendor ? `${vendor.vendor_name}|${range.startDate}|${range.endDate}` : null;
  const { data, loading, error } = useDetailData(key, () =>
    fetchVendorDetail(range, vendor!.vendor_name),
  );
  const avgPo = vendor && vendor.po_count ? vendor.total_value / vendor.po_count : 0;

  return (
    <InsightDetailDialog
      open={vendor != null}
      onOpenChange={(open) => !open && onClose()}
      title={vendor?.vendor_name ?? "-"}
      description={periodLabel}
      loading={loading}
      error={error}
    >
      {vendor && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DetailStat label="Jumlah PO" value={vendor.po_count} />
          <DetailStat label="Total Nilai (incl. pajak)" value={formatCurrency(vendor.total_value)} />
          <DetailStat label="Rata-rata per PO" value={formatCurrency(avgPo)} />
          <DetailStat label="PO Terakhir" value={formatShortDate(vendor.last_po_at)} />
        </div>
      )}

      <Tabs defaultValue="items" className="min-w-0">
        <TabsList>
          <TabsTrigger value="items">Barang Dibeli</TabsTrigger>
          <TabsTrigger value="pos">Daftar PO ({data?.pos.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          {data?.items.length ? (
            <DetailTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barang</TableHead>
                    <TableHead className="text-right">Jml PO</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((it) => (
                    <TableRow key={it.item_key}>
                      <TableCell className="max-w-[280px]">
                        <div className="truncate font-medium" title={it.item_name ?? undefined}>
                          {it.item_name || "-"}
                        </div>
                        {it.part_number && (
                          <div className="font-mono text-xs text-muted-foreground">
                            {it.part_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{it.po_count}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatQtyUom(it.qty, it.uom)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatCurrency(it.total_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DetailTableWrap>
          ) : (
            <InsightMessage>Tidak ada data barang.</InsightMessage>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            15 barang dengan nilai terbesar (sebelum pajak & diskon).
          </p>
        </TabsContent>
        <TabsContent value="pos">
          {data?.pos.length ? (
            <DetailTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode PO</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Jml Barang</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pos.map((po) => (
                    <TableRow key={po.po_id}>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          href={`/purchase-order/${po.po_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {po.kode_po}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatShortDate(po.created_at)}
                      </TableCell>
                      <TableCell>{po.po_status}</TableCell>
                      <TableCell className="text-right tabular-nums">{po.item_count}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatCurrency(po.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DetailTableWrap>
          ) : (
            <InsightMessage>Tidak ada PO.</InsightMessage>
          )}
        </TabsContent>
      </Tabs>
    </InsightDetailDialog>
  );
}

export function TopVendorsCard({ className, periodLabel, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, (input) => fetchTopVendors(input, 10));
  const [selected, setSelected] = useState<TopVendor | null>(null);

  const maxValue = data && data.length ? Math.max(data[0].total_value, 1) : 1;

  return (
    <Content
      size="md"
      title="Top Vendor"
      description={`Berdasarkan total nilai PO (termasuk pajak), ${periodLabel}. Klik baris untuk detail.`}
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
                  <TableRow
                    key={`${vendor.vendor_name}-${index}`}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => setSelected(vendor)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(vendor);
                      }
                    }}
                  >
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

      <VendorDetailDialog
        vendor={selected}
        range={range}
        periodLabel={periodLabel}
        onClose={() => setSelected(null)}
      />
    </Content>
  );
}
