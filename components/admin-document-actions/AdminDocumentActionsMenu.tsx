// components/admin-document-actions/AdminDocumentActionsMenu.tsx
//
// Tombol "Aksi Admin" di halaman edit MR Management & PO Management - pilih
// aksi (Batalkan / Tutup Sisa / Buka Kembali / shortcut approval & koreksi),
// lihat preview efek lanjutannya, isi alasan
// (+ catatan refund utk PO yang sudah dibayar), lalu jalankan. Logika &
// aturannya di services/adminDocumentActionService.ts.

"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  CircleDollarSign,
  ListChecks,
  Loader2,
  PackageMinus,
  PackageX,
  Undo2,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  DOC_STATUS_CANCELLED,
  PO_STATUS_PARTIAL_RECEIVE,
} from "@/type/enum";
import {
  AdminActionPreview,
  AdminActionStepOption,
  AdminDocumentAction,
  CloseRemainderMrMode,
  previewAdminDocumentAction,
  runAdminDocumentAction,
} from "@/services/adminDocumentActionService";
import { PO_ELIGIBLE_MR_STATUSES } from "@/services/purchaseOrderService";

type DocType = "mr" | "po";

const ACTIONS: Record<
  DocType,
  {
    cancel: AdminDocumentAction;
    close: AdminDocumentAction;
    reopen: AdminDocumentAction;
    resetApproval: AdminDocumentAction;
    forceApproval: AdminDocumentAction;
    label: string;
    /** Status dokumen yang punya "sisa" untuk ditutup (preview mengecek detailnya). */
    canClose: (status: string) => boolean;
  }
> = {
  mr: {
    cancel: "cancel_mr",
    close: "close_mr_remainder",
    reopen: "reopen_mr",
    resetApproval: "reset_mr_approval",
    forceApproval: "force_mr_approval",
    label: "MR",
    canClose: (status) => PO_ELIGIBLE_MR_STATUSES.includes(status),
  },
  po: {
    cancel: "cancel_po",
    close: "close_po_remainder",
    reopen: "reopen_po",
    resetApproval: "reset_po_approval",
    forceApproval: "force_po_approval",
    label: "PO",
    canClose: (status) => status === PO_STATUS_PARTIAL_RECEIVE || status === "Pending Payment",
  },
};

const STOP_ACTIONS: AdminDocumentAction[] = [
  "cancel_mr",
  "cancel_po",
  "close_mr_remainder",
  "close_po_remainder",
];

// Aksi yang memundurkan / menghentikan proses - tombol konfirmasi merah.
const DESTRUCTIVE_ACTIONS: AdminDocumentAction[] = [
  ...STOP_ACTIONS,
  "reset_mr_approval",
  "reset_po_approval",
  "unpay_po",
  "unreceive_po",
];

const STEP_ACTIONS: AdminDocumentAction[] = [
  "reset_mr_approval",
  "reset_po_approval",
  "force_mr_approval",
  "force_po_approval",
];

const MR_MODE_OPTIONS: { value: CloseRemainderMrMode; label: string; hint: string }[] = [
  {
    value: "reorder",
    label: "Pesan ulang sisanya",
    hint: 'Sisa item MR balik ke "Menunggu PO" - Purchasing bisa buat PO baru (mis. vendor lain).',
  },
  {
    value: "close",
    label: "Tutup juga di MR",
    hint: "Qty item MR disesuaikan ke yang diterima, budget sisanya dikembalikan.",
  },
];

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
  close_po_remainder: {
    title: "Tutup Sisa Purchase Order",
    description:
      "Barang yang belum diterima tidak akan dikirim vendor - PO selesai dengan qty yang sudah diterima.",
    confirm: "Tutup Sisa PO",
  },
  close_mr_remainder: {
    title: "Tutup Sisa Material Request",
    description:
      "Semua yang belum diterima tidak dilanjutkan - qty item disesuaikan ke yang sudah diterima, PO yang belum diterima dibatalkan, PO yang baru diterima sebagian ditutup sisanya.",
    confirm: "Tutup Sisa MR",
  },
  reset_mr_approval: {
    title: "Reset Approval MR ke Step",
    description:
      "Step yang dipilih dan sesudahnya dikembalikan ke pending - approver di step itu dapat giliran lagi. Status MR menyesuaikan.",
    confirm: "Reset Approval",
  },
  reset_po_approval: {
    title: "Reset Approval PO ke Step",
    description:
      "Step yang dipilih dan sesudahnya dikembalikan ke pending - approver di step itu dapat giliran lagi. Status PO menyesuaikan.",
    confirm: "Reset Approval",
  },
  force_mr_approval: {
    title: "Approve MR sampai Step",
    description:
      "Step dari giliran sekarang sampai step yang dipilih di-approve sekaligus atas nama approver-nya (mis. approver cuti / sudah setuju lewat jalur lain).",
    confirm: "Approve",
  },
  force_po_approval: {
    title: "Approve PO sampai Step",
    description:
      "Step dari giliran sekarang sampai step yang dipilih di-approve sekaligus atas nama approver-nya. Step Receiver tetap lewat checklist Terima Barang.",
    confirm: "Approve",
  },
  unpay_po: {
    title: "Batalkan Status Bayar PO",
    description:
      "Untuk pembayaran yang salah dicatat: step Payment Validator dst. balik pending, DP / Pelunasan belum lunas, item MR \"Dikirim Vendor\" balik \"Processing\".",
    confirm: "Batalkan Status Bayar",
  },
  unreceive_po: {
    title: "Batalkan Penerimaan Barang",
    description:
      "Untuk penerimaan yang salah dicatat: checklist Terima Barang dihapus, step Receiver dst. balik pending, item MR balik ke status sebelum diterima. Isi ulang checklist-nya sesudah ini.",
    confirm: "Batalkan Penerimaan",
  },
};

