"use client";

import { Content } from "@/components/content";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchApprovalTime, type ApprovalTimeRow } from "@/services/dashboardInsightService";
import {
  INSIGHT_ERROR_TEXT,
  InsightMessage,
  useInsightData,
  type InsightCardProps,
} from "./use-insight-data";

const formatDuration = (hours: number | null): string => {
  if (hours == null) return "–";
  if (hours < 1) return "< 1 jam";
  if (hours < 24) return `${Math.round(hours)} jam`;
  return `${(hours / 24).toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;
};

const DOC_LABELS: Record<ApprovalTimeRow["doc_type"], string> = {
  MR: "Material Request",
  PO: "Purchase Order",
};

function ApprovalTimeBlock({ row }: { row: ApprovalTimeRow }) {
  const empty = row.doc_count === 0;
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{DOC_LABELS[row.doc_type]}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {empty ? "–" : formatDuration(row.avg_hours)}
      </div>
      {empty ? (
        <div className="mt-2 text-xs text-muted-foreground">
          Belum ada dokumen selesai di-approve
        </div>
      ) : (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <div>Median: {formatDuration(row.median_hours)}</div>
          <div>{row.doc_count} dokumen</div>
        </div>
      )}
    </div>
  );
}

export function ApprovalTimeCard({ className, ...range }: InsightCardProps) {
  const { data, loading, error } = useInsightData(range, fetchApprovalTime);

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
      description="Dari dokumen dibuat sampai approval terakhir disetujui (tidak termasuk pembayaran & penerimaan barang). Dihitung dari dokumen yang selesai di-approve pada periode terpilih."
      className={className}
    >
      {loading ? (
        <Skeleton className="h-[140px] w-full" />
      ) : error ? (
        <InsightMessage>{INSIGHT_ERROR_TEXT}</InsightMessage>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <ApprovalTimeBlock key={row.doc_type} row={row} />
          ))}
        </div>
      )}
    </Content>
  );
}
