// src/app/(With Sidebar)/material-request/page.tsx

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  Newspaper,
  Printer,
  Search,
  Loader2,
  Edit,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
  useCallback,
  useTransition,
} from "react";
import { toast } from "sonner";
import { User as AuthUser } from "@supabase/supabase-js";
import { Profile } from "@/type";
import * as XLSX from "xlsx";
import { PaginationComponent } from "@/components/pagination-components"; // Path sudah dikoreksi
import { formatDateFriendly } from "@/lib/utils"; // Menggunakan helper yang konsisten
import { Badge } from "@/components/ui/badge";
import { LIMIT_OPTIONS } from "@/type/enum";
import { ComboboxData } from "@/components/combobox";

// --- Tipe Data ---
interface MaterialRequestListItem {
  id: string;
  kode_mr: string;
  kategori: string;
  status: string;
  department: string;
  tujuan_site: string; // Ditambahkan
  created_at: Date;
  due_date?: Date;
  users_with_profiles: { nama: string } | null; // Nama requester
}

// --- Konstanta untuk Filter ---
const dataDepartment: ComboboxData = [
  { label: "Human Resources", value: "Human Resources" },
  { label: "General Affair", value: "General Affair" },
  { label: "Marketing", value: "Marketing" },
  { label: "Produksi", value: "Produksi" },
  { label: "K3", value: "K3" },
  { label: "Finance", value: "Finance" },
  { label: "IT", value: "IT" },
  { label: "Logistik", value: "Logistik" },
  { label: "Purchasing", value: "Purchasing" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Service", value: "Service" },
  { label: "General Manager", value: "General Manager" },
  { label: "Executive Manager", value: "Executive Manager" },
  { label: "Boards of Director", value: "Boards of Director" },
];

const dataLokasi: ComboboxData = [
  { label: "Head Office", value: "Head Office" },
  { label: "Tanjung Enim", value: "Tanjung Enim" },
  { label: "Balikpapan", value: "Balikpapan" },
  { label: "Site BA", value: "Site BA" },
  { label: "Site TAL", value: "Site TAL" },
  { label: "Site MIP", value: "Site MIP" },
  { label: "Site MIFA", value: "Site MIFA" },
  { label: "Site BIB", value: "Site BIB" },
  { label: "Site AMI", value: "Site AMI" },
  { label: "Site Tabang", value: "Site Tabang" },
];

const STATUS_OPTIONS = [
  "Pending Validation",
  "Pending Approval",
  "Waiting PO",
  "Completed",
  "Rejected",
];

const SORT_OPTIONS = [
  { label: "Tanggal Dibuat (Terbaru)", value: "created_at.desc" },
  { label: "Tanggal Dibuat (Terlama)", value: "created_at.asc" },
  { label: "Due Date (Mendesak)", value: "due_date.asc" },
  { label: "Due Date (Lama)", value: "due_date.desc" },
];

function MaterialRequestContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- State Management ---
  const [dataMR, setDataMR] = useState<MaterialRequestListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentUser, setCurrentUser] = useState<(AuthUser & Profile) | null>(
    null
  );

  // --- State dari URL ---
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  // REVISI: State filter dan sort baru
  const departmentFilter = searchParams.get("department") || "";
  const siteFilter = searchParams.get("tujuan_site") || "";
  const sortFilter = searchParams.get("sort") || "created_at.desc"; // Default sort

  // --- State untuk Input ---
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

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

  // --- Efek untuk Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 1. Ambil data user dan profil saat ini
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak ditemukan, silakan login kembali.");
        setLoading(false);
        return;
      }
      const { data: profile } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      const userProfile = { ...user, ...profile };
      setCurrentUser(userProfile as AuthUser & Profile);

      // 2. Tentukan range paginasi
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      try {
        let query = s.from("material_requests").select(
          `
            id, kode_mr, kategori, status, department, created_at, due_date, 
            tujuan_site, 
            users_with_profiles!userid (nama)
          `,
          { count: "exact" }
        );

        // 3. Terapkan filter berdasarkan input
        if (searchTerm)
          query = query.or(
            `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`
          );
        if (statusFilter) query = query.eq("status", statusFilter);
        if (startDate) query = query.gte("created_at", startDate);
        if (endDate)
          query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

        // REVISI: Terapkan filter baru
        if (departmentFilter) query = query.eq("department", departmentFilter);
        if (siteFilter) query = query.eq("tujuan_site", siteFilter);

        // 4. Terapkan filter berdasarkan ROLE
        if (userProfile.role === "requester") {
          query = query.eq("userid", user.id);
        }

        // REVISI: Terapkan sorting
        const [sortBy, sortOrder] = sortFilter.split(".");
        query = query
          .order(sortBy, { ascending: sortOrder === "asc" })
          .range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const transformedData =
          data?.map((mr) => ({
            ...mr,
            users_with_profiles: Array.isArray(mr.users_with_profiles)
              ? mr.users_with_profiles[0] ?? null
              : mr.users_with_profiles,
          })) || [];

        setDataMR(transformedData as MaterialRequestListItem[]);
        setTotalItems(count || 0);
      } catch (error: any) {
        toast.error("Gagal memuat data MR:", { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    s,
    currentPage,
    limit,
    searchTerm,
    statusFilter,
    startDate,
    endDate,
    departmentFilter, // REVISI: Tambah dependency
    siteFilter, // REVISI: Tambah dependency
    sortFilter, // REVISI: Tambah dependency
  ]);

  // Efek debounce pencarian
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

  // Handler Download Excel
  const handleDownloadExcel = async () => {
    if (!currentUser) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s.from("material_requests").select(`
            kode_mr, kategori, department, status, remarks, cost_estimation, created_at, due_date,
            tujuan_site, // <-- REVISI: Tambahkan
            users_with_profiles!userid (nama)
        `);

      // Terapkan semua filter aktif
      if (searchTerm)
        query = query.or(
          `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

      // REVISI: Terapkan filter baru
      if (departmentFilter) query = query.eq("department", departmentFilter);
      if (siteFilter) query = query.eq("tujuan_site", siteFilter);

      // REVISI: Terapkan filter role
      if (currentUser.role === "requester") {
        query = query.eq("userid", currentUser.id);
      }

      // REVISI: Terapkan sorting
      const [sortBy, sortOrder] = sortFilter.split(".");
      const { data, error } = await query.order(sortBy, {
        ascending: sortOrder === "asc",
      });
      if (error) throw error;

      const formattedData = data.map((mr: any) => ({
        "Kode MR": mr.kode_mr,
        Kategori: mr.kategori,
        Departemen: mr.department,
        "Tujuan Site": mr.tujuan_site, // <-- REVISI: Tambahkan
        Status: mr.status,
        Requester: mr.users_with_profiles?.nama || "N/A",
        Remarks: mr.remarks,
        "Estimasi Biaya": Number(mr.cost_estimation),
        "Tanggal Dibuat": formatDateFriendly(mr.created_at),
        "Due Date": formatDateFriendly(mr.due_date),
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Material Requests");
      XLSX.writeFile(
        workbook,
        `Material_Requests_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <Content
      title="Daftar Material Request"
      description="Kelola seluruh data Material Request"
      cardAction={
        currentUser &&
        (currentUser.role === "requester" || currentUser.role === "admin") && (
          <Button asChild>
            <Link href="/material-request/buat">Buat Material Request</Link>
          </Button>
        )
      }
      className="col-span-12"
    >
      {/* --- Filter Section --- */}
      <div className="flex flex-col gap-4 mb-6 no-print">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode MR atau Remarks..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            className="w-full md:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Newspaper className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="w-full md:w-auto"
          >
            <Printer className="mr-2 h-4 w-4" /> Cetak
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted/50">
          {/* REVISI: Grid layout diubah untuk 5 filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

            {/* REVISI: Filter Departemen */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Departemen</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    department: value === "all" ? undefined : value,
                  })
                }
                defaultValue={departmentFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter departemen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {dataDepartment.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* REVISI: Filter Tujuan Site */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tujuan Site</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    tujuan_site: value === "all" ? undefined : value,
                  })
                }
                defaultValue={siteFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter site..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Site</SelectItem>
                  {dataLokasi.map((lok) => (
                    <SelectItem key={lok.value} value={lok.value}>
                      {lok.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              className="mt-4 w-full md:w-auto"
              onClick={() =>
                handleFilterChange({
                  startDate: startDateInput,
                  endDate: endDateInput,
                })
              }
            >
              Terapkan Filter Tanggal
            </Button>
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-x-auto" id="printable-area">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Tujuan Site</TableHead>
              {/* REVISI: Kolom baru */}
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right no-print">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                {/* REVISI: colSpan + 1 */}
                <TableCell colSpan={10} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : dataMR.length > 0 ? (
              dataMR.map((mr, index) => (
                <TableRow key={mr.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">{mr.kode_mr}</TableCell>
                  <TableCell>{mr.kategori}</TableCell>
                  <TableCell>{mr.department}</TableCell>
                  <TableCell>{mr.tujuan_site || "N/A"}</TableCell>
                  {/* REVISI: Cell baru */}
                  <TableCell>{mr.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mr.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDateFriendly(mr.created_at)}</TableCell>
                  <TableCell>{formatDateFriendly(mr.due_date)}</TableCell>
                  <TableCell className="text-right no-print">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/material-request/${mr.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                {/* REVISI: colSpan + 1 */}
                <TableCell colSpan={10} className="text-center h-24">
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        {/* REVISI: Bungkus limit dan sort dalam flex */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
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
            <span>dari {totalItems} hasil.</span>
          </div>

          {/* REVISI: Tambahkan Sortir */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Urutkan</span>
            <Select
              value={sortFilter}
              onValueChange={(value) => handleFilterChange({ sort: value })}
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Urutkan berdasarkan..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

// Bungkus komponen utama dengan Suspense
export default function MaterialRequestPage() {
  return (
    <Suspense fallback={<UserManagementSkeleton />}>
      {" "}
      <MaterialRequestContent />
    </Suspense>
  );
}

// Komponen skeleton sederhana untuk fallback Suspense
const UserManagementSkeleton = () => (
  <Content title="Daftar Material Request" size="lg" className="col-span-12">
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full md:w-1/2" />
        <Skeleton className="h-10 w-full md:w-auto px-6" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
    <Skeleton className="h-96 w-full rounded-lg" />
    <div className="mt-6 flex justify-between items-center">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-64" />
    </div>
  </Content>
);
