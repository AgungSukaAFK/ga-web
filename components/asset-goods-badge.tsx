// components/asset-goods-badge.tsx
// Badge "Aset"/"Barang" per-item. Klik badge untuk buka modal penjelasan
// perbedaan Aset vs Barang, dipakai di semua tabel/list barang MR & PO.

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

interface AssetGoodsBadgeProps {
  isAsset?: boolean | null;
  className?: string;
}

export function AssetGoodsBadge({ isAsset, className }: AssetGoodsBadgeProps) {
  const [open, setOpen] = useState(false);

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
          isAsset
            ? "border-purple-200 bg-purple-50 text-purple-700"
            : "border-slate-200 bg-slate-50 text-slate-600",
          className,
        )}
      >
        {isAsset ? "Aset" : "Barang"}
      </Badge>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Keterangan Aset & Barang</DialogTitle>
            <DialogDescription>
              Klasifikasi jenis item sesuai master data Barang.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div
              className={cn(
                "rounded-md border p-3",
                isAsset && "border-purple-300 bg-purple-50/60",
              )}
            >
              <Badge
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 font-normal"
              >
                Aset
              </Badge>
              <p className="text-muted-foreground text-xs mt-2">
                Barang yang tercatat sebagai aset perusahaan (inventaris /
                bernilai jangka panjang) pada master data Barang.
              </p>
            </div>
            <div
              className={cn(
                "rounded-md border p-3",
                !isAsset && "border-slate-300 bg-slate-50/60",
              )}
            >
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 text-slate-600 font-normal"
              >
                Barang
              </Badge>
              <p className="text-muted-foreground text-xs mt-2">
                Barang operasional / consumable biasa (bukan aset).
              </p>
            </div>
            <p className="text-muted-foreground text-xs italic">
              Catatan: 1 PO tidak boleh mencampur item Aset dengan Barang —
              keduanya harus dibuatkan PO terpisah.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
