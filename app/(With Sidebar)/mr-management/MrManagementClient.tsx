// src/app/(With Sidebar)/mr-management/MrManagementClient.tsx

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
  Building2,
  X,
  Eye,
  Calendar,
  User,
  MapPin,
  Tag,
  DollarSign,
  MoreHorizontal,
  Upload,
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
import { Profile, Order, MaterialRequestListItem, Attachment } from "@/type";
import { exportStyledExcel } from "@/lib/excel-export";
import { CustomPagination } from "@/components/custom-pagination";
import {
  formatCurrency,
  formatDateFriendly,
  calculatePriority,
  cn,
  getCurrentApprover,
  formatAge,
} from "@/lib/utils";
import { PicPoPopover } from "@/components/pic-po-popover";
import { PicGaPopover } from "@/components/pic-ga-popover";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LIMIT_OPTIONS,
  STATUS_OPTIONS,
  MR_LEVELS,
  MR_ITEM_BAST_ELIGIBLE_STATUSES,
  MR_ITEM_STATUS_LABELS,
  MR_ITEM_STATUS_COLORS,
  MR_ITEM_STATUS_COLOR_DEFAULT,
  PO_REF_STATUS_COLORS,
  PO_REF_STATUS_COLOR_DEFAULT,
} from "@/type/enum";
import { ComboboxData } from "@/components/combobox";
import { dataDepartment } from "@/type/comboboxData";
import {
  fetchActiveCostCenters,
  normalizeMrOrders,
  uploadBastForMrItem,
  removeBastForMrItem,
} from "@/services/mrService";
import { uploadAttachmentVps } from "@/services/storageService";
import { logActivity } from "@/services/logService";
import {
  resolveAttachmentUrl,
  getAttachmentSizeError,
  getUploadErrorMessage,
} from "@/lib/attachments";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
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
  { label: "GIS BPN", value: "GIS BPN" },
  { label: "Site Manado", value: "Site Manado" },
  { label: "Site DIZA", value: "Site DIZA" },
  { label: "Site PIK", value: "Site PIK" },
  { label: "Site BGE", value: "Site BGE" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000, 10000];

