// src/app/(With Sidebar)/vendor-management/VendorManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Edit,
  Plus,
  Trash2,
  Mail,
  User,
  MapPin,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Vendor, Profile } from "@/type";
import {
  deleteVendor,
  fetchVendors,
  createVendor,
  updateVendor,
} from "@/services/vendorService";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LIMIT_OPTIONS } from "@/type/enum";
import { PaginationComponent } from "@/components/pagination-components";

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
export function VendorManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  // State Dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const limit = Number(searchParams.get("limit") || 25);

  // State untuk input form
  const [searchInput, setSearchInput] = useState(searchTerm);

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

  const loadData = useCallback(() => {
    async function fetchData() {
      setLoading(true);

      // (Security Check: Pastikan hanya Admin yang akses halaman ini)
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        const { data: profile } = await s
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role !== "admin") {
          toast.error("Akses ditolak. Hanya Admin yang bisa mengelola Vendor.");
          router.push("/dashboard");
          return;
        }
      }

      try {
        const { data: vData, count } = await fetchVendors(
          currentPage,
          limit,
          searchTerm
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
  }, [s, currentPage, limit, searchTerm, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleOpenNew = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
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
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Vendor
          </Button>
        }
        className="col-span-12"
      >
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan Kode, Nama, atau PIC..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead>Kode Vendor</TableHead>
                <TableHead>Nama Vendor</TableHead>
                <TableHead>PIC Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || isPending ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
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
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(vendor)}
                      >
                        <Edit className="mr-2 h-3 w-3" /> Edit
                      </Button>
                      <ConfirmDialog
                        title={`Hapus Vendor: ${vendor.kode_vendor}`}
                        description="Apakah Anda yakin ingin menghapus data Vendor ini? Tindakan ini tidak dapat dibatalkan."
                        onConfirm={() => handleDelete(vendor.id)}
                      >
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </ConfirmDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Tidak ada data vendor ditemukan.
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
                    `${pathname}?${createQueryString({ limit: value })}`
                  )
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
            <span>dari {totalItems} vendor.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
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
