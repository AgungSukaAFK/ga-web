// src/app/(With Sidebar)/material-request/buat/MrTemplatePickerDialog.tsx
//
// Modal pilih Template MR di halaman Buat MR - list compact, detail barang &
// remarks bisa di-expand per template. Semua template diambil sekaligus
// (tanpa pagination) tiap kali modal dibuka.

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
import { fetchMrTemplates } from "@/services/mrTemplateService";
import { MrTemplate, Order } from "@/type";
import { toast } from "sonner";
import {
  ChevronDown,
  FileStack,
  Loader2,
  Search,
  CheckCircle2,
} from "lucide-react";

const totalOf = (orders: Order[]) =>
  orders.reduce(
    (sum, o) => sum + (Number(o.qty) || 0) * (Number(o.estimasi_harga) || 0),
    0,
  );

interface MrTemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appliedTemplateId: number | null;
  applyingTemplateId: number | null;
  onApply: (template: MrTemplate) => void;
}

export function MrTemplatePickerDialog({
  open,
  onOpenChange,
  appliedTemplateId,
  applyingTemplateId,
  onApply,
}: MrTemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<MrTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setExpandedId(null);
    setLoading(true);
    fetchMrTemplates()
      .then(setTemplates)
      .catch((error: any) =>
        toast.error("Gagal memuat template MR", {
          description: error.message,
        }),
      )
      .finally(() => setLoading(false));
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = !q
    ? templates
    : templates.filter(
        (t) =>
          t.nama_template.toLowerCase().includes(q) ||
          (t.deskripsi || "").toLowerCase().includes(q) ||
          (t.kategori || "").toLowerCase().includes(q) ||
          (t.orders || []).some(
            (o) =>
              o.name.toLowerCase().includes(q) ||
              (o.part_number || "").toLowerCase().includes(q),
          ),
      );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 p-4 sm:max-w-lg">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileStack className="h-4 w-4 text-primary" />
            Pilih Template MR
          </DialogTitle>
          <DialogDescription className="text-xs">
            Barang di template <strong>mengganti</strong> Order Item saat ini.
            Kategori ikut terisi, remarks hanya terisi kalau masih kosong.
            Harga diperbarui dari harga pembelian terakhir.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari template, kategori, barang, part number..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        {!loading && templates.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {q
              ? `${filtered.length} dari ${templates.length} template`
              : `${templates.length} template tersedia`}
          </p>
        )}

        <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1">
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {templates.length === 0
                ? "Belum ada template MR dari GA."
                : "Tidak ada template yang cocok."}
            </p>
          ) : (
            filtered.map((t) => {
              const orders = t.orders || [];
              const isApplied = appliedTemplateId === t.id;
              const isExpanded = expandedId === t.id;
              const remarksText = extractPlainText(t.remarks);

              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-md border text-sm transition-colors",
                    isApplied ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-start gap-2 p-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-snug [overflow-wrap:anywhere]">
                        {t.nama_template}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                        {isApplied && (
                          <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                            <CheckCircle2 className="h-3 w-3" /> Dipakai
                          </span>
                        )}
                        {t.kategori && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[10px] font-normal"
                          >
                            {t.kategori}
                          </Badge>
                        )}
                        <span>{orders.length} barang</span>
                        <span>·</span>
                        <span>± {formatCurrency(totalOf(orders))}</span>
                      </div>
                      {t.deskripsi && (
                        <p
                          className={cn(
                            "whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]",
                            !isExpanded && "line-clamp-2",
                          )}
                        >
                          {t.deskripsi}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="h-7 shrink-0 px-2.5 text-xs"
                      variant={isApplied ? "outline" : "default"}
                      onClick={() => onApply(t)}
                      disabled={applyingTemplateId !== null}
                    >
                      {applyingTemplateId === t.id && (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      )}
                      {isApplied ? "Terapkan Ulang" : "Gunakan"}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
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
                    <div className="space-y-2 border-t bg-muted/30 px-2.5 py-2">
                      <ol className="space-y-1">
                        {orders.map((o, i) => (
                          <li
                            key={o.barang_id ?? i}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="w-4 shrink-0 text-right text-muted-foreground">
                              {i + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="leading-snug [overflow-wrap:anywhere]">
                                {o.name}
                              </p>
                              {(o.part_number || o.note) && (
                                <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                                  {o.part_number && (
                                    <span className="font-mono">
                                      {o.part_number}
                                    </span>
                                  )}
                                  {o.part_number && o.note && " · "}
                                  {o.note}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 whitespace-nowrap font-medium">
                              {o.qty} {o.uom}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {remarksText && (
                        <div className="border-t pt-2 text-xs">
                          <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                            Remarks default
                          </p>
                          <p className="whitespace-pre-line [overflow-wrap:anywhere]">
                            {remarksText}
                          </p>
                        </div>
                      )}
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
