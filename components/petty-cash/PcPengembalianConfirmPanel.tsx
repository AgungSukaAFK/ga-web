// src/components/petty-cash/PcPengembalianConfirmPanel.tsx
//
// Panel "Konfirmasi Pengembalian Dana" (Finance/admin only) - dipakai dialog
// antrian di halaman Approval Petty Cash (ApprovalPettyCashClient.tsx, sesi
// "Konfirmasi Pengembalian Dana"). Finance mengecek bukti setor dari
// requester lalu Konfirmasi (budget bertambah) atau Tolak (wajib alasan,
// budget tidak berubah). Hak akses & status dicek ulang di RPC
// confirm/reject_petty_cash_pengembalian - ini cuma tampilan.
//
// `key={pengembalian.id}` WAJIB dipasang oleh pemanggil supaya state lokal
// (mode tolak & alasannya) ke-reset tiap pengembalian yang dilihat beda.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { PettyCashPengembalian } from "@/type";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

interface PcPengembalianConfirmPanelProps {
  pengembalian: PettyCashPengembalian;
  processing: boolean;
  onConfirm: () => Promise<void> | void;
  onReject: (reason: string) => Promise<void> | void;
}

export function PcPengembalianConfirmPanel({
  pengembalian,
  processing,
  onConfirm,
  onReject,
}: PcPengembalianConfirmPanelProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const rows: [string, string][] = [
    ["Pemohon", pengembalian.users_with_profiles?.nama || "-"],
    ["Departemen", pengembalian.petty_cash_voucher?.department || "-"],
    [
      "Dari Tarikan",
      `${pengembalian.petty_cash_sub_voucher?.kode_sub_voucher || "-"} (${formatCurrency(
        pengembalian.petty_cash_sub_voucher?.amount ?? 0,
      )})`,
    ],
    ["Voucher", pengembalian.petty_cash_voucher?.kode_voucher || "-"],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-end">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Nominal Dikembalikan</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(pengembalian.amount)}
          </p>
        </div>
      </div>

      {pengembalian.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Catatan</p>
          <p className="text-sm whitespace-pre-wrap">{pengembalian.notes}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Bukti Setor/Transfer
        </p>
        <div className="grid gap-2">
          {(pengembalian.attachments ?? []).map((file, i) => (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline p-2 border rounded-md bg-background truncate block"
            >
              {file.name}
            </a>
          ))}
        </div>
      </div>

      {rejecting && (
        <div className="space-y-2">
          <Label>
            Alasan Penolakan <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Misal: dana belum masuk ke rekening, nominal tidak sesuai bukti..."
            rows={2}
            autoFocus
          />
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {rejecting ? (
          <>
            <Button
              variant="ghost"
              onClick={() => setRejecting(false)}
              disabled={processing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => onReject(reason)}
              disabled={processing || !reason.trim()}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Tolak Pengembalian
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setRejecting(true)}
              disabled={processing}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Tolak
            </Button>
            <Button onClick={() => onConfirm()} disabled={processing}>
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Konfirmasi Dana Diterima
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
