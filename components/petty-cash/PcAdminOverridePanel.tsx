// src/components/petty-cash/PcAdminOverridePanel.tsx
//
// Panel admin LENGKAP (bukan cuma override status/approvals lagi) untuk
// dokumen Petty Cash yang PUNYA jalur approval sendiri (Pengajuan/Voucher/
// Deklarasi - lihat PcAdminSubVoucherPanel.tsx utk Sub-Voucher yang bentuknya
// beda, tidak punya approvals array). Empat kemampuan, disusun dari yang
// paling ringan ke paling berat:
//
//  1. Override Status & Jalur Approval (paling lama ada) - paksa ubah
//     status dokumen & status tiap approver satu-satu, dipakai utk dokumen
//     nyangkut (mis. approver resign). Tetap lewat adminUpdate{Pengajuan,
//     Voucher,Deklarasi} (blanket RLS admin, lihat
//     supabase/petty-cash-admin-management-setup.sql) - TIDAK tercatat ke
//     jejak audit baru (perilaku lama dipertahankan apa adanya).
//  2. Ganti Kode Dokumen - lewat RPC admin_rename_petty_cash_kode. Kalau
//     dokumen ini Voucher, kode Sub-Voucher turunannya OTOMATIS ikut
//     berubah (lihat catatan di bawah tombolnya).
//  3. Edit Paksa - buka PcAdminForceEditDialog (item/tanggal/departemen/
//     company/budget/catatan/lampiran, di status apa pun).
//  4. Hapus Dokumen (Zona Bahaya) - buka PcAdminDeleteDialog, cascade hapus
//     + refund budget lewat admin_delete_petty_cash_document.
//
// Proteksi SEBENARNYA utk (2)-(4) ada di RPC SECURITY DEFINER masing-masing
// (supabase/petty-cash-admin-full-management-setup.sql) - guard render
// `isAdmin` di pemanggil cuma proteksi UI, bukan pengganti RLS/RPC.
//
// `key={docId}` WAJIB dipasang oleh pemanggil supaya state lokal ke-reset
// tiap dokumen yang di-lihat beda (sama pola dgn komponen sejenis lainnya).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Attachment,
  PcDocType,
  PettyCashPengajuanApprover,
  PettyCashPengajuanItem,
} from "@/type";
import {
  PcAdminForceEditDialog,
  PcAdminForceEditValues,
} from "@/components/petty-cash/PcAdminForceEditDialog";
import { PcAdminDeleteDialog } from "@/components/petty-cash/PcAdminDeleteDialog";
import { getDeleteImpactWarning } from "@/services/pettyCashAdminService";
import { toast } from "sonner";
import {
  Loader2,
  PencilLine,
  Save,
  ShieldAlert,
  Tag,
  Trash2,
} from "lucide-react";

const APPROVAL_STATUS_OPTIONS = ["pending", "approved", "rejected"] as const;

interface PcAdminOverridePanelProps {
  docType: Exclude<PcDocType, "sub_voucher">;
  docId: number;
  kode: string;
  status: string;
  approvals: PettyCashPengajuanApprover[];
  statusOptions: readonly string[];
  onSaveStatus: (patch: {
    status: string;
    approvals: PettyCashPengajuanApprover[];
  }) => Promise<void>;

  // Utk dialog Edit Paksa (PcAdminForceEditDialog) - lihat props-nya.
  docLabel: string; // "Pengajuan" | "Voucher" | "Deklarasi"
  showNeededDate?: boolean;
  showBudget?: boolean;
  editInitial: {
    needed_date?: string | Date;
    week_of_month?: number | null;
    site: string | null;
    company_code: string;
    department: string;
    budget_id?: number | null;
    notes: string | null;
    items: PettyCashPengajuanItem[];
    attachments: Attachment[];
  };
  onForceEdit: (edits: PcAdminForceEditValues, reason: string) => Promise<void>;
  onRenameKode: (newKode: string, reason: string) => Promise<void>;
  // Dipanggil SETELAH hapus sukses - pemanggil yang urus navigasi keluar
  // dari halaman ini (dokumennya sudah tidak ada lagi).
  onDelete: (reason: string) => Promise<void>;
}

