// src/app/(With Sidebar)/barang/BarangClient.tsx

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ActiveFilter, FilterPanel } from "@/components/filter-panel";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ExcelDownloadMenu,
  type ExcelDownloadMode,
} from "@/components/excel-download-menu";
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import {
  SortableTableHead,
  resolveSort,
  type SortColumnConfig,
} from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { orIlikePattern } from "@/lib/supabase/search-filter";
import { LIMIT_OPTIONS } from "@/type/enum";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
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
  Trash2,
  Edit,
  Eye,
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
import { toast } from "@/lib/toast";
import { Barang } from "@/type";
import { formatCurrency, cn } from "@/lib/utils"; // Pastikan cn ada di utils atau hapus jika tidak pakai
import { exportStyledExcel, fetchAllRows } from "@/lib/excel-export";
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

// Kolom yang bisa di-sort lewat klik header tabel (key = nilai di URL).
const DEFAULT_SORT = "created_at.desc";
const SORTABLE_COLUMNS: Record<string, SortColumnConfig> = {
  created_at: { column: "created_at" },
  part_number: { column: "part_number" },
  part_name: { column: "part_name" },
  category: { column: "category" },
  vendor: { column: "vendor" },
  last_purchase_price: { column: "last_purchase_price" },
  is_asset: { column: "is_asset" },
};

const SEARCH_FIELDS = ["Part Number", "Nama Barang", "Vendor"];

type BarangFilters = { search: string; category: string; isAsset: string };

// Dipakai tabel & export Excel supaya hasilnya selalu sama.
const applyBarangFilters = (query: any, filters: BarangFilters) => {
  let result = query;
  if (filters.search) {
    const pattern = orIlikePattern(filters.search);
    result = result.or(
      `part_name.ilike.${pattern},part_number.ilike.${pattern},vendor.ilike.${pattern}`,
    );
  }
  if (filters.category !== "all") {
    result = result.eq("category", filters.category);
  }
  if (filters.isAsset !== "all") {
    result = result.eq("is_asset", filters.isAsset === "true");
  }
  return result;
};

