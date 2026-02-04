// src/app/(With Sidebar)/barang/BarangClient.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Content } from "@/components/content";
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Edit,
  FileSpreadsheet,
  Box,
  Tag,
  DollarSign,
  Link as LinkIcon,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Barang } from "@/type";
import { formatCurrency, cn } from "@/lib/utils"; // Pastikan cn ada di utils atau hapus jika tidak pakai
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

// --- 1. Helper Component untuk Text Ellipsis ---
const TruncatedCell = ({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) => {
  if (!text) return <span className="text-muted-foreground">-</span>;
  return (
    <div
      className={cn("truncate", className)}
      title={text} // Tooltip bawaan browser
    >
      {text}
    </div>
  );
};

export default function BarangClient() {
  const router = useRouter();
  const supabase = createClient();

  // --- STATE ---
  const [data, setData] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  // Filter & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAssetFilter, setIsAssetFilter] = useState<"all" | "true" | "false">(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Detail Dialog State
  const [selectedItem, setSelectedItem] = useState<Barang | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "");
      }

      const { data: barangData, error } = await supabase
        .from("barang")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Gagal mengambil data barang");
      } else {
        setData(barangData || []);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // --- FILTERING LOGIC ---
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch =
        (item.part_name?.toLowerCase() || "").includes(
          searchTerm.toLowerCase(),
        ) ||
        (item.part_number?.toLowerCase() || "").includes(
          searchTerm.toLowerCase(),
        ) ||
        (item.vendor?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;

      let matchesAsset = true;
      if (isAssetFilter === "true") matchesAsset = item.is_asset === true;
      if (isAssetFilter === "false") matchesAsset = item.is_asset === false;

      return matchesSearch && matchesCategory && matchesAsset;
    });
  }, [data, searchTerm, selectedCategory, isAssetFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = data
      .map((item) => item.category)
      .filter((c): c is string => !!c);
    return Array.from(new Set(cats)).sort();
  }, [data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, isAssetFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // --- HANDLERS ---
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast.warning("Tidak ada data untuk diexport");
      return;
    }
    const dataToExport = filteredData.map((item, index) => ({
      No: index + 1,
      "Part Number": item.part_number,
      "Nama Barang": item.part_name,
      Kategori: item.category,
      UoM: item.uom,
      Vendor: item.vendor,
      "Harga Ref": item.last_purchase_price,
      Link: item.link,
      Aset: item.is_asset ? "Ya" : "Tidak",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Barang");
    XLSX.writeFile(
      workbook,
      `Master_Barang_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("File Excel berhasil didownload!");
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("barang").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus barang");
    } else {
      toast.success("Barang berhasil dihapus");
      setData((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const openDetail = (item: Barang) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const canModify = [
    "admin",
    "approver",
    "Purchasing",
    "General Affair",
  ].includes(userRole);

  return (
    <>
      <Content
        title="Master Data Barang"
        description="Klik pada baris barang untuk melihat detail lengkap."
        size="lg"
        cardAction={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={loading}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
              Excel
            </Button>
            {canModify && (
              <Button onClick={() => router.push("/barang/tambah")}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* --- FILTER BAR --- */}
          <div className="flex flex-col lg:flex-row gap-4 bg-muted/20 p-4 rounded-lg border">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari PN, Nama, atau Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-background"
              />
            </div>
            <div className="w-full lg:w-[180px]">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-[150px]">
              <Select
                value={isAssetFilter}
                onValueChange={(val: any) => setIsAssetFilter(val)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Tipe Aset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="true">Asset</SelectItem>
                  <SelectItem value="false">Barang</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- TABLE --- */}
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="w-[130px]">Part Number</TableHead>
                  <TableHead className="min-w-[200px]">Nama Barang</TableHead>
                  <TableHead className="w-[120px]">Kategori</TableHead>
                  <TableHead className="w-[150px]">Vendor</TableHead>
                  <TableHead className="w-[140px] text-right">
                    Harga Ref
                  </TableHead>
                  <TableHead className="w-[80px] text-center">Aset</TableHead>
                  {canModify && (
                    <TableHead className="w-[100px] text-right">Aksi</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" /> Memuat
                        data...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Data tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(item)}
                    >
                      <TableCell>
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-medium">
                        {item.part_number}
                      </TableCell>

                      <TableCell>
                        <TruncatedCell
                          text={item.part_name}
                          className="max-w-[250px] font-medium"
                        />
                      </TableCell>

                      <TableCell>
                        <TruncatedCell
                          text={item.category}
                          className="max-w-[120px]"
                        />
                      </TableCell>

                      <TableCell>
                        <TruncatedCell
                          text={item.vendor}
                          className="max-w-[150px] text-muted-foreground"
                        />
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs">
                        {item.last_purchase_price
                          ? formatCurrency(item.last_purchase_price)
                          : "-"}
                      </TableCell>

                      <TableCell className="text-center">
                        {item.is_asset ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 text-[10px]">
                            Asset
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground"
                          >
                            Goods
                          </Badge>
                        )}
                      </TableCell>

                      {canModify && (
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation(); // Mencegah popup detail terbuka
                                router.push(`/barang/edit/${item.id}`);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Anda yakin ingin menghapus ${item.part_name}?`,
                                  )
                                ) {
                                  handleDelete(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* --- PAGINATION --- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-muted-foreground">
                Menampilkan {paginatedData.length} dari {filteredData.length}{" "}
                data
              </div>
              <Pagination className="justify-end w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-4">
                      Hal {currentPage} / {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </Content>

      {/* --- DETAIL DIALOG POPUP --- */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Box className="h-5 w-5 text-primary" /> Detail Barang
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap mengenai master barang.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="grid gap-6 py-2">
              {/* HEADER INFO */}
              <div className="bg-muted/30 p-4 rounded-lg border">
                <div className="grid gap-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    Part Number
                  </span>
                  <div className="text-lg font-bold text-primary flex items-center gap-2">
                    {selectedItem.part_number}
                    {selectedItem.is_asset && (
                      <Badge className="bg-blue-600 hover:bg-blue-700 ml-2">
                        Fixed Asset
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    Nama Barang
                  </span>
                  <div className="text-base font-medium">
                    {selectedItem.part_name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* KOLOM KIRI */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                      <Tag className="h-3 w-3" /> Kategori & Spesifikasi
                    </span>
                    <div className="p-3 bg-background border rounded-md space-y-2">
                      <div className="grid grid-cols-2 text-sm">
                        <span className="text-muted-foreground">Kategori:</span>
                        <span className="font-medium">
                          {selectedItem.category || "-"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 text-sm">
                        <span className="text-muted-foreground">
                          Satuan (UoM):
                        </span>
                        <span className="font-medium">
                          {selectedItem.uom || "-"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 text-sm">
                        <span className="text-muted-foreground">Tipe:</span>
                        <span className="flex items-center gap-1">
                          {selectedItem.is_asset ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-blue-600" />{" "}
                              Asset
                            </>
                          ) : (
                            <>
                              <Box className="h-3 w-3 text-gray-500" />{" "}
                              Consumable
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KOLOM KANAN */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                      <Building className="h-3 w-3" /> Informasi Pengadaan
                    </span>
                    <div className="p-3 bg-background border rounded-md space-y-2">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                          Vendor Default:
                        </span>
                        <div
                          className="text-sm font-medium truncate"
                          title={selectedItem.vendor || ""}
                        >
                          {selectedItem.vendor || "Belum diset"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                          Harga Referensi:
                        </span>
                        <div className="text-sm font-bold text-green-700">
                          {selectedItem.last_purchase_price
                            ? formatCurrency(selectedItem.last_purchase_price)
                            : "Rp 0"}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1">
                        {selectedItem.link ? (
                          <a
                            href={selectedItem.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Buka Link
                            Produk
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Tidak ada link
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER INFO */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 bg-muted/20 p-2 rounded">
                <Calendar className="h-3 w-3" />
                Dibuat pada:{" "}
                {format(
                  new Date(selectedItem.created_at),
                  "dd MMMM yyyy HH:mm",
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Tutup
            </Button>
            {canModify && selectedItem && (
              <Button
                onClick={() => router.push(`/barang/edit/${selectedItem.id}`)}
              >
                <Edit className="mr-2 h-4 w-4" /> Edit Barang
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
