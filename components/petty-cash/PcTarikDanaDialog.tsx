// src/components/petty-cash/PcTarikDanaDialog.tsx
//
// Dialog "Tarik Dana" (buat Sub-Voucher) dari sebuah Voucher yang sudah
// full-approved. Dipakai di halaman Pengajuan Voucher (tabel "Voucher
// Saya") DAN sebagai shortcut di Dokumen Petty Cash Saya (list + modal
// rantai dokumen) - satu komponen supaya aturan tarikannya sama persis.
//
// Tarik Dana dipilih PER-BARIS BARANG (checklist, qty boleh sebagian & bisa
// di-split ke beberapa tarikan berbeda) - BUKAN input nominal bebas, lihat
// komentar PettyCashSubVoucherItem (type/index.ts) & createSubVoucher
// (services/pettyCashSubVoucherService.ts). Sub-Voucher yang baru dibuat
// BELUM berarti dana diterima - requester wajib menunggu Finance approver
// menyelesaikan pembayarannya dulu.
//
// Layout: header & footer (total + tombol) tetap, cuma daftar barang yang
// scroll. Daftar barang SENGAJA bukan tabel ber-min-width - di dialog
// sempit/HP tabel 7 kolom bikin dialog melebar & scroll ke samping.

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RichMentionEditor,
  RichMentionEditorHandle,
} from "@/components/rich-mention-editor";
import { stringifyRichContent } from "@/lib/rich-content";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { PettyCashVoucher } from "@/type";
import {
  createSubVoucher,
  SubVoucherDraw,
} from "@/services/pettyCashSubVoucherService";
import { getPendingPembatalan } from "@/lib/pcChain";
import { formatPcPayment } from "@/lib/pcPayment";
import { PcCoaBadge } from "./PcCoaBadge";
import { AlertTriangle, Clock, Loader2, Minus, Plus, Wallet } from "lucide-react";

// Tarikan yang dibatalkan sudah di-refund, tidak dihitung sbg sudah ditarik.
export const drawnOf = (v: PettyCashVoucher) =>
  (v.petty_cash_sub_voucher ?? [])
    .filter((sv) => sv.status !== "Dibatalkan")
    .reduce((sum, sv) => sum + sv.amount, 0);

/**
 * Voucher yang masih bisa ditarik: sudah full-approved, masih ada sisa, &
 * Pengajuan-nya tidak sedang diajukan pembatalan (ditahan juga di RPC
 * create_petty_cash_sub_voucher). `pembatalan` = riwayat pembatalan
 * Pengajuan-nya kalau pemanggil memegangnya dari rantai Pengajuan (default:
 * dari join v.petty_cash_pengajuan, kalau ada).
 */
export const canDrawVoucher = (
  v: PettyCashVoucher,
  pembatalan?: { status: string }[] | null,
) =>
  v.status === "Approved" &&
  v.total_amount - drawnOf(v) > 0 &&
  !getPendingPembatalan(pembatalan ?? v.petty_cash_pengajuan?.petty_cash_pembatalan);

// Satu baris per item Voucher yang MASIH punya sisa qty (belum sepenuhnya
// ditarik di sub-voucher lain). `qty` default full sisa begitu dicentang,
// boleh dikurangi manual (tarikan sebagian, sisanya ditarik lagi lain kali).
type DrawRow = {
  item_index: number;
  part_name: string;
  category: string | null;
  coa: "GMI" | "GIS" | null;
  uom: string | null;
  unit_price: number;
  remainingQty: number;
  checked: boolean;
  qty: string;
};

/** Sisa qty tiap baris item Voucher = qty asli - total qty yang sudah dipakai di sub-voucher yang sudah ada. */
const buildDrawRows = (voucher: PettyCashVoucher): DrawRow[] => {
  const drawnByIndex = new Map<number, number>();
  (voucher.petty_cash_sub_voucher ?? []).forEach((sv) => {
    if (sv.status === "Dibatalkan") return;
    (sv.items ?? []).forEach((it) => {
      drawnByIndex.set(
        it.item_index,
        (drawnByIndex.get(it.item_index) ?? 0) + it.qty,
      );
    });
  });

  return voucher.items
    .map((it, idx) => ({
      item_index: idx,
      part_name: it.part_name,
      category: it.category,
      coa: it.coa,
      uom: it.uom,
      unit_price: it.unit_price,
      remainingQty: it.qty - (drawnByIndex.get(idx) ?? 0),
      checked: false,
      qty: "",
    }))
    .filter((row) => row.remainingQty > 0);
};

