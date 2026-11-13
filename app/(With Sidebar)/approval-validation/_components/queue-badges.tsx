"use client";

import {
  AlarmClock,
  BellRing,
  CalendarClock,
  Hourglass,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  KIND_META,
  PRIORITY_LABELS,
  STALE_DAYS,
  dueLabel,
  type Priority,
  type QueueItem,
  type QueueKind,
} from "../_lib/queue";

const PRIORITY_CLASS: Record<Priority, string> = {
  P0: "border-red-500 text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/40",
  P1: "border-orange-500 text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/40",
  P2: "border-yellow-500 text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/40",
  P3: "border-green-500 text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/40",
  P4: "border-border text-muted-foreground bg-muted",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority | null;
  className?: string;
}) {
  if (!priority)
    return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Badge
      variant="outline"
      title={PRIORITY_LABELS[priority]}
      className={cn(
        "px-1.5 py-0 font-semibold tabular-nums",
        PRIORITY_CLASS[priority],
        className,
      )}
    >
      {priority}
    </Badge>
  );
}

const KIND_CLASS: Record<QueueKind, string> = {
  "mr-validation":
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  "po-validation":
    "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  "mr-approval":
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "po-approval":
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  "po-receive":
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export function KindBadge({
  kind,
  className,
}: {
  kind: QueueKind;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[10px] font-medium whitespace-nowrap",
        KIND_CLASS[kind],
        className,
      )}
    >
      {KIND_META[kind].label}
    </Badge>
  );
}

/** Teks jatuh tempo berwarna: merah lewat, oranye <= 3 hari. */
export function DueText({
  item,
  className,
}: {
  item: Pick<QueueItem, "daysToDue" | "flags">;
  className?: string;
}) {
  const label = dueLabel(item.daysToDue);
  if (!label) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span
      className={cn(
        "text-xs font-medium whitespace-nowrap",
        item.flags.overdue
          ? "text-red-600 dark:text-red-400"
          : item.flags.dueSoon
            ? "text-orange-600 dark:text-orange-400"
            : "text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Ikon kecil untuk penanda yang perlu diperhatikan (dengan title). */
export function FlagIcons({ item }: { item: QueueItem }) {
  const { flags } = item;
  const icons: { key: string; title: string; node: React.ReactNode }[] = [];
  if (flags.overdue)
    icons.push({
      key: "overdue",
      title: "Lewat jatuh tempo",
      node: <AlarmClock className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
    });
  else if (flags.dueSoon)
    icons.push({
      key: "due",
      title: "Jatuh tempo ≤ 3 hari",
      node: (
        <CalendarClock className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
      ),
    });
  if (flags.overBudget)
    icons.push({
      key: "budget",
      title: "Estimasi melebihi sisa budget cost center",
      node: <Wallet className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
    });
  if (flags.followups > 0)
    icons.push({
      key: "followup",
      title: `Sudah di-follow-up ${flags.followups}x`,
      node: (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <BellRing className="h-3.5 w-3.5" />
          {flags.followups}
        </span>
      ),
    });
  if (flags.stale)
    icons.push({
      key: "stale",
      title: `Menunggu lebih dari ${STALE_DAYS} hari`,
      node: (
        <Hourglass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      ),
    });
  if (!icons.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {icons.map((i) => (
        <span key={i.key} title={i.title} aria-label={i.title} role="img">
          {i.node}
        </span>
      ))}
    </span>
  );
}

export function FreshBadge() {
  return (
    <Badge className="animate-in fade-in zoom-in-95 bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
      Baru
    </Badge>
  );
}
