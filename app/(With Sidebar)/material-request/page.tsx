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

// --- Tipe Data ---
interface MaterialRequestListItem {
  id: string;
  kode_mr: string;
  kategori: string;
  status: string;
  department: string;
  created_at: Date;
  due_date?: Date;
  users_with_profiles: { nama: string } | null; // Nama requester
}


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

        // 4. REVISI: Terapkan filter berdasarkan ROLE
        // Jika user adalah requester, hanya tampilkan MR miliknya
        if (userProfile.role === "requester") {
          query = query.eq("userid", user.id);
        }
        // Jika admin, approver, GA, dll (selain requester), tidak perlu filter userid
        // RLS perusahaan akan otomatis diterapkan oleh Supabase

        query = query.order("created_at", { ascending: false }).range(from, to);

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
  }, [s, currentPage, limit, searchTerm, statusFilter, startDate, endDate]);

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

      // REVISI: Terapkan filter role yang sama seperti di fetch utama
      if (currentUser.role === "requester") {
        query = query.eq("userid", currentUser.id);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;

      const formattedData = data.map((mr: any) => ({
        "Kode MR": mr.kode_mr,
        Kategori: mr.kategori,
        Departemen: mr.department,
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
        // Tombol Buat MR sekarang juga dicek berdasarkan role
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                  <SelectItem value="Pending Validation">
                    Pending Validation
                  </SelectItem>
                  <SelectItem value="Pending Approval">
                    Pending Approval
                  </SelectItem>
                  <SelectItem value="Waiting PO">Waiting PO</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
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
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Departemen</TableHead>
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
                <TableCell colSpan={9} className="text-center h-24">
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
                <TableCell colSpan={9} className="text-center h-24">
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
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
