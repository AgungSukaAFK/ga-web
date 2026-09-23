// src/components/petty-cash/PcAdminOverridePanel.tsx
//
// Override status dokumen + jalur approval PAKSA (admin only) - dipindah
// dari dialog PettyCashManagementClient (lihat komentar di file itu) ke
// sini supaya bisa dipakai juga di halaman detail
// petty-cash/{pengajuan,voucher,deklarasi}/[id]/page.tsx. Proteksi
// SEBENARNYA ada di RLS (petty_cash_*_update_admin, lihat
// supabase/petty-cash-admin-management-setup.sql) - guard render `isAdmin`
// di pemanggil cuma proteksi UI, bukan pengganti RLS.
//
// `key={docId}` WAJIB dipasang oleh pemanggil supaya state lokal (editStatus/
// editApprovals) ke-reset tiap dokumen yang di-lihat beda (sama pola dengan
// komponen sejenis lainnya di petty-cash/, lihat PcEditAndApproveDialog).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PettyCashPengajuanApprover } from "@/type";
import { Loader2, Save, ShieldAlert } from "lucide-react";

const APPROVAL_STATUS_OPTIONS = ["pending", "approved", "rejected"] as const;

interface PcAdminOverridePanelProps {
  status: string;
  approvals: PettyCashPengajuanApprover[];
  statusOptions: readonly string[];
  onSave: (patch: {
    status: string;
    approvals: PettyCashPengajuanApprover[];
  }) => Promise<void>;
}

export function PcAdminOverridePanel({
  status,
  approvals,
  statusOptions,
  onSave,
}: PcAdminOverridePanelProps) {
  const [editStatus, setEditStatus] = useState(status);
  const [editApprovals, setEditApprovals] =
    useState<PettyCashPengajuanApprover[]>(approvals || []);
  const [saving, setSaving] = useState(false);

  const updateApprovalStatus = (
    idx: number,
    val: "pending" | "approved" | "rejected",
  ) => {
    setEditApprovals((prev) =>
      prev.map((app, i) => (i === idx ? { ...app, status: val } : app)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ status: editStatus, approvals: editApprovals });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border border-amber-300 dark:border-amber-800 p-4 bg-amber-50/50 dark:bg-amber-950/20 print:hidden">
      <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" /> Override Admin
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Status Dokumen (override)
        </p>
        <Select value={editStatus} onValueChange={setEditStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Jalur Approval (override per approver)
        </p>
        <div className="space-y-1.5">
          {editApprovals.map((app, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-1.5 bg-background"
            >
              <span className="truncate">
                {i + 1}. {app.nama}{" "}
                <span className="text-xs text-muted-foreground">
                  ({app.department})
                </span>
              </span>
              <Select
                value={app.status}
                onValueChange={(v) =>
                  updateApprovalStatus(
                    i,
                    v as "pending" | "approved" | "rejected",
                  )
                }
              >
                <SelectTrigger className="w-[130px] h-8 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {editApprovals.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Belum ada jalur approval tercatat.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Simpan Override
        </Button>
      </div>
    </div>
  );
}
