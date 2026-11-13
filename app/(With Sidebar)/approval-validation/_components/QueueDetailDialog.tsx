"use client";

import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  CircleDashed,
  Clock,
  Eye,
  FileText,
  Hourglass,
  Info,
  Layers,
  Link2,
  MapPin,
  Paperclip,
  Receipt,
  Store,
  Tag,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import {
  cn,
  formatCurrency,
  formatDateWithTime,
  formatRelativeTime,
} from "@/lib/utils";
import {
  KIND_META,
  PRIORITY_LABELS,
  STALE_DAYS,
  approvalStepLabel,
  dueLabel,
  waitingLabel,
  type QueueItem,
} from "../_lib/queue";
import { KindBadge, PriorityBadge } from "./queue-badges";

const formatDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

function InfoCell({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" /> {label}
      </p>
      <div className="mt-0.5 break-words text-sm font-medium">{children}</div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
      {extra && (
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {extra}
        </span>
      )}
    </h4>
  );
}

/** Poin yang sebaiknya dipertimbangkan sebelum memutuskan. */
function Considerations({ item, now }: { item: QueueItem; now: number }) {
  const points: {
    key: string;
    tone: "danger" | "warn" | "info";
    icon: React.ComponentType<{ className?: string }>;
    text: React.ReactNode;
  }[] = [];
  const { flags } = item;

  if (flags.overdue)
    points.push({
      key: "overdue",
      tone: "danger",
      icon: AlarmClock,
      text: `Sudah lewat jatuh tempo ${Math.abs(item.daysToDue ?? 0)} hari (${formatDate(item.dueDate)}).`,
    });
  else if (flags.dueSoon)
    points.push({
      key: "due",
      tone: "warn",
      icon: CalendarClock,
      text: `Jatuh tempo ${dueLabel(item.daysToDue)?.toLowerCase()} (${formatDate(item.dueDate)}).`,
    });
  if (item.priority === "P0" || item.priority === "P1")
    points.push({
      key: "prio",
      tone: item.priority === "P0" ? "danger" : "warn",
      icon: Tag,
      text: `Prioritas ${PRIORITY_LABELS[item.priority]}.`,
    });
  if (flags.overBudget && item.costCenter)
    points.push({
      key: "budget",
      tone: "danger",
      icon: Wallet,
      text: `Estimasi ${formatCurrency(item.amount)} melebihi sisa budget ${item.costCenter.code || item.costCenter.name} (${formatCurrency(item.costCenter.budget)}).`,
    });
  if (flags.followups > 0)
    points.push({
      key: "followup",
      tone: "warn",
      icon: BellRing,
      text:
        item.kind === "mr-approval" || item.kind === "po-approval"
          ? `Requester sudah mem-follow-up Anda ${flags.followups}x.`
          : `Dokumen ini sudah di-follow-up ${flags.followups}x.`,
    });
  if (flags.stale)
    points.push({
      key: "stale",
      tone: "warn",
      icon: Hourglass,
      text: `Sudah menunggu ${waitingLabel(item.waitingSince, now)} (lebih dari ${STALE_DAYS} hari).`,
    });
  if (item.docType === "MR" && !item.costCenter && item.kind === "mr-validation")
    points.push({
      key: "cc",
      tone: "info",
      icon: Info,
      text: "Cost center belum ditentukan.",
    });
  if (item.attachments.length === 0 && item.kind !== "po-receive")
    points.push({
      key: "attach",
      tone: "info",
      icon: Paperclip,
      text: "Tidak ada lampiran pendukung.",
    });

  if (!points.length) return null;
  const toneClass = {
    danger:
      "text-red-700 dark:text-red-300 [&_svg]:text-red-600 dark:[&_svg]:text-red-400",
    warn: "text-amber-800 dark:text-amber-300 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400",
    info: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-amber-900 uppercase dark:text-amber-200">
        Perlu diperhatikan
      </p>
      <ul className="space-y-1">
        {points.map((p) => (
          <li
            key={p.key}
            className={cn("flex items-start gap-2 text-sm", toneClass[p.tone])}
          >
            <p.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BudgetBox({ item }: { item: QueueItem }) {
  const cc = item.costCenter;
  if (!cc) return null;
  const remaining = cc.budget - item.amount;
  const pct =
    cc.budget > 0 ? Math.min(100, (item.amount / cc.budget) * 100) : 100;
  return (
    <div className="rounded-lg border p-3">
      <SectionTitle icon={Wallet}>
        Budget Cost Center{" "}
        <Badge variant="outline" className="font-mono text-[10px]">
          {cc.code || cc.name}
        </Badge>
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Sisa budget</p>
          <p className="font-semibold tabular-nums">
            {formatCurrency(cc.budget)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Estimasi MR</p>
          <p className="font-semibold tabular-nums">
            {formatCurrency(item.amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sisa setelah MR</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              remaining < 0 && "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Porsi estimasi terhadap sisa budget"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            remaining < 0
              ? "bg-red-500"
              : pct > 75
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {cc.name} · MR ini memakai{" "}
        {cc.budget > 0 ? `${Math.round((item.amount / cc.budget) * 100)}%` : "-"}{" "}
        dari sisa budget.
      </p>
    </div>
  );
}

function PoCostBox({ item }: { item: QueueItem }) {
  if (!item.po) return null;
  const subtotal = item.items.reduce((s, i) => s + i.total, 0);
  const rows: [string, number | null, string?][] = [
    ["Subtotal barang", subtotal],
    ["Diskon", item.po.discount ? -item.po.discount : null],
    ["Pajak", item.po.tax || null],
    ["Ongkir", item.po.postage || null],
    ["PPh", item.po.pphAmount ? -item.po.pphAmount : null],
  ];
  return (
    <div className="rounded-lg border p-3">
      <SectionTitle icon={Receipt}>Rincian Biaya</SectionTitle>
      <dl className="space-y-1 text-sm">
        {rows
          .filter(([, v]) => v !== null)
          .map(([label, v]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">
                {v! < 0 ? `- ${formatCurrency(-v!)}` : formatCurrency(v!)}
              </dd>
            </div>
          ))}
        <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(item.amount)}</dd>
        </div>
      </dl>
      {item.kind === "po-receive" &&
        (item.po.dpPaid !== null || item.po.bpPaid !== null) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Badge variant={item.po.dpPaid ? "default" : "outline"}>
              DP {item.po.dpPaid ? "lunas" : "belum"}
            </Badge>
            <Badge variant={item.po.bpPaid ? "default" : "outline"}>
              Pelunasan {item.po.bpPaid ? "lunas" : "belum"}
            </Badge>
          </div>
        )}
    </div>
  );
}

function ApprovalChain({ item }: { item: QueueItem }) {
  if (!item.approvals.length)
    return (
      <p className="text-sm text-muted-foreground">
        {item.kind.endsWith("validation")
          ? "Alur approval akan ditentukan saat validasi."
          : "Belum ada alur approval."}
      </p>
    );
  const currentIdx = item.approvals.findIndex((a) => a.status !== "approved");
  return (
    <ol className="relative space-y-3">
      {item.approvals.map((a, idx) => {
        const isMine = idx === item.myStepIndex;
        const isCurrent = idx === currentIdx && a.status === "pending";
        return (
          <li key={`${a.userid}-${idx}`} className="relative flex gap-3">
            {idx < item.approvals.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 left-3.5 h-[calc(100%-0.75rem)] w-px",
                  a.status === "approved" ? "bg-emerald-400/70" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                a.status === "approved" &&
                  "border-emerald-500 bg-emerald-500 text-white",
                a.status === "rejected" &&
                  "border-red-500 bg-red-500 text-white",
                a.status === "pending" &&
                  (isCurrent
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950"
                    : "border-border bg-background text-muted-foreground"),
              )}
            >
              {a.status === "approved" ? (
                <Check className="h-3.5 w-3.5" />
              ) : a.status === "rejected" ? (
                <X className="h-3.5 w-3.5" />
              ) : isCurrent ? (
                <Clock className="h-3.5 w-3.5" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5" />
              )}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-md px-2 py-1",
                isMine && "bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-800",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{a.nama}</span>
                {isMine && (
                  <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white">
                    Giliran Anda
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {approvalStepLabel(a)}
                {a.department ? ` · ${a.department}` : ""}
              </p>
              {a.processed_at && (
                <p className="text-xs text-muted-foreground">
                  {a.status === "approved" ? "Disetujui" : "Ditolak"}{" "}
                  {formatDateWithTime(a.processed_at)}
                  {a.processed_by_admin
                    ? ` · oleh admin ${a.processed_by_admin.nama}`
                    : ""}
                </p>
              )}
              {a.status === "rejected" && a.rejection_note && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  “{a.rejection_note}”
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function QueueDetailDialog({
  item,
  open,
  onOpenChange,
  gone,
  now,
}: {
  item: QueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dokumen sudah keluar dari antrian (diproses di tab lain / user lain). */
  gone: boolean;
  now: number;
}) {
  const meta = item ? KIND_META[item.kind] : null;
  const itemsTotal = item?.items.reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6 lg:max-w-5xl">
        {item && meta && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-lg sm:text-xl">
                <FileText className="h-5 w-5 shrink-0" />
                <span className="font-mono">{item.kode}</span>
                <CopyTextButton
                  text={item.kode}
                  label={`Salin kode ${item.docType}`}
                  className="-ml-1 size-7"
                />
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  <KindBadge kind={item.kind} />
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {item.status}
                  </Badge>
                  <PriorityBadge priority={item.priority} className="text-[10px]" />
                  <span className="text-xs text-muted-foreground">
                    · menunggu {waitingLabel(item.waitingSince, now)}
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {gone && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Dokumen ini sudah tidak ada di antrian Anda - kemungkinan
                    sudah diproses di tab lain atau oleh user lain. Data di
                    bawah adalah kondisi terakhir sebelum berubah.
                  </span>
                </div>
              )}

              <Considerations item={item} now={now} />

              {/* Info utama */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3 lg:grid-cols-4">
                <InfoCell icon={User} label={item.docType === "MR" ? "Requester" : "Pembuat PO"}>
                  {item.requester}
                </InfoCell>
                <InfoCell icon={Building2} label="Departemen">
                  {item.department || "-"}
                </InfoCell>
                <InfoCell icon={Building2} label="Perusahaan">
                  {item.company || "-"}
                </InfoCell>
                <InfoCell icon={MapPin} label="Site">
                  {item.site || "-"}
                </InfoCell>
                <InfoCell icon={Calendar} label="Dibuat">
                  <span title={formatDateWithTime(item.createdAt)}>
                    {formatDate(item.createdAt)}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </InfoCell>
                <InfoCell icon={CalendarClock} label="Jatuh tempo">
                  {formatDate(item.dueDate)}
                  {item.daysToDue !== null && (
                    <span
                      className={cn(
                        "block text-xs font-normal",
                        item.flags.overdue
                          ? "text-red-600 dark:text-red-400"
                          : item.flags.dueSoon
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {dueLabel(item.daysToDue)}
                    </span>
                  )}
                </InfoCell>
                <InfoCell icon={Hourglass} label="Masuk antrian Anda">
                  {formatDate(item.waitingSince)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {waitingLabel(item.waitingSince, now)} lalu
                  </span>
                </InfoCell>
                {item.kategori && (
                  <InfoCell icon={Tag} label="Kategori">
                    {item.kategori}
                  </InfoCell>
                )}
                {item.docType === "PO" && (
                  <>
                    <InfoCell icon={Store} label="Vendor">
                      {item.vendor || "-"}
                    </InfoCell>
                    <InfoCell icon={Receipt} label="Termin bayar">
                      {item.paymentTerm || "-"}
                    </InfoCell>
                    <InfoCell icon={Link2} label="Ref. MR">
                      {item.refMr ? (
                        <Link
                          href={`/material-request/${item.refMr.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary underline-offset-2 hover:underline"
                        >
                          {item.refMr.kode}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </InfoCell>
                  </>
                )}
                <InfoCell
                  icon={Wallet}
                  label={item.docType === "MR" ? "Total estimasi" : "Total PO"}
                  className="col-span-2 sm:col-span-1"
                >
                  <span className="text-base font-bold tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                </InfoCell>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {item.docType === "MR" ? (
                  <BudgetBox item={item} />
                ) : (
                  <PoCostBox item={item} />
                )}
                {item.remarks && (
                  <div className="rounded-lg border p-3">
                    <SectionTitle icon={FileText}>
                      {item.docType === "MR" ? "Remarks" : "Catatan PO"}
                    </SectionTitle>
                    <p className="max-h-40 overflow-y-auto text-sm whitespace-pre-line text-muted-foreground">
                      {item.remarks}
                    </p>
                  </div>
                )}
              </div>

              {/* Barang */}
              <div>
                <SectionTitle
                  icon={Layers}
                  extra={`${item.items.length} item · ${formatCurrency(itemsTotal)}`}
                >
                  Daftar Barang
                </SectionTitle>
                <div className="overflow-hidden rounded-md border">
                  <Table className="min-w-[560px]">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-10">No</TableHead>
                        <TableHead>Barang</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">
                          {item.docType === "MR" ? "Est. Harga" : "Harga"}
                        </TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.items.length ? (
                        item.items.map((li, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="max-w-[280px] whitespace-normal">
                              <p className="font-medium break-words">{li.name}</p>
                              <p className="text-xs break-words text-muted-foreground">
                                {[li.partNumber, li.vendor, li.note]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {li.qty.toLocaleString("id-ID")} {li.uom}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(li.price)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(li.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-16 text-center text-muted-foreground"
                          >
                            Tidak ada barang.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <SectionTitle icon={Check}>Jalur Approval</SectionTitle>
                  <ApprovalChain item={item} />
                </div>
                <div className="rounded-lg border p-3">
                  <SectionTitle
                    icon={Paperclip}
                    extra={item.attachments.length ? `${item.attachments.length} file` : undefined}
                  >
                    Lampiran
                  </SectionTitle>
                  {item.attachments.length ? (
                    <ul className="space-y-1">
                      {item.attachments.map((a, i) => (
                        <li key={`${a.url}-${i}`}>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-sm text-primary hover:bg-muted"
                          >
                            {a.is_link ? (
                              <Link2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <Paperclip className="h-4 w-4 shrink-0" />
                            )}
                            <span className="truncate">{a.name || a.url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada lampiran.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              <Button variant="outline" asChild>
                <Link href={item.detailHref}>
                  <Eye className="mr-2 h-4 w-4" /> Lihat Detail Lengkap
                </Link>
              </Button>
              {!gone && (
                <Button asChild>
                  <Link href={item.actionHref}>
                    {meta.actionLabel} {item.docType}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
