// components/admin-document-actions/CancelledDocumentNotice.tsx
//
// Banner di halaman detail MR/PO yang dibatalkan lewat "Aksi Admin" - kapan,
// alasan, dan catatan refund (PO yang sudah dibayar). Riwayat lengkapnya di
// log aktivitas dokumen.

import { Ban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFriendly } from "@/lib/utils";

export function CancelledDocumentNotice({
  docLabel,
  cancelledAt,
  reason,
  refundNote,
  className,
}: {
  docLabel: string;
  cancelledAt?: string | null;
  reason?: string | null;
  refundNote?: string | null;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <Ban className="h-4 w-4" />
      <AlertTitle>
        {docLabel} ini dibatalkan admin
        {cancelledAt ? ` pada ${formatDateFriendly(cancelledAt)}` : ""}
      </AlertTitle>
      <AlertDescription>
        {reason && <p>Alasan: {reason}</p>}
        {refundNote && <p>Catatan refund: {refundNote}</p>}
      </AlertDescription>
    </Alert>
  );
}
