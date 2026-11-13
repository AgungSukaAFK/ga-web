"use client";

// Dialog ringkasan dokumen saat baris tabel di halaman Approval & Validation
// diklik. Satu komponen untuk MR & PO.

import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarClock,
  DollarSign,
  Eye,
  FileText,
  Layers,
  Link2,
  MapPin,
  Store,
  Tag,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { extractPlainText } from "@/lib/rich-content";
import {
  cn,
  formatCurrency,
  formatDateFriendly,
  formatDateWithTime,
} from "@/lib/utils";
import type { Approval, MaterialRequest, PurchaseOrder } from "@/type";

export type ApprovalDetailTarget =
  | {
      type: "mr";
      data: MaterialRequest;
      actionHref: string;
      actionLabel: string;
    }
  | {
      type: "po";
      data: PurchaseOrder;
      actionHref: string;
      actionLabel: string;
    };

const PRIORITY_CLASS: Record<string, string> = {
  P0: "border-red-500 text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/40",
  P1: "border-orange-500 text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/40",
  P2: "border-yellow-500 text-yellow-600 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/40",
  P3: "border-green-500 text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-900/40",
};

// Warna sama dengan badge prioritas di halaman list MR.
export function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-xs font-semibold",
        PRIORITY_CLASS[priority] ||
          "border-border bg-muted text-muted-foreground",
      )}
    >
      {priority}
    </Badge>
  );
}

function InfoItem({
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
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="break-words font-medium">{children}</div>
    </div>
  );
}

