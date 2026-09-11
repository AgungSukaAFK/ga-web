"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FollowupRequest } from "@/type";
import { requestApprovalFollowup } from "@/services/approvalService";
import { notifyOnApprovalFollowup } from "@/lib/notifications/client";
import { logActivity } from "@/services/logService";
import { formatRelativeTime } from "@/lib/utils";

interface FollowupApprovalButtonProps {
  resourceType: "material_request" | "purchase_order";
  resourceId: number | string;
  kode: string;
  approverId: string;
  approverName: string;
  followups: FollowupRequest[];
  currentUserId: string;
  currentUserName: string;
  onUpdated: (updated: FollowupRequest[]) => void;
}

export function FollowupApprovalButton({
  resourceType,
  resourceId,
  kode,
  approverId,
  approverName,
  followups,
  currentUserId,
  currentUserName,
  onUpdated,
}: FollowupApprovalButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const table =
    resourceType === "material_request"
      ? "material_requests"
      : "purchase_orders";
  const docLabel = resourceType === "material_request" ? "MR" : "PO";

  const myPreviousFollowups = followups
    .filter((f) => f.approver_id === approverId && f.requested_by === currentUserId)
    .sort(
      (a, b) =>
        new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime(),
    );
  const lastMine = myPreviousFollowups[0];

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const updated = await requestApprovalFollowup({
        table,
        resourceId,
        currentFollowups: followups,
        approverId,
        approverName,
        requestedBy: currentUserId,
        requestedByName: currentUserName,
      });

      await logActivity(
        currentUserId,
        resourceType === "material_request"
          ? "REQUEST_FOLLOWUP_MR_APPROVAL"
          : "REQUEST_FOLLOWUP_PO_APPROVAL",
        resourceType,
        String(resourceId),
        `${currentUserName} meminta follow-up approval kepada ${approverName} untuk ${docLabel} ${kode}.`,
        { approver_id: approverId, approver_name: approverName },
      );

      await notifyOnApprovalFollowup({
        actorId: currentUserId,
        actorName: currentUserName,
        approverId,
        kode,
        resourceId,
        resourceType,
      });

      onUpdated(updated);
      toast.success(`Follow-up terkirim ke ${approverName}.`);
      setOpen(false);
    } catch (err: any) {
      toast.error("Gagal mengirim follow-up", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BellRing className="mr-1.5 h-3.5 w-3.5" />
          Follow-up
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Follow-up Approval</AlertDialogTitle>
          <AlertDialogDescription>
            {lastMine ? (
              <>
                Anda sudah meminta follow-up ke <strong>{approverName}</strong>{" "}
                {formatRelativeTime(lastMine.requested_at)}. Ajukan follow-up
                lagi ke {approverName} untuk {docLabel} {kode}?
              </>
            ) : (
              <>
                Kirim notifikasi follow-up ke <strong>{approverName}</strong>{" "}
                supaya segera memproses approval {docLabel} {kode}?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ya, Kirim Follow-up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
