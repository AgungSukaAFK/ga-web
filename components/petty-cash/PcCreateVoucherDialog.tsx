// src/components/petty-cash/PcCreateVoucherDialog.tsx
//
// Dialog konfirmasi "Buat Voucher" dari Pengajuan yang sudah "Approved" -
// menampilkan PREVIEW snapshot (item/nominal/catatan disalin apa adanya,
// tidak bisa diubah, lihat createVoucherFromPengajuan di
// services/pettyCashVoucherService.ts) sebelum dikirim ke jalur approval
// Voucher. Dipakai di halaman Pengajuan Voucher DAN sebagai shortcut di
// Dokumen Petty Cash Saya (list + modal rantai dokumen).
//
// Layout sama dengan PcTarikDanaDialog: header & footer tetap, daftar
// barang yang scroll, tanpa tabel ber-min-width supaya tidak melebar.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RichContentView } from "@/components/rich-content-view";
import { parseRichValue } from "@/lib/rich-content";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { pickCurrentDoc } from "@/lib/pcChain";
import { PettyCashPengajuan, PettyCashVoucher } from "@/type";
import { createVoucherFromPengajuan } from "@/services/pettyCashVoucherService";
import { PcCoaBadge } from "./PcCoaBadge";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ExternalLink,
  Loader2,
  Paperclip,
  Send,
  Wallet,
} from "lucide-react";

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export function PcCreateVoucherDialog({
  pengajuan,
  userId,
  onOpenChange,
  onCreated,
}: {
  /** Pengajuan asal Voucher - null = dialog tertutup. */
  pengajuan: PettyCashPengajuan | null;
  userId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: (voucher: PettyCashVoucher) => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  // Pengajuan yang boleh di-voucher-kan tidak punya Voucher aktif - kalau
  // masih ada Voucher di sini, berarti itu yang ditolak.
  const rejectedVoucher = pickCurrentDoc(pengajuan?.petty_cash_voucher);

  const handleSubmit = async () => {
    if (!pengajuan || !userId) return;
    setSubmitting(true);
    try {
      const voucher = await createVoucherFromPengajuan(pengajuan, userId);
      toast.success(
        `Voucher ${voucher.kode_voucher} berhasil dibuat dan masuk jalur approval.`,
      );
      onOpenChange(false);
      await onCreated?.(voucher);
    } catch (error: any) {
      toast.error("Gagal membuat voucher", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!pengajuan}
      onOpenChange={(open) => !submitting && onOpenChange(open)}
    >
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-3 border-b px-4 pt-5 pb-4 text-left sm:px-6">
          <div className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 shrink-0 text-primary" />
              {rejectedVoucher ? "Ajukan Ulang Voucher" : "Buat Voucher"}
            </DialogTitle>
            <DialogDescription className="mt-1.5">
              Isi Voucher disalin persis dari Pengajuan{" "}
              <span className="font-medium text-foreground [overflow-wrap:anywhere]">
                {pengajuan?.kode_pengajuan}
              </span>{" "}
              dan tidak bisa diubah. Setelah dikirim, Voucher langsung masuk
              jalur approval.
            </DialogDescription>
          </div>
          {pengajuan && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Dibutuhkan {formatDate(pengajuan.needed_date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {pengajuan.department} · {pengajuan.company_code}
              </span>
              {pengajuan.petty_cash_budget?.name && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" />
                  {pengajuan.petty_cash_budget.name}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {pengajuan && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {rejectedVoucher && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Voucher sebelumnya{" "}
                  <span className="font-medium">
                    {rejectedVoucher.kode_voucher}
                  </span>{" "}
                  ditolak.{" "}
                  <Link
                    href={`/petty-cash/voucher/${rejectedVoucher.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
                  >
                    Lihat alasan <ExternalLink className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            )}

            {pengajuan.notes && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <RichContentView content={parseRichValue(pengajuan.notes)} />
              </div>
            )}

            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                Rincian barang
                <span className="text-xs font-normal text-muted-foreground">
                  {pengajuan.items.length} barang
                </span>
              </div>
              <ul className="divide-y">
                {pengajuan.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">
                        {it.part_name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <PcCoaBadge coa={it.coa} />
                        {it.category && (
                          <span className="[overflow-wrap:anywhere]">
                            {it.category}
                          </span>
                        )}
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">
                          {it.qty} {it.uom || ""} ×{" "}
                          {formatCurrency(it.unit_price)}
                        </span>
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(it.subtotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {pengajuan.attachments?.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                {pengajuan.attachments.length} lampiran ikut disalin ke Voucher.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs text-muted-foreground">Total Voucher</p>
            <p className="text-xl font-bold tabular-nums text-primary">
              {formatCurrency(pengajuan?.total_amount ?? 0)}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !userId}>
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              Kirim Voucher
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