export function AdminDocumentActionsMenu({
  docType,
  docId,
  status,
  actor,
  disabled,
  hasUnsavedChanges,
  onDone,
}: {
  docType: DocType;
  docId: number;
  status: string;
  actor: { id: string; name: string } | null;
  disabled?: boolean;
  /** Form halaman punya perubahan belum disimpan - hilang saat halaman dimuat ulang setelah aksi. */
  hasUnsavedChanges?: boolean;
  /** Dipanggil setelah aksi berhasil - muat ulang data halaman. */
  onDone: () => void | Promise<void>;
}) {
  const {
    cancel,
    close: closeRemainder,
    reopen,
    resetApproval,
    forceApproval,
    label,
    canClose,
  } = ACTIONS[docType];
  const isCancelled = status === DOC_STATUS_CANCELLED;

  const [action, setAction] = useState<AdminDocumentAction | null>(null);
  const [preview, setPreview] = useState<AdminActionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState("");
  const [refundNotes, setRefundNotes] = useState<Record<number, string>>({});
  const [mrMode, setMrMode] = useState<CloseRemainderMrMode>("reorder");
  // Pilihan step disimpan terpisah supaya pemilihnya tidak hilang saat
  // preview dihitung ulang.
  const [steps, setSteps] = useState<AdminActionStepOption[]>([]);
  const [stepIndex, setStepIndex] = useState<number | undefined>(undefined);
  const [running, setRunning] = useState(false);

  const loadPreview = async (
    next: AdminDocumentAction,
    opts: { mrMode: CloseRemainderMrMode; stepIndex?: number },
  ) => {
    if (!actor) return;
    setPreview(null);
    setLoadingPreview(true);
    try {
      const result = await previewAdminDocumentAction(next, docId, actor, opts);
      setPreview(result);
      setSteps(result.steps ?? []);
      setStepIndex(result.stepIndex);
    } catch (err: any) {
      toast.error("Gagal memuat preview aksi", { description: err.message });
      setAction(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const openAction = (next: AdminDocumentAction) => {
    setAction(next);
    setReason("");
    setRefundNotes({});
    setMrMode("reorder");
    setSteps([]);
    setStepIndex(undefined);
    loadPreview(next, { mrMode: "reorder" });
  };

  const changeMrMode = (mode: CloseRemainderMrMode) => {
    if (!action || mode === mrMode) return;
    setMrMode(mode);
    loadPreview(action, { mrMode: mode });
  };

  const changeStep = (index: number) => {
    if (!action || index === stepIndex) return;
    setStepIndex(index);
    loadPreview(action, { mrMode, stepIndex: index });
  };

  const close = () => {
    if (running) return;
    setAction(null);
    setPreview(null);
  };

  const isStopAction = !!action && STOP_ACTIONS.includes(action);
  const paidPos = isStopAction ? (preview?.cancelledPos ?? []).filter((p) => p.paid) : [];
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
            <>
              <DropdownMenuItem onSelect={() => openAction(forceApproval)}>
                <ListChecks className="mr-2 h-4 w-4" />
                Approve sampai Step...
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openAction(resetApproval)}>
                <Undo2 className="mr-2 h-4 w-4" />
                Reset Approval ke Step...
              </DropdownMenuItem>
              {docType === "po" && (
                <>
                  <DropdownMenuItem onSelect={() => openAction("unpay_po")}>
                    <CircleDollarSign className="mr-2 h-4 w-4" />
                    Batalkan Status Bayar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openAction("unreceive_po")}>
                    <PackageMinus className="mr-2 h-4 w-4" />
                    Batalkan Penerimaan
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {canClose(status) && (
                <>
                  <DropdownMenuItem onSelect={() => openAction(closeRemainder)}>
                    <PackageX className="mr-2 h-4 w-4" />
                    Tutup Sisa {label}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => openAction(cancel)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Batalkan {label}
              </DropdownMenuItem>
            </>
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

          {action && STEP_ACTIONS.includes(action) && steps.length > 0 && (
            <div className="space-y-2">
              <Label>
                {action.startsWith("reset") ? "Reset mulai dari" : "Approve sampai"}
              </Label>
              <Select
                value={stepIndex !== undefined ? String(stepIndex) : undefined}
                onValueChange={(v) => changeStep(Number(v))}
                disabled={running || loadingPreview}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih step" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((st) => (
                    <SelectItem key={st.index} value={String(st.index)}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "close_po_remainder" && (
            <div className="space-y-2">
              <Label>Sisa barang di MR</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MR_MODE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={mrMode === opt.value ? "default" : "outline"}
                    className="h-auto flex-col items-start whitespace-normal py-2 text-left"
                    onClick={() => changeMrMode(opt.value)}
                    disabled={running || loadingPreview}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs font-normal opacity-80">{opt.hint}</span>
                  </Button>
                ))}
              </div>
            </div>
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
                  {hasUnsavedChanges && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Ada perubahan di form yang belum disimpan - perubahan itu akan hilang
                        karena halaman dimuat ulang setelah aksi ini.
                      </AlertDescription>
                    </Alert>
                  )}
                  {paidPos.map((po) => (
                    <div key={po.id} className="space-y-2">
                      <Label htmlFor={`refund-${po.id}`}>
                        {po.closing ? "Catatan refund / penyesuaian tagihan" : "Catatan refund"}{" "}
                        {po.kode_po}{" "}
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
                variant={action && DESTRUCTIVE_ACTIONS.includes(action) ? "destructive" : "default"}
                onClick={handleRun}
                disabled={!canRun || running}
              >
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isStopAction ? (
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
