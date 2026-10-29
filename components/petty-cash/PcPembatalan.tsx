// src/components/petty-cash/PcPembatalan.tsx
//
// UI Pembatalan Pengajuan Petty Cash sisi requester (lihat
// services/pettyCashPembatalanService.ts):
//  - PcPembatalanStatus: kotak status permintaan terakhir (menunggu Finance /
//    disetujui / ditolak) - dipasang di halaman detail Pengajuan & modal
//    rantai dokumen "Pengajuan Saya".
//  - PcAjukanPembatalanButton: tombol + dialog alasan. Cuma muncul kalau
//    pemilik & masih boleh dibatalkan (canRequestPembatalan, lib/pcChain.ts) -
//    syaratnya dicek ulang di RPC request_petty_cash_pembatalan.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { sortDocsNewestFirst } from "@/lib/pcChain";
import { requestPembatalan } from "@/services/pettyCashPembatalanService";
import { PettyCashPembatalan, PettyCashPengajuan } from "@/type";
import { Ban, Clock, Loader2, XCircle } from "lucide-react";

const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function PcPembatalanStatus({
  pembatalan,
}: {
  pembatalan: PettyCashPembatalan[] | null | undefined;
}) {
  // Yang ditampilkan cuma permintaan terakhir (paling banyak 1 yang masih
  // menunggu, sisanya riwayat).
  const latest = sortDocsNewestFirst(pembatalan)[0];
  if (!latest) return null;

  if (latest.status === "Menunggu Persetujuan") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">Pembatalan menunggu persetujuan Finance</p>
          <p className="text-xs">
            Diajukan {formatDateTime(latest.created_at)}. Alasan:{" "}
            <span className="[overflow-wrap:anywhere]">{latest.reason}</span>
          </p>
          <p className="text-xs">
            Selama menunggu, Tarik Dana & pembayaran tarikan ditahan.
          </p>
        </div>
      </div>
    );
  }

  if (latest.status === "Disetujui") {
    const refunded = latest.detail?.total_refunded ?? 0;
    return (
      <div className="flex items-start gap-2 rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">Pengajuan ini sudah dibatalkan</p>
          <p className="text-xs">
            Disetujui {latest.processed_by_profile?.nama || "Finance"}
            {latest.processed_at
              ? ` pada ${formatDateTime(latest.processed_at)}`
              : ""}
            . Alasan pemohon:{" "}
            <span className="[overflow-wrap:anywhere]">{latest.reason}</span>
          </p>
          {latest.finance_note && (
            <p className="text-xs">Catatan Finance: {latest.finance_note}</p>
          )}
          {refunded > 0 && (
            <p className="text-xs">
              {formatCurrency(refunded)} dari tarikan yang belum dibayar
              dikembalikan ke budget.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">Permintaan pembatalan ditolak Finance</p>
        <p className="text-xs">
          {latest.processed_by_profile?.nama || "Finance"}
          {latest.processed_at
            ? `, ${formatDateTime(latest.processed_at)}`
            : ""}
          {latest.finance_note ? ` - alasan: ${latest.finance_note}` : ""}.
          Pengajuan tetap berjalan.
        </p>
      </div>
    </div>
  );
}

export function PcAjukanPembatalanButton({
  pengajuan,
  onRequested,
  size = "sm",
}: {
  pengajuan: Pick<PettyCashPengajuan, "id" | "kode_pengajuan" | "company_code">;
  onRequested?: () => void | Promise<void>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error("Alasan pembatalan wajib diisi.");
    setSubmitting(true);
    try {
      await requestPembatalan(pengajuan, reason.trim());
      toast.success(
        `Pembatalan ${pengajuan.kode_pengajuan} diajukan - menunggu persetujuan Finance.`,
      );
      setOpen(false);
      setReason("");
      await onRequested?.();
    } catch (error: any) {
      toast.error("Gagal mengajukan pembatalan", {
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-4 w-4 mr-1" /> Ajukan Pembatalan
      </Button>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan Pembatalan</DialogTitle>
            <DialogDescription>
              {pengajuan.kode_pengajuan} - permintaan ini diproses Finance.
              Kalau disetujui, Pengajuan beserta Voucher & tarikan yang belum
              dibayar ikut dibatalkan dan potongan budget-nya dikembalikan.
              Selama menunggu, Tarik Dana ditahan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pc-pembatalan-reason">
              Alasan Pembatalan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="pc-pembatalan-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: kegiatan dibatalkan, kebutuhan sudah dipenuhi dari sumber lain..."
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
            <Button
              variant="destructive"
              onClick={submit}
              disabled={submitting || !reason.trim()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajukan Pembatalan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
