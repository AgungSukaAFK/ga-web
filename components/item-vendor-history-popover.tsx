// components/item-vendor-history-popover.tsx
// Tombol + popover "History Vendor" per item MR di halaman Buat PO. Data
// sudah di-fetch batch oleh parent (fetchItemVendorHistory,
// services/itemVendorHistoryService.ts) - komponen ini murni tampilan, buka/
// tutup popover tidak memicu query.

"use client";

import { History, RefreshCcw, Store, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ItemVendorHistory,
  ItemVendorHistoryVendor,
} from "@/services/itemVendorHistoryService";

interface ItemVendorHistoryPopoverProps {
  itemName: string;
  partNumber?: string | null;
  // false = item tanpa barang_id & part_number, tidak bisa dicari.
  searchable: boolean;
  history?: ItemVendorHistory;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const formatShortDate = (value: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatQty = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/60 px-2 py-1.5 text-center">
      <div className="text-sm font-semibold tabular-nums leading-tight">
        {value}
        <span className="text-[10px] font-normal text-muted-foreground">
          x
        </span>
      </div>
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function VendorCard({
  vendor,
  isTop,
}: {
  vendor: ItemVendorHistoryVendor;
  isTop: boolean;
}) {
  const hasRange =
    vendor.min_price != null &&
    vendor.max_price != null &&
    vendor.min_price !== vendor.max_price;

  return (
    <li
      className={cn(
        "rounded-lg border p-3 space-y-2.5",
        isTop && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold leading-snug break-words line-clamp-2"
            title={vendor.nama_vendor}
          >
            {vendor.nama_vendor}
          </p>
          {vendor.kode_vendor && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {vendor.kode_vendor}
            </p>
          )}
        </div>
        {isTop && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Trophy className="h-3 w-3" />
            Paling sering
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="Dibeli" value={vendor.bought_count} />
        <StatBox label="Di-PO" value={vendor.po_count} />
        <StatBox label="Dari MR" value={vendor.mr_count} />
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Harga terakhir</dt>
        <dd className="text-right font-medium tabular-nums break-words">
          {vendor.last_price != null ? formatCurrency(vendor.last_price) : "-"}
        </dd>
        {hasRange && (
          <>
            <dt className="text-muted-foreground">Rentang harga</dt>
            <dd className="text-right tabular-nums break-words">
              {formatCurrency(vendor.min_price!)} –{" "}
              {formatCurrency(vendor.max_price!)}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Total qty</dt>
        <dd className="text-right tabular-nums break-words">
          {formatQty(vendor.total_qty)} {vendor.uom ?? ""}
        </dd>
        <dt className="text-muted-foreground">PO terakhir</dt>
        <dd className="min-w-0 text-right">
          <span
            className="block truncate font-mono text-[11px]"
            title={vendor.last_kode_po ?? undefined}
          >
            {vendor.last_kode_po ?? "-"}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {formatShortDate(vendor.last_po_at)}
          </span>
        </dd>
      </dl>
    </li>
  );
}

export function ItemVendorHistoryPopover({
  itemName,
  partNumber,
  searchable,
  history,
  loading,
  error,
  onRetry,
}: ItemVendorHistoryPopoverProps) {
  if (!searchable) {
    return (
      <span
        className="text-[10px] text-muted-foreground"
        title="Barang tanpa kode/part number - history vendor tidak bisa dicari"
      >
        -
      </span>
    );
  }

  if (loading && !history) {
    return <Skeleton className="h-7 w-20" />;
  }

  if (error && !history) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive"
        onClick={onRetry}
      >
        <RefreshCcw className="mr-1 h-3 w-3" />
        Coba lagi
      </Button>
    );
  }

  const vendors = history?.vendors ?? [];
  const totalPo = vendors.reduce((sum, v) => sum + v.po_count, 0);
  const totalBought = vendors.reduce((sum, v) => sum + v.bought_count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1 px-2 text-xs whitespace-nowrap",
            vendors.length === 0 && "text-muted-foreground",
          )}
          title="Lihat history vendor barang ini"
        >
          <History className="h-3 w-3 shrink-0" />
          {vendors.length > 0 ? `${vendors.length} vendor` : "Belum ada"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="flex w-[min(calc(100vw-1.5rem),24rem)] max-h-[min(75vh,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0"
      >
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Store className="h-3.5 w-3.5 shrink-0" />
            History Vendor
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold leading-snug break-words line-clamp-2"
              title={itemName}
            >
              {itemName}
            </p>
            {partNumber && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {partNumber}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-muted px-2 py-0.5">
              {vendors.length} vendor
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {totalPo} PO · {totalBought} dibeli
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              Diminta di {history?.mr_request_count ?? 0} MR lain
            </span>
          </div>
        </div>

        {vendors.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Barang ini belum pernah di-PO-kan ke vendor manapun.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {vendors.map((vendor, i) => (
              <VendorCard
                key={`${vendor.vendor_id ?? vendor.nama_vendor}-${i}`}
                vendor={vendor}
                isTop={i === 0 && vendors.length > 1}
              />
            ))}
          </ul>
        )}

        <p className="border-t px-3 py-2 text-[10px] leading-snug text-muted-foreground">
          Hanya PO/MR yang berjalan atau selesai (Rejected/Cancelled tidak
          dihitung). &quot;Dibeli&quot; = PO yang barangnya sudah diterima.
        </p>
      </PopoverContent>
    </Popover>
  );
}
