"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { POItem, ReceiveRecord } from "@/type";

interface ReceiveGoodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: POItem[];
  receiveRecord?: ReceiveRecord | null;
  onSubmit: (receivedQtyByPartNumber: Record<string, number>) => Promise<void>;
  isSubmitting: boolean;
}

interface Row {
  part_number: string;
  name: string;
  ordered_qty: number;
  received_qty: number;
}

// Modal checklist qty penerimaan barang - dipakai dari 2 tempat yang hasilnya
// harus konsisten: klik "Setujui" di step approval "Receiver", dan tombol
// "Terima Barang" manual (GA Receive). Default qty diterima = qty PO; kalau
// `receiveRecord` sudah ada (mode edit, PO lagi "Partial Receive"), prefill
// dari situ. Qty diterima 0 berarti item itu sama sekali tidak datang.
export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  items,
  receiveRecord,
  onSubmit,
  isSubmitting,
}: ReceiveGoodsDialogProps) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      items
        .filter((item) => !!item.part_number)
        .map((item) => {
          const prev = receiveRecord?.items.find(
            (i) => i.part_number === item.part_number,
          );
          return {
            part_number: item.part_number,
            name: item.name,
            ordered_qty: item.qty,
            received_qty: prev ? prev.received_qty : item.qty,
          };
        }),
    );
  }, [open]);

  const setReceivedQty = (partNumber: string, value: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.part_number === partNumber
          ? { ...r, received_qty: Math.max(0, value) }
          : r,
      ),
    );
  };

  const isFullMatch = rows.every((r) => r.received_qty === r.ordered_qty);

  const handleSubmit = async () => {
    const receivedQtyByPartNumber = Object.fromEntries(
      rows.map((r) => [r.part_number, r.received_qty]),
    );
    await onSubmit(receivedQtyByPartNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checklist Penerimaan Barang</DialogTitle>
          <DialogDescription>
            Cocokkan qty barang yang aktual diterima dengan qty di PO. Kalau
            ada barang yang kurang atau sama sekali tidak datang, isi qty
            diterima sesuai kenyataan (0 kalau tidak ada) - PO akan jadi
            &quot;Partial Receive&quot; dan checklist ini bisa diedit lagi
            nanti sampai sesuai.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Barang</TableHead>
                <TableHead className="w-[100px] text-right">Qty PO</TableHead>
                <TableHead className="w-[140px] text-right">
                  Qty Diterima
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const mismatch = row.received_qty !== row.ordered_qty;
                return (
                  <TableRow
                    key={row.part_number}
                    className={mismatch ? "bg-amber-50 dark:bg-amber-950/30" : ""}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">
                      {row.ordered_qty}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        className="w-24 ml-auto text-right"
                        value={row.received_qty}
                        onChange={(e) =>
                          setReceivedQty(
                            row.part_number,
                            Number(e.target.value),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {isFullMatch ? (
          <p className="text-xs text-green-600 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Semua item sesuai qty PO - PO
            akan jadi &quot;Full Received&quot;.
          </p>
        ) : (
          <p className="text-xs text-amber-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Ada item yang qty-nya
            tidak sesuai PO - PO akan jadi &quot;Partial Receive&quot;.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Submit Penerimaan Barang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
