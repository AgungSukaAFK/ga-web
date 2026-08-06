// components/item-level-badge.tsx
// Badge status level per-item MR (Open 1..5, Close). Klik badge untuk buka
// modal penjelasan seluruh level, dipakai di semua tabel/list barang MR & PO.

"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { MR_ITEM_LEVELS, MR_ITEM_LEVEL_COLORS } from "@/type/enum";

const ITEM_LEVEL_DESCRIPTIONS: Record<string, string> = {
  "Open 1":
    "Item baru diajukan di MR, menunggu approval dari atasan/approver.",
  "Open 2":
    "Item sudah full approved, menunggu dibuatkan PO oleh tim SCM/Purchasing.",
  "Open 3A":
    "PO untuk item ini sudah dibuat, menunggu vendor mengirim barang (tidak ada kendala pembayaran).",
  "Open 3B":
    "PO sudah dibuat tapi ada kendala pembayaran (payment issue), vendor belum bisa kirim.",
  "Open 4":
    "Pembayaran item ini sudah disetujui oleh Payment Validator.",
  "Open 5": "Barang sudah diterima oleh tim GA/Warehouse.",
  Close: "Proses untuk item ini sudah selesai (dokumen/BAST sudah lengkap).",
};

interface ItemLevelBadgeProps {
  level?: string | null;
  className?: string;
}

export function ItemLevelBadge({ level, className }: ItemLevelBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!level) return null;

  return (
    <>
      <Badge
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "text-[10px] font-normal px-1.5 py-0 cursor-pointer hover:opacity-75 transition-opacity",
          MR_ITEM_LEVEL_COLORS[level],
          className,
        )}
        title={MR_ITEM_LEVELS[level] || level}
      >
        {level}
      </Badge>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Keterangan Level Barang</DialogTitle>
            <DialogDescription>
              Level ini melacak status fisik & pembayaran tiap item barang
              dalam MR, terpisah dari status keseluruhan MR.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {Object.entries(MR_ITEM_LEVELS).map(([value, label]) => (
              <div
                key={value}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-2.5",
                  value === level && "border-primary bg-primary/5",
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 font-normal",
                    MR_ITEM_LEVEL_COLORS[value],
                  )}
                >
                  {value}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {ITEM_LEVEL_DESCRIPTIONS[value]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
