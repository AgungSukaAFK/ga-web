"use client";

// Header tabel yang bisa digeser (drag & drop) untuk mengubah urutan kolom.
// Urutan & penyimpanannya diatur hooks/use-column-order.ts; komponen ini
// cuma interaksi drag-nya. Pakai drag & drop HTML5 bawaan browser (tanpa
// library) - jalan di desktop, tidak di layar sentuh.
//
// State drag disimpan di <ReorderableHeaderRow> (context), bukan di halaman,
// supaya menggeser header tidak me-render ulang seluruh baris data (list bisa
// sampai ribuan baris).

import { createContext, useContext, useState } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { TableHead, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  SortButton,
  sortAriaValue,
  type SortDirection,
} from "@/components/sortable-table-head";
import { cn } from "@/lib/utils";

export type ReorderableColumn = {
  id: string;
  label: string;
  // Diisi = kolom bisa di-sort (key sort = `id`); nilainya arah saat pertama
  // kali diklik.
  sortDirection?: SortDirection;
  className?: string;
};

type DragState = { from: string; over: string | null };

type DragContextValue = {
  order: readonly string[];
  onMove: (from: string, to: string) => void;
  drag: DragState | null;
  setDrag: (drag: DragState | null) => void;
};

const DragContext = createContext<DragContextValue | null>(null);

export function ReorderableHeaderRow({
  order,
  onMove,
  className,
  children,
}: {
  order: readonly string[];
  onMove: (from: string, to: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  return (
    <DragContext.Provider value={{ order, onMove, drag, setDrag }}>
      <TableRow className={className}>{children}</TableRow>
    </DragContext.Provider>
  );
}

export function ReorderableTableHead({
  column,
  sort,
}: {
  column: ReorderableColumn;
  // Dipakai kalau `column.sortDirection` diisi.
  sort?: {
    currentSort: string;
    onSortChange: (value: string | undefined) => void;
  };
}) {
  const ctx = useContext(DragContext);
  if (!ctx) {
    throw new Error("ReorderableTableHead harus di dalam ReorderableHeaderRow");
  }
  const { order, onMove, drag, setDrag } = ctx;
  const { id, label, sortDirection, className } = column;
  const sortable = sortDirection && sort;

  // Garis penanda posisi jatuh: digeser ke kanan -> sisi kanan target,
  // ke kiri -> sisi kiri (sesuai hasil moveColumn).
  const dropSide =
    drag && drag.over === id && drag.from !== id
      ? order.indexOf(drag.from) < order.indexOf(id)
        ? "right"
        : "left"
      : null;

  return (
    <TableHead
      draggable
      title="Geser untuk memindahkan kolom"
      aria-sort={sortable ? sortAriaValue(id, sort.currentSort) : undefined}
      className={cn(
        "group/col relative cursor-grab active:cursor-grabbing",
        drag?.from === id && "opacity-40",
        dropSide &&
          "before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-primary",
        dropSide === "left" && "before:left-0",
        dropSide === "right" && "before:right-0",
        className,
      )}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox baru mulai drag kalau ada data.
        e.dataTransfer.setData("text/plain", label);
        setDrag({ from: id, over: null });
      }}
      onDragOver={(e) => {
        // Abaikan drag dari luar header tabel ini (teks, file, tabel lain).
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (drag.over !== id) setDrag({ ...drag, over: id });
      }}
      onDragLeave={(e) => {
        if (
          drag?.over === id &&
          !e.currentTarget.contains(e.relatedTarget as Node | null)
        ) {
          setDrag({ ...drag, over: null });
        }
      }}
      onDrop={(e) => {
        if (!drag) return;
        e.preventDefault();
        onMove(drag.from, id);
        setDrag(null);
      }}
      onDragEnd={() => setDrag(null)}
    >
      <span className="inline-flex items-center gap-1">
        <GripVertical className="no-print h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/col:opacity-100" />
        {sortable ? (
          <SortButton
            sortKey={id}
            currentSort={sort.currentSort}
            onSortChange={sort.onSortChange}
            defaultDirection={sortDirection}
            alignRight={className?.includes("text-right")}
          >
            {label}
          </SortButton>
        ) : (
          label
        )}
      </span>
    </TableHead>
  );
}

// Tampil di atas tabel kalau urutan kolom sudah diubah user.
export function ColumnOrderReset({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      Urutan kolom sudah diubah.
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onReset}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Kembalikan urutan bawaan
      </Button>
    </div>
  );
}
