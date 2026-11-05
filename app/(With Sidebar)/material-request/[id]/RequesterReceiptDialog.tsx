"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/file-dropzone";
import { ReceiptItemState } from "@/lib/requesterReceipt";

export interface RequesterReceiptSubmission {
  items: { index: number; qty: number }[];
  files: File[];
}

interface RequesterReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  states: ReceiptItemState[];
  // Barang yang langsung tercentang: satu barang dari tombol per baris, kosong
  // berarti semua.
  preselectedIndices: number[];
  submitting: boolean;
  onSubmit: (submission: RequesterReceiptSubmission) => void;
}

export function RequesterReceiptDialog({
  open,
  onOpenChange,
  states,
  preselectedIndices,
  submitting,
  onSubmit,
}: RequesterReceiptDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [qtyByIndex, setQtyByIndex] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<File[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(
        preselectedIndices.length > 0
          ? preselectedIndices
          : states.map((s) => s.index),
      ),
    );
    setQtyByIndex(
      Object.fromEntries(states.map((s) => [s.index, String(s.defaultQty)])),
    );
    setFiles(null);
    // Form hanya di-reset saat dialog dibuka, bukan tiap data di belakangnya
    // berubah - input yang sedang diisi tidak boleh hilang.
  }, [open]);

  const rows = useMemo(
    () =>
      states.map((state) => {
        const isSelected = selected.has(state.index);
        const raw = qtyByIndex[state.index] ?? "";
        const qty = Number(raw);
        const error = !isSelected
          ? null
          : raw.trim() === "" || !Number.isFinite(qty) || qty <= 0
            ? "Isi qty lebih dari 0"
            : qty > state.maxQty
              ? `Maksimal ${state.maxQty} ${state.order.uom}`
              : null;
        return { state, isSelected, qty, error };
      }),
    [states, selected, qtyByIndex],
  );

  const chosen = rows.filter((row) => row.isSelected);
  const hasError = chosen.some((row) => row.error);
  const allSelected = states.length > 0 && chosen.length === states.length;
  const partialCount = chosen.filter(
    (row) => !row.error && row.qty < row.state.remaining,
  ).length;
  const needsFile = !files || files.length === 0;

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  const handleSubmit = () => {
    if (hasError || !files || files.length === 0 || chosen.length === 0) return;
    onSubmit({
      items: chosen.map((row) => ({ index: row.state.index, qty: row.qty })),
      files,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Konfirmasi Barang Diterima</DialogTitle>
          <DialogDescription>
            Pilih barang yang sudah sampai dan isi qty-nya. Barang yang belum
            datang bisa dikonfirmasi nanti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Barang ({chosen.length} dipilih)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setSelected(
                    allSelected ? new Set() : new Set(states.map((s) => s.index)),
                  )
                }
              >
                {allSelected ? "Kosongkan" : "Pilih semua"}
              </Button>
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-md border divide-y">
              {rows.map(({ state, isSelected, error }) => (
                <div key={state.index} className="flex gap-3 p-3 text-sm">
                  <Checkbox
                    id={`receipt-item-${state.index}`}
                    className="mt-0.5"
                    checked={isSelected}
                    onCheckedChange={() => toggle(state.index)}
                    disabled={submitting}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <label
                      htmlFor={`receipt-item-${state.index}`}
                      className="block cursor-pointer"
                    >
                      <span className="font-medium break-words">
                        {state.order.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {state.message}
                        {state.received > 0 &&
                          ` · sudah diterima ${state.received} dari ${state.qty} ${state.order.uom}`}
                      </span>
                    </label>
                    {isSelected && (
                      <div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={state.maxQty}
                            step="any"
                            aria-label={`Qty diterima ${state.order.name}`}
                            aria-invalid={!!error}
                            className="h-9 w-24"
                            value={qtyByIndex[state.index] ?? ""}
                            onChange={(e) =>
                              setQtyByIndex((prev) => ({
                                ...prev,
                                [state.index]: e.target.value,
                              }))
                            }
                            disabled={submitting}
                          />
                          <span className="text-xs text-muted-foreground">
                            dari {state.maxQty} {state.order.uom}
                          </span>
                        </div>
                        {error && (
                          <p className="mt-1 text-xs text-destructive">{error}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="requester-receipt-file">
              Foto / Dokumen Bukti Terima
            </Label>
            <FileDropzone
              id="requester-receipt-file"
              multiple
              onFiles={setFiles}
              selectedFiles={files}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Satu bukti bisa mewakili semua barang yang dipilih.
            </p>
          </div>

          {partialCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {partialCount} barang diterima sebagian dan tetap terbuka sampai
              sisanya datang.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || chosen.length === 0 || hasError || needsFile
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Konfirmasi {chosen.length > 0 ? `${chosen.length} Barang` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