export function PcAdminOverridePanel({
  docType,
  docId,
  kode,
  status,
  approvals,
  statusOptions,
  onSaveStatus,
  docLabel,
  showNeededDate = true,
  showBudget = false,
  editInitial,
  onForceEdit,
  onRenameKode,
  onDelete,
}: PcAdminOverridePanelProps) {
  const [editStatus, setEditStatus] = useState(status);
  const [editApprovals, setEditApprovals] =
    useState<PettyCashPengajuanApprover[]>(approvals || []);
  const [savingStatus, setSavingStatus] = useState(false);

  const [newKode, setNewKode] = useState(kode);
  const [kodeReason, setKodeReason] = useState("");
  const [savingKode, setSavingKode] = useState(false);

  const [forceEditOpen, setForceEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateApprovalStatus = (
    idx: number,
    val: "pending" | "approved" | "rejected",
  ) => {
    setEditApprovals((prev) =>
      prev.map((app, i) => (i === idx ? { ...app, status: val } : app)),
    );
  };

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    try {
      await onSaveStatus({ status: editStatus, approvals: editApprovals });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveKode = async () => {
    const trimmed = newKode.trim();
    if (!trimmed) return toast.error("Kode baru tidak boleh kosong.");
    if (trimmed === kode)
      return toast.error("Kode baru sama dengan kode saat ini.");
    if (!kodeReason.trim())
      return toast.error("Alasan perubahan kode wajib diisi.");

    setSavingKode(true);
    try {
      await onRenameKode(trimmed, kodeReason.trim());
      toast.success(`Kode berhasil diubah menjadi "${trimmed}".`);
      setKodeReason("");
    } catch (error: any) {
      toast.error("Gagal mengubah kode", { description: error.message });
    } finally {
      setSavingKode(false);
    }
  };

  return (
    <div className="space-y-6 rounded-md border border-amber-300 dark:border-amber-800 p-4 bg-amber-50/50 dark:bg-amber-950/20 print:hidden">
      <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4" /> Kontrol Admin
      </p>

      {/* 1. Override status & approval */}
      <div className="space-y-4">
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
          <Button onClick={handleSaveStatus} disabled={savingStatus} size="sm">
            {savingStatus ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan Override
          </Button>
        </div>
      </div>

      {/* 2. Ganti kode dokumen */}
      <div className="space-y-2 border-t border-amber-200 dark:border-amber-900 pt-4">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Ubah Kode Dokumen
        </p>
        {docType === "voucher" && (
          <p className="text-xs text-muted-foreground italic">
            Mengubah kode Voucher akan otomatis mengubah kode semua
            Sub-Voucher turunannya juga (format &quot;{"{kode}"}-SV
            {"{urutan}"}&quot; tetap konsisten).
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={newKode} onChange={(e) => setNewKode(e.target.value)} />
        </div>
        <Textarea
          value={kodeReason}
          onChange={(e) => setKodeReason(e.target.value)}
          placeholder="Alasan perubahan kode (wajib)"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSaveKode}
            disabled={savingKode}
            size="sm"
            variant="outline"
          >
            {savingKode ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Tag className="mr-2 h-4 w-4" />
            )}
            Simpan Kode Baru
          </Button>
        </div>
      </div>

      {/* 3. Edit paksa */}
      <div className="border-t border-amber-200 dark:border-amber-900 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForceEditOpen(true)}
        >
          <PencilLine className="mr-2 h-4 w-4" /> Edit Paksa Dokumen (Admin)
        </Button>
        <p className="text-xs text-muted-foreground mt-1.5">
          Edit item/tanggal/departemen/company/budget/catatan/lampiran di
          status apa pun - tidak perlu giliran approval.
        </p>
      </div>

      {/* 4. Zona bahaya */}
      <div className="border-t border-destructive/30 pt-4 space-y-2">
        <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Zona Bahaya
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Hapus {docLabel} Ini
        </Button>
      </div>

      <PcAdminForceEditDialog
        open={forceEditOpen}
        onOpenChange={setForceEditOpen}
        docLabel={docLabel}
        kode={kode}
        showNeededDate={showNeededDate}
        showBudget={showBudget}
        initial={editInitial}
        onSubmit={onForceEdit}
      />

      <PcAdminDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        docLabel={docLabel}
        kode={kode}
        impactWarning={getDeleteImpactWarning(docType)}
        onConfirm={onDelete}
      />
    </div>
  );
}
