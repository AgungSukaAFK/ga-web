"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Loader2 } from "lucide-react";
import { fetchActivityLogs } from "@/services/logService";
import type { DocumentChange } from "@/lib/document-change-log";
import { formatDateWithTime, cn } from "@/lib/utils";

interface ActivityLogDialogProps {
  resourceType: string;
  resourceId: string;
  trigger?: React.ReactNode;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_MR: "MR Dibuat",
  UPDATE_MR: "MR Diubah",
  UPDATE_MR_ADMIN: "Diedit Admin",
  UPDATE_MR_DEPARTMENT: "Departemen Diubah",
  APPROVE_MR: "Disetujui",
  REJECT_MR: "Ditolak",
  REJECT_MR_APPROVER: "Ditolak Approver",
  VALIDATE_MR: "Divalidasi",
  HOLD_MR: "Ditahan",
  RESUBMIT_MR: "Diajukan Ulang",
  CONVERT_MR_COMPANY: "Konversi Company",
  CONVERT_MR_ITEM_BARANG: "Konversi Barang",
  CREATE_PO: "PO Dibuat",
  UPDATE_PO: "PO Diubah",
  APPROVE_PO: "Disetujui",
  REJECT_PO: "Ditolak",
  VALIDATE_PO: "Divalidasi",
  REJECT_PO_VALIDATION: "Validasi Ditolak",
  CONVERT_PO_ITEM_BARANG: "Konversi Barang",
  CHANGE_PO_TYPE: "Jenis PO Diubah",
  RECEIVE_GOODS: "Barang Diterima",
  UPDATE_PAYMENT_DP_BP: "Pembayaran Diubah",
  UPDATE_ITEM_STATUS: "Status Item Diubah",
  ADMIN_OVERRIDE_APPROVAL: "Approval Diubah Admin",
};

const actionLabel = (log: { action_type: string; metadata?: any }) => {
  if (log.metadata?.mode === "admin") return "Diedit Admin";
  return (
    ACTION_LABELS[log.action_type] ??
    log.action_type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
};

const VISIBLE_CHANGES = 5;

function LogChanges({ changes }: { changes: DocumentChange[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? changes : changes.slice(0, VISIBLE_CHANGES);

  return (
    <div className="mt-1.5 rounded-md border bg-muted/40 p-2">
      <ul className="space-y-1 text-[11px]">
        {visible.map((change, i) => (
          <li key={i} className="break-words">
            <span className="font-medium">{change.label}</span>
            {change.from !== undefined && change.to !== undefined ? (
              <span className="text-muted-foreground">
                : {change.from} → {change.to}
              </span>
            ) : (
              <span className="text-muted-foreground">
                : {change.to ?? change.from}
              </span>
            )}
          </li>
        ))}
      </ul>
      {changes.length > VISIBLE_CHANGES && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-medium text-primary hover:underline"
        >
          {expanded ? "Sembunyikan" : `Lihat semua (${changes.length})`}
        </button>
      )}
    </div>
  );
}

function LogDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          "text-xs text-foreground/90",
          !expanded && "line-clamp-2",
        )}
      >
        {text}
      </p>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          {expanded ? "Sembunyikan" : "Lihat selengkapnya"}
        </button>
      )}
    </div>
  );
}

export function ActivityLogDialog({
  resourceType,
  resourceId,
  trigger,
}: ActivityLogDialogProps) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const handleOpenChange = async (next: boolean) => {
    if (!next) return;
    setLoading(true);
    const data = await fetchActivityLogs(resourceType, resourceId);
    setLogs(data || []);
    setLoading(false);
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Riwayat Aktivitas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Riwayat Aktivitas</DialogTitle>
          <DialogDescription>
            Log perubahan yang dilakukan oleh User atau Sistem.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] -mx-6 px-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Belum ada riwayat aktivitas.
            </p>
          ) : (
            <div className="pb-2">
              {logs.map((log, i) => (
                <div key={log.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    {i !== logs.length - 1 && (
                      <span className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatDateWithTime(log.created_at)}
                      </span>
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[9px]"
                      >
                        {actionLabel(log)}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold mt-0.5">
                      {log.users_with_profiles?.nama || "Sistem"}
                    </p>
                    <LogDescription text={log.description} />
                    {Array.isArray(log.metadata?.changes) &&
                      log.metadata.changes.length > 0 && (
                        <LogChanges changes={log.metadata.changes} />
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
