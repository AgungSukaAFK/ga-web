// components/admin-document-actions/AdminDocumentActionsMenu.tsx
//
// Tombol "Aksi Admin" di halaman edit MR Management & PO Management - pilih
// aksi (Batalkan / Buka Kembali), lihat preview efek lanjutannya, isi alasan
// (+ catatan refund utk PO yang sudah dibayar), lalu jalankan. Logika &
// aturannya di services/adminDocumentActionService.ts.

"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { DOC_STATUS_CANCELLED } from "@/type/enum";
import {
  AdminActionPreview,
  AdminDocumentAction,
  previewAdminDocumentAction,
  runAdminDocumentAction,
} from "@/services/adminDocumentActionService";

type DocType = "mr" | "po";

const ACTIONS: Record<
  DocType,
  { cancel: AdminDocumentAction; reopen: AdminDocumentAction; label: string }
> = {
  mr: { cancel: "cancel_mr", reopen: "reopen_mr", label: "MR" },
  po: { cancel: "cancel_po", reopen: "reopen_po", label: "PO" },
};

const DIALOG_COPY: Record<
  AdminDocumentAction,
  { title: string; description: string; confirm: string }
> = {
  cancel_mr: {
    title: "Batalkan Material Request",
    description:
      "MR & semua PO aktifnya dibatalkan, item MR jadi Cancelled, budget cost center dikembalikan.",
    confirm: "Batalkan MR",
  },
  cancel_po: {
    title: "Batalkan Purchase Order",
    description:
      "PO dibatalkan dan item MR yang tidak lagi ter-cover PO lain balik ke Menunggu PO supaya bisa di-PO ulang.",
    confirm: "Batalkan PO",
  },
  reopen_mr: {
    title: "Buka Kembali Material Request",
    description: "MR yang dibatalkan diaktifkan lagi beserta item-itemnya.",
    confirm: "Buka Kembali MR",
  },
  reopen_po: {
    title: "Buka Kembali Purchase Order",
    description:
      "PO yang dibatalkan diaktifkan lagi - jalur approval & pembayaran diulang dari awal.",
    confirm: "Buka Kembali PO",
  },
};

export function AdminDocumentActionsMenu({
  docType,
  docId,
  status,
  actor,
  disabled,
  disabledReason,
  onDone,
}: {
  docType: DocType;
  docId: number;
  status: string;
  actor: { id: string; name: string } | null;
  disabled?: boolean;
  /** Tooltip saat `disabled`, mis. "Simpan perubahan dulu". */
  disabledReason?: string;
  /** Dipanggil setelah aksi berhasil - muat ulang data halaman. */
  onDone: () => void | Promise<void>;
}) {
  const { cancel, reopen, label } = ACTIONS[docType];
  const isCancelled = status === DOC_STATUS_CANCELLED;

  const [action, setAction] = useState<AdminDocumentAction | null>(null);
  const [preview, setPreview] = useState<AdminActionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState("");
  const [refundNotes, setRefundNotes] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);

  const openAction = async (next: AdminDocumentAction) => {
    setAction(next);
    setPreview(null);
    setReason("");
    setRefundNotes({});
    setLoadingPreview(true);
    try {
      setPreview(await previewAdminDocumentAction(next, docId));
    } catch (err: any) {
      toast.error("Gagal memuat preview aksi", { description: err.message });
      setAction(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const close = () => {
    if (running) return;
    setAction(null);
    setPreview(null);
  };

  const isCancelAction = action === "cancel_mr" || action === "cancel_po";
  const paidPos = isCancelAction ? (preview?.cancelledPos ?? []).filter((p) => p.paid) : [];
  const canRun =
    !!preview &&
    !!actor &&
    preview.blockers.length === 0 &&
    reason.trim().length > 0 &&
    paidPos.every((p) => refundNotes[p.id]?.trim());

  const handleRun = async () => {
    if (!preview || !actor || !action) return;
    setRunning(true);
    try {
      await runAdminDocumentAction(preview, { reason, refundNotes }, actor);
      toast.success(`${DIALOG_COPY[action].confirm} berhasil`);
      setAction(null);
      setPreview(null);
      await onDone();
    } catch (err: any) {
      toast.error(`Gagal ${DIALOG_COPY[action].confirm.toLowerCase()}`, {
        description: err.message,
      });
    } finally {
      setRunning(false);
    }
  };

  const copy = action ? DIALOG_COPY[action] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || !actor}
            title={disabled ? disabledReason : undefined}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Aksi Admin
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Aksi Dokumen {label}</DropdownMenuLabel>
          {isCancelled ? (
            <DropdownMenuItem onSelect={() => openAction(reopen)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Buka Kembali {label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => openAction(cancel)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Batalkan {label}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!action} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {copy && (
            <DialogHeader>
              <DialogTitle>
                {copy.title}
                {preview && (
                  <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                    {preview.kode}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
          )}

          {loadingPreview || !preview ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Menghitung efek aksi...
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {preview.blockers.length > 0 && (
                <Alert variant="destructive">
                  <Ban className="h-4 w-4" />
                  <AlertTitle>Aksi tidak bisa dijalankan</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {preview.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {preview.effects.length > 0 && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Yang akan terjadi:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {preview.effects.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {preview.blockers.length === 0 && (
                <>
                  {paidPos.map((po) => (
                    <div key={po.id} className="space-y-2">
                      <Label htmlFor={`refund-${po.id}`}>
                        Catatan refund {po.kode_po}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({formatCurrency(po.total_price)})
                        </span>
                        <span className="text-destructive"> *</span>
                      </Label>
                      <Textarea
                        id={`refund-${po.id}`}
                        placeholder="Mis. vendor refund via transfer ke rekening perusahaan, estimasi 7 hari kerja"
                        value={refundNotes[po.id] ?? ""}
                        onChange={(e) =>
                          setRefundNotes((prev) => ({ ...prev, [po.id]: e.target.value }))
                        }
                        disabled={running}
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="admin-action-reason">
                      Alasan <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="admin-action-reason"
                      placeholder="Alasan dicatat di log & dikirim ke pihak terkait lewat notifikasi"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={running}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={running}>
              Tutup
            </Button>
            {preview && preview.blockers.length === 0 && copy && (
              <Button
                variant={isCancelAction ? "destructive" : "default"}
                onClick={handleRun}
                disabled={!canRun || running}
              >
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isCancelAction ? (
                  <Ban className="mr-2 h-4 w-4" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {copy.confirm}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
