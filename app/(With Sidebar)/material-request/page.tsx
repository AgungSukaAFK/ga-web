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
  Layers,
  Building2,
  X,
  Eye,
  Calendar,
  User,
  MapPin,
  Tag,
  DollarSign,
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
import { Profile, Order, MaterialRequestListItem } from "@/type";
import * as XLSX from "xlsx";
import { CustomPagination } from "@/components/custom-pagination";
import {
  formatCurrency,
  formatDateFriendly,
  calculatePriority,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STATUS_OPTIONS, MR_LEVELS } from "@/type/enum";
import { ComboboxData } from "@/components/combobox";
import {
  fetchActiveCostCenters,
  normalizeMrOrders,
} from "@/services/mrService";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- Konstanta Filter ---
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

// Opsi Limit sesuai permintaan
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000, 10000];

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
    null,
  );
  const [costCenterList, setCostCenterList] = useState<ComboboxData>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  // --- Quick View State ---
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [selectedMr, setSelectedMr] = useState<MaterialRequestListItem | null>(
    null,
  );

  // --- URL Params ---
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const departmentFilter = searchParams.get("department") || "";
  const siteFilter = searchParams.get("tujuan_site") || "";
  const sortFilter = searchParams.get("sort") || "created_at.desc";
  const levelFilter = searchParams.get("level") || "";
  const minEstimasi = searchParams.get("min_estimasi") || "";
  const maxEstimasi = searchParams.get("max_estimasi") || "";
  const costCenterFilter = searchParams.get("cost_center") || "all";
  const prioritasFilter = searchParams.get("prioritas") || "";

  // Local Input State
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);
  const [minEstimasiInput, setMinEstimasiInput] = useState(minEstimasi);
  const [maxEstimasiInput, setMaxEstimasiInput] = useState(maxEstimasi);

  // --- Helper: Create Query String ---
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
      // Reset page jika parameter selain 'page' berubah
      if (
        Object.keys(paramsToUpdate).some((k) => k !== "page" && k !== "limit")
      ) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  // --- Helper: Handle Page Change ---
  const handlePageChange = (page: number) => {
    const queryString = createQueryString({ page });
    startTransition(() => {
      router.push(`${pathname}?${queryString}`);
    });
  };

  // --- Load User ---
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) return;

      const { data: profile } = await s
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const fullUser = { ...user, ...profile };
      setCurrentUser(fullUser as AuthUser & Profile);

      if (profile?.company) {
        if (profile.company === "LOURDES") {
          setSelectedCompanies(["GMI", "GIS", "LOURDES"]);
        } else if (["GMI", "GIS"].includes(profile.company)) {
          setSelectedCompanies([profile.company, "LOURDES"]);
        } else {
          setSelectedCompanies([profile.company]);
        }
      }

      try {
        const ccData = await fetchActiveCostCenters(
          profile?.company || "LOURDES",
        );
        const options = ccData.map((cc: any) => ({
          label: `${cc.code} - ${cc.name}`,
          value: String(cc.id),
        }));
        setCostCenterList(options);
      } catch (e) {
        console.error(e);
      }
    };
    loadUser();
  }, []);

  // --- Fetch Data ---
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;

      try {
        let query = s.from("material_requests").select(
          `
            id, kode_mr, kategori, status, department, created_at, due_date, 
            tujuan_site, prioritas, level, cost_estimation, remarks, company_code, orders,
            users_with_profiles!userid (nama),
            cost_centers (code)
          `,
          { count: "exact" },
        );

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
        if (endDate)
          query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
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

        const userCompany = currentUser.company;
        let allowedScope: string[] = [];

        if (userCompany === "LOURDES") {
          allowedScope = ["ALL"];
        } else if (["GMI", "GIS"].includes(userCompany || "")) {
          allowedScope = [userCompany!, "LOURDES"];
        } else {
          allowedScope = userCompany ? [userCompany] : [];
        }

        if (selectedCompanies.length > 0) {
          if (allowedScope.includes("ALL")) {
            query = query.in("company_code", selectedCompanies);
          } else {
            const validFilters = selectedCompanies.filter((c) =>
              allowedScope.includes(c),
            );
            if (validFilters.length > 0) {
              query = query.in("company_code", validFilters);
            } else {
              query = query.eq("id", -1);
            }
          }
        } else {
          if (!allowedScope.includes("ALL")) {
            query = query.in("company_code", allowedScope);
          }
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
              ? (mr.users_with_profiles[0] ?? null)
              : mr.users_with_profiles,
            cost_centers: Array.isArray(mr.cost_centers)
              ? (mr.cost_centers[0] ?? null)
              : mr.cost_centers,
            orders: normalizeMrOrders(
              Array.isArray(mr.orders) ? mr.orders : [],
            ),
            company_code: mr.company_code ?? null,
          })) || [];

        setDataMR(transformedData as MaterialRequestListItem[]);
        setTotalItems(count || 0);
      } catch (error: any) {
        toast.error("Gagal memuat data MR", { description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    currentUser,
    currentPage,
    limit,
    searchTerm,
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
    selectedCompanies,
  ]);

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
  }, [searchInput, searchTerm, createQueryString, pathname, router]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleCompanyToggle = (company: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(company)
        ? prev.filter((c) => c !== company)
        : [...prev, company],
    );
    handleFilterChange({ page: 1 });
  };

  const clearFilters = () => {
    setSearchInput("");
    setStartDateInput("");
    setEndDateInput("");
    setMinEstimasiInput("");
    setMaxEstimasiInput("");

    router.push(pathname);

    if (currentUser?.company) {
      if (currentUser.company === "LOURDES")
        setSelectedCompanies(["GMI", "GIS", "LOURDES"]);
      else if (["GMI", "GIS"].includes(currentUser.company))
        setSelectedCompanies([currentUser.company, "LOURDES"]);
      else setSelectedCompanies([currentUser.company]);
    }
  };

  const getAvailableCompanyOptions = () => {
    const myCompany = currentUser?.company;
    if (myCompany === "LOURDES") return ["GMI", "GIS", "LOURDES"];
    if (myCompany === "GMI") return ["GMI", "LOURDES"];
    if (myCompany === "GIS") return ["GIS", "LOURDES"];
    return [myCompany || ""];
  };

  const handleDownloadExcel = async () => {
    if (!currentUser) return;
    setIsExporting(true);
    toast.info("Mempersiapkan data lengkap...");

    try {
      let query = s.from("material_requests").select(`
            kode_mr, kategori, department, status, remarks, cost_estimation, 
            tujuan_site, company_code, created_at, due_date,
            prioritas, level, orders, 
            users_with_profiles!userid (nama),
            cost_centers (code)
        `);

      if (searchTerm) query = query.or(`kode_mr.ilike.%${searchTerm}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
      if (departmentFilter) query = query.eq("department", departmentFilter);
      if (siteFilter) query = query.eq("tujuan_site", siteFilter);
      if (levelFilter) query = query.eq("level", levelFilter);

      const userCompany = currentUser.company;
      if (userCompany !== "LOURDES") {
        const allowed = ["GMI", "GIS"].includes(userCompany || "")
          ? [userCompany!, "LOURDES"]
          : [userCompany!];
        if (selectedCompanies.length > 0) {
          const valid = selectedCompanies.filter((c) => allowed.includes(c));
          if (valid.length > 0) query = query.in("company_code", valid);
          else query = query.eq("id", -1);
        } else {
          query = query.in("company_code", allowed);
        }
      } else if (selectedCompanies.length > 0) {
        query = query.in("company_code", selectedCompanies);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning("Tidak ada data untuk diekspor.");
        setIsExporting(false);
        return;
      }

      const formattedData = data.flatMap((mr: any) => {
        const baseMrInfo = {
          "Kode MR": mr.kode_mr,
          "Cost Center": mr.cost_centers?.code || "-",
          Level: mr.level,
          Kategori: mr.kategori,
          Departemen: mr.department,
          "Tujuan Site": mr.tujuan_site,
          Requester: mr.users_with_profiles?.nama || "N/A",
          "Status MR": mr.status,
          Company: mr.company_code,
          "Tanggal Dibuat": formatDateFriendly(mr.created_at ?? undefined),
          "Due Date": formatDateFriendly(mr.due_date ?? undefined),
          "Total Estimasi": Number(mr.cost_estimation),
          Remarks: mr.remarks,
        };

        const orders = normalizeMrOrders(mr.orders);
        if (orders.length > 0) {
          return orders.map((item: Order, idx: number) => ({
            ...baseMrInfo,
            "No Item": idx + 1,
            "Nama Barang": item.name,
            "Part Number": item.part_number || "-",
            Qty: Number(item.qty) || 0,
            UoM: item.uom,
            "Estimasi Harga": Number(item.estimasi_harga) || 0,
            "Total Harga Item":
              (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0),
            "Status Barang": item.status || "Pending",
            "No. PO": item.po_refs?.join(", ") || "-",
            "Catatan Item": item.note || item.status_note || "-",
            URL: item.url || "-",
          }));
        } else {
          return [{ ...baseMrInfo, "Nama Barang": "TIDAK ADA ITEM" }];
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data MR & Tracking");
      XLSX.writeFile(
        workbook,
        `Rekap_MR_Tracking_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Download berhasil!");
    } catch (error: any) {
      toast.error("Gagal export excel", { description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => window.print();

  const handleRowClick = (mr: MaterialRequestListItem) => {
    setSelectedMr(mr);
    setIsQuickViewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Approved
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending approval":
        return <Badge variant="secondary">Pending Approval</Badge>;
      case "pending validation":
        return (
          <Badge
            variant="outline"
            className="border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800"
          >
            Validation
          </Badge>
        );
      case "waiting po":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800">
            Waiting PO
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800">
            Completed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
      <div className="flex flex-col gap-4 mb-6 no-print">
        {/* Row 1: Search & Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode MR, Requester..."
              className="pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              variant="outline"
              className="w-full md:w-auto"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Newspaper className="mr-2 h-4 w-4" />
              )}{" "}
              Excel
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="w-full md:w-auto"
            >
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
          </div>
        </div>

        {/* Row 2: Filter Grid */}
        <div className="p-4 border rounded-lg bg-muted/50 dark:bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) =>
                  handleFilterChange({ status: v === "all" ? undefined : v })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cost Center</label>
              <Select
                value={costCenterFilter}
                onValueChange={(v) => handleFilterChange({ cost_center: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Cost Center" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua CC</SelectItem>
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
                value={levelFilter || "all"}
                onValueChange={(v) =>
                  handleFilterChange({ level: v === "all" ? undefined : v })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Level" />
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
                value={departmentFilter || "all"}
                onValueChange={(v) =>
                  handleFilterChange({
                    department: v === "all" ? undefined : v,
                  })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Dept</SelectItem>
                  {dataDepartment.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
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
                value={siteFilter || "all"}
                onValueChange={(v) =>
                  handleFilterChange({
                    tujuan_site: v === "all" ? undefined : v,
                  })
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Site</SelectItem>
                  {dataLokasi.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
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
                className="bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Max Estimasi</label>
              <Input
                type="number"
                placeholder="Rp Max"
                value={maxEstimasiInput}
                onChange={(e) => setMaxEstimasiInput(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="bg-background"
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
                className="bg-background"
              />
            </div>

            {/* FILTER COMPANY */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Filter Perusahaan</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-background font-normal"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {selectedCompanies.length > 0
                        ? `${selectedCompanies.length} Terpilih`
                        : "Pilih PT"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Pilih Perusahaan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {getAvailableCompanyOptions().map((company) => (
                    <DropdownMenuCheckboxItem
                      key={company}
                      checked={selectedCompanies.includes(company)}
                      onCheckedChange={() => handleCompanyToggle(company)}
                    >
                      {company}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-2 justify-end">
              <Button
                className="w-full"
                onClick={() =>
                  handleFilterChange({
                    startDate: startDateInput,
                    endDate: endDateInput,
                    min_estimasi: minEstimasiInput,
                    max_estimasi: maxEstimasiInput,
                  })
                }
              >
                Terapkan Filter
              </Button>
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-muted-foreground w-full"
              >
                <X className="mr-2 h-3 w-3" /> Reset Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Table Data --- */}
      <div
        className="border rounded-md overflow-x-auto bg-card"
        id="printable-area"
      >
        <Table className="min-w-[1600px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Kode MR</TableHead>
              <TableHead>Cost Center</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Tujuan Site</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Tanggal Dibuat</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total Estimasi</TableHead>
              <TableHead className="text-right no-print">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : dataMR.length > 0 ? (
              dataMR.map((mr, index) => (
                <TableRow
                  key={mr.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => handleRowClick(mr)}
                >
                  <TableCell className="text-muted-foreground">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>

                  {/* Kode MR */}
                  <TableCell className="font-semibold text-foreground">
                    {mr.kode_mr}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">
                      {(mr as any).cost_centers?.code || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="default"
                      className="bg-slate-600 dark:bg-slate-700"
                    >
                      <Layers className="h-3 w-3 mr-1" /> {mr.level || "OPEN 1"}
                    </Badge>
                  </TableCell>
                  <TableCell>{mr.kategori}</TableCell>
                  <TableCell>{mr.department}</TableCell>
                  <TableCell>{mr.tujuan_site || "N/A"}</TableCell>
                  <TableCell>{mr.users_with_profiles?.nama || "N/A"}</TableCell>
                  <TableCell>{getStatusBadge(mr.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {mr.company_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateFriendly(mr.created_at ?? undefined)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {mr.due_date ? formatDateFriendly(mr.due_date) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(mr.cost_estimation))}
                  </TableCell>

                  {/* Aksi: Hanya View */}
                  <TableCell className="text-right no-print">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/material-request/${mr.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 no-print">
        {/* Limit Selector */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => handleFilterChange({ limit: val, page: 1 })}
          >
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue placeholder={limit} />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>entries</span>
          <span className="hidden sm:inline-block ml-2">
            (Total {totalItems})
          </span>
        </div>

        <CustomPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / limit)}
          onPageChange={handlePageChange}
        />
      </div>

      {/* --- QUICK VIEW DIALOG --- */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ringkasan MR: {selectedMr?.kode_mr}
            </DialogTitle>
            <DialogDescription>
              Informasi singkat dan daftar barang.
            </DialogDescription>
          </DialogHeader>

          {selectedMr && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg text-sm border">
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <User className="h-3 w-3" /> Requester
                  </p>
                  <p className="font-medium">
                    {selectedMr.users_with_profiles?.nama}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Dept
                  </p>
                  <p className="font-medium">{selectedMr.department}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Site
                  </p>
                  <p className="font-medium">{selectedMr.tujuan_site}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Dibuat
                  </p>
                  <p className="font-medium">
                    {formatDateFriendly(selectedMr.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Status
                  </p>
                  {getStatusBadge(selectedMr.status)}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Level
                  </p>
                  <p className="font-medium">{selectedMr.level}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Estimasi
                  </p>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedMr.cost_estimation))}
                  </p>
                </div>
              </div>

              {/* Table Items */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Daftar Barang
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Est. Harga</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMr.orders && selectedMr.orders.length > 0 ? (
                        selectedMr.orders.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell>{item.qty}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell>
                              {formatCurrency(item.estimasi_harga)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(
                                (Number(item.qty) || 0) *
                                  (Number(item.estimasi_harga) || 0),
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.status || "Pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground h-16"
                          >
                            Tidak ada barang.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickViewOpen(false)}>
              Tutup
            </Button>
            {selectedMr && (
              <Button asChild>
                <Link href={`/material-request/${selectedMr.id}`}>
                  <Eye className="mr-2 h-4 w-4" /> Lihat Detail Lengkap
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}

export default function MaterialRequestPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-96 w-full" />
        </Content>
      }
    >
      <MaterialRequestContent />
    </Suspense>
  );
}
