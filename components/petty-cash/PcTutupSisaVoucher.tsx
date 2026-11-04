// src/components/petty-cash/PcTutupSisaVoucher.tsx
//
// "Tutup Sisa Voucher" - lihat supabase/migrations/0022_petty_cash_tutup_sisa_voucher.sql.
//  - PcTutupSisaButton: tombol + dialog alasan. Cuma muncul kalau sisanya
//    boleh ditutup (canCloseVoucherRemainder, lib/pcChain.ts) - dicek ulang
//    di RPC.
//  - PcSisaDitutupInfo: keterangan sisa yang sudah ditutup.

"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { closeVoucherRemainder } from "@/services/pettyCashVoucherService";
import { PettyCashVoucher } from "@/type";
import { CircleSlash, Loader2 } from "lucide-react";

export function PcTutupSisaButton({
  voucher,
  sisa,
  onClosed,
  size = "sm",
}: {
  voucher: Pick<PettyCashVoucher, "id" | "kode_voucher">;
  sisa: number;
  onClosed?: () => void | Promise<void>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error("Alasan wajib diisi.");
    setSubmitting(true);
    try {
      await closeVoucherRemainder(voucher.id, reason.trim());
      toast.success(`Sisa ${voucher.kode_voucher} berhasil ditutup.`);
      setOpen(false);
      setReason("");
      await onClosed?.();
    } catch (error: any) {
      toast.error("Gagal menutup sisa Voucher", {
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <CircleSlash className="h-4 w-4 mr-1" /> Tutup Sisa Voucher
      </Button>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tutup Sisa Voucher</DialogTitle>
            <DialogDescription>
              Sisa {formatCurrency(sisa)} dari {voucher.kode_voucher} tidak akan
              ditarik. Budget tidak berubah karena sisa ini belum pernah
              dipotong. Tindakan ini final: Tarik Dana tidak bisa dilakukan
              lagi. Tarikan yang sudah ada tetap wajib dideklarasikan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pc-tutup-sisa-reason">
              Alasan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="pc-tutup-sisa-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: kebutuhan sudah terpenuhi, barang sisanya tidak jadi dibeli..."
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={submit} disabled={submitting || !reason.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tutup Sisa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PcSisaDitutupInfo({
  closed,
}: {
  closed: NonNullable<PettyCashVoucher["closed_remainder"]>;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          Sisa {formatCurrency(closed.amount)} sudah ditutup
        </p>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          Oleh {closed.closed_by_name}. Alasan: {closed.reason}
        </p>
      </div>
    </div>
  );
}
