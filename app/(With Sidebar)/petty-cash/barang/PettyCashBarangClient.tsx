// src/app/(With Sidebar)/petty-cash/barang/PettyCashBarangClient.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, ComboboxData } from "@/components/combobox";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import { Loader2, Search, Edit, Plus, Trash2, Box } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PettyCashBarang, Profile } from "@/type";
import {
  fetchPettyCashBarang,
  createPettyCashBarang,
  updatePettyCashBarang,
  deletePettyCashBarang,
  PettyCashBarangFormInput,
} from "@/services/pettyCashBarangService";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  LIMIT_OPTIONS,
  PETTY_CASH_BARANG_KATEGORI_OPTIONS,
  UOM_OPTIONS,
} from "@/type/enum";
import { PaginationComponent } from "@/components/pagination-components";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

// Diurutkan A-Z di sini (bukan di type/enum.ts) supaya daftar sumbernya tetap
// bisa dikelompokkan per makna, sementara yang tampil di combobox tetap
// alfabetis biar gampang di-scan.
const KATEGORI_COMBOBOX_DATA: ComboboxData = [
  ...PETTY_CASH_BARANG_KATEGORI_OPTIONS,
]
  .sort((a, b) => a.localeCompare(b))
  .map((k) => ({ value: k, label: k }));
const UOM_COMBOBOX_DATA: ComboboxData = [...UOM_OPTIONS]
  .sort((a, b) => a.localeCompare(b))
  .map((u) => ({ value: u, label: u }));

const EMPTY_FORM: PettyCashBarangFormInput = {
  part_number: "",
  part_name: "",
  category: "",
  uom: "",
  vendor: "",
  last_purchase_price: 0,
  link: "",
  description: "",
};

// --- Dialog Tambah / Edit Barang Petty Cash ---
function BarangDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  initialData: PettyCashBarang | null; // null = Mode Tambah
}) {
  const [formData, setFormData] =
    useState<PettyCashBarangFormInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const isCreateMode = !initialData;

  useEffect(() => {
    if (initialData) {
      setFormData({
        part_number: initialData.part_number ?? "",
        part_name: initialData.part_name ?? "",
        category: initialData.category ?? "",
        uom: initialData.uom ?? "",
        vendor: initialData.vendor ?? "",
        last_purchase_price: initialData.last_purchase_price ?? 0,
        link: initialData.link ?? "",
        description: initialData.description ?? "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [initialData, open]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.part_name?.trim()) {
      toast.error("Nama Barang wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const payload: PettyCashBarangFormInput = {
        ...formData,
        part_number: formData.part_number?.trim() || null,
        category: formData.category?.trim() || null,
        uom: formData.uom?.trim() || null,
        vendor: formData.vendor?.trim() || null,
        link: formData.link?.trim() || null,
        description: formData.description?.trim() || "",
      };

      if (initialData) {
        await updatePettyCashBarang(initialData.id, payload);
        toast.success(`Barang "${formData.part_name}" berhasil diperbarui.`);
      } else {
        await createPettyCashBarang(payload);
        toast.success(`Barang "${formData.part_name}" berhasil ditambahkan.`);
      }
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan data", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    // modal={false}: Radix Dialog secara default mengunci scroll di body,
    // yang juga mem-block wheel-scroll di dalam Popover (Combobox Kategori/
    // Satuan) yang di-portal terpisah - nonaktifkan lock itu supaya list
    // combobox tetap bisa di-scroll saat dialog ini terbuka.
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode
              ? "Tambah Barang Petty Cash"
              : `Edit Barang: ${initialData?.part_name}`}
          </DialogTitle>
          <DialogDescription>
            Katalog barang ini khusus dipakai untuk pengajuan Petty Cash,
            terpisah dari master barang MR/PO.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="part_name">
              Nama Barang <span className="text-red-500">*</span>
            </Label>
            <Input
              id="part_name"
              name="part_name"
              value={formData.part_name || ""}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Ex: Konsumsi Acara"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="part_number">
                Kode Barang{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opsional)
                </span>
              </Label>
              <Input
                id="part_number"
                name="part_number"
                value={formData.part_number || ""}
                onChange={handleInputChange}
                disabled={loading}
                placeholder="Ex: PC-001"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Kategori</Label>
              <Combobox
                id="category"
                data={KATEGORI_COMBOBOX_DATA}
                defaultValue={formData.category || ""}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, category: val }))
                }
                placeholder="Cari kategori..."
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="uom">Satuan (UoM)</Label>
              <Combobox
                id="uom"
                data={UOM_COMBOBOX_DATA}
                defaultValue={formData.uom || ""}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, uom: val }))
                }
                placeholder="Cari satuan..."
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_purchase_price">Harga Referensi</Label>
              <CurrencyInput
                value={formData.last_purchase_price || 0}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    last_purchase_price: val,
                  }))
                }
                disabled={loading}
                placeholder="Rp 0"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendor">
              Vendor / Toko Langganan{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opsional)
              </span>
            </Label>
            <Input
              id="vendor"
              name="vendor"
              value={formData.vendor || ""}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Ex: Indomaret / Toko ATK Jaya"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link">
              Link Referensi{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opsional)
              </span>
            </Label>
            <Input
              id="link"
              name="link"
              value={formData.link || ""}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="https://..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Catatan</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              disabled={loading}
              rows={3}
              placeholder="Spesifikasi atau catatan tambahan..."
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