const isRowQtyInvalid = (row: DrawRow) =>
  row.checked &&
  (!row.qty || Number(row.qty) <= 0 || Number(row.qty) > row.remainingQty);

const SummaryStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) => (
  <div className="rounded-md border bg-muted/30 px-3 py-2 min-w-0">
    <p className="text-[11px] text-muted-foreground truncate">{label}</p>
    <p
      className={cn(
        "text-sm font-semibold tabular-nums truncate",
        tone === "warn" && "text-destructive",
      )}
    >
      {value}
    </p>
  </div>
);

export function PcTarikDanaDialog({
  voucher,
  onOpenChange,
  onCreated,
}: {
  /** Voucher yang ditarik dananya - null = dialog tertutup. */
  voucher: PettyCashVoucher | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
}) {
  const notesEditorRef = useRef<RichMentionEditorHandle>(null);
  const [rows, setRows] = useState<DrawRow[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!voucher) return;
    setRows(buildDrawRows(voucher));
    setNotes("");
  }, [voucher]);

  const toggleRow = (itemIndex: number, checked: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.item_index === itemIndex
          ? { ...row, checked, qty: checked ? String(row.remainingQty) : "" }
          : row,
      ),
    );
  };

  // Ngetik qty langsung ikut mencentang barisnya - tidak perlu centang dulu.
  const updateRowQty = (itemIndex: number, qty: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.item_index === itemIndex
          ? { ...row, qty, checked: row.checked || Number(qty) > 0 }
          : row,
      ),
    );
  };

  const stepRowQty = (row: DrawRow, delta: number) => {
    const next = Math.min(
      row.remainingQty,
      Math.max(0, (Number(row.qty) || 0) + delta),
    );
    if (next <= 0) return toggleRow(row.item_index, false);
    updateRowQty(row.item_index, String(next));
  };

  const allChecked = rows.length > 0 && rows.every((r) => r.checked);
  const toggleAll = (checked: boolean) => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        checked,
        qty: checked ? String(row.remainingQty) : "",
      })),
    );
  };

  const remainingVoucher = voucher
    ? voucher.total_amount - drawnOf(voucher)
    : 0;
  const remainingBudget = voucher?.petty_cash_budget?.current_budget ?? null;

  const selectedRows = rows.filter((row) => row.checked && Number(row.qty) > 0);
  const total = selectedRows.reduce(
    (sum, row) => sum + Number(row.qty) * row.unit_price,
    0,
  );
  const overBudget = remainingBudget != null && total > remainingBudget;
  const hasInvalidQty = rows.some(isRowQtyInvalid);

  const handleSubmit = async () => {
    if (!voucher) return;
    if (selectedRows.length === 0) {
      return toast.error("Pilih minimal 1 barang untuk ditarik.");
    }
    if (hasInvalidQty) {
      return toast.error(
        "Qty tarikan tiap barang wajib lebih dari 0 dan tidak melebihi sisa qty-nya.",
      );
    }
    if (overBudget) {
      return toast.error(
        `Total tarikan melebihi sisa budget departemen (${formatCurrency(
          remainingBudget ?? 0,
        )}). Kurangi qty/barang yang dipilih.`,
      );
    }
    const draws: SubVoucherDraw[] = selectedRows.map((row) => ({
      item_index: row.item_index,
      qty: Number(row.qty),
    }));
    setSubmitting(true);
    try {
      const sv = await createSubVoucher(voucher, draws, notes);
      toast.success(
        `Sub-Voucher ${sv.kode_sub_voucher} berhasil dibuat, menunggu pembayaran Finance.`,
      );
      onOpenChange(false);
      await onCreated?.();
    } catch (error: any) {
      toast.error("Gagal menarik dana", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!voucher}
      onOpenChange={(open) => !submitting && onOpenChange(open)}
    >
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="gap-3 border-b px-4 pt-5 pb-4 text-left sm:px-6">
          <div className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary shrink-0" />
              Tarik Dana
            </DialogTitle>
            <DialogDescription className="mt-1.5 [overflow-wrap:anywhere]">
              {voucher?.kode_voucher} - pilih barang yang dananya ditarik
              sekarang. Qty boleh sebagian, sisanya bisa ditarik lain kali.
              Dicairkan via{" "}
              <span className="font-medium text-foreground">
                {formatPcPayment(voucher, "metode pilihan Finance")}
              </span>
              .
            </DialogDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryStat
              label="Total Voucher"
              value={formatCurrency(voucher?.total_amount ?? 0)}
            />
            <SummaryStat
              label="Sisa belum ditarik"
              value={formatCurrency(remainingVoucher)}
            />
            {remainingBudget != null && (
              <SummaryStat
                label="Sisa budget departemen"
                value={formatCurrency(remainingBudget)}
                tone={overBudget ? "warn" : undefined}
              />
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Semua barang di Voucher ini sudah habis ditarik.
            </p>
          ) : (
            <div className="rounded-md border">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Pilih semua barang"
                  />
                  Pilih semua
                </label>
                <span className="text-xs text-muted-foreground">
                  {selectedRows.length}/{rows.length} barang dipilih
                </span>
              </div>
              <ul className="divide-y">
                {rows.map((row) => {
                  const invalid = isRowQtyInvalid(row);
                  const subtotal = row.checked
                    ? (Number(row.qty) || 0) * row.unit_price
                    : 0;
                  const checkboxId = `draw-row-${row.item_index}`;
                  return (
                    <li
                      key={row.item_index}
                      className={cn(
                        "flex gap-3 px-3 py-3 transition-colors",
                        row.checked && "bg-primary/5",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        className="mt-0.5"
                        checked={row.checked}
                        onCheckedChange={(v) =>
                          toggleRow(row.item_index, v === true)
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-2 sm:flex sm:items-center sm:gap-4 sm:space-y-0">
                        <label
                          htmlFor={checkboxId}
                          className="block min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="block text-sm font-medium [overflow-wrap:anywhere]">
                            {row.part_name}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                            <PcCoaBadge coa={row.coa} />
                            {row.category && (
                              <span className="[overflow-wrap:anywhere]">
                                {row.category}
                              </span>
                            )}
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              {formatCurrency(row.unit_price)}/
                              {row.uom || "unit"}
                            </span>
                          </span>
                        </label>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="space-y-1">
                            <div
                              className={cn(
                                "flex h-9 items-center rounded-md border bg-background",
                                invalid && "border-destructive",
                              )}
                            >
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-r-none"
                                onClick={() => stepRowQty(row, -1)}
                                disabled={!row.checked}
                                aria-label="Kurangi qty"
                              >
                                <Minus />
                              </Button>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={row.remainingQty}
                                value={row.qty}
                                placeholder="0"
                                onChange={(e) =>
                                  updateRowQty(row.item_index, e.target.value)
                                }
                                aria-label={`Qty ditarik ${row.part_name}`}
                                className="h-9 w-14 rounded-none border-0 px-1 text-center shadow-none tabular-nums focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-l-none"
                                onClick={() => stepRowQty(row, 1)}
                                disabled={Number(row.qty) >= row.remainingQty}
                                aria-label="Tambah qty"
                              >
                                <Plus />
                              </Button>
                            </div>
                            <p
                              className={cn(
                                "text-[11px] tabular-nums",
                                invalid
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              Sisa {row.remainingQty} {row.uom || ""}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "w-28 text-right text-sm font-semibold tabular-nums",
                              !row.checked && "text-muted-foreground/60",
                            )}
                          >
                            {formatCurrency(subtotal)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Catatan{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opsional)
              </span>
            </Label>
            <RichMentionEditor
              ref={notesEditorRef}
              placeholder="Ex: Kebutuhan minggu ini..."
              onChange={() =>
                setNotes(
                  notesEditorRef.current?.isEmpty()
                    ? ""
                    : stringifyRichContent(
                        notesEditorRef.current?.getJSON() ?? { type: "doc" },
                      ),
                )
              }
            />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Dana belum langsung cair - tarikan menunggu pembayaran Finance dulu,
            baru setelah itu bisa dideklarasikan.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Total tarikan · {selectedRows.length} barang
            </p>
            <p
              className={cn(
                "text-xl font-bold tabular-nums",
                overBudget ? "text-destructive" : "text-primary",
              )}
            >
              {formatCurrency(total)}
            </p>
            {overBudget && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Melebihi sisa budget departemen.
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
                submitting ||
                selectedRows.length === 0 ||
                hasInvalidQty ||
                overBudget
              }
            >
              {submitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Wallet />
              )}
              Tarik Dana
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