export default function MrManagementClient() {
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
  // Peta kode_po -> {id, status} utk badge PO Refs per item di Quick View.
  const [quickViewPoRefsMap, setQuickViewPoRefsMap] = useState<
    Record<string, { id: number; status: string }>
  >({});

  // --- Upload BAST State (Admin, via MR Management) ---
  // Bisa upload utk >1 barang sekaligus (mis. 1 foto BAST yg sama mewakili
  // beberapa barang) - satu file diunggah sekali, lalu dilampirkan ke semua
  // barang terpilih.
  const [isBastUploadOpen, setIsBastUploadOpen] = useState(false);
  const [selectedItemsForBast, setSelectedItemsForBast] = useState<Order[]>(
    [],
  );
  const [bastFiles, setBastFiles] = useState<FileList | null>(null);
  const [uploadingBast, setUploadingBast] = useState(false);

  // --- URL Params ---
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const departmentFilter = searchParams.get("department") || "";
  const siteFilter = searchParams.get("tujuan_site") || "";
  const levelFilter = searchParams.get("level") || "";
  const minEstimasi = searchParams.get("min_estimasi") || "";
  const maxEstimasi = searchParams.get("max_estimasi") || "";
  const costCenterFilter = searchParams.get("cost_center") || "all";

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

  // --- Load User & Default Filters ---
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

      // Default Filter Company Logic (Admin scope)
      if (profile?.company) {
        if (profile.company === "LOURDES") {
          setSelectedCompanies(["GMI", "GIS", "LOURDES"]);
        } else if (["GMI", "GIS"].includes(profile.company)) {
          setSelectedCompanies([profile.company, "LOURDES"]);
        } else {
          setSelectedCompanies([profile.company]);
        }
      }

      // Load Cost Centers
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
            tujuan_site, prioritas, level, cost_estimation, remarks, company_code, orders, approvals, full_received_at,
            users_with_profiles!userid (nama),
            cost_centers (code)
          `,
          { count: "exact" },
        );

        // --- Filter Logic ---
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
        if (levelFilter) query = query.eq("level", levelFilter);
        if (costCenterFilter && costCenterFilter !== "all") {
          query = query.eq("cost_center_id", costCenterFilter);
        }
        if (minEstimasi)
          query = query.gte("cost_estimation", Number(minEstimasi));
        if (maxEstimasi)
          query = query.lte("cost_estimation", Number(maxEstimasi));

        // Company Visibility Logic
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

        const { data, error, count } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

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
    levelFilter,
    minEstimasi,
    maxEstimasi,
    costCenterFilter,
    selectedCompanies,
  ]);

  // Debounce Search
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

  // Handlers
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

      // Re-apply same filters as fetch logic...
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
        .limit(2000);

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
            "Status Barang":
              MR_ITEM_STATUS_LABELS[item.status || "Pending"] ||
              item.status ||
              "Pending",
            "No. PO": item.po_refs?.join(", ") || "-",
            "Catatan Item": item.note || item.status_note || "-",
            URL: item.url || "-",
          }));
        } else {
          return [{ ...baseMrInfo, "Nama Barang": "TIDAK ADA ITEM" }];
        }
      });

      await exportStyledExcel(
        formattedData,
        `Rekap_MR_Admin_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Data MR & Tracking",
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
    setQuickViewPoRefsMap({});
    s.from("purchase_orders")
      .select("id, kode_po, status")
      .eq("mr_id", mr.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { id: number; status: string }> = {};
        for (const row of data) {
          map[row.kode_po] = { id: row.id, status: row.status };
        }
        setQuickViewPoRefsMap(map);
      });
  };

  // --- Upload BAST (Admin, via MR Management) ---
  // `item` di-pre-select kalau dibuka dari tombol per-baris; dialog tetap
  // nampilin semua barang berstatus "On Delivery" (atau "Pending BAST" utk
  // data lama) di MR yg sama biar bisa nambah barang lain (utk kasus 1 foto
  // BAST yg sama dipakai buat beberapa barang).
  const bastEligibleItems = (selectedMr?.orders || []).filter(
    (o: Order) =>
      MR_ITEM_BAST_ELIGIBLE_STATUSES.includes(o.status || "") &&
      o.part_number,
  );

  const handleOpenBastUpload = (item?: Order) => {
    setSelectedItemsForBast(item ? [item] : []);
    setBastFiles(null);
    setIsBastUploadOpen(true);
  };

  const toggleBastItemSelection = (item: Order) => {
    setSelectedItemsForBast((prev) =>
      prev.some((it) => it.part_number === item.part_number)
        ? prev.filter((it) => it.part_number !== item.part_number)
        : [...prev, item],
    );
  };

  // Refresh status/level/orders satu MR saja (dipanggil setelah upload BAST)
  // - biar Quick View & baris tabel ikut update tanpa refetch seluruh list.
  const refreshMrRow = async (mrId: number) => {
    const { data, error } = await s
      .from("material_requests")
      .select("id, status, level, orders")
      .eq("id", mrId)
      .single();
    if (error || !data) return;

    const orders = normalizeMrOrders(
      Array.isArray(data.orders) ? data.orders : [],
    );
    setSelectedMr((prev) =>
      prev && Number(prev.id) === mrId
        ? { ...prev, status: data.status, level: data.level, orders }
        : prev,
    );
    setDataMR((prev) =>
      prev.map((mr) =>
        Number(mr.id) === mrId
          ? { ...mr, status: data.status, level: data.level, orders }
          : mr,
      ),
    );
  };

  const handleUploadItemBast = async () => {
    if (!selectedMr || selectedItemsForBast.length === 0) {
      toast.error("Pilih minimal satu barang");
      return;
    }
    if (!bastFiles || bastFiles.length === 0) {
      toast.error("Pilih file bukti penerimaan terlebih dahulu");
      return;
    }
    if (!currentUser) {
      toast.error("Sesi tidak valid, silakan muat ulang halaman");
      return;
    }

    for (const file of bastFiles) {
      const sizeError = getAttachmentSizeError(file);
      if (sizeError) {
        toast.error("Ukuran file terlalu besar", { description: sizeError });
        return;
      }
    }

    setUploadingBast(true);
    try {
      // Upload file(s) SEKALI, lalu lampirkan hasil yang sama ke setiap
      // barang terpilih - bukan upload ulang per barang.
      const pathSegment =
        selectedItemsForBast.length === 1
          ? selectedItemsForBast[0].part_number
          : "multi-item";
      const uploadedAttachments: Attachment[] = [];
      for (let i = 0; i < bastFiles.length; i++) {
        const file = bastFiles[i];
        const filePath = `${selectedMr.kode_mr.replace(/\//g, "-")}/bast/${pathSegment}/${Date.now()}_${file.name}`;
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadAttachmentVps(formData, filePath);
        if (!result.success) throw new Error(result.message);
        uploadedAttachments.push({
          name: file.name,
          url: result.url,
          type: "bast",
        });
      }

      // Sequential (bukan Promise.all) - uploadBastForMrItem baca-ubah-tulis
      // seluruh array `orders`, jadi kalau dijalankan paralel utk barang2
      // dari MR yang sama, update bisa saling menimpa (lost update).
      for (const item of selectedItemsForBast) {
        if (!item.part_number) continue;
        await uploadBastForMrItem(
          Number(selectedMr.id),
          item.part_number,
          uploadedAttachments,
          currentUser.id,
        );
      }

      await logActivity(
        currentUser.id,
        "UPLOAD_ITEM_BAST",
        "material_request",
        String(selectedMr.id),
        `Admin ${currentUser.nama || "Unknown"} mengunggah ${uploadedAttachments.length} file bukti penerimaan untuk ${selectedItemsForBast.length} barang pada MR ${selectedMr.kode_mr}`,
        {
          part_numbers: selectedItemsForBast.map((it) => it.part_number),
          files: uploadedAttachments.map((att) => att.name),
        },
      );

      toast.success(
        selectedItemsForBast.length === 1
          ? "Bukti penerimaan berhasil diunggah, item ditandai selesai"
          : `Bukti penerimaan berhasil diunggah untuk ${selectedItemsForBast.length} barang`,
      );
      setIsBastUploadOpen(false);
      await refreshMrRow(Number(selectedMr.id));
    } catch (err: any) {
      toast.error("Gagal upload bukti penerimaan", {
        description: getUploadErrorMessage(err),
      });
    } finally {
      setUploadingBast(false);
    }
  };

  const handleRemoveItemBast = async (item: Order, attachmentUrl: string) => {
    if (!selectedMr || !item.part_number || !currentUser) return;
    try {
      await removeBastForMrItem(
        Number(selectedMr.id),
        item.part_number,
        attachmentUrl,
        currentUser.id,
      );

      await logActivity(
        currentUser.id,
        "REMOVE_ITEM_BAST",
        "material_request",
        String(selectedMr.id),
        `Admin ${currentUser.nama || "Unknown"} menghapus lampiran bukti penerimaan dari barang "${item.name}" (${item.part_number}) pada MR ${selectedMr.kode_mr}`,
        { part_number: item.part_number, attachment_url: attachmentUrl },
      );

      toast.success("Lampiran bukti penerimaan dihapus");
      await refreshMrRow(Number(selectedMr.id));
    } catch (err: any) {
      toast.error("Gagal hapus lampiran bukti penerimaan", {
        description: err.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800">
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
            className="border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
          >
            Validation
          </Badge>
        );
      case "waiting po":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800">
            Waiting PO
          </Badge>
        );
      case "on process":
        return (
          <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-800">
            On Process
          </Badge>
        );
      case "pending receive":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800">
            Pending Receive
          </Badge>
        );
      case "partial receive":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800">
            Partial Receive
          </Badge>
        );
      case "full received":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800">
            Full Received
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderStatusCell = (mr: MaterialRequestListItem) => {
    const approver =
      mr.status === "Pending Approval" ? getCurrentApprover(mr.approvals) : null;
    return (
      <div className="flex flex-col items-start gap-1">
        {getStatusBadge(mr.status)}
        {approver && (
          <span className="text-[11px] text-muted-foreground">
            Menunggu: {approver.nama}
          </span>
        )}
        {mr.status === "Pending Validation" && <PicGaPopover />}
        {mr.status === "Waiting PO" && (
          <PicPoPopover companyCode={mr.company_code} />
        )}
      </div>
    );
  };

  return (
    <Content
      title="Manajemen Material Request"
      description="Monitoring dan Kelola seluruh MR (Admin View)."
    >
      <div className="flex flex-col gap-4 mb-6 no-print">
        {/* Row 1: Search & Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari Kode MR, Requester, Remarks..."
              className="pl-10 bg-background"
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
        <div className="p-4 border rounded-lg bg-muted/50">
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
              <TableHead>Umur</TableHead>
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
                <TableCell colSpan={15} className="h-24 text-center">
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
                  <TableCell>{renderStatusCell(mr)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatAge(
                      mr.created_at,
                      mr.full_received_at,
                      mr.status === "Full Received",
                    )}
                  </TableCell>
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

                  {/* Aksi: View + Edit (Admin Only) */}
                  <TableCell className="text-right no-print">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                        {/* Admin Special: Edit available for most statuses except Closed */}
                        {mr.status !== "Full Received" && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/mr-management/edit/${mr.id}`}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit Admin
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={15}
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
            <SelectTrigger className="w-[80px] h-8 bg-background">
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
        <DialogContent className="max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ringkasan MR: {selectedMr?.kode_mr}
            </DialogTitle>
            <DialogDescription>
              Informasi singkat dan daftar barang (Admin Quick View).
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
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Daftar Barang
                  </h4>
                  {currentUser?.role === "admin" &&
                    bastEligibleItems.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenBastUpload()}
                      >
                        <Upload className="mr-2 h-3.5 w-3.5" /> Upload Bukti
                        Penerimaan Massal
                      </Button>
                    )}
                </div>
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
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMr.orders && selectedMr.orders.length > 0 ? (
                        selectedMr.orders.map((item, i) => {
                          const statusColor =
                            MR_ITEM_STATUS_COLORS[item.status || "Pending"] ||
                            MR_ITEM_STATUS_COLOR_DEFAULT;
                          const statusLabel =
                            MR_ITEM_STATUS_LABELS[item.status || "Pending"] ||
                            item.status;

                          return (
                          <TableRow key={i}>
                            <TableCell className="font-medium whitespace-normal break-words max-w-[220px]">
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
                              <Badge
                                variant="outline"
                                className={cn("capitalize font-normal", statusColor)}
                              >
                                {statusLabel}
                              </Badge>
                              {item.po_refs && item.po_refs.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.po_refs.map((ref, refIdx) => (
                                    <Link
                                      key={refIdx}
                                      href={`/purchase-order/${quickViewPoRefsMap[ref]?.id ?? ""}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => {
                                        if (!quickViewPoRefsMap[ref]?.id)
                                          e.preventDefault();
                                      }}
                                    >
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] h-5 px-1.5 font-mono cursor-pointer hover:opacity-75 transition-opacity",
                                          PO_REF_STATUS_COLORS[
                                            quickViewPoRefsMap[ref]?.status ??
                                              ""
                                          ] || PO_REF_STATUS_COLOR_DEFAULT,
                                        )}
                                      >
                                        {ref}
                                      </Badge>
                                    </Link>
                                  ))}
                                </div>
                              )}
                              {item.bast_attachments &&
                                item.bast_attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.bast_attachments.map((att, idx) => (
                                      <div
                                        key={idx}
                                        className="text-[10px] bg-emerald-50 text-emerald-700 pl-2 pr-1 py-0.5 rounded-sm flex items-center gap-1"
                                      >
                                        <Link
                                          href={resolveAttachmentUrl(att.url)}
                                          target="_blank"
                                          className="hover:underline flex items-center gap-1"
                                        >
                                          <FileText className="w-3 h-3" />
                                          {att.name}
                                        </Link>
                                        {currentUser?.role === "admin" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveItemBast(
                                                item,
                                                att.url,
                                              )
                                            }
                                            className="hover:text-red-600"
                                            title="Hapus lampiran"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </TableCell>
                            <TableCell>
                              {currentUser?.role === "admin" &&
                                MR_ITEM_BAST_ELIGIBLE_STATUSES.includes(
                                  item.status || "",
                                ) &&
                                item.part_number && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => handleOpenBastUpload(item)}
                                  >
                                    <Upload className="mr-1 h-3 w-3" /> Upload
                                    Bukti Terima
                                  </Button>
                                )}
                            </TableCell>
                          </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
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
              <Button variant="outline" asChild>
                <Link href={`/mr-management/edit/${selectedMr.id}`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit MR
                </Link>
              </Button>
            )}
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

      {/* --- UPLOAD BAST DIALOG (Admin, via MR Management) --- */}
      {/* Bisa pilih >1 barang sekaligus - 1 file BAST yg sama dilampirkan ke
          semua barang terpilih. */}
      <Dialog open={isBastUploadOpen} onOpenChange={setIsBastUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Bukti Penerimaan Barang</DialogTitle>
            <DialogDescription>
              Unggah bukti penerimaan barang (foto/dokumen serah terima).
              Barang yang dicentang akan ditandai selesai dengan bukti yang
              sama.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Barang ({selectedItemsForBast.length} dipilih)</Label>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y">
                {bastEligibleItems.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    Tidak ada barang yang bisa diunggah bukti penerimaannya.
                  </div>
                ) : (
                  bastEligibleItems.map((item) => {
                    const checked = selectedItemsForBast.some(
                      (it) => it.part_number === item.part_number,
                    );
                    return (
                      <label
                        key={item.part_number}
                        className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            toggleBastItemSelection(item)
                          }
                        />
                        <span className="flex-1">
                          {item.name}{" "}
                          <span className="text-muted-foreground">
                            ({item.qty} {item.uom})
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="admin-item-bast-file">
                File Bukti Penerimaan / Bukti Foto
              </Label>
              <Input
                id="admin-item-bast-file"
                type="file"
                multiple
                onChange={(e) => setBastFiles(e.target.files)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBastUploadOpen(false)}
              disabled={uploadingBast}
            >
              Batal
            </Button>
            <Button
              onClick={handleUploadItemBast}
              disabled={uploadingBast || selectedItemsForBast.length === 0}
            >
              {uploadingBast && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload & Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
