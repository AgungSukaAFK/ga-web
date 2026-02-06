// src/app/(With Sidebar)/mr-management/MrManagementClient.tsx

"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Eye,
  Edit,
  MoreHorizontal,
  FileSpreadsheet,
  Loader2,
  Calendar,
} from "lucide-react";
import { PaginationComponent } from "@/components/pagination-components";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import * as XLSX from "xlsx";
import { LIMIT_OPTIONS } from "@/type/enum";
import { createClient } from "@/lib/supabase/client";
import { fetchMaterialRequests } from "@/services/mrService";

// Status Options sesuai Database baru
const STATUS_OPTIONS = [
  "Pending Approval",
  "Approved",
  "Rejected",
  "On Process", // Biasanya status saat PO dibuat
  "Completed",
  "PO Open",
  "Partial PO",
];

export default function MrManagementClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [dataMR, setDataMR] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [userProfile, setUserProfile] = useState<any>(null);

  // Params
  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "10");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  // Local State for Inputs
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  // --- QUERY STRING BUILDER ---
  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value !== undefined && value !== null && String(value) !== "") {
          params.set(name, String(value));
        } else {
          params.delete(name);
        }
      });
      // Reset page ke 1 jika filter berubah (kecuali page itu sendiri)
      if (!Object.keys(paramsToUpdate).includes("page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  // --- FETCH DATA ---
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          setUserProfile(profile);

          const { data, count } = await fetchMaterialRequests(
            currentPage,
            limit,
            searchTerm,
            profile?.company, // Filter by company user
            statusFilter,
            startDate,
            endDate,
          );
          setDataMR(data || []);
          setTotalItems(count || 0);
        }
      } catch (err: any) {
        toast.error("Gagal mengambil data MR", { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [currentPage, limit, searchTerm, statusFilter, startDate, endDate]);

  // --- DEBOUNCE SEARCH ---
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
  }, [searchInput, searchTerm, router, pathname, createQueryString]);

  // --- HANDLER FILTERS ---
  const handleFilterChange = (key: string, value: string) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`);
    });
  };

  const handleApplyDateFilter = () => {
    startTransition(() => {
      router.push(
        `${pathname}?${createQueryString({
          start_date: startDateInput,
          end_date: endDateInput,
        })}`,
      );
    });
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch all data matching current filters (without pagination limit)
      const { data } = await fetchMaterialRequests(
        1,
        1000, // Max export limit
        searchTerm,
        userProfile?.company,
        statusFilter,
        startDate,
        endDate,
      );

      if (!data || data.length === 0) {
        toast.warning("Tidak ada data untuk diexport.");
        return;
      }

      const formattedData = data.flatMap((mr: any) => {
        const base = {
          "Kode MR": mr.kode_mr,
          Tanggal: formatDateFriendly(mr.created_at),
          Requester: mr.users_with_profiles?.nama || "N/A",
          Departemen: mr.department,
          Kategori: mr.kategori,
          Status: mr.status,
          "Level Logistik": mr.level || "-",
          "Cost Center": mr.cost_centers?.name || "-",
          Tujuan: mr.tujuan_site,
          "Estimasi Biaya": mr.cost_estimation,
          Remarks: mr.remarks,
        };

        // Flatten Items (Orders)
        if (mr.orders && mr.orders.length > 0) {
          return mr.orders.map((order: any) => ({
            ...base,
            "Nama Barang": order.name,
            "Part Number": order.part_number || "-",
            Qty: order.qty,
            UoM: order.uom,
            "Est. Harga Satuan": order.estimasi_harga,
          }));
        }
        return [base];
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Material Requests");
      XLSX.writeFile(
        wb,
        `MR_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Export berhasil!");
    } catch (err: any) {
      toast.error("Gagal export", { description: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // --- HELPER STATUS BADGE ---
  const getStatusBadge = (status: string, level: string) => {
    let colorClass = "bg-slate-100 text-slate-800 border-slate-200";

    if (status === "Approved")
      colorClass = "bg-green-100 text-green-800 border-green-200";
    else if (status === "Rejected")
      colorClass = "bg-red-100 text-red-800 border-red-200";
    else if (status === "Pending Approval")
      colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
    else if (status === "On Process" || status === "PO Open")
      colorClass = "bg-blue-100 text-blue-800 border-blue-200";
    else if (status === "Completed")
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";

    return (
      <div className="flex flex-col gap-1 items-center">
        <Badge variant="outline" className={`${colorClass} whitespace-nowrap`}>
          {status}
        </Badge>
        {level && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {level}
          </span>
        )}
      </div>
    );
  };

  return (
    <Content
      title="Manajemen Material Request"
      description="Monitoring seluruh permintaan barang."
    >
      {/* --- FILTER BAR --- */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari Kode MR, Remarks, Departemen..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExporting || loading}
              className="w-full lg:w-auto"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(val) => handleFilterChange("status", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dari Tanggal</label>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sampai Tanggal</label>
            <Input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
            />
          </div>

          <Button variant="secondary" onClick={handleApplyDateFilter}>
            <Calendar className="mr-2 h-4 w-4" /> Terapkan Tanggal
          </Button>
        </div>
      </div>

      {/* --- TABLE --- */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode MR</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Cost Center</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : dataMR.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-32 text-muted-foreground"
                >
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              dataMR.map((mr) => (
                <TableRow key={mr.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium font-mono text-primary">
                    <Link
                      href={`/material-request/${mr.id}`}
                      className="hover:underline"
                    >
                      {mr.kode_mr}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateFriendly(mr.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {mr.users_with_profiles?.nama || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {mr.users_with_profiles?.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{mr.department}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {mr.cost_centers?.name || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(mr.status, mr.level)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/material-request/${mr.id}`}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                          </Link>
                        </DropdownMenuItem>
                        {/* Tambahkan Edit jika diperlukan dan user punya akses */}
                        {mr.status === "Pending Approval" && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/mr-management/edit/${mr.id}`}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- PAGINATION --- */}
      <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => handleFilterChange("limit", val)}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>of {totalItems} entries</span>
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
