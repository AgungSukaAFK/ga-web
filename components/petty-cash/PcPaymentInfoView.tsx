// src/components/petty-cash/PcPaymentInfoView.tsx
//
// Tampilan ringkas Metode Pencairan (ikon + metode + rekening tujuan kalau
// Transfer) - dipakai panel info dokumen, antrian pembayaran Finance, &
// tabel riwayat tarikan. `planned` = masih rencana di Voucher (tarikan
// belum dibayar), ditandai teks kecil supaya tidak dikira sudah final.

import { formatPcBankAccount } from "@/lib/pcPayment";
import { cn } from "@/lib/utils";
import { PcPaymentInfo, PcPaymentMethod } from "@/type";
import { Banknote, Landmark, Repeat, Wallet } from "lucide-react";

const METHOD_ICON: Record<PcPaymentMethod, React.ElementType> = {
  Transfer: Landmark,
  Cash: Banknote,
  Overbook: Repeat,
};

export function PcPaymentInfoView({
  payment,
  planned = false,
  compact = false,
  className,
}: {
  payment: Partial<PcPaymentInfo> | null | undefined;
  planned?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const method = payment?.payment_method ?? null;
  const Icon = method ? METHOD_ICON[method] : Wallet;
  const bank = formatPcBankAccount(payment);

  if (!method) {
    return (
      <span className={cn("text-sm text-muted-foreground italic", className)}>
        Belum dipilih
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-start gap-1.5", className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="font-medium">{method}</span>
        {planned && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            (rencana)
          </span>
        )}
        {bank && (
          <span
            className={cn(
              "block text-muted-foreground [overflow-wrap:anywhere]",
              compact ? "text-xs" : "text-sm font-normal",
            )}
          >
            {bank}
          </span>
        )}
      </span>
    </span>
  );
}