function ApprovalList({ approvals }: { approvals: Approval[] | null }) {
  if (!approvals?.length)
    return (
      <p className="text-sm text-muted-foreground">
        Alur approval belum ditentukan.
      </p>
    );
  return (
    <ol className="space-y-2">
      {approvals.map((a, i) => (
        <li
          key={`${a.userid}-${i}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">
              {i + 1}. {a.nama}
            </p>
            <p className="text-xs text-muted-foreground">
              {[a.type || a.role, a.department].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <Badge
              variant={a.status === "rejected" ? "destructive" : "outline"}
              className={cn(
                "capitalize",
                a.status === "approved" &&
                  "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-200",
              )}
            >
              {a.status}
            </Badge>
            {a.processed_at && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDateWithTime(a.processed_at)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ApprovalDetailDialog({
  target,
  onOpenChange,
}: {
  target: ApprovalDetailTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isMr = target?.type === "mr";
  const mr = isMr ? (target.data as MaterialRequest) : null;
  const po = target?.type === "po" ? (target.data as PurchaseOrder) : null;
  const kode = mr?.kode_mr ?? po?.kode_po ?? "";
  const priority = mr ? mr.prioritas : po?.material_requests?.prioritas;
  const dueDate = mr ? mr.due_date : po?.material_requests?.due_date;

  const rows = mr
    ? (mr.orders || []).map((o) => ({
        name: o.name,
        sub: [o.part_number, o.note].filter(Boolean).join(" · "),
        qty: `${o.qty} ${o.uom}`,
        price: Number(o.estimasi_harga) || 0,
        total: (Number(o.qty) || 0) * (Number(o.estimasi_harga) || 0),
      }))
    : (po?.items || []).map((i) => ({
        name: i.name,
        sub: [i.part_number, i.vendor_name].filter(Boolean).join(" · "),
        qty: `${i.qty} ${i.uom}`,
        price: Number(i.price) || 0,
        total: Number(i.total_price) || (Number(i.qty) || 0) * (Number(i.price) || 0),
      }));

  const vendor = po
    ? (po.vendor_details as { nama_vendor?: string } | null)?.nama_vendor ||
      po.vendor_details?.name ||
      "-"
    : null;
  // Remarks MR & catatan PO sama-sama bisa berupa rich text (JSON Tiptap).
  const remarks = extractPlainText(mr ? mr.remarks : po?.notes);

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto lg:max-w-5xl">
        {target && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-6 text-xl">
                <FileText className="h-5 w-5 shrink-0" />
                <span>
                  Ringkasan {isMr ? "MR" : "PO"}: {kode}
                </span>
                <CopyTextButton
                  text={kode}
                  label={`Salin kode ${isMr ? "MR" : "PO"}`}
                  className="-ml-1 size-7"
                />
              </DialogTitle>
              <DialogDescription>
                Informasi singkat, daftar barang, dan jalur approval.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-4">
                <InfoItem icon={User} label={isMr ? "Requester" : "Pembuat"}>
                  {(target.data as MaterialRequest | PurchaseOrder)
                    .users_with_profiles?.nama || "N/A"}
                </InfoItem>
                {mr ? (
                  <>
                    <InfoItem icon={Building2} label="Departemen">
                      {mr.department || "-"}
                    </InfoItem>
                    <InfoItem icon={MapPin} label="Site">
                      {mr.tujuan_site || "-"}
                    </InfoItem>
                  </>
                ) : (
                  <>
                    <InfoItem icon={Link2} label="Ref. MR">
                      {po?.material_requests?.kode_mr || "-"}
                    </InfoItem>
                    <InfoItem icon={Store} label="Vendor">
                      {vendor}
                    </InfoItem>
                  </>
                )}
                <InfoItem icon={Calendar} label="Dibuat">
                  {formatDateFriendly(mr?.created_at ?? po?.created_at)}
                </InfoItem>
                <InfoItem icon={Tag} label="Status">
                  <Badge variant="secondary">{mr?.status ?? po?.status}</Badge>
                </InfoItem>
                <InfoItem icon={AlertCircle} label="Prioritas">
                  <PriorityBadge priority={priority} />
                </InfoItem>
                <InfoItem icon={CalendarClock} label="Due Date">
                  {dueDate ? formatDateFriendly(dueDate) : "-"}
                </InfoItem>
                {mr ? (
                  <InfoItem icon={Wallet} label="Cost Center">
                    {mr.cost_centers ? (
                      <>
                        {mr.cost_centers.name}
                        <span className="block text-xs font-normal text-muted-foreground">
                          Sisa budget{" "}
                          {formatCurrency(mr.cost_centers.current_budget)}
                        </span>
                      </>
                    ) : (
                      "-"
                    )}
                  </InfoItem>
                ) : (
                  <InfoItem icon={Wallet} label="Termin Bayar">
                    {po?.payment_term || "-"}
                  </InfoItem>
                )}
                <InfoItem
                  icon={DollarSign}
                  label={isMr ? "Total Estimasi" : "Total Harga"}
                  className="col-span-2"
                >
                  <span className="text-lg font-bold">
                    {formatCurrency(
                      mr ? Number(mr.cost_estimation) : po?.total_price,
                    )}
                  </span>
                </InfoItem>
              </div>

              {remarks && (
                <div>
                  <h4 className="mb-1 font-semibold">
                    {isMr ? "Remarks" : "Catatan"}
                  </h4>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {remarks}
                  </p>
                </div>
              )}

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-semibold">
                  <Layers className="h-4 w-4" /> Daftar Barang
                </h4>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">
                          {isMr ? "Est. Harga" : "Harga"}
                        </TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length ? (
                        rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[260px] whitespace-normal">
                              <p className="font-medium break-words">{r.name}</p>
                              {r.sub && (
                                <p className="text-xs break-words text-muted-foreground">
                                  {r.sub}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.qty}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(r.price)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(r.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
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

              <div>
                <h4 className="mb-2 font-semibold">Jalur Approval</h4>
                <ApprovalList
                  approvals={(mr?.approvals ?? po?.approvals) || null}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={
                    isMr
                      ? `/material-request/${mr!.id}`
                      : `/purchase-order/${po!.id}`
                  }
                >
                  <Eye className="mr-2 h-4 w-4" /> Lihat Detail Lengkap
                </Link>
              </Button>
              <Button asChild>
                <Link href={target.actionHref}>{target.actionLabel}</Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
