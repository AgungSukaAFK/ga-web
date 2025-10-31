// src/app/(With Sidebar)/barang/BarangClient.tsx

"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination-components";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";
import { Barang } from "@/type";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LIMIT_OPTIONS } from "@/type/enum";


export function BarangClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State Data
  const [data, setData] = useState<Barang[]>([]);
  const [totalItems, setTotalItems] = useState(0);

  // State UI
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<string>("");

  // State Filter dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const categoryFilter = searchParams.get("category") || "";

  // State untuk Input Form
  const [searchInput, setSearchInput] = useState(searchTerm);

  // State untuk data filter dinamis
  const [categories, setCategories] = useState<string[]>([]);

  // Mengambil data kategori unik untuk filter
  useEffect(() => {
    const fetchCategories = async () => {
      const { data: categoriesData } = await s
        .from("barang")
        .select("category")
        .is("category", { is: "not null" });

      if (data) {
        // Buat daftar kategori unik
        const uniqueCategories = [
          ...new Set(categoriesData?.map((item) => item.category) || []),
        ];
        setCategories(uniqueCategories.sort());
      }
    };
    fetchCategories();
  }, [s]);

  // Mengambil profil user
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (user) {
        const { data: profileData } = await s
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profileData) {
          setRole(profileData.role || "");
        }
      }
    };
    fetchProfile();
  }, [s]);

  // Fungsi untuk membuat query string
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

  // Fetch data utama
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s.from("barang").select("*", { count: "exact" });

      // Terapkan filter pencarian
      if (searchTerm) {
        query = query.or(
          `part_number.ilike.%${searchTerm}%,part_name.ilike.%${searchTerm}%`
        );
      }
      // Terapkan filter kategori
      if (categoryFilter) {
        query = query.eq("category", categoryFilter);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        toast.error("Gagal mengambil data barang", {
          description: error.message,
        });
        setData([]);
      } else {
        setData(data || []);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchData();
  }, [s, currentPage, limit, searchTerm, categoryFilter]);

  // Debounce untuk input pencarian
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchTerm) {
        startTransition(() => {
          router.push(
            `${pathname}?${createQueryString({ search: searchInput })}`
          );
        });
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
  }, [searchInput, searchTerm, pathname, router, createQueryString]);

  // Handler untuk perubahan filter
  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleDeleteBarang = async (id: string) => {
    const { error } = await s.from("barang").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus data barang", {
        description: error.message,
      });
      return;
    }
    setData((prevData) =>
      prevData.filter((item) => item.id.toString() !== id.toString())
    );
    toast.success("Data barang berhasil dihapus");
  };

  // Memoize data hak akses untuk tombol
  const canModify = useMemo(
    () =>
      role === "admin" ||
      role === "approver" ||
      role === "Purchasing" ||
      role === "General Affair",
    [role]
  );

  return (
    <Content
      title="Data Barang"
      description="Daftar barang yang tersedia di master data."
      cardAction={
        canModify && (
          <Button variant={"outline"} asChild>
            <Link href="/barang/tambah">
              <Plus className="mr-2 h-4 w-4" /> Tambah barang
            </Link>
          </Button>
        )
      }
      className="col-span-12"
    >
      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan Part Number atau Nama Barang..."
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    category: value === "all" ? undefined : value,
                  })
                }
                defaultValue={categoryFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Tambahkan filter lain di sini jika perlu, misal 'vendor' */}
          </div>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Part Number</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Vendor</TableHead>
              {canModify && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canModify ? 7 : 6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.length > 0 ? (
              data.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.part_number}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {item.part_name}
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.uom}</TableCell>
                  <TableCell>{item.vendor}</TableCell>
                  {canModify && (
                    <TableCell className="text-right space-x-2">
                      <Button variant={"outline"} size={"sm"} asChild>
                        <Link href={`/barang/edit/${item.id}`}>
                          <Edit className="h-3 w-3" />
                        </Link>
                      </Button>
                      <ConfirmDialog
                        title="Hapus data barang"
                        description="Apakah Anda yakin ingin menghapus data barang ini? Tindakan ini tidak dapat dibatalkan."
                        onConfirm={() => handleDeleteBarang(item.id.toString())}
                      >
                        <Button variant={"destructive"} size={"sm"}>
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
                  colSpan={canModify ? 7 : 6}
                  className="text-center h-24"
                >
                  Tidak ada data barang yang ditemukan.
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
  );
}
