// src/components/petty-cash/PcItemsEditor.tsx
//
// Tabel baris item Pengajuan/Voucher/Deklarasi Petty Cash - kombinasi
// combobox katalog + tombol tambah manual + baris qty/harga/catatan/COA
// yang bisa diedit. Diekstrak dari InputPengajuanClient.tsx supaya dipakai
// ulang di form Input Pengajuan ATAUPUN dialog "Edit & Setujui" approver
// (PcEditAndApproveDialog) - dan, dalam mode `readOnly`, buat menampilkan
// snapshot item apa adanya di riwayat revisi (PcRevisionHistory) & panel
// info dokumen (PcDocumentInfoPanel).
//
// COA per baris (lihat komentar PettyCashPengajuanItem.coa, type/index.ts):
//  - coaMode="locked": company submitter sendiri (non-Lourdes) - dikunci,
//    tidak bisa diganti, meski barang katalognya berlaku utk GMI & GIS.
//  - coaMode="choose": akun Lourdes - barang katalog ber-COA tunggal tetap
//    auto-terisi (tidak ambigu), tapi barang ber-COA ganda (atau barang
//    manual) WAJIB dipilih salah satu lewat Select per baris sebelum submit.

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Combobox } from "@/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PettyCashItemSearchCombobox } from "./PettyCashItemSearchCombobox";
import { PcCoaBadge } from "./PcCoaBadge";
import { PettyCashBarang, PettyCashPengajuanItem } from "@/type";
import { PC_COA_OPTIONS, UOM_OPTIONS } from "@/type/enum";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

const UOM_COMBOBOX_DATA = [...UOM_OPTIONS]
  .sort((a, b) => a.localeCompare(b))
  .map((u) => ({ value: u, label: u }));

const makeRowKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

type ItemRow = {
  _rowKey: string;
  barang_id: number | null;
  part_name: string;
  category: string | null;
  uom: string | null;
  qty: string; // string di state biar field bisa dikosongkan, dikonversi Number saat submit
  unit_price: number;
  note: string;
  coa: "GMI" | "GIS" | null;
  // COA yang berlaku di katalog barang ini (kalau row berasal dari
  // katalog) - dipakai membatasi opsi Select saat coaMode="choose". null/
  // undefined = barang manual, kedua opsi GMI/GIS berlaku.
  catalogCoa?: ("GMI" | "GIS")[] | null;
};

const toDraftRow = (item: PettyCashPengajuanItem): ItemRow => ({
  _rowKey: makeRowKey(),
  barang_id: item.barang_id,
  part_name: item.part_name,
  category: item.category,
  uom: item.uom,
  qty: String(item.qty),
  unit_price: item.unit_price,
  note: item.note || "",
  coa: item.coa ?? null,
  catalogCoa: null,
});

const toItems = (rows: ItemRow[]): PettyCashPengajuanItem[] =>
  rows.map((r) => ({
    barang_id: r.barang_id,
    part_name: r.part_name,
    category: r.category,
    uom: r.uom,
    qty: Number(r.qty) || 0,
    unit_price: r.unit_price,
    subtotal: (Number(r.qty) || 0) * r.unit_price,
    note: r.note.trim() || null,
    coa: r.coa,
  }));

interface PcItemsEditorProps {
  initialItems?: PettyCashPengajuanItem[];
  onChange?: (items: PettyCashPengajuanItem[]) => void;
  coaMode?: "locked" | "choose";
  lockedCoa?: "GMI" | "GIS" | null;
  // Filter company diteruskan ke combobox pencarian katalog - null/undefined
  // = tidak difilter (Lourdes / mode readOnly).
  coaSearchFilter?: "GMI" | "GIS" | null;
  readOnly?: boolean;
}

