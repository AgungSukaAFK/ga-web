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
import {
  fetchApprovalDetail,
  fetchApprovalTime,
  type ApprovalTimeRow,
  type InsightRangeInput,
} from "@/services/dashboardInsightService";
import {
  DetailStat,
  DetailTableWrap,
  InsightDetailDialog,
  formatHours,
  formatShortDate,
  useDetailData,
} from "./insight-detail";
import {
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

const DOC_LABELS: Record<ApprovalTimeRow["doc_type"], string> = {
  MR: "Material Request",
  PO: "Purchase Order",
};

const DOC_PATHS: Record<ApprovalTimeRow["doc_type"], string> = {
  MR: "/material-request",
  PO: "/purchase-order",
};

function ApprovalTimeBlock({ row, onClick }: { row: ApprovalTimeRow; onClick: () => void }) {
  const empty = row.doc_count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className="rounded-lg border p-4 text-left transition-colors enabled:hover:bg-muted/50 disabled:cursor-default"
    >
      <div className="text-sm text-muted-foreground">{DOC_LABELS[row.doc_type]}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {empty ? "–" : formatHours(row.avg_hours)}
      </div>
      {empty ? (
        <div className="mt-2 text-xs text-muted-foreground">
          Belum ada dokumen selesai di-approve
        </div>
      ) : (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <div>Median: {formatHours(row.median_hours)}</div>
          <div>{row.doc_count} dokumen</div>
          <div className="pt-1 text-primary">Lihat detail →</div>
        </div>
      )}
    </button>
  );
}

function ApprovalDetailDialog({
  row,
  range,
  periodLabel,
  onClose,
}: {
  row: ApprovalTimeRow | null;
  range: InsightRangeInput;
  periodLabel: string;
  onClose: () => void;
}) {
  const key = row ? `${row.doc_type}|${range.startDate}|${range.endDate}` : null;
  const { data, loading, error } = useDetailData(key, () =>
    fetchApprovalDetail(range, row!.doc_type),
  );

  return (
    <InsightDetailDialog
      open={row != null}
      onOpenChange={(open) => !open && onClose()}
      title={row ? `Waktu Approval ${DOC_LABELS[row.doc_type]}` : ""}
      description={`Dokumen yang selesai di-approve, ${periodLabel}.`}
      loading={loading}
      error={error}
    >
      {row && (
        <div className="grid grid-cols-3 gap-3">
          <DetailStat label="Rata-rata" value={formatHours(row.avg_hours)} />
          <DetailStat label="Median" value={formatHours(row.median_hours)} />
          <DetailStat label="Dokumen" value={row.doc_count} />
        </div>
      )}

      <div className="min-w-0 space-y-2">
        <h4 className="text-sm font-semibold">Dokumen dengan Approval Terlama</h4>
          {data?.slowest.length && row ? (
            <DetailTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokumen</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Selesai Approve</TableHead>
                    <TableHead className="text-right">Durasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowest.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          href={`${DOC_PATHS[row.doc_type]}/${d.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {d.kode}
                        </Link>
                        {d.department && (
                          <div className="text-xs text-muted-foreground">{d.department}</div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatShortDate(d.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatShortDate(d.approved_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatHours(d.hours)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DetailTableWrap>
          ) : (
            <InsightMessage>Tidak ada data.</InsightMessage>
          )}
      </div>
    </InsightDetailDialog>
  );
}

export function ApprovalTimeCard({ className, periodLabel, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, fetchApprovalTime);
  const [selected, setSelected] = useState<ApprovalTimeRow | null>(null);

  // RPC selalu balikin baris MR & PO, tapi tetap dijaga kalau salah satunya hilang.
  const rows: ApprovalTimeRow[] = (["MR", "PO"] as const).map(
    (type) =>
      data?.find((r) => r.doc_type === type) ?? {
        doc_type: type,
        doc_count: 0,
        avg_hours: null,
        median_hours: null,
      },
  );

  return (
    <Content
      size="md"
      title="Rata-rata Waktu Approval"
      description={`Dari dokumen dibuat sampai approval terakhir disetujui (tidak termasuk pembayaran & penerimaan barang), ${periodLabel}. Klik untuk melihat dokumen terlama.`}
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[140px] w-full" />
      ) : error ? (
        <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <ApprovalTimeBlock key={row.doc_type} row={row} onClick={() => setSelected(row)} />
          ))}
        </div>
      )}

      <ApprovalDetailDialog
        row={selected}
        range={range}
        periodLabel={periodLabel}
        onClose={() => setSelected(null)}
      />
    </Content>
  );
}
