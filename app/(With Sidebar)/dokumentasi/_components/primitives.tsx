// Primitif kecil yang dipakai berulang di halaman Dokumentasi: badge status
// (warnanya disamakan dengan badge di halaman detail MR/PO/Petty Cash supaya
// yang dilihat user di sini = yang dilihat di aplikasi), badge peran, dan
// "jendela" mock UI untuk visual tiap langkah stepper.

import { cn } from "@/lib/utils";
import {
  MR_ITEM_STATUS_COLORS,
  PC_PEMBATALAN_STATUS_COLORS,
  PC_PENGEMBALIAN_STATUS_COLORS,
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLORS,
} from "@/type/enum";
import {
  ArrowRight,
  Banknote,
  Building2,
  Cpu,
  PackageCheck,
  ShoppingCart,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// STATUS
// ---------------------------------------------------------------------------

const SOLID = "border-transparent text-white";

// Warna status dokumen MR & PO - ngikut getStatusBadge di
// material-request/[id]/page.tsx & purchase-order/[id]/page.tsx.
const DOC_STATUS_COLORS: Record<string, string> = {
  "Pending Validation": "border-transparent bg-secondary text-secondary-foreground",
  "Pending Approval": "border-transparent bg-secondary text-secondary-foreground",
  "On Hold": `${SOLID} bg-orange-500`,
  "Waiting PO": `${SOLID} bg-blue-500`,
  "On Process": `${SOLID} bg-cyan-500`,
  "Pending Payment": `${SOLID} bg-orange-500`,
  "Pending Receive": `${SOLID} bg-yellow-500`,
  "Partial Receive": `${SOLID} bg-amber-600`,
  "Full Received": `${SOLID} bg-green-500`,
  Rejected: "border-transparent bg-destructive text-destructive-foreground dark:bg-destructive/60",
};

const PC_STATUS_COLORS: Record<string, string> = {
  ...PC_PENGEMBALIAN_STATUS_COLORS,
  ...PC_PEMBATALAN_STATUS_COLORS,
  ...PC_VOUCHER_STATUS_COLORS,
  ...PC_SUB_VOUCHER_STATUS_COLORS,
};

export type StatusDomain = "doc" | "item" | "pc";

export function StatusPill({
  status,
  label,
  domain = "doc",
  className,
}: {
  status: string;
  label?: string;
  domain?: StatusDomain;
  className?: string;
}) {
  const color =
    domain === "item"
      ? MR_ITEM_STATUS_COLORS[status]
      : domain === "pc"
        ? PC_STATUS_COLORS[status]
        : DOC_STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold",
        color ?? "bg-muted text-foreground",
        className,
      )}
    >
      {label ?? status}
    </span>
  );
}

/** "Status A → Status B" - status tujuan muncul dengan animasi pop. */
export function StatusTransition({
  from,
  to,
  domain = "doc",
}: {
  from?: string;
  to: string;
  domain?: StatusDomain;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {from && (
        <>
          <StatusPill status={from} domain={domain} className="opacity-60" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      <span className="docs-pop" style={{ animationDelay: "0.35s" }}>
        <StatusPill status={to} domain={domain} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PERAN
// ---------------------------------------------------------------------------

export type RoleId =
  | "requester"
  | "approver"
  | "ga"
  | "purchasing"
  | "receiver"
  | "finance"
  | "admin"
  | "system";

export const ROLE_META: Record<
  RoleId,
  { label: string; icon: React.ElementType; color: string; dot: string }
> = {
  requester: {
    label: "Requester",
    icon: User,
    color:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
    dot: "bg-sky-500",
  },
  approver: {
    label: "Approver",
    icon: UserCheck,
    color:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  ga: {
    label: "General Affair",
    icon: Building2,
    color:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  purchasing: {
    label: "Purchasing",
    icon: ShoppingCart,
    color:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
    dot: "bg-indigo-500",
  },
  receiver: {
    label: "Receiver",
    icon: PackageCheck,
    color:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  finance: {
    label: "Finance",
    icon: Banknote,
    color:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    color:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    dot: "bg-red-500",
  },
  system: {
    label: "Sistem (otomatis)",
    icon: Cpu,
    color:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    dot: "bg-gray-400",
  },
};

export function RoleChip({
  role,
  className,
}: {
  role: RoleId;
  className?: string;
}) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.color,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MOCK UI
// ---------------------------------------------------------------------------

/** Bingkai "jendela aplikasi" untuk mock UI di tiap langkah. */
export function MockWindow({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-sm",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="space-y-3 p-4 text-xs">{children}</div>
    </div>
  );
}

/** Field form tiruan (label + kotak isi). */
export function MockField({
  label,
  value,
  highlight,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  delay?: number;
}) {
  return (
    <div className="docs-fade-up space-y-1" style={{ animationDelay: `${delay}s` }}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "rounded-md border bg-card px-2.5 py-1.5",
          highlight && "border-primary ring-2 ring-primary/20",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Tombol tiruan yang "berdenyut" supaya kelihatan sebagai aksi utama. */
export function MockButton({
  children,
  variant = "primary",
  pulse,
  delay = 0,
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "danger";
  pulse?: boolean;
  delay?: number;
}) {
  return (
    <span
      className={cn(
        "docs-fade-up inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "outline" && "border bg-background",
        variant === "danger" && "bg-destructive text-destructive-foreground dark:bg-destructive/60",
        pulse && "docs-ring",
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </span>
  );
}
