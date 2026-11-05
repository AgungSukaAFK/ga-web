"use client";

import { ReactNode, RefObject, useEffect, useId, useRef, useState } from "react";
import { BellRing, Check, Loader2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatDateWithTime } from "@/lib/utils";
import { Approval } from "@/type";

export interface ApprovalDecision {
  docLabel: "MR" | "PO";
  kode: string;
  approveLabel: string;
  rejectLabel: string;
  loading: boolean;
  // Setujui membuka form sendiri (bukti bayar, checklist barang), jadi tidak perlu
  // dialog konfirmasi lagi.
  approveOpensForm?: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}

// Warna yang sama di banner, kartu Tindakan, dan bar mengambang - supaya ketiganya
// terbaca sebagai satu hal yang sama: giliran user ini.
export const APPROVAL_TURN_RING = "ring-2 ring-amber-400 dark:ring-amber-600";

const REJECTION_NOTE_MAX_LENGTH = 500;

// Baris satu approver di kartu Jalur Approval. Nama diberi satu baris penuh karena
// sering berupa email tanpa spasi, jadi badge status ada di baris departemen.
export const ApprovalStepHeader = ({
  approver,
  statusBadge,
}: {
  approver: Approval;
  statusBadge: ReactNode;
}) => (
  <div className="flex items-start gap-2">
    <UserAvatar
      userId={approver.userid}
      name={approver.nama}
      className="h-9 w-9"
      fallbackClassName="text-xs"
    />
    <div className="min-w-0 flex-1 space-y-1">
      <p className="font-semibold [overflow-wrap:anywhere]">{approver.nama}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="max-w-full whitespace-normal">
          {approver.department}
        </Badge>
        <div className="ml-auto">{statusBadge}</div>
      </div>
      <p className="text-sm text-muted-foreground">{approver.type}</p>
      {approver.status !== "pending" && approver.processed_at && (
        <p className="text-xs text-muted-foreground italic">
          {formatDateWithTime(approver.processed_at)}
        </p>
      )}
      {approver.status === "rejected" && approver.rejection_note && (
        <p className="whitespace-pre-line text-sm text-red-700 [overflow-wrap:anywhere] dark:text-red-400">
          Catatan: {approver.rejection_note}
        </p>
      )}
    </div>
  </div>
);

export const ApprovalTurnBadge = () => (
  <Badge className="bg-amber-500 text-white hover:bg-amber-500">Giliran Anda</Badge>
);

export const ApprovalDecisionButtons = ({
  decision,
  className,
}: {
  decision: ApprovalDecision;
  className?: string;
}) => {
  const { docLabel, kode, approveLabel, rejectLabel, loading } = decision;
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const noteFieldId = useId();
  const isRejecting = confirming === "reject";

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Button
        className="bg-emerald-600 text-white hover:bg-emerald-700"
        onClick={() =>
          decision.approveOpensForm ? decision.onApprove() : setConfirming("approve")
        }
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-2 h-4 w-4" />
        )}
        {approveLabel}
      </Button>
      <Button
        variant="destructive"
        onClick={() => {
          setRejectionNote("");
          setConfirming("reject");
        }}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="mr-2 h-4 w-4" />
        )}
        {rejectLabel}
      </Button>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRejecting ? "Tolak" : "Setujui"} {docLabel} ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRejecting
                ? `${docLabel} ${kode} akan ditolak dan alurnya berhenti di sini. Pembuatnya akan mendapat notifikasi.`
                : `${docLabel} ${kode} akan disetujui dan lanjut ke tahap berikutnya.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isRejecting && (
            <div className="space-y-2">
              <Label htmlFor={noteFieldId}>Catatan penolakan (opsional)</Label>
              <Textarea
                id={noteFieldId}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                maxLength={REJECTION_NOTE_MAX_LENGTH}
                placeholder="Tulis alasan supaya pembuatnya tahu apa yang perlu diperbaiki"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={
                isRejecting
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
              onClick={() =>
                isRejecting
                  ? decision.onReject(rejectionNote.trim())
                  : decision.onApprove()
              }
            >
              Ya, {isRejecting ? "tolak" : "setujui"} {docLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Ruang di akhir halaman supaya bar mengambang tidak menutupi konten terakhir.
export const ApprovalTurnSpacer = () => (
  <div aria-hidden className="no-print col-span-12 h-16" />
);

// True selama salah satu elemen masih terlihat di layar.
const useAnyVisible = (refs: RefObject<HTMLElement | null>[]) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const seen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target);
        else seen.delete(entry.target);
      }
      setIsVisible(seen.size > 0);
    });
    for (const ref of refs) {
      if (ref.current) observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  return isVisible;
};

/**
 * Banner "Giliran Anda" di atas halaman, plus bar mengambang yang muncul begitu
 * banner dan tombol di kartu Tindakan (`actionsRef`) sama-sama keluar layar.
 * Jadi approver yang sedang memeriksa isi dokumen tidak perlu scroll balik.
 */
export const ApprovalTurnPrompt = ({
  title,
  hint,
  decision,
  actionsRef,
  className,
}: {
  title: string;
  hint: string;
  decision: ApprovalDecision;
  actionsRef: RefObject<HTMLElement | null>;
  className?: string;
}) => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const isButtonOnScreen = useAnyVisible([bannerRef, actionsRef]);

  return (
    <>
      <div
        ref={bannerRef}
        className={cn(
          "no-print flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/40",
          APPROVAL_TURN_RING,
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <BellRing className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{title}</p>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
        </div>
        <ApprovalDecisionButtons decision={decision} className="shrink-0 sm:w-72" />
      </div>

      {!isButtonOnScreen && (
        <div
          className={cn(
            "no-print fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2",
            "md:left-[calc(var(--sidebar-width)+1rem)] md:group-has-data-[collapsible=icon]/sidebar-wrapper:left-[calc(var(--sidebar-width-icon)+1rem)]",
          )}
        >
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-2 shadow-lg sm:pl-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="hidden min-w-0 flex-1 text-sm font-medium sm:block">
              Giliran Anda: {decision.docLabel} {decision.kode}
            </p>
            <ApprovalDecisionButtons
              decision={decision}
              className="flex-1 sm:w-72 sm:flex-none"
            />
          </div>
        </div>
      )}
    </>
  );
};
