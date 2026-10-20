// src/app/(With Sidebar)/purchase-order/create/BarangPickerPopover.tsx
//
// Picker "Tambah Item" di Buat PO - langsung dropdown search (tanpa modal).
// Daftar awal = barang dari MR referensi (maks 15), ketik untuk cari barang
// lain di database. Tiap baris menampilkan info yang membantu Purchasing
// memilih: harga terakhir, riwayat PO (RPC get_item_vendor_history, sama
// dengan kolom "History Vendor"), stok GA, dan konteks form (sudah di PO,
// sisa qty MR, beda tipe aset).

"use client";

import { ReactNode, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { AssetGoodsBadge } from "@/components/asset-goods-badge";
import { fetchBarangByIds, searchBarang } from "@/services/purchaseOrderService";
import {
  fetchItemVendorHistory,
  getItemVendorHistoryKey,
  ItemVendorHistory,
} from "@/services/itemVendorHistoryService";
import { fetchGaStockQtyMap } from "@/services/gaStockService";
import { Barang } from "@/type";
import { cn, formatCurrency } from "@/lib/utils";

const MAX_ITEMS = 15;

type Props = {
  /** Trigger popover (tombol "Tambah Item"). */
  children: ReactNode;
  onSelect: (barang: Barang) => void;
  /** barang_id item MR referensi - jadi daftar awal (maks 15). */
  initialBarangIds: number[];
  /** Judul grup daftar awal, mis. "Dari MR GMI/MR/...". */
  initialLabel?: string;
  /** MR yang sedang ditautkan - dikecualikan dari hitungan "diminta di N MR". */
  mrId: number | null;
  /** Company PO, untuk stok GA. */
  companyCode: string | null;
  /** barang_id -> qty item yang sudah ada di PO. */
  poQtyByBarang: Record<number, number>;
  /** barang_id -> sisa qty MR yang belum di-PO-kan. */
  mrRemainingByBarang: Record<number, { qty: number; uom: string }>;
  poIsAsset: boolean;
};

const formatShortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

function HistoryLine({
  history,
  loading,
}: {
  history: ItemVendorHistory | undefined;
  loading: boolean;
}) {
  if (loading && !history) {
    return <span className="animate-pulse">Memuat riwayat…</span>;
  }
  const vendors = history?.vendors ?? [];
  const poCount = vendors.reduce((sum, v) => sum + v.po_count, 0);
  if (poCount === 0) return <span>Belum pernah di-PO</span>;

  const last = vendors.reduce((a, b) =>
    (b.last_po_at ?? "") > (a.last_po_at ?? "") ? b : a,
  );
  return (
    <span className="min-w-0">
      Dibeli <span className="font-medium text-foreground">{poCount}×</span>
      {" · "}
      <span className="[overflow-wrap:anywhere]">{last.nama_vendor}</span>
      {last.last_po_at && `, ${formatShortDate(last.last_po_at)}`}
    </span>
  );
}

export function BarangPickerPopover({
  children,
  onSelect,
  initialBarangIds,
  initialLabel = "Dari MR referensi",
  mrId,
  companyCode,
  poQtyByBarang,
  mrRemainingByBarang,
  poIsAsset,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [initialItems, setInitialItems] = useState<Barang[]>([]);
  const [results, setResults] = useState<Barang[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [history, setHistory] = useState<Record<string, ItemVendorHistory>>(
    {},
  );
  const [stock, setStock] = useState<Record<number, number>>({});
  const [infoLoading, setInfoLoading] = useState(false);

  const initialKey = initialBarangIds.slice(0, MAX_ITEMS).join(",");

  // Daftar awal: barang dari MR (urutan sesuai MR), dimuat saat dibuka.
  useEffect(() => {
    if (!open) return;
    const ids = initialKey ? initialKey.split(",").map(Number) : [];
    if (ids.length === 0) {
      setInitialItems([]);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    fetchBarangByIds(ids)
      .then((data) => !cancelled && setInitialItems(data))
      .finally(() => !cancelled && setListLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, initialKey]);

  // Pencarian (debounce 300ms).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    const handler = setTimeout(() => {
      searchBarang(q, MAX_ITEMS)
        .then((data) => !cancelled && setResults(data))
        .finally(() => !cancelled && setListLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [query]);

  const isSearching = query.trim().length > 0;
  const items = isSearching ? results : initialItems;
  const itemsKey = items.map((b) => b.id).join(",");

  // Info tambahan (riwayat PO + stok GA) untuk baris yang sedang tampil -
  // 1 RPC + 1 query untuk semua baris; riwayat di-cache service 5 menit.
  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;
    setInfoLoading(true);
    Promise.all([
      fetchItemVendorHistory(
        items.map((b) => ({ barang_id: b.id, part_number: b.part_number })),
        mrId,
      ).catch(() => ({}) as Record<string, ItemVendorHistory>),
      companyCode
        ? fetchGaStockQtyMap(
            items.map((b) => b.id),
            companyCode,
          ).catch(() => ({}) as Record<number, number>)
        : Promise.resolve({} as Record<number, number>),
    ])
      .then(([h, s]) => {
        if (cancelled) return;
        setHistory((prev) => ({ ...prev, ...h }));
        setStock((prev) => ({ ...prev, ...s }));
      })
      .finally(() => !cancelled && setInfoLoading(false));
    return () => {
      cancelled = true;
    };
    // `items` sengaja diwakili itemsKey (array baru tiap render).
  }, [open, itemsKey, mrId, companyCode]);

  const handleSelect = (barang: Barang) => {
    onSelect(barang);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(560px,calc(100vw-2rem))] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cari part number / nama barang..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(440px,60vh)]">
            {listLoading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat barang…
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                {isSearching ? (
                  "Barang tidak ditemukan."
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" /> Ketik part number atau nama
                    barang untuk mencari.
                  </span>
                )}
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={
                  isSearching
                    ? `Hasil pencarian (${items.length}${items.length >= MAX_ITEMS ? "+" : ""})`
                    : initialLabel
                }
              >
                {items.map((barang) => {
                  const historyKey = getItemVendorHistoryKey({
                    barang_id: barang.id,
                    part_number: barang.part_number,
                  });
                  const inPoQty = poQtyByBarang[barang.id];
                  const mrRemaining = mrRemainingByBarang[barang.id];
                  const typeMismatch = !!barang.is_asset !== poIsAsset;
                  const stockQty = stock[barang.id];

                  return (
                    <CommandItem
                      key={barang.id}
                      value={String(barang.id)}
                      onSelect={() => handleSelect(barang)}
                      className="items-start border-b px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Baris 1: nama + badge */}
                        <div className="flex items-start justify-between gap-3">
                          <span className="line-clamp-2 min-w-0 text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                            {barang.part_name || barang.part_number}
                          </span>
                          <span className="flex shrink-0 flex-wrap justify-end gap-1">
                            <AssetGoodsBadge isAsset={!!barang.is_asset} />
                            {inPoQty != null && (
                              <Badge
                                variant="outline"
                                className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                              >
                                Di PO ({inPoQty})
                              </Badge>
                            )}
                            {typeMismatch && (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                title={
                                  poIsAsset
                                    ? "PO ini PO Aset, barang ini bukan aset"
                                    : "Barang aset, PO ini bukan PO Aset"
                                }
                              >
                                Beda tipe PO
                              </Badge>
                            )}
                          </span>
                        </div>

                        {/* Baris 2: part number, satuan, harga terakhir */}
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-mono [overflow-wrap:anywhere]">
                            {barang.part_number}
                          </span>
                          {barang.uom && <span>· {barang.uom}</span>}
                          <span>
                            ·{" "}
                            {barang.last_purchase_price ? (
                              <>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(barang.last_purchase_price)}
                                </span>{" "}
                                (terakhir)
                              </>
                            ) : (
                              "Belum ada harga"
                            )}
                          </span>
                          {mrRemaining && (
                            <span
                              className={cn(
                                mrRemaining.qty > 0
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              · Sisa MR {mrRemaining.qty} {mrRemaining.uom}
                            </span>
                          )}
                        </div>

                        {/* Baris 3: riwayat PO + stok GA */}
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          {historyKey ? (
                            <HistoryLine
                              history={history[historyKey]}
                              loading={infoLoading}
                            />
                          ) : (
                            <span>Belum pernah di-PO</span>
                          )}
                          {companyCode && (
                            <span>
                              ·{" "}
                              {stockQty === undefined && infoLoading ? (
                                <span className="animate-pulse">Stok GA…</span>
                              ) : (stockQty ?? 0) > 0 ? (
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                  Stok GA: {stockQty}
                                  {barang.uom ? ` ${barang.uom}` : ""}
                                </span>
                              ) : (
                                "Stok GA: –"
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
