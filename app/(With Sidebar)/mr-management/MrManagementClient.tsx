// src/app/(With Sidebar)/mr-management/MrManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import { PaginationComponent } from "@/components/pagination-components"; // Sesuaikan path jika perlu
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
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { createClient } from "@/lib/supabase/client";
import { Loader2, Newspaper, Search, Edit } from "lucide-react"; // Import ikon
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import * as XLSX from "xlsx";
import { MaterialRequestListItem, Order, Profile } from "@/type"; // Pastikan Order diimpor
import { formatCurrency, formatDateFriendly } from "@/lib/utils"; // Pastikan formatCurrency diimpor
import { Badge } from "@/components/ui/badge";

const LIMIT_OPTIONS = [10, 25, 50, 100];
const STATUS_OPTIONS = [
  // Opsi status untuk filter
  "Pending Validation",
  "Pending Approval",
  "Waiting PO",
  "Completed",
  "Rejected",
];

export function MrManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [mrList, setMrList] = useState<MaterialRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || ""; // Filter company baru
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

  // Efek untuk fetch data MR dan profil admin
  useEffect(() => {
    async function fetchMRsAndAdminProfile() {
      setLoading(true);

      // Ambil profil admin
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak valid. Silakan login kembali.");
        router.push("/auth/login"); // Redirect jika tidak ada user
        return;
      }
      const { data: profileData } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        toast.error(
          "Akses ditolak. Hanya admin yang bisa mengakses halaman ini."
        );
        router.push("/dashboard"); // Redirect jika bukan admin
        return;
      }
      setAdminProfile(profileData);

      // Fetch data MR
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      // REVISI: Ambil juga cost_estimation
      let query = s.from("material_requests").select(
        `
            id, kode_mr, kategori, status, department, created_at, due_date, company_code, cost_estimation,
            users_with_profiles!userid (nama)
          `,
        { count: "exact" }
      );

      // Filter Pencarian
      if (searchTerm)
        query = query.or(
          `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (companyFilter) query = query.eq("company_code", companyFilter);

      if (profileData.company && profileData.company !== "LOURDES") {
        query = query.eq("company_code", profileData.company);
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data MR: " + error.message);
        setMrList([]);
      } else {
        const transformedData =
          data?.map((mr) => ({
            ...mr,
            users_with_profiles: Array.isArray(mr.users_with_profiles)
              ? mr.users_with_profiles[0] ?? null
              : mr.users_with_profiles,
          })) || [];
        setMrList(transformedData as MaterialRequestListItem[]);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchMRsAndAdminProfile();
  }, [s, currentPage, searchTerm, statusFilter, companyFilter, limit, router]);

  // Efek untuk debounce pencarian
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

  // Handler untuk filter
  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  // --- REVISI: handleDownloadExcel ---
  const handleDownloadExcel = async () => {
    if (!adminProfile) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      // 1. Ambil kolom 'orders' (JSON) dari database
      let query = s.from("material_requests").select(`
          kode_mr, kategori, department, status, remarks, cost_estimation, company_code, created_at, due_date,
          orders, 
          users_with_profiles!userid (nama)
        `);

      // Terapkan semua filter aktif
      if (searchTerm)
        query = query.or(
          `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (companyFilter) query = query.eq("company_code", companyFilter);

      if (adminProfile.company && adminProfile.company !== "LOURDES") {
        query = query.eq("company_code", adminProfile.company);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Tidak ada data MR untuk diekspor sesuai filter.");
        setIsExporting(false);
        return;
      }

      // 2. Gunakan .flatMap() untuk "meledakkan" data
      const formattedData = data.flatMap((mr: any) => {
        // Simpan info MR dasar yang akan diulang
        const baseMrInfo = {
          "Kode MR": mr.kode_mr,
          Kategori: mr.kategori,
          Departemen: mr.department,
          Status: mr.status,
          Requester: mr.users_with_profiles?.nama || "N/A",
          Perusahaan: mr.company_code,
          Remarks: mr.remarks,
          "Total Estimasi Biaya (MR)": Number(mr.cost_estimation), // Ini adalah total auto-sum
          "Tanggal Dibuat": formatDateFriendly(mr.created_at),
          "Due Date": formatDateFriendly(mr.due_date),
        };

        // Cek apakah 'orders' ada dan merupakan array
        if (Array.isArray(mr.orders) && mr.orders.length > 0) {
          // Jika ada item, buat satu baris untuk setiap item
          return mr.orders.map((item: Order) => ({
            ...baseMrInfo,
            // Tambahkan kolom item di sini
            "Nama Item": item.name,
            Qty: Number(item.qty) || 0,
            UoM: item.uom,
            "Estimasi Harga Item": Number(item.estimasi_harga) || 0,
            "Total Estimasi Item":
              (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0),
            "Catatan Item": item.note || "-",
            "URL Referensi": item.url || "-",
          }));
        } else {
          // Jika MR tidak punya item, kembalikan satu baris
          return [
            {
              ...baseMrInfo,
              "Nama Item": "N/A",
              Qty: 0,
              UoM: "N/A",
              "Estimasi Harga Item": 0,
              "Total Estimasi Item": 0,
              "Catatan Item": "N/A",
              "URL Referensi": "N/A",
            },
          ];
        }
      });

      // 3. Buat Excel
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Material Requests");
      XLSX.writeFile(
        workbook,
        `Admin_Material_Requests_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success("Data MR berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Content
      title="Manajemen Material Request (Admin)"
      size="lg"
      className="col-span-12"
    >
      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode MR, Remarks, Departemen..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting || loading || isPending}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Filter Status */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    status: value === "all" ? undefined : value,
                  })
                }
                defaultValue={statusFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Filter Company (hanya untuk admin Lourdes) */}
            {adminProfile?.company === "LOURDES" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Perusahaan</label>
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
                    <SelectItem value="GMI">GMI</SelectItem>
                    <SelectItem value="GIS">GIS</SelectItem>
                    <SelectItem value="LOURDES">LOURDES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Status</TableHead>
              {/* REVISI: Tampilkan Total Estimasi Biaya */}
              <TableHead className="text-right">Total Estimasi</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : mrList.length > 0 ? (
              mrList.map((mr, index) => (
                <TableRow key={mr.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">{mr.kode_mr}</TableCell>
                  <TableCell>{mr.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>{mr.department}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{mr.company_code || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mr.status}</Badge>
                  </TableCell>
                  {/* REVISI: Tampilkan Total Estimasi Biaya */}
                  <TableCell className="text-right font-medium">
                    {formatCurrency(mr.cost_estimation)}
                  </TableCell>
                  <TableCell>{formatDateFriendly(mr.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/mr-management/edit/${mr.id}`}>
                        <Edit className="mr-2 h-3 w-3" />
                        Edit/View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  Tidak ada Material Request yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
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
          <span>dari {totalItems} MR.</span>
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
