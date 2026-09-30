// src/app/(With Sidebar)/material-request/buat/MrHistoryPickerDialog.tsx
//
// Modal pilih "History MR" di halaman Buat MR - pakai MR lama (departemen
// yang sama) sebagai template. Beda dari MrTemplatePickerDialog: TIDAK
// memuat list di awal, requester ketik pencarian dulu (kode MR, remarks,
// nama barang, part number),
// hasil dibatasi MR_HISTORY_SEARCH_LIMIT supaya hemat query.

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractPlainText } from "@/lib/rich-content";
import { cn, formatCurrency } from "@/lib/utils";
import {
  MR_HISTORY_SEARCH_LIMIT,
  MrHistoryItem,
  searchMrHistory,
} from "@/services/mrTemplateService";
import { Order } from "@/type";
import { format } from "date-fns";
import {
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  Search,
} from "lucide-react";

const MIN_QUERY_LENGTH = 3;

const totalOf = (orders: Order[]) =>
  orders.reduce(
    (sum, o) => sum + (Number(o.qty) || 0) * (Number(o.estimasi_harga) || 0),
    0,
  );

interface MrHistoryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: string;
  // null = tanpa filter perusahaan (user LOURDES).
  companyCode: string | null;
  appliedMrId: number | null;
  applyingMrId: number | null;
  onApply: (mr: MrHistoryItem) => void;
}

export function MrHistoryPickerDialog({
  open,
  onOpenChange,
  department,
  companyCode,
  appliedMrId,
  applyingMrId,
  onApply,
}: MrHistoryPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MrHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setSearched(false);
    setError(null);
    setExpandedId(null);
  }, [open]);

  // Debounce: query baru jalan setelah user berhenti ngetik & minimal
  // MIN_QUERY_LENGTH karakter.
  useEffect(() => {
    const q = search.trim();
    if (!open || q.length < MIN_QUERY_LENGTH || !department) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handler = setTimeout(() => {
      searchMrHistory(q, department, companyCode)
        .then((data) => {
          if (cancelled) return;
          setResults(data);
          setError(null);
          setSearched(true);
          setExpandedId(null);
        })
        .catch((err: any) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [search, department, companyCode, open]);

  const queryTooShort = search.trim().length < MIN_QUERY_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 p-4 sm:max-w-lg">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Gunakan History MR
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cari MR lama departemen <strong>{department || "-"}</strong>
            {companyCode && (
              <>
                {" "}
                (<strong>{companyCode}</strong>)
              </>
            )}{" "}
            berdasarkan kode MR, remarks, nama barang, atau part number.
            Barangnya{" "}
            <strong>mengganti</strong> Order Item saat ini, harga diperbarui
            dari harga pembelian terakhir.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kode MR, remarks, nama barang, part number..."
            className="h-8 pl-8 pr-8 text-sm"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {searched && !queryTooShort && !error && (
          <p className="text-[11px] text-muted-foreground">
            {results.length === MR_HISTORY_SEARCH_LIMIT
              ? `Menampilkan ${MR_HISTORY_SEARCH_LIMIT} MR terbaru yang cocok - perjelas pencarian kalau MR yang dicari belum muncul.`
              : `${results.length} MR ditemukan`}
          </p>
        )}

        <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1">
          {queryTooShort ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ketik minimal {MIN_QUERY_LENGTH} karakter untuk mulai mencari.
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive [overflow-wrap:anywhere]">
              Gagal mencari MR: {error}
            </p>
          ) : !searched ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada MR yang cocok.
            </p>
          ) : (
            results.map((mr) => {
              const isApplied = appliedMrId === mr.id;
              const isExpanded = expandedId === mr.id;
              const remarksText = extractPlainText(mr.remarks);
              const usableCount = mr.orders.filter((o) => o.barang_id).length;
              const q = search.trim().toLowerCase();
              const matchedItems = mr.orders.filter(
                (o) =>
                  o.name.toLowerCase().includes(q) ||
                  (o.part_number || "").toLowerCase().includes(q),
              );

              return (
                <div
                  key={mr.id}
                  className={cn(
                    "rounded-md border text-sm transition-colors",
                    isApplied
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-2 p-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <a
                        href={`/material-request/${mr.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 font-mono text-xs font-semibold text-primary hover:underline [overflow-wrap:anywhere]"
                        title="Buka MR di tab baru"
                      >
                        {mr.kode_mr}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                      </a>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                        {isApplied && (
                          <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                            <CheckCircle2 className="h-3 w-3" /> Dipakai
                          </span>
                        )}
                        {mr.kategori && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[10px] font-normal"
                          >
                            {mr.kategori}
                          </Badge>
                        )}
                        <span>{mr.orders.length} barang</span>
                        <span>·</span>
                        <span>± {formatCurrency(totalOf(mr.orders))}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                        {mr.requester_name || "-"} ·{" "}
                        {format(new Date(mr.created_at), "dd MMM yyyy")}
                        {mr.status && <> · {mr.status}</>}
                      </p>
                      {matchedItems.length > 0 && (
                        <p className="text-[11px] [overflow-wrap:anywhere]">
                          <span className="text-muted-foreground">Cocok: </span>
                          <span className="font-medium">
                            {matchedItems
                              .map(
                                (o) =>
                                  `${o.name}${o.part_number ? ` (${o.part_number})` : ""}`,
                              )
                              .join(", ")}
                          </span>
                        </p>
                      )}
                      {remarksText && (
                        <p
                          className={cn(
                            "whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]",
                            !isExpanded && "line-clamp-2",
                          )}
                        >
                          {remarksText}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="h-7 shrink-0 px-2.5 text-xs"
                      variant={isApplied ? "outline" : "default"}
                      onClick={() => onApply(mr)}
                      disabled={applyingMrId !== null || usableCount === 0}
                      title={
                        usableCount === 0
                          ? "Tidak ada barang dari database di MR ini"
                          : undefined
                      }
                    >
                      {applyingMrId === mr.id && (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      )}
                      {isApplied ? "Terapkan Ulang" : "Gunakan"}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : mr.id)}
                    className="flex w-full items-center justify-between border-t px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? "Sembunyikan detail" : "Lihat detail barang"}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-2.5 py-2">
                      <ol className="space-y-1">
                        {mr.orders.map((o, i) => (
                          <li
                            key={i}
                            className={cn(
                              "flex items-start gap-2 text-xs",
                              !o.barang_id && "opacity-60",
                            )}
                          >
                            <span className="w-4 shrink-0 text-right text-muted-foreground">
                              {i + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="leading-snug [overflow-wrap:anywhere]">
                                {o.name}
                              </p>
                              {(o.part_number || !o.barang_id) && (
                                <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                                  {o.part_number && (
                                    <span className="font-mono">
                                      {o.part_number}
                                    </span>
                                  )}
                                  {!o.barang_id && (
                                    <>
                                      {o.part_number && " · "}
                                      Bukan dari database, akan dilewati
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 whitespace-nowrap font-medium">
                              {o.qty} {o.uom}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
