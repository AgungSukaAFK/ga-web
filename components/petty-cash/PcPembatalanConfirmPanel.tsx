// src/components/petty-cash/PcPembatalanConfirmPanel.tsx
//
// Panel "Permintaan Pembatalan" (Finance/admin only) - dipakai dialog antrian
// di halaman Approval Petty Cash (ApprovalPettyCashClient.tsx, sesi
// "Permintaan Pembatalan"). Menampilkan alasan pemohon + DAMPAK kalau
// disetujui (Voucher & tarikan belum dibayar yang ikut dibatalkan, total
// budget yang di-refund), lalu Setujui (catatan opsional) atau Tolak (wajib
// alasan). Hak akses & syarat dicek ulang di RPC approve/reject_petty_cash_pembatalan.
//
// `key={pembatalan.id}` WAJIB dipasang pemanggil supaya state lokal (mode
// tolak & catatannya) ke-reset tiap permintaan yang dilihat beda - sama pola
// dgn PcPengembalianConfirmPanel.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { toEmbedArray } from "@/lib/pcChain";
import { PettyCashPembatalan } from "@/type";
import { PcEskalasiBadge } from "./PcEskalasiBadge";
import { Ban, Loader2, XCircle } from "lucide-react";

interface PcPembatalanConfirmPanelProps {
  pembatalan: PettyCashPembatalan;
  processing: boolean;
  onApprove: (note: string) => Promise<void> | void;
  onReject: (reason: string) => Promise<void> | void;
}

export function PcPembatalanConfirmPanel({
  pembatalan,
  processing,
  onApprove,
  onReject,
}: PcPembatalanConfirmPanelProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const pengajuan = pembatalan.petty_cash_pengajuan;
  const vouchers = toEmbedArray(pengajuan?.petty_cash_voucher).filter(
    (v) => v.status !== "Rejected" && v.status !== "Dibatalkan",
  );
  const unpaid = vouchers.flatMap((v) =>
    toEmbedArray(v.petty_cash_sub_voucher).filter(
      (sv) => sv.status === "Menunggu Pembayaran",
    ),
  );
  const paid = vouchers.flatMap((v) =>
    toEmbedArray(v.petty_cash_sub_voucher).filter(
      (sv) => sv.status === "Selesai",
    ),
  );
  const refund = unpaid.reduce((sum, sv) => sum + Number(sv.amount), 0);

  const rows: [string, React.ReactNode][] = [
    ["Pemohon", pembatalan.users_with_profiles?.nama || "-"],
    [
      "Pengajuan",
      <span key="pj" className="inline-flex flex-wrap items-center gap-1.5">
        {pengajuan?.kode_pengajuan || "-"}
        <PcEskalasiBadge show={pengajuan?.is_eskalasi} />
      </span>,
    ],
    ["Status Saat Ini", pengajuan?.status || "-"],
    ["Departemen", pengajuan?.department || "-"],
    ["Total Pengajuan", formatCurrency(pengajuan?.total_amount ?? 0)],
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

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Alasan Pemohon
        </p>
        <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/40 p-2">
          {pembatalan.reason}
        </p>
      </div>

      {paid.length > 0 ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Sudah ada {paid.length} tarikan yang dibayar - Pengajuan ini tidak
          bisa dibatalkan lagi. Tolak permintaan ini; dana yang sudah cair
          diselesaikan lewat Deklarasi/Pengembalian Dana.
        </p>
      ) : (
        <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
          <p className="font-medium">Kalau disetujui:</p>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
            <li>Pengajuan {pengajuan?.kode_pengajuan} jadi &quot;Dibatalkan&quot;.</li>
            {vouchers.map((v) => (
              <li key={v.id}>Voucher {v.kode_voucher} jadi &quot;Dibatalkan&quot;.</li>
            ))}
            {unpaid.length > 0 ? (
              <li>
                {unpaid.length} tarikan belum dibayar (
                {unpaid.map((sv) => sv.kode_sub_voucher).join(", ")}) ikut
                dibatalkan, {formatCurrency(refund)} dikembalikan ke budget.
              </li>
            ) : (
              <li>Belum ada tarikan dana - tidak ada budget yang perlu di-refund.</li>
            )}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label>
          {rejecting ? (
            <>
              Alasan Penolakan <span className="text-destructive">*</span>
            </>
          ) : (
            "Catatan Finance (opsional)"
          )}
        </Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            rejecting
              ? "Misal: kegiatan tetap berjalan, dana sudah dijadwalkan..."
              : "Catatan untuk pemohon..."
          }
          rows={2}
        />
      </div>

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
              onClick={() => onReject(note)}
              disabled={processing || !note.trim()}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Tolak Pembatalan
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
            <Button
              variant="destructive"
              onClick={() => onApprove(note)}
              disabled={processing || paid.length > 0}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Setujui Pembatalan
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
