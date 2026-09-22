// src/components/petty-cash/PcApprovalActions.tsx
//
// Tiga tombol aksi approval Petty Cash - Tolak / Setujui Langsung / Edit &
// Setujui - dipakai bareng oleh ApprovalPengajuanClient, ApprovalVoucherClient,
// dan ApprovalDeklarasiClient. Render HANYA tombol-tombolnya (dipasang di
// dalam DialogFooter pemanggil) - dialog alasan penolakan & dialog edit
// dirender sebagai sibling (portal, jadi tidak masalah posisinya di DOM).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PcEditAndApproveDialog,
  PcEditAndApproveEdits,
} from "@/components/petty-cash/PcEditAndApproveDialog";
import { Attachment, PettyCashPengajuanItem } from "@/type";
import { CheckCircle2, Loader2, PencilLine, XCircle } from "lucide-react";

interface PcApprovalActionsProps {
  docLabel: string;
  kode: string;
  companyCode: string;
  showNeededDate?: boolean;
  editInitial: {
    needed_date?: string | Date;
    week_of_month?: number | null;
    notes: string | null;
    items: PettyCashPengajuanItem[];
    attachments: Attachment[];
  };
  processing: boolean;
  onApprove: () => Promise<void> | void;
  onReject: (reason: string) => Promise<void> | void;
  onEditAndApprove: (edits: PcEditAndApproveEdits) => Promise<void> | void;
}

export function PcApprovalActions({
  docLabel,
  kode,
  companyCode,
  showNeededDate = true,
  editInitial,
  processing,
  onApprove,
  onReject,
  onEditAndApprove,
}: PcApprovalActionsProps) {
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const submitReject = async () => {
    if (!rejectReason.trim()) return;
    await onReject(rejectReason);
    setIsRejectOpen(false);
    setRejectReason("");
  };

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setIsRejectOpen(true)}
        disabled={processing}
      >
        <XCircle className="mr-2 h-4 w-4" /> Tolak
      </Button>
      <Button
        variant="outline"
        onClick={() => setIsEditOpen(true)}
        disabled={processing}
      >
        <PencilLine className="mr-2 h-4 w-4" /> Edit & Setujui
      </Button>
      <Button onClick={() => onApprove()} disabled={processing}>
        {processing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Setujui Langsung
      </Button>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak {docLabel}</DialogTitle>
            <DialogDescription>
              Jelaskan alasan penolakan - requester akan melihat catatan ini.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Contoh: Nominal terlalu besar untuk kebutuhan ini..."
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRejectOpen(false)}
              disabled={processing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tolak {docLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PcEditAndApproveDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        docLabel={docLabel}
        kode={kode}
        companyCode={companyCode}
        showNeededDate={showNeededDate}
        initial={editInitial}
        onSubmit={onEditAndApprove}
      />
    </>
  );
}
