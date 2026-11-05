import { ShieldAlert } from "lucide-react";
import { OverrideApprovalStep, getAdminActionNote } from "@/lib/approvalOverride";
import { cn } from "@/lib/utils";

// Keterangan di bawah nama approver kalau step-nya diproses admin. `span`
// supaya aman dipakai di dalam baris/sel mana pun.
export const AdminApprovalNote = ({
  step,
  className,
}: {
  step: OverrideApprovalStep;
  className?: string;
}) => {
  const note = getAdminActionNote(step);
  if (!note) return null;
  return (
    <span
      className={cn(
        "flex items-start gap-1 text-xs font-medium text-amber-700 [overflow-wrap:anywhere] dark:text-amber-400",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      {note}
    </span>
  );
};
