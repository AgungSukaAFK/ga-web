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
  Layers,
  Zap,
  CalendarClock,
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
import { Profile, Order } from "@/type";
import * as XLSX from "xlsx";
import { PaginationComponent } from "@/components/pagination-components";
import {
  formatCurrency,
  formatDateFriendly,
  calculatePriority,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DATA_LEVEL,
  LIMIT_OPTIONS,
  STATUS_OPTIONS,
  MR_LEVELS,
} from "@/type/enum";
import { ComboboxData } from "@/components/combobox";
import { fetchActiveCostCenters } from "@/services/mrService";

// --- Tipe Data ---
import { MaterialRequestListItem } from "@/type";

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

  // State Filter Cost Center
  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);

  // --- State dari URL ---
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const departmentFilter = searchParams.get("department") || "";
  const siteFilter = searchParams.get("tujuan_site") || "";
  const sortFilter = searchParams.get("sort") || "created_at.desc";
  const prioritasFilter = searchParams.get("prioritas") || "";
  const levelFilter = searchParams.get("level") || "";
  const minEstimasi = searchParams.get("min_estimasi") || "";
  const maxEstimasi = searchParams.get("max_estimasi") || "";
  const costCenterFilter = searchParams.get("cost_center") || "all";

  // --- State untuk Input ---
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);
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

  // --- Load Cost Centers ---
  useEffect(() => {
    const loadCC = async () => {
      if (currentUser) {
        try {
          const ccData = await fetchActiveCostCenters(
            currentUser.company || "LOURDES"
          );
          const options = ccData.map((cc: any) => ({
            label: `${cc.code} - ${cc.name}`,
            value: String(cc.id),
          }));
          setCostCenterList(options);
        } catch (e) {
          console.error("Gagal load cost center", e);
        }
      }
    };
    if (currentUser) loadCC();
  }, [currentUser]);

  // --- Efek untuk Fetch Data MR ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

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

      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      try {
        // 1. Query Utama
        let query = s.from("material_requests").select(
          `
            id, kode_mr, kategori, status, department, created_at, due_date, 
            tujuan_site, prioritas, level, cost_estimation,
            users_with_profiles!userid (nama),
            cost_centers (code)
          `,
          { count: "exact" }
        );

        // 2. LOGIKA PENCARIAN REVISI (2 Langkah)
        // Ini untuk menghindari error "failed to parse logic tree" pada relasi
        if (searchTerm) {
          // Langkah A: Cari ID user yang namanya mengandung searchTerm
          const { data: matchingUsers } = await s
            .from("users_with_profiles")
            .select("id")
            .ilike("nama", `%${searchTerm}%`); // ilike = case insensitive

          const userIds = matchingUsers?.map((u) => u.id) || [];

          // Langkah B: Bangun filter .or()
          // Format: kode_mr.ilike.%term%,remarks.ilike.%term%
          let orFilter = `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`;

          // Jika ada user yang cocok, tambahkan pencarian by userid
          if (userIds.length > 0) {
            orFilter += `,userid.in.(${userIds.join(",")})`;
          }

          query = query.or(orFilter);
        }

        // Filter Lainnya
        if (statusFilter) query = query.eq("status", statusFilter);
        if (startDate) query = query.gte("created_at", startDate);
        if (endDate)
          query = query.lte("created_at", `${endDate}T23:59:59.999Z`);

        if (departmentFilter) query = query.eq("department", departmentFilter);
        if (siteFilter) query = query.eq("tujuan_site", siteFilter);
        if (prioritasFilter) query = query.eq("prioritas", prioritasFilter);
        if (levelFilter) query = query.eq("level", levelFilter);

        // 3. Filter Cost Center
        if (costCenterFilter && costCenterFilter !== "all") {
          query = query.eq("cost_center_id", costCenterFilter);
        }

        if (minEstimasi)
          query = query.gte("cost_estimation", Number(minEstimasi));
        if (maxEstimasi)
          query = query.lte("cost_estimation", Number(maxEstimasi));

        // 4. Filter Company
        if (userProfile.company && userProfile.company !== "LOURDES") {
          query = query.eq("company_code", userProfile.company);
        }

        const [sortBy, sortOrder] = sortFilter.split(".");
        query = query
          .order(sortBy, { ascending: sortOrder === "asc" })
          .range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const transformedData =
          data?.map((mr: any) => ({
            ...mr,
            users_with_profiles: Array.isArray(mr.users_with_profiles)
              ? mr.users_with_profiles[0] ?? null
              : mr.users_with_profiles,
            cost_centers: Array.isArray(mr.cost_centers)
              ? mr.cost_centers[0] ?? null
              : mr.cost_centers,
            orders: Array.isArray(mr.orders) ? mr.orders : [],
            approvals: Array.isArray(mr.approvals) ? mr.approvals : [],
            attachments: Array.isArray(mr.attachments) ? mr.attachments : [],
            company_code: mr.company_code ?? mr.company ?? null,
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
    searchTerm, // Ini memicu fetch ulang saat searchTerm berubah
    statusFilter,
    startDate,
    endDate,
    departmentFilter,
    siteFilter,
    sortFilter,
    prioritasFilter,
    levelFilter,
    minEstimasi,
    maxEstimasi,
    costCenterFilter,
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
          kode_mr, kategori, department, status, remarks, cost_estimation, 
          tujuan_site, company_code, created_at, due_date,
          prioritas, level, orders, 
          users_with_profiles!userid (nama),
          cost_centers (code)
        `);

      // --- LOGIKA PENCARIAN EXCEL (SAMA DENGAN FETCH DATA) ---
      if (searchTerm) {
        const { data: matchingUsers } = await s
          .from("users_with_profiles")
          .select("id")
          .ilike("nama", `%${searchTerm}%`);

        const userIds = matchingUsers?.map((u) => u.id) || [];
        let orFilter = `kode_mr.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`;
        if (userIds.length > 0) {
          orFilter += `,userid.in.(${userIds.join(",")})`;
        }
        query = query.or(orFilter);
      }

      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
      if (departmentFilter) query = query.eq("department", departmentFilter);
      if (siteFilter) query = query.eq("tujuan_site", siteFilter);
      if (prioritasFilter) query = query.eq("prioritas", prioritasFilter);
      if (levelFilter) query = query.eq("level", levelFilter);
      if (costCenterFilter && costCenterFilter !== "all") {
        query = query.eq("cost_center_id", costCenterFilter);
      }
      if (minEstimasi)
        query = query.gte("cost_estimation", Number(minEstimasi));
      if (maxEstimasi)
        query = query.lte("cost_estimation", Number(maxEstimasi));

      if (currentUser.company && currentUser.company !== "LOURDES") {
        query = query.eq("company_code", currentUser.company);
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
        const livePriority = calculatePriority(mr.due_date || new Date());

        const baseMrInfo = {
          "Kode MR": mr.kode_mr,
          Kategori: mr.kategori,
          "Cost Center": mr.cost_centers?.code || "-",
          Departemen: mr.department,
          Tujuan: mr.tujuan_site,
          Status: mr.status,
          Level: mr.level,
          "Prioritas (Live)": livePriority,
          "Prioritas (Awal)": mr.prioritas,
          Requester: mr.users_with_profiles?.nama || "N/A",
          Perusahaan: mr.company_code,
          Remarks: mr.remarks,
          "Total Estimasi Biaya (MR)": Number(mr.cost_estimation),
          "Tanggal Dibuat": formatDateFriendly(mr.created_at ?? undefined),
          "Due Date": formatDateFriendly(mr.due_date ?? undefined),
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
        `Material_Requests_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast.success("Data MR berhasil diunduh!");
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
              placeholder="Cari Kode MR, Requester, Remarks..."
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Level</label>
              <Select
                onValueChange={(value) =>
                  handleFilterChange({
                    level: value === "all" ? undefined : value,
                  })
                }
                defaultValue={levelFilter || "all"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Level</SelectItem>
                  {MR_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
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

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2"></div>
            <div className="flex flex-col gap-2 justify-end">
              <Button
                className="w-full"
                onClick={() =>
                  handleFilterChange({
                    startDate: startDateInput,
                    endDate: endDateInput,
                    min_estimasi: minEstimasiInput || undefined,
                    max_estimasi: maxEstimasiInput || undefined,
                  })
                }
              >
                Terapkan Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Table Section --- */}
      <div className="border rounded-md overflow-x-auto" id="printable-area">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Cost Center</TableHead>
              <TableHead>Prioritas</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Tujuan Site</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total Estimasi</TableHead>
              <TableHead className="text-right no-print">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || isPending ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center h-24">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memuat data...
                  </div>
                </TableCell>
              </TableRow>
            ) : dataMR.length > 0 ? (
              dataMR.map((mr, index) => {
                const livePriority = calculatePriority(
                  mr.due_date || new Date()
                );

                return (
                  <TableRow key={mr.id}>
                    <TableCell className="font-medium">
                      {(currentPage - 1) * limit + index + 1}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {mr.kode_mr}
                    </TableCell>
                    {/* Kolom Cost Center */}
                    <TableCell>
                      <Badge variant="outline">
                        {(mr as any).cost_centers?.code || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          livePriority === "P0" ? "destructive" : "outline"
                        }
                        className={cn(
                          "font-mono transition-all duration-500",
                          livePriority === "P0" &&
                            "animate-pulse repeat-[5] shadow-sm"
                        )}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        {livePriority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-slate-600">
                        <Layers className="h-3 w-3 mr-1" />
                        {mr.level}
                      </Badge>
                    </TableCell>
                    <TableCell>{mr.kategori}</TableCell>
                    <TableCell>{mr.department}</TableCell>
                    <TableCell>{mr.tujuan_site || "N/A"}</TableCell>
                    <TableCell>
                      {mr.users_with_profiles?.nama || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{mr.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDateFriendly(mr.created_at ?? undefined)}
                    </TableCell>
                    <TableCell>
                      {mr.due_date ? (
                        <span
                          className={cn(
                            livePriority === "P0"
                              ? "text-destructive font-bold"
                              : ""
                          )}
                        >
                          {formatDateFriendly(mr.due_date)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(mr.cost_estimation)}
                    </TableCell>
                    <TableCell className="text-right no-print">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/material-request/${mr.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-center h-24">
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- Pagination & Limit Section --- */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
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

export default function MaterialRequestPage() {
  return (
    <Suspense
      fallback={
        <Content
          title="Daftar Material Request"
          size="lg"
          className="col-span-12"
        >
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <MaterialRequestContent />
    </Suspense>
  );
}
