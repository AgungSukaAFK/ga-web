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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
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
import { Content } from "@/components/content";
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Edit,
  Filter,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Barang } from "@/type";
import { formatCurrency } from "@/lib/utils";
import * as XLSX from "xlsx"; // Import library Excel
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Helper untuk truncate text
const TruncatedCell = ({
  text,
  maxWidth = "200px",
}: {
  text: string;
  maxWidth?: string;
}) => (
  <div
    className="truncate"
    style={{ maxWidth }}
    title={text} // Tooltip bawaan browser saat hover
  >
    {text}
  </div>
);

export default function BarangClient() {
  const router = useRouter();
  const supabase = createClient();

  // --- STATE DATA ---
  const [data, setData] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  // --- STATE FILTER & PAGINATION ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAssetFilter, setIsAssetFilter] = useState<"all" | "true" | "false">(
    "all",
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Cek Role User
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

      // Ambil Semua Data Barang (Client-side filtering lebih cepat untuk < 10k items)
      // Jika data sangat besar, perlu ubah ke Server-side filtering
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

  // --- 2. FILTERING LOGIC (Advanced) ---
  // Menggunakan useMemo agar filter tidak dijalankan ulang saat pagination berubah
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Filter Text (Part Number / Nama)
      const matchesSearch =
        item.part_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.part_number.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter Kategori
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;

      // Filter Asset
      let matchesAsset = true;
      if (isAssetFilter === "true") matchesAsset = item.is_asset === true;
      if (isAssetFilter === "false") matchesAsset = item.is_asset === false;

      return matchesSearch && matchesCategory && matchesAsset;
    });
  }, [data, searchTerm, selectedCategory, isAssetFilter]);

  // List unik kategori untuk dropdown filter
  const uniqueCategories = useMemo(() => {
    const cats = data
      .map((item) => item.category)
      .filter((c): c is string => !!c); // Hapus null
    return Array.from(new Set(cats)).sort();
  }, [data]);

  // Reset halaman ke 1 setiap kali filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, isAssetFilter]);

  // --- 3. PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // --- 4. EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast.warning("Tidak ada data untuk diexport");
      return;
    }

    // Format data agar rapi di Excel
    const dataToExport = filteredData.map((item, index) => ({
      No: index + 1,
      "Part Number": item.part_number,
      "Nama Barang": item.part_name,
      Kategori: item.category || "-",
      UoM: item.uom || "-",
      Vendor: item.vendor || "-",
      "Harga Referensi": item.last_purchase_price || 0,
      "Aset?": item.is_asset ? "Ya" : "Tidak",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Barang");

    // Auto width columns (sedikit styling dasar)
    const max_width = dataToExport.reduce(
      (w, r) => Math.max(w, r["Nama Barang"]?.length || 10),
      10,
    );
    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 15 },
      { wch: max_width },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 10 },
    ];

    XLSX.writeFile(
      workbook,
      `Master_Barang_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("File Excel berhasil didownload!");
  };

  // --- 5. DELETE HANDLER ---
  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("barang").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus barang");
    } else {
      toast.success("Barang berhasil dihapus");
      setData((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const canModify = [
    "admin",
    "approver",
    "Purchasing",
    "General Affair",
  ].includes(userRole);

  return (
    <Content
      title="Master Data Barang"
      description="Kelola daftar barang, sparepart, dan aset perusahaan."
      size="lg" // Lebarkan content agar tabel muat
      cardAction={
        <div className="flex gap-2">
          {/* Tombol Export */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={loading}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            Export Excel
          </Button>

          {canModify && (
            <Button onClick={() => router.push("/barang/tambah")}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Barang
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* --- FILTER SECTION --- */}
        <div className="flex flex-col md:flex-row gap-4 bg-muted/20 p-4 rounded-lg border">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Part Number atau Nama Barang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-background"
            />
          </div>

          {/* Filter Kategori */}
          <div className="w-full md:w-[200px]">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Semua Kategori" />
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

          {/* Filter Asset (Status) */}
          <div className="w-full md:w-[180px]">
            <Select
              value={isAssetFilter}
              onValueChange={(val: any) => setIsAssetFilter(val)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Status Aset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="true">Fixed Asset</SelectItem>
                <SelectItem value="false">Non-Asset (Consumable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Items Per Page */}
          <div className="w-[100px]">
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(val) => {
                setItemsPerPage(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / Hal</SelectItem>
                <SelectItem value="25">25 / Hal</SelectItem>
                <SelectItem value="50">50 / Hal</SelectItem>
                <SelectItem value="100">100 / Hal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* --- TABLE SECTION --- */}
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No</TableHead>
                <TableHead className="w-[120px]">Part Number</TableHead>
                <TableHead>Nama Barang</TableHead>
                <TableHead className="w-[150px]">Kategori</TableHead>
                <TableHead className="w-[80px]">UoM</TableHead>
                <TableHead className="w-[150px]">Vendor</TableHead>
                <TableHead className="w-[150px] text-right">
                  Harga Ref
                </TableHead>
                <TableHead className="w-[100px] text-center">Tipe</TableHead>
                {canModify && (
                  <TableHead className="w-[100px] text-right">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Memuat
                      data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Tidak ada barang ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>

                    <TableCell className="font-mono text-xs font-medium">
                      {item.part_number}
                    </TableCell>

                    {/* TRUNCATED NAME */}
                    <TableCell>
                      <TruncatedCell
                        text={item.part_name || "-"}
                        maxWidth="250px"
                      />
                    </TableCell>

                    <TableCell>
                      <TruncatedCell
                        text={item.category || "-"}
                        maxWidth="140px"
                      />
                    </TableCell>

                    <TableCell>{item.uom}</TableCell>

                    {/* TRUNCATED VENDOR */}
                    <TableCell>
                      <TruncatedCell
                        text={item.vendor || "-"}
                        maxWidth="140px"
                      />
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs">
                      {item.last_purchase_price
                        ? formatCurrency(item.last_purchase_price)
                        : "-"}
                    </TableCell>

                    <TableCell className="text-center">
                      {item.is_asset ? (
                        <Badge
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-[10px]"
                        >
                          Asset
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Barang
                        </Badge>
                      )}
                    </TableCell>

                    {canModify && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(`/barang/edit/${item.id}`)
                            }
                          >
                            <Edit className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const confirmed = confirm(
                                `Anda yakin ingin menghapus ${item.part_name}?`,
                              );
                              if (confirmed) handleDelete(item.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* --- PAGINATION CONTROLS --- */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  // disabled={currentPage === 1} // Shadcn pagination doesn't have disabled prop on link usually, handled by logic
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {/* Simple Pagination Logic for Compact View */}
              <PaginationItem>
                <span className="text-sm px-4">
                  Halaman {currentPage} dari {totalPages}
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
        )}

        <div className="text-xs text-muted-foreground text-center">
          Total {filteredData.length} Barang
        </div>
      </div>
    </Content>
  );
}
