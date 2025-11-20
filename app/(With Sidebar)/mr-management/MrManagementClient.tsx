// src/app/(With Sidebar)/mr-management/MrManagementClient.tsx

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
import { MaterialRequestListItem, Order, Profile } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LIMIT_OPTIONS, STATUS_OPTIONS } from "@/type/enum";
import { ComboboxData } from "@/components/combobox";
import { fetchActiveCostCenters } from "@/services/mrService"; // Import service cost center

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

const SORT_OPTIONS = [
  { label: "Tanggal Dibuat (Terbaru)", value: "created_at.desc" },
  { label: "Tanggal Dibuat (Terlama)", value: "created_at.asc" },
  { label: "Due Date (Mendesak)", value: "due_date.asc" },
  { label: "Due Date (Lama)", value: "due_date.desc" },
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

  // State untuk Cost Center Filter
  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);

  // State dari URL
  const currentPage = Number(searchParams.get("page") || "1");
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";
  const costCenterFilter = searchParams.get("cost_center") || "all"; // Filter baru
  const limit = Number(searchParams.get("limit") || 25);
  const departmentFilter = searchParams.get("department") || "";
  const siteFilter = searchParams.get("tujuan_site") || "";
  const sortFilter = searchParams.get("sort") || "created_at.desc";
  const minEstimasi = searchParams.get("min_estimasi") || "";
  const maxEstimasi = searchParams.get("max_estimasi") || "";

  // State untuk input form
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [minEstimasiInput, setMinEstimasiInput] = useState(minEstimasi);
  const [maxEstimasiInput, setMaxEstimasiInput] = useState(maxEstimasi);

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

  // 1. Load Cost Centers untuk Filter
  useEffect(() => {
    const loadCostCenters = async () => {
      if (adminProfile) {
        try {
          const ccData = await fetchActiveCostCenters(
            adminProfile.company || "LOURDES"
          );
          const options = ccData.map((cc: any) => ({
            label: `${cc.code} - ${cc.name}`,
            value: String(cc.id),
          }));
          setCostCenterList(options);
        } catch (e) {
          console.error("Failed to load cost centers", e);
        }
      }
    };

    if (adminProfile) {
      loadCostCenters();
    }
  }, [adminProfile]);

  // 2. Fetch Data MR & Profil Admin
  useEffect(() => {
    async function fetchMRsAndAdminProfile() {
      setLoading(true);

      // Ambil profil admin
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
        toast.error(
          "Akses ditolak. Hanya admin yang bisa mengakses halaman ini."
        );
        router.push("/dashboard");
        return;
      }
      setAdminProfile(profileData);

      // Fetch data MR
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      let query = s.from("material_requests").select(
        `
            id, kode_mr, kategori, status, department, created_at, due_date, company_code, cost_estimation,
            tujuan_site,
            users_with_profiles!userid (nama),
            cost_centers (code)
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
      if (departmentFilter) query = query.eq("department", departmentFilter);
      if (siteFilter) query = query.eq("tujuan_site", siteFilter);

      // Filter Cost Center Baru
      if (costCenterFilter && costCenterFilter !== "all") {
        query = query.eq("cost_center_id", costCenterFilter);
      }

      if (minEstimasi)
        query = query.gte("cost_estimation", Number(minEstimasi));
      if (maxEstimasi)
        query = query.lte("cost_estimation", Number(maxEstimasi));

      if (profileData.company && profileData.company !== "LOURDES") {
        query = query.eq("company_code", profileData.company);
      }

      // Sorting
      const [sortBy, sortOrder] = sortFilter.split(".");
      query = query
        .order(sortBy, { ascending: sortOrder === "asc" })
        .range(from, to);

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
            // Ensure required fields from MaterialRequestListItem exist with safe defaults
            orders: Array.isArray((mr as any).orders) ? (mr as any).orders : [],
            approvals: Array.isArray((mr as any).approvals)
              ? (mr as any).approvals
              : [],
            attachments: Array.isArray((mr as any).attachments)
              ? (mr as any).attachments
              : [],
            prioritas: (mr as any).prioritas ?? null,
            level: (mr as any).level ?? null,
          })) || [];
        setMrList(transformedData as MaterialRequestListItem[]);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchMRsAndAdminProfile();
  }, [
    s,
    currentPage,
    searchTerm,
    statusFilter,
    companyFilter,
    costCenterFilter, // Dependency baru
    limit,
    router,
    departmentFilter,
    siteFilter,
    sortFilter,
    minEstimasi,
    maxEstimasi,
  ]);

  // Debounce search
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

  // 3. Update Download Excel
  const handleDownloadExcel = async () => {
    if (!adminProfile) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap untuk diunduh...");

    try {
      let query = s.from("material_requests").select(`
          kode_mr, kategori, department, status, remarks, cost_estimation, tujuan_site, company_code, created_at, due_date,
          orders, 
          users_with_profiles!userid (nama),
          cost_centers (code)
        `);

      if (searchTerm)
        query = query.or(
          `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`
        );
      if (statusFilter) query = query.eq("status", statusFilter);
      if (companyFilter) query = query.eq("company_code", companyFilter);
      if (departmentFilter) query = query.eq("department", departmentFilter);
      if (siteFilter) query = query.eq("tujuan_site", siteFilter);
      if (costCenterFilter && costCenterFilter !== "all") {
        query = query.eq("cost_center_id", costCenterFilter);
      }
      if (minEstimasi)
        query = query.gte("cost_estimation", Number(minEstimasi));
      if (maxEstimasi)
        query = query.lte("cost_estimation", Number(maxEstimasi));

      if (adminProfile.company && adminProfile.company !== "LOURDES") {
        query = query.eq("company_code", adminProfile.company);
      }

      const [sortBy, sortOrder] = sortFilter.split(".");
      const { data, error } = await query.order(sortBy, {
        ascending: sortOrder === "asc",
      });
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Tidak ada data MR untuk diekspor sesuai filter.");
        setIsExporting(false);
        return;
      }

      const formattedData = data.flatMap((mr: any) => {
        const baseMrInfo = {
          "Kode MR": mr.kode_mr,
          Kategori: mr.kategori,
          "Cost Center": mr.cost_centers?.code || "-", // Kolom Baru di Excel
          Departemen: mr.department,
          Tujuan: mr.tujuan_site,
          Status: mr.status,
          Requester: mr.users_with_profiles?.nama || "N/A",
          Perusahaan: mr.company_code,
          Remarks: mr.remarks,
          "Total Estimasi Biaya (MR)": Number(mr.cost_estimation),
          "Tanggal Dibuat": formatDateFriendly(mr.created_at),
          "Due Date": formatDateFriendly(mr.due_date),
        };

        if (Array.isArray(mr.orders) && mr.orders.length > 0) {
          return mr.orders.map((item: Order) => ({
            ...baseMrInfo,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Filter Company */}
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
                  <SelectValue placeholder="Filter departemen" />
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
                  <SelectValue placeholder="Filter site" />
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

            {/* 4. Filter Cost Center Baru */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cost Center</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    cost_center: value,
                  })
                }
                defaultValue={costCenterFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Cost Center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cost Center</SelectItem>
                  {costCenterList.map((cc) => (
                    <SelectItem key={cc.value} value={cc.value}>
                      {cc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Estimasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Min Estimasi</label>
              <Input
                type="number"
                placeholder="Rp 0"
                value={minEstimasiInput}
                onChange={(e) => setMinEstimasiInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Max Estimasi</label>
              <Input
                type="number"
                placeholder="Rp 1.000.000"
                value={maxEstimasiInput}
                onChange={(e) => setMaxEstimasiInput(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-2 justify-end">
              <Button
                className="w-full"
                onClick={() =>
                  handleFilterChange({
                    min_estimasi: minEstimasiInput || undefined,
                    max_estimasi: maxEstimasiInput || undefined,
                  })
                }
              >
                Terapkan Filter Estimasi
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Cost Center</TableHead> {/* Kolom Baru */}
              <TableHead>Requester</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Tujuan Site</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Estimasi</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center h-24">
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
                  {/* Tampilkan Kode Cost Center */}
                  <TableCell>
                    <Badge variant="outline">
                      {(mr as any).cost_centers?.code || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>{mr.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>{mr.department}</TableCell>
                  <TableCell>{mr.tujuan_site || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{mr.company_code || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mr.status}</Badge>
                  </TableCell>
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
                <TableCell colSpan={11} className="text-center h-24">
                  Tidak ada Material Request yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
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
            <span>dari {totalItems} MR.</span>
          </div>

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
