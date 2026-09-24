// src/components/petty-cash/PcRevisionHistory.tsx
//
// Riwayat revisi sebuah dokumen Petty Cash (Pengajuan/Voucher/Deklarasi) -
// tiap kali approver pakai "Edit & Setujui" (lihat PcEditAndApproveDialog),
// versi SEBELUM edit itu dicatat ke `revisions[]` (lihat PcDocumentRevision,
// type/index.ts). Komponen ini merender tiap versi sebagai badge yang bisa
// diklik utk lihat detail lengkap versi itu (via PcItemsEditor readOnly) -
// "Versi Asli" = revisions[0], lalu "Revisi 2/3/dst", dan "Versi Terkini" =
// nilai dokumen yang berlaku sekarang.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PcItemsEditor } from "./PcItemsEditor";
import { RichContentView } from "@/components/rich-content-view";
import { parseRichValue } from "@/lib/rich-content";
import { Attachment, PcDocumentRevision, PettyCashPengajuanItem } from "@/type";
import { History } from "lucide-react";

const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

interface VersionSnapshot {
  needed_date?: string | Date;
  week_of_month?: number | null;
  notes: string | null;
  items: PettyCashPengajuanItem[];
  attachments: Attachment[];
}

interface PcRevisionHistoryProps {
  revisions: PcDocumentRevision[] | null | undefined;
  current: VersionSnapshot;
  // Deklarasi tidak punya konsep needed_date - sembunyikan baris itu di
  // detail versi kalau false.
  showNeededDate?: boolean;
}

export function PcRevisionHistory({
  revisions,
  current,
  showNeededDate = true,
}: PcRevisionHistoryProps) {
  const list = revisions ?? [];
  const [viewing, setViewing] = useState<{
    label: string;
    meta: string | null;
    snapshot: VersionSnapshot;
  } | null>(null);

  if (list.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Belum pernah direvisi approver - versi yang tampil adalah versi asli.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Riwayat Revisi ({list.length}x diedit approver)
        </p>
        <div className="flex flex-wrap gap-2">
          {list.map((rev, i) => (
            <Badge
              key={i}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() =>
                setViewing({
                  label: i === 0 ? "Versi Asli" : `Revisi ke-${i}`,
                  meta: `${rev.revised_by_name} - ${formatDateTime(rev.revised_at)}`,
                  snapshot: rev.snapshot,
                })
              }
            >
              {i === 0 ? "Versi Asli" : `Revisi ${i}`}
            </Badge>
          ))}
          <Badge
            className="cursor-pointer bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
            onClick={() =>
              setViewing({
                label: "Versi Terkini",
                meta: null,
                snapshot: current,
              })
            }
          >
            Versi Terkini
          </Badge>
        </div>
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.label}</DialogTitle>
            {viewing?.meta && (
              <DialogDescription>Direvisi oleh {viewing.meta}</DialogDescription>
            )}
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {showNeededDate && viewing.snapshot.needed_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tanggal Dibutuhkan
                    </p>
                    <p className="font-medium">
                      {formatDateTime(viewing.snapshot.needed_date)}
                    </p>
                  </div>
                )}
                {showNeededDate &&
                  viewing.snapshot.week_of_month != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Minggu ke-
                      </p>
                      <p className="font-medium">
                        {viewing.snapshot.week_of_month}
                      </p>
                    </div>
                  )}
              </div>
              {viewing.snapshot.notes && (
                <div className="text-sm bg-muted/50 rounded-md p-3 border">
                  <RichContentView
                    content={parseRichValue(viewing.snapshot.notes)}
                  />
                </div>
              )}
              <PcItemsEditor readOnly initialItems={viewing.snapshot.items} />
              {viewing.snapshot.attachments?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Lampiran
                  </p>
                  {viewing.snapshot.attachments.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline p-2 border rounded-md bg-background truncate block"
                    >
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
