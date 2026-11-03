// components/admin-document-actions/ClosedRemainderNotice.tsx
//
// Banner di halaman detail PO yang sisanya ditutup lewat "Aksi Admin > Tutup
// Sisa" - barang apa saja yang tidak dikirim, alasan, catatan refund. Riwayat
// lengkapnya di log aktivitas dokumen.

import { PackageX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { PoClosedRemainder } from "@/type";

export function ClosedRemainderNotice({
  closed,
  className,
}: {
  closed: PoClosedRemainder;
  className?: string;
}) {
  return (
    <Alert className={className}>
      <PackageX className="h-4 w-4" />
      <AlertTitle>
        Sisa PO ini ditutup admin
        {closed.closed_by_name ? ` (${closed.closed_by_name})` : ""}
        {closed.closed_at ? ` pada ${formatDateFriendly(closed.closed_at)}` : ""}
      </AlertTitle>
      <AlertDescription>
        <p>
          Tidak dikirim:{" "}
          {closed.items
            .map((i) => `${i.name} ${i.closed_qty} dari ${i.ordered_qty}`)
            .join(", ")}{" "}
          - senilai {formatCurrency(closed.closed_value)}.
        </p>
        <p>
          Sisa di MR:{" "}
          {closed.mr_mode === "reorder" ? "dipesan ulang" : "ikut ditutup"}.
        </p>
        {closed.reason && <p>Alasan: {closed.reason}</p>}
        {closed.refund_note && <p>Catatan refund / tagihan: {closed.refund_note}</p>}
      </AlertDescription>
    </Alert>
  );
}
