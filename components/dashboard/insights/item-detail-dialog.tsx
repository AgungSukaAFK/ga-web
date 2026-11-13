"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import {
  fetchItemDetail,
  type InsightRangeInput,
  type ItemDetailMrRow,
  type ItemDetailPoRow,
} from "@/services/dashboardInsightService";
import {
  DetailStat,
  DetailTableWrap,
  InsightDetailDialog,
  formatQty,
  formatShortDate,
  useDetailData,
} from "./insight-detail";
import { InsightMessage } from "./use-insight-data";

export interface ItemDetailTarget {
  item_key: string;
  item_name: string | null;
  part_number: string | null;
  uom: string | null;
}

/** Total qty per satuan, mis. "120 Pcs + 3 Box" (satuan dibandingkan case-insensitive). */
const sumByUom = (rows: { qty: number; uom: string | null }[]): string => {
  if (!rows.length) return "0";
  const map = new Map<string, { label: string; qty: number }>();
  for (const r of rows) {
    const label = r.uom?.trim() || "-";
    const key = label.toLowerCase();
    const cur = map.get(key) ?? { label, qty: 0 };
    cur.qty += r.qty;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.qty - a.qty)
    .map((v) => `${formatQty(v.qty)} ${v.label}`)
    .join(" + ");
};

function MrTable({ rows }: { rows: ItemDetailMrRow[] }) {
  if (!rows.length) return <InsightMessage>Tidak ada MR pada periode ini.</InsightMessage>;
  return (
    <DetailTableWrap>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode MR</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Departemen / Pemohon</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Status Barang</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.mr_id}-${i}`}>
              <TableCell className="whitespace-nowrap">
                <Link
                  href={`/material-request/${r.mr_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.kode_mr}
                </Link>
                <div className="text-xs text-muted-foreground">{r.mr_status}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatShortDate(r.created_at)}</TableCell>
              <TableCell>
                <div>{r.department || "-"}</div>
                <div className="text-xs text-muted-foreground">{r.requester || "-"}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatQty(r.qty)} {r.uom || ""}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.line_status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DetailTableWrap>
  );
}

function PoTable({ rows }: { rows: ItemDetailPoRow[] }) {
  if (!rows.length) return <InsightMessage>Tidak ada PO pada periode ini.</InsightMessage>;
  return (
    <DetailTableWrap>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode PO</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Harga Satuan</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.po_id}-${i}`}>
              <TableCell className="whitespace-nowrap">
                <Link
                  href={`/purchase-order/${r.po_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.kode_po}
                </Link>
                <div className="text-xs text-muted-foreground">{r.po_status}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatShortDate(r.created_at)}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={r.vendor_name}>
                {r.vendor_name}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatQty(r.qty)} {r.uom || ""}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatCurrency(r.price)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatCurrency(r.line_total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DetailTableWrap>
  );
}

export function ItemDetailDialog({
  item,
  range,
  periodLabel,
  defaultTab = "mr",
  onClose,
}: {
  item: ItemDetailTarget | null;
  range: InsightRangeInput;
  periodLabel: string;
  defaultTab?: "mr" | "po" | "dept";
  onClose: () => void;
}) {
  const key = item ? `${item.item_key}|${range.startDate}|${range.endDate}` : null;
  const { data, loading, error } = useDetailData(key, () =>
    fetchItemDetail(range, item!.item_key),
  );

  const mrRows = data?.mr ?? [];
  const poRows = data?.po ?? [];
  const mrCount = new Set(mrRows.map((r) => r.mr_id)).size;
  const poCount = new Set(poRows.map((r) => r.po_id)).size;
  const poValue = poRows.reduce((acc, r) => acc + r.line_total, 0);
  const avgPrice = (() => {
    const qty = poRows.reduce((acc, r) => acc + r.qty, 0);
    return qty > 0 ? poValue / qty : null;
  })();

  return (
    <InsightDetailDialog
      open={item != null}
      onOpenChange={(open) => !open && onClose()}
      title={item?.item_name || item?.part_number || "-"}
      description={
        <>
          {item?.part_number && <span className="font-mono">{item.part_number}</span>}
          {item?.part_number && " · "}
          {item?.uom ? `Satuan: ${item.uom} · ` : ""}
          {periodLabel}
        </>
      }
      loading={loading}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DetailStat label="Jumlah MR" value={mrCount} />
        <DetailStat label="Total Qty MR" value={sumByUom(mrRows)} />
        <DetailStat label="Jumlah PO" value={poCount} />
        <DetailStat label="Total Qty PO" value={sumByUom(poRows)} />
        <DetailStat
          label="Nilai PO"
          value={formatCurrency(poValue)}
          hint={avgPrice != null ? `Rata-rata ${formatCurrency(avgPrice)}/satuan` : undefined}
        />
      </div>

      <Tabs defaultValue={defaultTab} className="min-w-0">
        <TabsList>
          <TabsTrigger value="mr">MR ({mrRows.length})</TabsTrigger>
          <TabsTrigger value="po">PO ({poRows.length})</TabsTrigger>
          <TabsTrigger value="dept">Per Departemen</TabsTrigger>
        </TabsList>
        <TabsContent value="mr">
          <MrTable rows={mrRows} />
        </TabsContent>
        <TabsContent value="po">
          <PoTable rows={poRows} />
        </TabsContent>
        <TabsContent value="dept">
          {data?.departments.length ? (
            <DetailTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departemen</TableHead>
                    <TableHead className="text-right">Jumlah MR</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.departments.map((d) => (
                    <TableRow key={d.department}>
                      <TableCell>{d.department}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.mr_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatQty(d.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DetailTableWrap>
          ) : (
            <InsightMessage>Tidak ada MR pada periode ini.</InsightMessage>
          )}
        </TabsContent>
      </Tabs>
      {(mrRows.length >= 300 || poRows.length >= 300) && (
        <p className="text-xs text-muted-foreground">
          Daftar dibatasi 300 baris terbaru.
        </p>
      )}
    </InsightDetailDialog>
  );
}
