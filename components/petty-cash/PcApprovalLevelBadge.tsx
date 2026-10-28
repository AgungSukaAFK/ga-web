// src/components/petty-cash/PcApprovalLevelBadge.tsx
//
// Badge kecil level approver Petty Cash (Dicek/Disetujui/Dijalankan Oleh,
// lihat PcApprovalLevel di type/index.ts) - dipakai di daftar jalur approval
// (PcDocumentInfoPanel, halaman Template Approval, halaman verifikasi QR).
// Ambil level-nya lewat getPcApprovalLevel (lib/pcApprovalFlow.ts) supaya
// dokumen lama tanpa level tetap dapat label fallback.

import { Badge } from "@/components/ui/badge";
import { PcApprovalLevel } from "@/type";
import { PC_APPROVAL_LEVEL_COLORS } from "@/type/enum";

export function PcApprovalLevelBadge({ level }: { level: PcApprovalLevel }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-normal whitespace-nowrap ${PC_APPROVAL_LEVEL_COLORS[level] || ""}`}
    >
      {level}
    </Badge>
  );
}
