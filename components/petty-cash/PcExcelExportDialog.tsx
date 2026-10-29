// src/components/petty-cash/PcExcelExportDialog.tsx
//
// Dialog "Download Excel - All Document" Petty Cash (Management Petty Cash,
// admin/GA/Finance). Filter berlaku di level Pengajuan - seluruh Voucher,
// Tarik Dana, Deklarasi, Pengembalian & Pembatalan dari Pengajuan yang lolos
// filter ikut diekspor (lihat services/pettyCashExportService.ts). Sheet
// bisa dipilih; filter kosong = semua data yang boleh diakses user.
//
// `allowedCompanies` null = tanpa batas (admin). Selain itu pilihan company
// dikunci ke daftar itu (GA/Finance company sendiri, LOURDES semua).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/date-picker";
import { toast } from "@/lib/toast";
import { getLocalDateString } from "@/lib/utils";
import { dataDepartment, dataLokasi } from "@/type/comboboxData";
import { PC_PENGAJUAN_STATUS_OPTIONS } from "@/type/enum";
import {
  EMPTY_PC_EXPORT_FILTERS,
  exportPettyCashExcel,
  hasPcExportFilter,
  PC_EXPORT_SHEETS,
  PcExportFilters,
  PcExportSheetKey,
} from "@/services/pettyCashExportService";
import { FileSpreadsheet, Loader2 } from "lucide-react";

const ALL = "all";
const ALL_COMPANIES = ["GMI", "GIS", "LOURDES"];

const toDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`) : undefined);

export function PcExcelExportDialog({
  open,
  onOpenChange,
  allowedCompanies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedCompanies: string[] | null;
}) {
  const [filters, setFilters] = useState<PcExportFilters>(
    EMPTY_PC_EXPORT_FILTERS,
  );
  const [sheets, setSheets] = useState<PcExportSheetKey[]>(
    PC_EXPORT_SHEETS.map((s) => s.key),
  );
  const [exporting, setExporting] = useState(false);

  const companyOptions = allowedCompanies ?? ALL_COMPANIES;
  const set = <K extends keyof PcExportFilters>(
    key: K,
    value: PcExportFilters[K],
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleSheet = (key: PcExportSheetKey, checked: boolean) =>
    setSheets((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );

  const handleExport = async () => {
    if (sheets.length === 0) return toast.error("Pilih minimal 1 sheet.");
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
      return toast.error("Tanggal awal tidak boleh setelah tanggal akhir.");

    setExporting(true);
    toast.info(
      hasPcExportFilter(filters)
        ? "Mempersiapkan data sesuai filter..."
        : "Mempersiapkan semua data...",
    );
    try {
      const count = await exportPettyCashExcel(
        filters,
        allowedCompanies,
        sheets,
      );
      if (count === 0) {
        toast.warning(
          hasPcExportFilter(filters)
            ? "Tidak ada data untuk diekspor sesuai filter."
            : "Tidak ada data untuk diekspor.",
        );
        return;
      }
      toast.success(`Download berhasil - ${count} Pengajuan beserta turunannya.`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Gagal export excel", { description: error.message });
    } finally {
      setExporting(false);
    }
  };

  const selectField = (
    label: string,
    value: string | null,
    onChange: (v: string | null) => void,
    options: { value: string; label: string }[],
    allLabel: string,
  ) => (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <SearchableSelect
        value={value ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? null : v)}
      >
        <SearchableSelectTrigger>
          <SearchableSelectValue placeholder={allLabel} />
        </SearchableSelectTrigger>
        <SearchableSelectContent>
          <SearchableSelectItem value={ALL}>{allLabel}</SearchableSelectItem>
          {options.map((o) => (
            <SearchableSelectItem key={o.value} value={o.value}>
              {o.label}
            </SearchableSelectItem>
          ))}
        </SearchableSelectContent>
      </SearchableSelect>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !exporting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Download Excel - Semua Dokumen Petty Cash
          </DialogTitle>
          <DialogDescription>
            Filter berlaku ke Pengajuan; Voucher, Tarik Dana, Deklarasi,
            Pengembalian & Pembatalan dari Pengajuan tersebut ikut diekspor.
            Biarkan kosong untuk semua data yang bisa Anda akses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Tanggal Pengajuan (dari)</Label>
              <DatePicker
                value={toDate(filters.dateFrom)}
                onChange={(d) =>
                  set("dateFrom", d ? getLocalDateString(d) : null)
                }
                placeholder="Semua tanggal"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tanggal Pengajuan (sampai)</Label>
              <DatePicker
                value={toDate(filters.dateTo)}
                onChange={(d) => set("dateTo", d ? getLocalDateString(d) : null)}
                placeholder="Semua tanggal"
              />
            </div>
            {companyOptions.length > 1
              ? selectField(
                  "Company",
                  filters.company,
                  (v) => set("company", v),
                  companyOptions.map((c) => ({ value: c, label: c })),
                  "Semua Company",
                )
              : (
                <div className="flex flex-col gap-2">
                  <Label>Company</Label>
                  <p className="h-9 rounded-md border bg-muted/40 px-3 text-sm leading-9">
                    {companyOptions[0] ?? "-"}
                  </p>
                </div>
              )}
            {selectField(
              "Status Pengajuan",
              filters.status,
              (v) => set("status", v),
              PC_PENGAJUAN_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
              "Semua Status",
            )}
            {selectField(
              "Departemen",
              filters.department,
              (v) => set("department", v),
              dataDepartment,
              "Semua Departemen",
            )}
            {selectField(
              "Site",
              filters.site,
              (v) => set("site", v),
              dataLokasi,
              "Semua Site",
            )}
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={filters.eskalasiOnly}
              onCheckedChange={(c) => set("eskalasiOnly", c === true)}
            />
            Hanya Pengajuan Eskalasi
          </label>

          <div className="space-y-2">
            <Label>Sheet yang diikutkan</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PC_EXPORT_SHEETS.map((sheet) => (
                <label
                  key={sheet.key}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/40"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={sheets.includes(sheet.key)}
                    onCheckedChange={(c) => toggleSheet(sheet.key, c === true)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{sheet.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {sheet.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setFilters(EMPTY_PC_EXPORT_FILTERS)}
            disabled={exporting || !hasPcExportFilter(filters)}
          >
            Reset Filter
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