export default function PettyCashBarangClient() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<PettyCashBarang[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PettyCashBarang | null>(
    null,
  );

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchTerm);

  const canModify =
    !!profile &&
    (profile.role === "admin" || isGADepartment(profile.department));

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
    [searchParams],
  );

  const loadData = useCallback(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          setProfile(profileData);
        }

        const { data: rows, count } = await fetchPettyCashBarang(
          currentPage,
          limit,
          searchTerm,
        );
        setData(rows);
        setTotalItems(count);
      } catch (err: any) {
        toast.error("Gagal memuat data barang", { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase, currentPage, limit, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`,
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleOpenNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: PettyCashBarang) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = async (item: PettyCashBarang) => {
    const toastId = toast.loading("Menghapus barang...");
    try {
      await deletePettyCashBarang(item.id);
      toast.success("Barang berhasil dihapus.", { id: toastId });
      loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus barang", {
        id: toastId,
        description: err.message,
      });
    }
  };

  return (
    <>
      <Content
        title="Barang Petty Cash"
        description="Katalog barang khusus Petty Cash - terpisah dari master barang MR/PO. Hanya GA & Admin yang bisa menambah/mengubah/menghapus."
        cardAction={
          canModify && (
            <Button onClick={handleOpenNew}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Barang
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Nama, Kode, Kategori, atau Vendor..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead className="w-[120px]">Kode</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead className="w-[120px]">Kategori</TableHead>
                <TableHead className="w-[90px]">UoM</TableHead>
                <TableHead className="w-[140px] text-right">
                  Harga Ref
                </TableHead>
                <TableHead className="w-[160px]">Terakhir Diubah</TableHead>
                {canModify && (
                  <TableHead className="w-[110px] text-right">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || isPending ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : data.length > 0 ? (
                data.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {(currentPage - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.part_number || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.part_name}</div>
                      {item.description && (
                        <div
                          className="text-xs text-muted-foreground truncate max-w-[280px]"
                          title={item.description}
                        >
                          {item.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.category || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.uom || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {item.last_purchase_price
                        ? formatCurrency(item.last_purchase_price)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{item.updated_by_profile?.nama || "-"}</div>
                      <div>
                        {format(new Date(item.updated_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    </TableCell>
                    {canModify && (
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <ConfirmDialog
                          title={`Hapus Barang: ${item.part_name}`}
                          description="Apakah Anda yakin ingin menghapus barang ini dari katalog Petty Cash? Tindakan ini tidak dapat dibatalkan."
                          onConfirm={() => handleDelete(item)}
                        >
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </ConfirmDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center h-24 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Box className="h-6 w-6" />
                      Belum ada data barang Petty Cash.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Tampilkan</span>
            <Select
              value={String(limit)}
              onValueChange={(value) =>
                startTransition(() =>
                  router.push(
                    `${pathname}?${createQueryString({ limit: value })}`,
                  ),
                )
              }
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>dari {totalItems} barang.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
      </Content>

      <BarangDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => loadData()}
        initialData={selectedItem}
      />
    </>
  );
}