export function PcItemsEditor({
  initialItems,
  onChange,
  coaMode = "locked",
  lockedCoa = null,
  coaSearchFilter = null,
  readOnly = false,
}: PcItemsEditorProps) {
  // Lazy init sekali saat mount - komponen ini dipakai di dalam Dialog yang
  // di-mount ulang tiap dibuka (lihat pola `{selected && <Dialog.../>}` di
  // pemanggilnya), jadi initialItems baru otomatis kebaca lagi tiap dialog
  // dibuka ulang tanpa perlu sinkronisasi prop->state manual.
  const [rows, setRows] = useState<ItemRow[]>(() =>
    (initialItems ?? []).map(toDraftRow),
  );

  useEffect(() => {
    if (!readOnly) onChange?.(toItems(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const addItemFromCatalog = (barang: PettyCashBarang) => {
    const catalogCoa = barang.coa ?? [];
    const coa: "GMI" | "GIS" | null =
      coaMode === "locked"
        ? (lockedCoa ?? null)
        : catalogCoa.length === 1
          ? catalogCoa[0]
          : null;

    setRows((prev) => [
      ...prev,
      {
        _rowKey: makeRowKey(),
        barang_id: barang.id,
        part_name: barang.part_name,
        category: barang.category,
        uom: barang.uom,
        qty: "1",
        unit_price: barang.last_purchase_price || 0,
        note: "",
        coa,
        catalogCoa,
      },
    ]);
  };

  const addManualItem = () => {
    setRows((prev) => [
      ...prev,
      {
        _rowKey: makeRowKey(),
        barang_id: null,
        part_name: "",
        category: null,
        uom: null,
        qty: "1",
        unit_price: 0,
        note: "",
        coa: coaMode === "locked" ? (lockedCoa ?? null) : null,
        catalogCoa: null,
      },
    ]);
  };

  const updateRow = (rowKey: string, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((it) => (it._rowKey === rowKey ? { ...it, ...patch } : it)),
    );
  };

  const removeRow = (rowKey: string) =>
    setRows((prev) => prev.filter((it) => it._rowKey !== rowKey));

  const totalAmount = rows.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (it.unit_price || 0),
    0,
  );

  const renderCoaCell = (row: ItemRow) => {
    if (coaMode === "locked") return <PcCoaBadge coa={lockedCoa} />;
    const options = row.catalogCoa?.length ? row.catalogCoa : PC_COA_OPTIONS;
    if (options.length === 1) return <PcCoaBadge coa={options[0]} />;
    return (
      <Select
        value={row.coa ?? ""}
        onValueChange={(val) =>
          updateRow(row._rowKey, { coa: val as "GMI" | "GIS" })
        }
      >
        <SelectTrigger
          className={`h-9 w-[90px] ${!row.coa ? "border-red-400" : ""}`}
        >
          <SelectValue placeholder="Pilih COA" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  if (readOnly) {
    const items = initialItems ?? [];
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Nama Barang</TableHead>
              <TableHead className="w-[80px]">COA</TableHead>
              <TableHead className="w-[100px]">UoM</TableHead>
              <TableHead className="w-[70px]">Qty</TableHead>
              <TableHead className="w-[130px] text-right">
                Harga Satuan
              </TableHead>
              <TableHead className="w-[130px] text-right">Subtotal</TableHead>
              <TableHead className="min-w-[140px]">Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-16 text-muted-foreground"
                >
                  Tidak ada barang.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-medium">{it.part_name}</div>
                    {it.category && (
                      <div className="text-xs text-muted-foreground">
                        {it.category}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <PcCoaBadge coa={it.coa} />
                  </TableCell>
                  <TableCell className="text-sm">{it.uom || "-"}</TableCell>
                  <TableCell className="text-sm">{it.qty}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(it.unit_price)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(it.subtotal)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {it.note || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <PettyCashItemSearchCombobox
            onSelect={addItemFromCatalog}
            coaFilter={coaSearchFilter}
          />
        </div>
        <Button type="button" variant="outline" onClick={addManualItem}>
          <Plus className="mr-2 h-4 w-4" /> Barang Manual
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Nama Barang</TableHead>
              <TableHead className="w-[100px]">COA</TableHead>
              <TableHead className="w-[110px]">UoM</TableHead>
              <TableHead className="w-[90px]">Qty</TableHead>
              <TableHead className="w-[150px]">Harga Satuan</TableHead>
              <TableHead className="w-[140px] text-right">Subtotal</TableHead>
              <TableHead className="min-w-[160px]">Catatan</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center h-24 text-muted-foreground"
                >
                  Belum ada barang ditambahkan.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((it) => (
                <TableRow key={it._rowKey}>
                  <TableCell>
                    {it.barang_id ? (
                      <div>
                        <div className="font-medium">{it.part_name}</div>
                        {it.category && (
                          <div className="text-xs text-muted-foreground">
                            {it.category}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={it.part_name}
                        onChange={(e) =>
                          updateRow(it._rowKey, { part_name: e.target.value })
                        }
                        placeholder="Nama barang manual"
                        className="h-9"
                      />
                    )}
                  </TableCell>
                  <TableCell>{renderCoaCell(it)}</TableCell>
                  <TableCell>
                    {it.barang_id ? (
                      <span className="text-sm">{it.uom || "-"}</span>
                    ) : (
                      <Combobox
                        data={UOM_COMBOBOX_DATA}
                        defaultValue={it.uom || ""}
                        onChange={(val) => updateRow(it._rowKey, { uom: val })}
                        placeholder="Cari satuan..."
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) =>
                        updateRow(it._rowKey, { qty: e.target.value })
                      }
                      className="h-9 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <CurrencyInput
                      value={it.unit_price}
                      onValueChange={(val) =>
                        updateRow(it._rowKey, { unit_price: val })
                      }
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(
                      (Number(it.qty) || 0) * (it.unit_price || 0),
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={it.note}
                      onChange={(e) =>
                        updateRow(it._rowKey, { note: e.target.value })
                      }
                      placeholder="-"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeRow(it._rowKey)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** True kalau ada baris yang belum punya COA - dipakai validasi submit. */
export const hasUnresolvedCoa = (items: PettyCashPengajuanItem[]): boolean =>
  items.some((it) => !it.coa);
