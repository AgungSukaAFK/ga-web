// src/components/petty-cash/PcAdminDeleteDialog.tsx
//
// Konfirmasi HAPUS BERANTAI dokumen Petty Cash (admin only) - dipakai dari
// panel override di halaman detail (PcAdminOverridePanel/
// PcAdminSubVoucherPanel) MAUPUN tombol hapus cepat di tabel Management
// Petty Cash (PettyCashManagementClient.tsx). Proteksi SEBENARNYA ada di RPC
// `admin_delete_petty_cash_document` (lihat
// supabase/petty-cash-admin-full-management-setup.sql) - dialog ini cuma
// mengumpulkan alasan & mencegah klik tidak sengaja (wajib ketik ulang kode
// dokumennya persis, sama pola "type to confirm" yang umum dipakai utk aksi
// destruktif tidak bisa di-undo).
//
// Sengaja pakai <Dialog> biasa (BUKAN <AlertDialog>) - aksi di sini bisa
// GAGAL (mis. bukan admin, alasan kosong) & perlu ditampilkan sbg toast
// tanpa dialog ikut ketutup duluan, sama pola dgn semua dialog form lain di
// petty-cash/ (PcEditAndApproveDialog dkk.), bukan pola ConfirmDialog/
// AlertDialogAction yang auto-close begitu diklik.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface PcAdminDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docLabel: string; // "Pengajuan" | "Voucher" | "Sub-Voucher" | "Deklarasi"
  kode: string;
  impactWarning: string;
  onConfirm: (reason: string) => Promise<void>;
}

export function PcAdminDeleteDialog({
  open,
  onOpenChange,
  docLabel,
  kode,
  impactWarning,
  onConfirm,
}: PcAdminDeleteDialogProps) {
  const [confirmKode, setConfirmKode] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const kodeMatches = confirmKode.trim() === kode;

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      setConfirmKode("");
      setReason("");
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!kodeMatches) {
      return toast.error("Kode konfirmasi belum cocok", {
        description: `Ketik ulang persis "${kode}" untuk melanjutkan.`,
      });
    }
    if (!reason.trim()) {
      return toast.error("Alasan penghapusan wajib diisi");
    }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      handleClose(false);
    } catch (error: any) {
      toast.error("Gagal menghapus dokumen", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Hapus {docLabel} - {kode}
          </DialogTitle>
          <DialogDescription>
            Tindakan ini PERMANEN dan tidak bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{impactWarning}</p>
          </div>

          <div className="space-y-2">
            <Label>
              Ketik <span className="font-mono font-semibold">{kode}</span>{" "}
              untuk konfirmasi
            </Label>
            <Input
              value={confirmKode}
              onChange={(e) => setConfirmKode(e.target.value)}
              placeholder={kode}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Alasan Penghapusan (wajib)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan kenapa dokumen ini perlu dihapus - tercatat permanen di jejak audit admin."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !kodeMatches || !reason.trim()}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
