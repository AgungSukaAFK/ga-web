// src/app/(With Sidebar)/vendor-management/VendorManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import {
  SortableTableHead,
  resolveSort,
  type SortColumnConfig,
} from "@/components/sortable-table-head";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  ExcelDownloadMenu,
  type ExcelDownloadMode,
} from "@/components/excel-download-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Edit,
  Plus,
  Trash2,
  Mail,
  User,
  MapPin,
  Building2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "@/lib/toast";
import { Vendor, Profile } from "@/type";
import {
  deleteVendor,
  fetchAllVendors,
  fetchVendors,
  createVendor,
  updateVendor,
} from "@/services/vendorService";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LIMIT_OPTIONS, VENDOR_TIPE_OPTIONS, VENDOR_TIPE_LABELS } from "@/type/enum";
import { Badge } from "@/components/ui/badge";
import { exportStyledExcel } from "@/lib/excel-export";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";

// --- Komponen Dialog CRUD Vendor ---
function VendorDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  initialData: Vendor | null; // null = Create Mode
}) {
  const [formData, setFormData] = useState<Partial<Vendor>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({});
    }
  }, [initialData, open]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.kode_vendor || !formData.nama_vendor) {
      toast.error("Kode dan Nama Vendor wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      if (initialData) {
        // Mode Edit
        await updateVendor(initialData.id, formData as any);
        toast.success(`Vendor ${formData.nama_vendor} berhasil diperbarui.`);
      } else {
        // Mode Create
        await createVendor(formData as any);
        toast.success(`Vendor ${formData.nama_vendor} berhasil dibuat.`);
      }
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const isCreateMode = !initialData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode
              ? "Tambah Vendor Baru"
              : `Edit Vendor: ${initialData?.nama_vendor}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="kode_vendor" className="text-right">
              Kode Vendor
            </Label>
            <Input
              id="kode_vendor"
              name="kode_vendor"
              value={formData.kode_vendor || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading || !isCreateMode} // Kode Vendor hanya bisa diisi saat buat baru
              placeholder="Ex: V-001"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nama_vendor" className="text-right">
              Nama Vendor
            </Label>
            <Input
              id="nama_vendor"
              name="nama_vendor"
              value={formData.nama_vendor || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Ex: PT Solusi Indah"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tipe_vendor" className="text-right">
              Tipe Vendor
            </Label>
            <SearchableSelect
              value={formData.tipe_vendor || undefined}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  tipe_vendor: value as Vendor["tipe_vendor"],
                }))
              }
              disabled={loading}
            >
              <SearchableSelectTrigger className="col-span-3">
                <SearchableSelectValue placeholder="Pilih tipe vendor..." />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                {VENDOR_TIPE_OPTIONS.map((opt) => (
                  <SearchableSelectItem key={opt} value={opt}>
                    {VENDOR_TIPE_LABELS[opt]}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pic_contact_person" className="text-right">
              PIC Contact
            </Label>
            <Input
              id="pic_contact_person"
              name="pic_contact_person"
              value={formData.pic_contact_person || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Ex: Bpk. Budi (0812...)"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email || ""}
              onChange={handleInputChange}
              className="col-span-3"
              disabled={loading}
              placeholder="Ex: vendor@email.com"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="alamat" className="text-right pt-2">
              Alamat
            </Label>
            <Textarea
              id="alamat"
              name="alamat"
              value={formData.alamat || ""}
              onChange={handleInputChange}
              className="col-span-3"
              rows={3}
              disabled={loading}
              placeholder="Ex: Jl. Industri Raya No. 12"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Simpan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Komponen Klien Utama ---
// Kolom yang bisa di-sort lewat klik header tabel (key = nilai di URL).
const DEFAULT_SORT = "nama_vendor.asc";
const SORTABLE_COLUMNS: Record<string, SortColumnConfig> = {
  kode_vendor: { column: "kode_vendor" },
  nama_vendor: { column: "nama_vendor" },
  tipe_vendor: { column: "tipe_vendor" },
  pic_contact_person: { column: "pic_contact_person" },
  email: { column: "email" },
  alamat: { column: "alamat" },
};

const SEARCH_FIELDS = [
  "Kode Vendor",
  "Nama Vendor",
  "PIC Contact",
];

export function VendorManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // State Dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const sortFilter = searchParams.get("sort") || DEFAULT_SORT;
  const limit = Number(searchParams.get("limit") || 25);

  // State untuk input form
  // Push ke URL hanya dari ketikan user - lihat hooks/use-url-search-input.ts
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) =>
      startTransition(() => {
        router.push(`${pathname}?${createQueryString({ search: value })}`);
      }),
  );

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams]
  );

  const handlePageChange = (page: number) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ page })}`);
    });
  };

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const loadData = useCallback(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const { data: vData, count } = await fetchVendors(
          currentPage,
          limit,
          searchTerm,
          resolveSort(sortFilter, SORTABLE_COLUMNS, DEFAULT_SORT),
        );
        setVendorList(vData);
        setTotalItems(count);
      } catch (err: any) {
        toast.error("Gagal memuat data Vendor", { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [s, currentPage, limit, searchTerm, sortFilter, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenNew = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
  };

  const fetchAllVendorCount = async () => {
    const { count } = await fetchVendors(1, 1, null);
    return count;
  };

  const handleDownloadExcel = async (mode: ExcelDownloadMode) => {
    setIsExporting(true);
    const toastId = toast.loading("Menyiapkan data vendor...");
    try {
      const data = await fetchAllVendors(mode === "filtered" ? searchTerm : null);
      if (data.length === 0) {
        toast.warning("Tidak ada data vendor untuk diexport.", { id: toastId });
        return;
      }
      const dataToExport = data.map((vendor, index) => ({
        No: index + 1,
        "Kode Vendor": vendor.kode_vendor,
        "Nama Vendor": vendor.nama_vendor,
        "Tipe Vendor": vendor.tipe_vendor
          ? VENDOR_TIPE_LABELS[vendor.tipe_vendor]
          : "-",
        "PIC Contact": vendor.pic_contact_person || "-",
        Email: vendor.email || "-",
        Alamat: vendor.alamat || "-",
      }));
      await exportStyledExcel(
        dataToExport,
        `Data_Vendor_${new Date().toISOString().split("T")[0]}.xlsx`,
        "Data Vendor",
      );
      toast.success("File Excel berhasil didownload!", { id: toastId });
    } catch (err: any) {
      toast.error("Gagal export data vendor", { description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    const toastId = toast.loading("Menghapus Vendor...");
    try {
      await deleteVendor(id);
      toast.success("Vendor berhasil dihapus.", { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus Vendor", {
        id: toastId,
        description: err.message,
      });
    }
  };

  return (
    <>
      <Content
        title="Manajemen Vendor"
        description="Kelola daftar Vendor (Pemasok) untuk Purchase Order."
        cardAction={
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenNew}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Vendor
            </Button>
          </div>
        }
        className="col-span-12"
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <ListSearchInput
            placeholder="Cari kode, nama, atau PIC..."
            value={searchInput}
            onChange={setSearchInput}
            searchableFields={SEARCH_FIELDS}
          />
          <ExcelDownloadMenu
            itemLabel="vendor"
            filteredCount={totalItems}
            fetchAllCount={fetchAllVendorCount}
            onDownload={handleDownloadExcel}
            isExporting={isExporting}
          />
        </div>

        <StickyHeaderTable
          className="min-w-[1200px]"
          containerClassName="border rounded-md overflow-x-auto"
          header={
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <SortableTableHead
              sortKey="kode_vendor"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              Kode Vendor
            </SortableTableHead>
              <SortableTableHead
              sortKey="nama_vendor"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              Nama Vendor
            </SortableTableHead>
              <SortableTableHead
              sortKey="tipe_vendor"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              Tipe Vendor
            </SortableTableHead>
              <SortableTableHead
              sortKey="pic_contact_person"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              PIC Contact
            </SortableTableHead>
              <SortableTableHead
              sortKey="email"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              Email
            </SortableTableHead>
              <SortableTableHead
              sortKey="alamat"
              currentSort={sortFilter}
              onSortChange={(sort) => handleFilterChange({ sort })}
            >
              Alamat
            </SortableTableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          }
        >
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : vendorList.length > 0 ? (
              vendorList.map((vendor, index) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">
                    {vendor.kode_vendor}
                  </TableCell>
                  <TableCell>{vendor.nama_vendor}</TableCell>
                  <TableCell>
                    {vendor.tipe_vendor ? (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {VENDOR_TIPE_LABELS[vendor.tipe_vendor]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {vendor.pic_contact_person || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {vendor.email || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="truncate">{vendor.alamat || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActionsMenu>
                      <DropdownMenuItem onSelect={() => handleOpenEdit(vendor)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() =>
                          setConfirmAction({
                            title: `Hapus Vendor: ${vendor.kode_vendor}`,
                            description:
                              "Apakah Anda yakin ingin menghapus data Vendor ini? Tindakan ini tidak dapat dibatalkan.",
                            onConfirm: () => handleDelete(vendor.id),
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </RowActionsMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24">
                  Tidak ada data vendor ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </StickyHeaderTable>

        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title={confirmAction?.title ?? ""}
          description={confirmAction?.description ?? ""}
          confirmText={confirmAction?.confirmText}
          cancelText={confirmAction?.cancelText}
          onConfirm={() => confirmAction?.onConfirm()}
        />
        <TablePaginationFooter
          currentPage={currentPage}
          totalItems={totalItems}
          limit={limit}
          limitOptions={LIMIT_OPTIONS}
          itemLabel="vendor"
          onPageChange={handlePageChange}
          onLimitChange={(value) => handleFilterChange({ limit: value })}
          className="mt-6"
        />
      </Content>

      <VendorDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => loadData()}
        initialData={selectedVendor}
      />
    </>
  );
}
