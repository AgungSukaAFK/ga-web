// src/components/petty-cash/PcAdminForceEditSubVoucherDialog.tsx
//
// Dialog "Edit Paksa (Admin)" khusus Sub-Voucher - LEBIH SEMPIT dari
// PcAdminForceEditDialog.tsx (dipakai Pengajuan/Voucher/Deklarasi) karena
// Sub-Voucher itemnya adalah SUBSET barang yang ditarik dari Voucher induk,
// diidentifikasi lewat `item_index` yang harus tetap merujuk ke posisi array
// `petty_cash_voucher.items` asalnya (lihat komentar PettyCashSubVoucherItem,
// type/index.ts). Baris TIDAK BOLEH ditambah/dihapus di sini (beda dari
// PcItemsEditor yang bebas) - admin cuma boleh menyesuaikan qty & harga
// satuan tiap baris yang SUDAH ada (mis. requester salah ketik qty saat
// tarik dana). Selisih nominalnya otomatis direkonsiliasi ke Budget oleh RPC
// `admin_force_update_sub_voucher` (lihat
// supabase/petty-cash-admin-full-management-setup.sql) - dialog ini cuma
// mengumpulkan nilai baru.
//
// Sub-Voucher tidak punya jalur approval sendiri (lihat komentar
// PettyCashSubVoucher, type/index.ts) jadi status di sini cuma 2 pilihan
// (Menunggu Pembayaran/Selesai) - dipakai admin utk membenahi kasus salah
// tandai pembayaran, BUKAN pengganti alur normal (mark_petty_cash_sub_voucher_paid,
// yang mewajibkan bukti transfer).

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PettyCashSubVoucherItem } from "@/type";
import { Loader2, ShieldAlert } from "lucide-react";

export interface PcAdminForceEditSubVoucherValues {
  items: PettyCashSubVoucherItem[];
  notes: string | null;
  status: "Menunggu Pembayaran" | "Selesai";
}

interface PcAdminForceEditSubVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kode: string;
  initial: {
    items: PettyCashSubVoucherItem[];
    notes: string | null;
    status: string;
  };
  onSubmit: (
    edits: PcAdminForceEditSubVoucherValues,
    reason: string,
  ) => Promise<void>;
}

export function PcAdminForceEditSubVoucherDialog({
  open,
  onOpenChange,
  kode,
  initial,
  onSubmit,
}: PcAdminForceEditSubVoucherDialogProps) {
  const [items, setItems] = useState<PettyCashSubVoucherItem[]>(initial.items);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [status, setStatus] = useState<"Menunggu Pembayaran" | "Selesai">(
    initial.status === "Selesai" ? "Selesai" : "Menunggu Pembayaran",
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(initial.items);
    setNotes(initial.notes ?? "");
    setStatus(initial.status === "Selesai" ? "Selesai" : "Menunggu Pembayaran");
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateRow = (
    idx: number,
    field: "qty" | "unit_price",
    value: number,
  ) => {
    setItems((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]: value,
              subtotal:
                field === "qty"
                  ? value * row.unit_price
                  : row.qty * value,
            }
          : row,
      ),
    );
  };

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);

  const handleSubmit = async () => {
    if (items.some((it) => !it.qty || it.qty <= 0))
      return toast.error("Qty setiap baris wajib lebih dari 0.");
    if (items.some((it) => it.unit_price < 0))
      return toast.error("Harga satuan tidak boleh negatif.");
    if (!reason.trim())
      return toast.error("Alasan edit paksa wajib diisi.", {
        description: "Tercatat permanen di jejak audit admin.",
      });

    setSubmitting(true);
    try {
      await onSubmit({ items, notes: notes.trim() || null, status }, reason.trim());
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Gagal menyimpan edit paksa", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
            Edit Paksa Sub-Voucher (Admin)
          </DialogTitle>
          <DialogDescription>
            {kode} - qty/harga per baris boleh disesuaikan, selisih
            nominalnya otomatis direkonsiliasi ke Budget terkait. Baris tidak
            bisa ditambah/dihapus di sini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barang</TableHead>
                  <TableHead className="w-[110px]">Qty</TableHead>
                  <TableHead className="w-[160px]">Harga Satuan</TableHead>
                  <TableHead className="w-[140px] text-right">
                    Subtotal
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{row.part_name}</p>
                      {row.coa && (
                        <p className="text-xs text-muted-foreground">
                          COA {row.coa}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.qty}
                        onChange={(e) =>
                          updateRow(idx, "qty", Number(e.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={row.unit_price}
                        onChange={(e) =>
                          updateRow(idx, "unit_price", Number(e.target.value))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(row.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-right text-sm font-semibold">
            Total: {formatCurrency(total)}
          </p>

          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Status Pembayaran</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v as "Menunggu Pembayaran" | "Selesai")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Menunggu Pembayaran">
                  Menunggu Pembayaran
                </SelectItem>
                <SelectItem value="Selesai">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Alasan Edit Paksa (wajib)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan kenapa Sub-Voucher ini perlu diedit paksa - tercatat permanen di jejak audit admin."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Edit Paksa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
