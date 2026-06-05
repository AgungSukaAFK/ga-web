// src/app/(With Sidebar)/stok-ga/GaStockClient.tsx

"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination-components";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { isGADepartment } from "@/lib/constants/departments";
import { Loader2, Search, Plus, Edit, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Barang, GaStock, Profile } from "@/type";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMIT_OPTIONS } from "@/type/enum";
import { User } from "@supabase/supabase-js";
import { BarangSearchCombobox } from "../purchase-order/BarangSearchCombobox";
import {
  createGaStock,
  deleteGaStock,
  fetchGaStocks,
  updateGaStock,
} from "@/services/gaStockService";

const COMPANY_OPTIONS = ["GMI", "GIS", "LOURDES"];

// --- Dialog Tambah / Edit Stok ---
function StockDialog({
  open,
  onOpenChange,
  onSave,
  authUser,
  adminProfile,
  stock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  authUser: User | null;
  adminProfile: Profile | null;
  stock: GaStock | null; // null = Mode Tambah
}) {
  const isCreate = !stock;
  const isLourdes = adminProfile?.company === "LOURDES";

  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [companyCode, setCompanyCode] = useState("");
  // Disimpan sebagai string agar field bisa dikosongkan (hindari "0" yang lengket).
  const [quantity, setQuantity] = useState<string>("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stock) {
      setSelectedBarang(null);
      setCompanyCode(stock.company_code);
      setQuantity(String(Number(stock.quantity) || 0));
      setLocation(stock.location || "");
      setNote(stock.note || "");
    } else {
      setSelectedBarang(null);
      // Non-LOURDES otomatis terkunci ke perusahaannya
      setCompanyCode(isLourdes ? "" : adminProfile?.company || "");
      setQuantity("");
      setLocation("");
      setNote("");
    }
  }, [stock, open, isLourdes, adminProfile?.company]);

  const handleSubmit = async () => {
    if (!authUser) {
      toast.error("Sesi pengguna tidak ditemukan.");
      return;
    }
    if (isCreate && !selectedBarang) {
      toast.error("Pilih barang dari database terlebih dahulu.");
      return;
    }
    if (!companyCode) {
      toast.error("Perusahaan wajib dipilih.");
      return;
    }
    const qtyNum = Number(quantity);
    if (quantity.trim() === "" || Number.isNaN(qtyNum) || qtyNum < 0) {
      toast.error("Jumlah stok tidak valid.");
      return;
    }

    setLoading(true);
    try {
      if (isCreate) {
        await createGaStock(
          {
            barang_id: selectedBarang!.id,
            company_code: companyCode,
            quantity: qtyNum,
            location: location.trim() || null,
            note: note.trim() || null,
          },
          authUser.id,
        );
        toast.success("Stok berhasil ditambahkan.");
      } else {
        await updateGaStock(
          stock!.id,
          {
            quantity: qtyNum,
            location: location.trim() || null,
            note: note.trim() || null,
          },
          authUser.id,
        );
        toast.success("Stok berhasil diperbarui.");
      }
      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Gagal menyimpan stok", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const barangLabel = isCreate
    ? selectedBarang
      ? `${selectedBarang.part_name || "-"} (${selectedBarang.part_number})`
      : "Belum dipilih"
    : `${stock?.barang?.part_name || "-"} (${stock?.barang?.part_number || "-"})`;

  const uom = isCreate ? selectedBarang?.uom : stock?.barang?.uom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? "Tambah Stok GA" : "Edit Stok"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Pilih barang dari database, lalu masukkan jumlah stoknya."
              : "Perbarui jumlah, lokasi, atau catatan stok."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Barang</Label>
            {isCreate ? (
              <>
                <BarangSearchCombobox onSelect={setSelectedBarang} />
                <p className="text-sm text-muted-foreground">
                  Terpilih: <span className="font-medium">{barangLabel}</span>
                </p>
              </>
            ) : (
              <div className="flex h-10 w-full items-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {barangLabel}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Perusahaan</Label>
            {isCreate && isLourdes ? (
              <Select value={companyCode} onValueChange={setCompanyCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih perusahaan..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 w-full items-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {companyCode || "-"}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qty">Jumlah Stok{uom ? ` (${uom})` : ""}</Label>
            <Input
              id="qty"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Lokasi Penyimpanan (opsional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Mis: Gudang HO Rak A"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tambahan..."
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Komponen Utama ---
export function GaStockClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<GaStock[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const companyFilter = searchParams.get("company") || "";

  const [searchInput, setSearchInput] = useState(searchTerm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<GaStock | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
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
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setAuthUser(user);

      const { data: profileData } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const isAllowed =
        profileData &&
        (isGADepartment(profileData.department) ||
          profileData.role === "admin");
      if (!isAllowed) {
        toast.error("Akses ditolak. Halaman ini khusus GA & Admin.");
        router.push("/dashboard");
        return;
      }
      setAdminProfile(profileData);

      try {
        const { data: rows, count } = await fetchGaStocks(
          currentPage,
          limit,
          searchTerm,
          companyFilter,
          profileData,
        );
        setData(rows);
        setTotalItems(count);
      } catch (err: any) {
        toast.error("Gagal memuat stok", { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [s, currentPage, limit, searchTerm, companyFilter, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(`${pathname}?${createQueryString({ search: searchInput })}`);
        });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleOpenNew = () => {
    setSelectedStock(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (stock: GaStock) => {
    setSelectedStock(stock);
    setIsFormOpen(true);
  };

  const handleDelete = async (stock: GaStock) => {
    if (
      !confirm(
        `Hapus stok untuk "${stock.barang?.part_name || stock.barang?.part_number || "barang ini"}" (${stock.company_code})?`,
      )
    )
      return;
    setDeletingId(stock.id);
    try {
      await deleteGaStock(stock.id);
      toast.success("Stok dihapus.");
      loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus stok", { description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Content
        title="Stok GA"
        description="Stok barang yang dikelola GA. Tidak semua barang punya stok."
        cardAction={
          <Button onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Stok
          </Button>
        }
        className="col-span-12"
      >
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Part Number atau Nama Barang..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {adminProfile?.company === "LOURDES" && (
            <div className="flex flex-col gap-2 md:w-56">
              <Label className="text-sm font-medium">Perusahaan</Label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    company: value === "all" ? undefined : value,
                  })
                }
                defaultValue={companyFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Perusahaan</SelectItem>
                  {COMPANY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Barang</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Catatan</TableHead>
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
              ) : data.length > 0 ? (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.barang?.part_name || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.barang?.part_number || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.company_code}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Number(item.quantity)}
                      {item.barang?.uom ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {item.barang.uom}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {item.location || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.note || "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Edit className="mr-2 h-3 w-3" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Belum ada data stok.
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
              onValueChange={(value) => handleFilterChange({ limit: value })}
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
            <span>dari {totalItems} item stok.</span>
          </div>
          <PaginationComponent
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / limit)}
            limit={limit}
            basePath={pathname}
          />
        </div>
      </Content>

      <StockDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={() => loadData()}
        authUser={authUser}
        adminProfile={adminProfile}
        stock={selectedStock}
      />
    </>
  );
}
