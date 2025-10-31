// src/app/(With Sidebar)/po-management/PoManagementClient.tsx

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
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Newspaper, Search, Edit } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import * as XLSX from "xlsx";
import { PurchaseOrderListItem, Profile } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LIMIT_OPTIONS } from "@/type/enum";

const STATUS_OPTIONS = [
  "Pending Validation",
  "Pending Approval",
  "Pending BAST",
  "Completed",
  "Rejected",
  "Draft",
  "Ordered",
];

export function PoManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [poList, setPoList] = useState<PurchaseOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";
  const limit = Number(searchParams.get("limit") || 25);

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

  useEffect(() => {
    async function fetchPOsAndAdminProfile() {
      setLoading(true);

      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak valid. Silakan login kembali.");
        router.push("/auth/login");
        return;
      }
      const { data: profileData } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        toast.error("Akses ditolak.");
        router.push("/dashboard");
        return;
      }
      setAdminProfile(profileData);

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s.from("purchase_orders").select(
        `
            id, kode_po, status, total_price, created_at, company_code,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr)
          `,
        { count: "exact" }
      );

      if (searchTerm)
        query = query.or(
          `kode_po.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,material_requests.kode_mr.ilike.%${searchTerm}%`
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (companyFilter) query = query.eq("company_code", companyFilter);

      if (profileData.company && profileData.company !== "LOURDES") {
        query = query.eq("company_code", profileData.company);
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data PO: " + error.message);
        setPoList([]);
      } else {
        const transformedData =
          data?.map((po) => ({
            ...po,
            users_with_profiles: Array.isArray(po.users_with_profiles)
              ? po.users_with_profiles[0] ?? null
              : po.users_with_profiles,
            material_requests: Array.isArray(po.material_requests)
              ? po.material_requests[0] ?? null
              : po.material_requests,
          })) || [];
        setPoList(transformedData as PurchaseOrderListItem[]);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchPOsAndAdminProfile();
  }, [s, currentPage, searchTerm, statusFilter, companyFilter, limit, router]);

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

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleDownloadExcel = async () => {
    if (!adminProfile) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s.from("purchase_orders").select(`
            kode_po, status, total_price, company_code, created_at,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr)
        `);

      if (searchTerm)
        query = query.or(
          `kode_po.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,material_requests.kode_mr.ilike.%${searchTerm}%`
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
        toast.warning("Tidak ada data PO untuk diekspor sesuai filter.");
        setIsExporting(false);
        return;
      }

      const formattedData = data.map((po: any) => ({
        "Kode PO": po.kode_po,
        "Ref. Kode MR": po.material_requests?.kode_mr || "N/A",
        Status: po.status,
        "Total Harga": po.total_price,
        Pembuat: po.users_with_profiles?.nama || "N/A",
        Perusahaan: po.company_code,
        "Tanggal Dibuat": formatDateFriendly(po.created_at),
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
      XLSX.writeFile(
        workbook,
        `Admin_Purchase_Orders_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success("Data PO berhasil diunduh!");
    } catch (error: any) {
      toast.error("Gagal mengunduh data", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Content
      title="Manajemen Purchase Order (Admin)"
      size="lg"
      className="col-span-12"
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode PO, Ref MR, Status..."
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

      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode PO</TableHead>
              <TableHead>Ref. Kode MR</TableHead>
              <TableHead>Pembuat</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Harga</TableHead>
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
            ) : poList.length > 0 ? (
              poList.map((po, index) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="font-semibold">{po.kode_po}</TableCell>
                  <TableCell>
                    {po.material_requests?.kode_mr || "N/A"}
                  </TableCell>
                  <TableCell>{po.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{po.company_code || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{po.status}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(po.total_price)}</TableCell>
                  <TableCell>{formatDateFriendly(po.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/po-management/edit/${po.id}`}>
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
                  Tidak ada Purchase Order yang ditemukan.
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
          <span>dari {totalItems} PO.</span>
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
