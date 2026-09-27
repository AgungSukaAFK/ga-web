// src/components/petty-cash/PcAdminSubVoucherPanel.tsx
//
// Panel admin utk Sub-Voucher (Tarikan Dana) - BARU, Sub-Voucher sebelumnya
// SAMA SEKALI tidak punya kontrol admin apa pun (tidak ada policy RLS
// update/delete langsung, satu-satunya jalan masuk cuma RPC
// create_petty_cash_sub_voucher & mark_petty_cash_sub_voucher_paid - lihat
// komentar PettyCashSubVoucher, type/index.ts). Beda dari
// PcAdminOverridePanel.tsx (Pengajuan/Voucher/Deklarasi, yang punya jalur
// approval sendiri buat di-override), Sub-Voucher TIDAK punya approvals
// array (persetujuannya sudah ada di level Voucher induk) - jadi panel ini
// LEBIH SEMPIT, tiga kemampuan:
//
//  1. Ubah Kode - lewat admin_rename_petty_cash_kode (docType "sub_voucher",
//     tidak ada cascade lebih lanjut - beda dari rename kode_voucher yang
//     mencascade ke sini).
//  2. Edit Paksa - buka PcAdminForceEditSubVoucherDialog (qty/harga per
//     baris + status + catatan, selisih nominal direkonsiliasi ke Budget).
//  3. Hapus (Zona Bahaya) - cascade hapus Deklarasi turunannya + refund
//     nominal ke Budget + downgrade status "Selesai" Voucher induk kalau
//     relevan (lihat admin_delete_petty_cash_document).
//
// Proteksi SEBENARNYA ada di RPC SECURITY DEFINER masing-masing (lihat
// supabase/petty-cash-admin-full-management-setup.sql) - guard render
// `isAdmin` di pemanggil cuma proteksi UI.
//
// `key={docId}` WAJIB dipasang oleh pemanggil, sama seperti
// PcAdminOverridePanel.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PettyCashSubVoucherItem } from "@/type";
import {
  PcAdminForceEditSubVoucherDialog,
  PcAdminForceEditSubVoucherValues,
} from "@/components/petty-cash/PcAdminForceEditSubVoucherDialog";
import { PcAdminDeleteDialog } from "@/components/petty-cash/PcAdminDeleteDialog";
import { getDeleteImpactWarning } from "@/services/pettyCashAdminService";
import { toast } from "sonner";
import { Loader2, PencilLine, ShieldAlert, Tag, Trash2 } from "lucide-react";

interface PcAdminSubVoucherPanelProps {
  docId: number;
  kode: string;
  status: string;
  notes: string | null;
  items: PettyCashSubVoucherItem[];
  onForceEdit: (
    edits: PcAdminForceEditSubVoucherValues,
    reason: string,
  ) => Promise<void>;
  onRenameKode: (newKode: string, reason: string) => Promise<void>;
  onDelete: (reason: string) => Promise<void>;
}

export function PcAdminSubVoucherPanel({
  docId,
  kode,
  status,
  notes,
  items,
  onForceEdit,
  onRenameKode,
  onDelete,
}: PcAdminSubVoucherPanelProps) {
  const [newKode, setNewKode] = useState(kode);
  const [kodeReason, setKodeReason] = useState("");
  const [savingKode, setSavingKode] = useState(false);

  const [forceEditOpen, setForceEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Ubah Kode Dokumen
        </p>
        <Input value={newKode} onChange={(e) => setNewKode(e.target.value)} />
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

      <div className="border-t border-amber-200 dark:border-amber-900 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForceEditOpen(true)}
        >
          <PencilLine className="mr-2 h-4 w-4" /> Edit Paksa Sub-Voucher
        </Button>
        <p className="text-xs text-muted-foreground mt-1.5">
          Sesuaikan qty/harga per baris & status pembayaran - selisih nominal
          otomatis direkonsiliasi ke Budget terkait.
        </p>
      </div>

      <div className="border-t border-destructive/30 pt-4 space-y-2">
        <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Zona Bahaya
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Hapus Sub-Voucher Ini
        </Button>
      </div>

      <PcAdminForceEditSubVoucherDialog
        open={forceEditOpen}
        onOpenChange={setForceEditOpen}
        kode={kode}
        initial={{ items, notes, status }}
        onSubmit={onForceEdit}
      />

      <PcAdminDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        docLabel="Sub-Voucher"
        kode={kode}
        impactWarning={getDeleteImpactWarning("sub_voucher")}
        onConfirm={onDelete}
      />
    </div>
  );
}