export default function BarangClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  // Dibuka dari global search (components/topbar/topbar-search.tsx):
  // ?search= mengisi kotak cari, ?id= langsung membuka detail barang.
  const urlDetailId = searchParams.get("id");

  // --- URL PARAMS ---
  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const selectedCategory = searchParams.get("category") || "all";
  const isAssetFilter = searchParams.get("is_asset") || "all";
  const sortFilter = searchParams.get("sort") || DEFAULT_SORT;

  // --- STATE ---
  const [data, setData] = useState<Barang[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [, startTransition] = useTransition();

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value !== undefined && String(value).trim() !== "") {
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

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  // Push ke URL hanya dari ketikan user - lihat hooks/use-url-search-input.ts
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) =>
      startTransition(() => {
        router.push(`${pathname}?${createQueryString({ search: value })}`);
      }),
  );

  // Detail Dialog State
  const [selectedItem, setSelectedItem] = useState<Barang | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchProfile = async () => {
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
    };

    // Opsi filter kategori: dari semua barang, bukan cuma halaman yang tampil.
    const fetchCategories = async () => {
      const rows = await fetchAllRows<{ category: string | null }>(() =>
        supabase
          .from("barang")
          .select("category")
          .not("category", "is", null)
          .order("id", { ascending: true }),
      );
      setUniqueCategories(
        Array.from(
          new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
        ).sort(),
      );
    };

    fetchProfile();
    fetchCategories().catch(() => setUniqueCategories([]));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const from = (currentPage - 1) * limit;
      const sort = resolveSort(sortFilter, SORTABLE_COLUMNS, DEFAULT_SORT);
      const {
        data: barangData,
        error,
        count,
      } = await applyBarangFilters(
        supabase.from("barang").select("*", { count: "exact" }),
        { search: searchTerm, category: selectedCategory, isAsset: isAssetFilter },
      )
        .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
        .order("id", { ascending: false }) // urutan stabil antar halaman
        .range(from, from + limit - 1);

      if (error) {
        toast.error("Gagal mengambil data barang");
      } else {
        setData(barangData || []);
        setTotalItems(count || 0);
      }
      setLoading(false);
    };

    fetchData();
  }, [
    currentPage,
    limit,
    searchTerm,
    selectedCategory,
    isAssetFilter,
    sortFilter,
    reloadKey,
  ]);

  // --- HANDLERS ---
  const fetchAllBarangCount = async () => {
    const { count, error } = await supabase
      .from("barang")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  };

  const handleExportExcel = async (mode: ExcelDownloadMode) => {
    const useFilters = mode === "filtered";
    setIsExporting(true);
    const toastId = toast.loading(
      useFilters
        ? "Menyiapkan data barang sesuai filter..."
        : "Menyiapkan semua data barang...",
    );
    try {
      const sort = useFilters
        ? resolveSort(sortFilter, SORTABLE_COLUMNS, DEFAULT_SORT)
        : { column: "created_at", ascending: false };
      const rows = await fetchAllRows<Barang>(() => {
        const query = supabase.from("barang").select("*");
        return (
          useFilters
            ? applyBarangFilters(query, {
                search: searchTerm,
                category: selectedCategory,
                isAsset: isAssetFilter,
              })
            : query
        )
          .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
          .order("id", { ascending: true });
      });
      if (rows.length === 0) {
        toast.warning("Tidak ada data untuk diexport", { id: toastId });
        return;
      }
      const dataToExport = rows.map((item, index) => ({
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

      await exportStyledExcel(
        dataToExport,
        `Master_Barang_${useFilters ? "Filter" : "Semua"}_${new Date().toISOString().split("T")[0]}.xlsx`,
        "Data Barang",
      );
      toast.success("File Excel berhasil didownload!", { id: toastId });
    } catch (error: any) {
      toast.error("Gagal mengunduh data", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("barang").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus barang");
    } else {
      toast.success("Barang berhasil dihapus");
      setReloadKey((k) => k + 1);
    }
  };

  const openDetail = (item: Barang) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  // Barang dari ?id= belum tentu ada di halaman tabel yang sedang tampil.
  useEffect(() => {
    if (!urlDetailId) return;
    let cancelled = false;
    supabase
      .from("barang")
      .select("*")
      .eq("id", urlDetailId)
      .maybeSingle()
      .then(({ data: item }) => {
        if (!cancelled && item) openDetail(item as Barang);
      });
    return () => {
      cancelled = true;
    };
  }, [urlDetailId]);

  const handleDetailOpenChange = (open: boolean) => {
    setIsDetailOpen(open);
    // Lepas ?id= supaya membuka barang yang sama lagi dari search tetap
    // memicu efek di atas.
    if (!open && urlDetailId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("id");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  };

  const canModify = [
    "admin",
    "approver",
    "Purchasing",
    "General Affair",
  ].includes(userRole);

  const clearFilters = () => {
    resetSearchInput();
    startTransition(() => {
      router.push(pathname);
    });
  };

  // --- Chip filter aktif ---
  const activeFilters: ActiveFilter[] = [];
  if (searchTerm)
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: searchTerm,
      onRemove: () => {
        resetSearchInput();
        handleFilterChange({ search: undefined });
      },
    });
  if (selectedCategory !== "all")
    activeFilters.push({
      key: "category",
      label: "Kategori",
      value: selectedCategory,
      onRemove: () => handleFilterChange({ category: undefined }),
    });
  if (isAssetFilter !== "all")
    activeFilters.push({
      key: "is_asset",
      label: "Tipe Aset",
      value: isAssetFilter === "true" ? "Asset" : "Barang",
      onRemove: () => handleFilterChange({ is_asset: undefined }),
    });

  return (
    <>
      <Content
        title="Master Data Barang"
        description="Klik pada baris barang untuk melihat detail lengkap."
        size="lg"
        cardAction={
          <div className="flex gap-2">
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
          <div className="flex flex-col md:flex-row gap-4">
            <ListSearchInput
              placeholder="Cari part number, nama, vendor..."
              value={searchInput}
              onChange={setSearchInput}
              searchableFields={SEARCH_FIELDS}
            />
            <ExcelDownloadMenu
              itemLabel="barang"
              filteredCount={totalItems}
              fetchAllCount={fetchAllBarangCount}
              onDownload={handleExportExcel}
              isExporting={isExporting}
            />
          </div>
          <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Kategori</label>
                <SearchableSelect
                  value={selectedCategory}
                  onValueChange={(val) =>
                    handleFilterChange({
                      category: val === "all" ? undefined : val,
                    })
                  }
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Kategori" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">
                      Semua Kategori
                    </SearchableSelectItem>
                    {uniqueCategories.map((cat) => (
                      <SearchableSelectItem key={cat} value={cat}>
                        {cat}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tipe Aset</label>
                <SearchableSelect
                  value={isAssetFilter}
                  onValueChange={(val) =>
                    handleFilterChange({
                      is_asset: val === "all" ? undefined : val,
                    })
                  }
                >
                  <SearchableSelectTrigger className="bg-background">
                    <SearchableSelectValue placeholder="Tipe Aset" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">
                      Semua
                    </SearchableSelectItem>
                    <SearchableSelectItem value="true">
                      Asset
                    </SearchableSelectItem>
                    <SearchableSelectItem value="false">
                      Barang
                    </SearchableSelectItem>
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            </div>
          </FilterPanel>

          {/* --- TABLE --- */}
          <StickyHeaderTable
            containerClassName="rounded-md border bg-card"
            header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <SortableTableHead
                    sortKey="part_number"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    className="w-[130px]"
                  >
                    Part Number
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="part_name"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    className="min-w-[200px]"
                  >
                    Nama Barang
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="category"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    className="w-[120px]"
                  >
                    Kategori
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="vendor"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    className="w-[150px]"
                  >
                    Vendor
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="last_purchase_price"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    defaultDirection="desc"
                    className="w-[140px] text-right"
                  >
                    Harga Ref
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="is_asset"
                    currentSort={sortFilter}
                    onSortChange={(sort) => handleFilterChange({ sort })}
                    defaultDirection="desc"
                    className="w-[80px]"
                  >
                    Aset
                  </SortableTableHead>
                  {canModify && (
                    <TableHead className="w-[70px] text-right">Aksi</TableHead>
                  )}
                </TableRow>
            }
          >
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
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Data tidak ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openDetail(item)}
                  >
                    <TableCell>
                      {(currentPage - 1) * limit + index + 1}
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
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:border-blue-800 text-[10px]">
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
                        <RowActionsMenu>
                          <DropdownMenuItem onSelect={() => openDetail(item)}>
                            <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              router.push(`/barang/edit/${item.id}`)
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => {
                              if (
                                window.confirm(
                                  `Anda yakin ingin menghapus ${item.part_name}?`,
                                )
                              ) {
                                handleDelete(item.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                          </DropdownMenuItem>
                        </RowActionsMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </StickyHeaderTable>

          {/* --- PAGINATION --- */}
          <TablePaginationFooter
            currentPage={currentPage}
            totalItems={totalItems}
            limit={limit}
            limitOptions={LIMIT_OPTIONS}
            itemLabel="barang"
            onPageChange={(page) => handleFilterChange({ page })}
            onLimitChange={(value) => handleFilterChange({ limit: value })}
          />
        </div>
      </Content>

      {/* --- DETAIL DIALOG POPUP --- */}
      <Dialog open={isDetailOpen} onOpenChange={handleDetailOpenChange}>
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
                              <Box className="h-3 w-3 text-muted-foreground" />{" "}
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
                        <div className="text-sm font-bold text-green-700 dark:text-green-400">
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
                            className="text-xs flex items-center gap-1 text-primary hover:underline"
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
