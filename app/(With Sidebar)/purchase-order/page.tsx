// src/app/(With Sidebar)/purchase-order/page.tsx

"use client";

import {
  Fragment,
  Suspense,
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
  lazy,
} from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import {
  ExcelDownloadMenu,
  type ExcelDownloadMode,
} from "@/components/excel-download-menu";
import { ListSearchInput } from "@/components/list-search-input";
import {
  PO_DEFAULT_SORT,
  PO_SEARCH_FIELDS,
  PO_SORTABLE_COLUMNS,
  applyPoCompanyAccess,
  applyPoFilters,
  buildPoSearchFilter,
  type PoListFilters,
} from "@/lib/po-list";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import {
  formatCurrency,
  formatDateFriendly,
  getCurrentApprover,
  formatAge,
} from "@/lib/utils";
import { PicGaPopover } from "@/components/pic-ga-popover";
import { CreatePOModal } from "./CreatePOModal";
import { QuickTrackingSlot, useQuickTracking } from "@/components/quick-tracking";
import { fetchPoQuickTracking } from "@/services/quickTrackingService";
import { AssetGoodsBadge } from "@/components/asset-goods-badge";
import {
  resolveSort,
} from "@/components/sortable-table-head";
import {
  ColumnOrderReset,
  ReorderableHeaderRow,
  ReorderableTableHead,
  type ReorderableColumn,
} from "@/components/reorderable-table-head";
import { useColumnOrder } from "@/hooks/use-column-order";
import {
  Newspaper,
  Search,
  CreditCard,
  Building2,
  User,
  Mail,
  MapPin,
  Plus,
  Eye,
  Calendar,
  Tag,
  DollarSign,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Approval,
  POItem,
  Profile,
  PurchaseOrderListItem,
  StoredVendorDetails,
} from "@/type";
import { exportStyledExcel, fetchAllRows } from "@/lib/excel-export";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  LIMIT_OPTIONS,
  isPoPaid,
  isDpBpPaymentTerm,
  getLastApprovedApprover,
} from "@/type/enum";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import {
  ActiveFilter,
  FilterApplyButton,
  FilterField,
  FilterFields,
  FilterPanel,
  FilterRange,
  FilterRangeFields,
  filterOptionLabel,
  formatFilterDate,
  formatFilterRange,
  formatFilterRupiah,
} from "@/components/filter-panel";

// Kolom tabel sebelum "Aksi" (tetap paling kanan), urutan bawaan. Urutannya
// bisa digeser user - lihat hooks/use-column-order.ts. `sortDirection`
// diisi = bisa di-sort, id-nya harus ada di PO_SORTABLE_COLUMNS.
const PO_COLUMNS = [
  { id: "kode_po", label: "Kode PO", sortDirection: "asc" },
  { id: "kode_mr", label: "Ref. Kode MR", sortDirection: "asc" },
  { id: "vendor", label: "Vendor", sortDirection: "asc" },
  { id: "pembuat", label: "Pembuat PO", sortDirection: "asc" },
  { id: "company", label: "Perusahaan", sortDirection: "asc" },
  { id: "status", label: "Status PO", sortDirection: "asc" },
  { id: "umur", label: "Umur", sortDirection: "desc" },
  { id: "payment", label: "Payment" },
  {
    id: "total_price",
    label: "Total Harga",
    sortDirection: "desc",
    className: "text-right",
  },
  { id: "created_at", label: "Tanggal Dibuat", sortDirection: "desc" },
] as const satisfies readonly ReorderableColumn[];
type PoColumnId = (typeof PO_COLUMNS)[number]["id"];

const STATUS_OPTIONS = [
  "Pending Validation",
  "Pending Approval",
  "Pending Payment",
  "Pending Receive",
  "Partial Receive",
  "Full Received",
  "Rejected",
  "Cancelled",
  "Draft",
  "Ordered",
];

const PAYMENT_TERM_OPTIONS = [
  { label: "Semua Jenis", value: "all" },
  { label: "Cash", value: "Cash" },
  { label: "Termin", value: "Termin" },
  { label: "DP & BP - Kirim Setelah DP", value: "ship_after_dp" },
  {
    label: "DP & BP - Kirim Setelah Pelunasan",
    value: "ship_after_full_payment",
  },
];

const loadPoQuickTracking = () => import("./PoQuickTracking");
const PoQuickTracking = lazy(loadPoQuickTracking);

// --- Komponen Modal Detail Vendor ---

function VendorDetailModal({
  isOpen,
  onClose,
  vendor,
}: {
  isOpen: boolean;
  onClose: () => void;
  vendor: StoredVendorDetails | null;
}) {
  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Informasi Vendor
          </DialogTitle>
          <DialogDescription>
            Detail lengkap vendor yang dipilih.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Nama Vendor
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-base">
                {vendor.nama_vendor}
              </span>
            </div>
            {vendor.kode_vendor && (
              <Badge variant="outline" className="w-fit mt-1">
                {vendor.kode_vendor}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Kontak Person
            </label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>{vendor.contact_person || "-"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Email
            </label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>{vendor.email || "-"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Alamat
            </label>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-1" />
              <span className="whitespace-pre-wrap text-sm">
                {vendor.alamat || "-"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderPageContent() {
  const [dataPO, setDataPO] = useState<PurchaseOrderListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const columnOrder = useColumnOrder(
    "table-column-order:purchase-order",
    PO_COLUMNS,
  );

  // State untuk Modal Vendor
  const [selectedVendor, setSelectedVendor] =
    useState<StoredVendorDetails | null>(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // State untuk Modal Quick View PO
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderListItem | null>(
    null,
  );
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const quickTracking = useQuickTracking(fetchPoQuickTracking);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const s = createClient();

  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const paymentFilter = searchParams.get("payment_status") || "";
  const paymentTermFilter = searchParams.get("payment_term_filter") || "";
  const assetTypeFilter = searchParams.get("asset_type") || "";
  const sortFilter = searchParams.get("sort") || PO_DEFAULT_SORT;

  // Push ke URL hanya dari ketikan user - lihat hooks/use-url-search-input.ts
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) =>
      startTransition(() => {
        router.push(`${pathname}?${createQueryString({ search: value })}`);
      }),
  );
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);

  const poFilters = useMemo<PoListFilters>(
    () => ({
      status: statusFilter,
      assetType: assetTypeFilter,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      payment: paymentFilter,
      paymentTerm: paymentTermFilter,
    }),
    [
      statusFilter,
      assetTypeFilter,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      paymentFilter,
      paymentTermFilter,
    ],
  );

  // Handler Update URL Params
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
      // Reset ke halaman 1 jika filter berubah selain page
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  // Handler Pagination (Mempertahankan Filter)
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // --- Main Data Fetching ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
        } = await s.auth.getUser();
        let profile: Profile | null = null;
        if (user) {
          const { data: profileData } = await s
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          profile = profileData;
          setUserProfile(profile);
        }

        const from = (currentPage - 1) * limit;
        const to = from + limit - 1;

        // Query Utama
        let query = s.from("purchase_orders").select(
          `
            id, kode_po, status, total_price, created_at, company_code, approvals, vendor_details, payment_term, dp_paid, bp_paid, items, is_asset, full_received_at,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (
              kode_mr,
              users_with_profiles!userid (nama)
            )
          `,
          { count: "exact" },
        );

        // --- 1. FILTER COMPANY ACCESS LOGIC ---
        query = applyPoCompanyAccess(query, profile?.company, companyFilter);

        // --- 2. FILTER SEARCH TEXT ---
        if (searchTerm) {
          query = query.or(await buildPoSearchFilter(s, searchTerm));
        }

        // --- 3. FILTER STANDAR ---
        query = applyPoFilters(query, poFilters);

        // Eksekusi Query
        const sort = resolveSort(sortFilter, PO_SORTABLE_COLUMNS, PO_DEFAULT_SORT);
        query = query
          .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
          .order("id", { ascending: false }) // urutan stabil antar halaman
          .range(from, to);

        const { data, count, error } = await query;

        if (error) throw error;

        // Transform Data
        const transformedData =
          data?.map((po: any) => ({
            ...po,
            users_with_profiles: Array.isArray(po.users_with_profiles)
              ? (po.users_with_profiles[0] ?? null)
              : po.users_with_profiles,
            material_requests: Array.isArray(po.material_requests)
              ? po.material_requests[0]
                ? {
                    ...po.material_requests[0],
                    users_with_profiles: Array.isArray(
                      po.material_requests[0].users_with_profiles,
                    )
                      ? (po.material_requests[0].users_with_profiles[0] ?? null)
                      : po.material_requests[0].users_with_profiles,
                  }
                : null
              : po.material_requests
                ? {
                    ...po.material_requests,
                    users_with_profiles: Array.isArray(
                      po.material_requests.users_with_profiles,
                    )
                      ? (po.material_requests.users_with_profiles[0] ?? null)
                      : po.material_requests.users_with_profiles,
                  }
                : null,
          })) || [];

        setDataPO(transformedData as PurchaseOrderListItem[]);
        setTotalItems(count || 0);
      } catch (err: any) {
        toast.error("Gagal memuat data PO", { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [
    currentPage,
    limit,
    searchTerm,
    s,
    statusFilter,
    companyFilter,
    minPrice,
    maxPrice,
    startDate,
    endDate,
    paymentFilter,
    paymentTermFilter,
    assetTypeFilter,
    sortFilter,
    poFilters,
  ]);

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };

  const handleVendorClick = (vendorDetails: StoredVendorDetails) => {
    setSelectedVendor(vendorDetails);
    setIsVendorModalOpen(true);
  };

  const handleRowClick = (po: PurchaseOrderListItem) => {
    setSelectedPo(po);
    setIsQuickViewOpen(true);
    // Chunk kartu diunduh bersamaan dengan datanya, bukan sesudahnya.
    void loadPoQuickTracking();
    quickTracking.load(po);
  };

  // Isi 1 sel tabel; urutannya mengikuti columnOrder (lihat PO_COLUMNS).
  const renderPoCell = (po: PurchaseOrderListItem, id: PoColumnId) => {
    switch (id) {
      case "kode_po":
        return (
          <TableCell className="font-medium">
            <Button
              asChild
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/purchase-order/${po.id}`}>{po.kode_po}</Link>
            </Button>
          </TableCell>
        );
      case "kode_mr":
        return <TableCell>{po.material_requests?.kode_mr || "N/A"}</TableCell>;
      case "vendor":
        return (
          <TableCell>
            {po.vendor_details ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVendorClick(po.vendor_details);
                }}
                className="text-primary hover:underline font-medium text-left"
              >
                {po.vendor_details.nama_vendor}
              </button>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        );
      case "pembuat":
        return <TableCell>{po.users_with_profiles?.nama || "N/A"}</TableCell>;
      case "company":
        return (
          <TableCell>
            <Badge variant="outline">{(po as any).company_code}</Badge>
          </TableCell>
        );
      case "status":
        return (
          <TableCell>
            <div className="flex flex-col items-start gap-1">
              <Badge variant="secondary">{po.status}</Badge>
              {po.status === "Pending Approval" &&
                (() => {
                  const approver = getCurrentApprover(po.approvals);
                  return approver ? (
                    <span className="text-[11px] text-muted-foreground">
                      {approver.nama}
                    </span>
                  ) : null;
                })()}
              {po.status === "Pending Validation" && <PicGaPopover />}
            </div>
          </TableCell>
        );
      case "umur":
        return (
          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
            {formatAge(
              po.created_at,
              po.full_received_at,
              po.status === "Full Received",
            )}
          </TableCell>
        );
      case "payment":
        return (
          <TableCell>
            {isPoPaid(po.approvals) ? (
              <Badge className="flex w-fit items-center gap-1 bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700">
                <CreditCard className="h-3 w-3" />
                Paid
              </Badge>
            ) : isDpBpPaymentTerm(po.payment_term) &&
              (po.dp_paid || po.bp_paid) ? (
              <Badge className="flex w-fit items-center gap-1 bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700">
                <CreditCard className="h-3 w-3" />
                {po.dp_paid ? "DP Lunas" : "BP Lunas"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit">
                Unpaid
              </Badge>
            )}
          </TableCell>
        );
      case "total_price":
        return (
          <TableCell className="text-right">
            {formatCurrency(po.total_price)}
          </TableCell>
        );
      case "created_at":
        return <TableCell>{formatDateFriendly(po.created_at)}</TableCell>;
    }
  };

  const handleCreatePO = () => {
    router.push("/purchase-order/create");
  };

  const fetchAllPoCount = async () => {
    const { count, error } = await applyPoCompanyAccess(
      s.from("purchase_orders").select("id", { count: "exact", head: true }),
      userProfile?.company,
    );
    if (error) throw error;
    return count ?? 0;
  };

  // mode "all"      : semua PO yang boleh dilihat user (hak akses company tetap berlaku)
  // mode "filtered" : sesuai filter, pencarian & urutan yang sedang diterapkan di tabel
  const handleDownloadExcel = async (mode: ExcelDownloadMode) => {
    if (!userProfile) return;
    const useFilters = mode === "filtered";
    setIsExporting(true);
    const toastId = toast.loading(
      useFilters
        ? "Menyiapkan data PO sesuai filter..."
        : "Menyiapkan semua data PO...",
    );
    const exportSort = useFilters
      ? resolveSort(sortFilter, PO_SORTABLE_COLUMNS, PO_DEFAULT_SORT)
      : { column: "created_at", ascending: false };

    try {
      const searchOrFilter =
        useFilters && searchTerm
          ? await buildPoSearchFilter(s, searchTerm)
          : "";

      // Penambahan query department dan cost_centers untuk data Excel
      const buildQuery = () => {
        let query = applyPoCompanyAccess(
          s.from("purchase_orders").select(
            `
            kode_po, status, total_price, company_code, created_at,
            items, approvals, payment_term, vendor_details,
            dp_paid, bp_paid, attachments, is_asset, full_received_at,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (
              kode_mr,
              department,
              cost_centers (name),
              users_with_profiles!userid (nama)
            )
          `,
          ),
          userProfile.company,
          useFilters ? companyFilter : undefined,
        );
        if (searchOrFilter) query = query.or(searchOrFilter);
        if (useFilters) query = applyPoFilters(query, poFilters);

        return query
          .order(exportSort.column, {
            ascending: exportSort.ascending,
            nullsFirst: false,
          })
          .order("id", { ascending: true }); // urutan stabil antar halaman
      };

      const data = await fetchAllRows(buildQuery);

      if (data.length === 0) {
        toast.warning(
          useFilters
            ? "Tidak ada data PO untuk diekspor sesuai filter."
            : "Tidak ada data PO untuk diekspor.",
          { id: toastId },
        );
        return;
      }

      const formattedData = data.flatMap((po: any) => {
        const isPaid = isPoPaid(po.approvals as Approval[]);
        const lastApprover = getLastApprovedApprover(
          po.approvals as Approval[],
        );
        const hasInvoice =
          Array.isArray(po.attachments) &&
          po.attachments.some((att: any) => att.type === "invoice");

        // Ekstrak data MR dengan aman (menghindari issue jika Supabase mereturn array)
        const mrData = Array.isArray(po.material_requests)
          ? po.material_requests[0]
          : po.material_requests;
        const ccData = mrData?.cost_centers;
        const costCenterName = Array.isArray(ccData)
          ? ccData[0]?.name
          : ccData?.name;
        const requesterData = mrData?.users_with_profiles;
        const requesterName = Array.isArray(requesterData)
          ? requesterData[0]?.nama
          : requesterData?.nama;

        const basePoInfo = {
          "Kode PO": po.kode_po,
          "Ref. Kode MR": mrData?.kode_mr || "N/A",
          "Departemen MR": mrData?.department || "N/A",
          "Cost Center": costCenterName || "N/A",
          Vendor: po.vendor_details?.nama_vendor || "N/A",
          "Requester MR": requesterName || "N/A",
          Status: po.status,
          Umur: formatAge(
            po.created_at,
            po.full_received_at,
            po.status === "Full Received",
          ),
          "Status Pembayaran": isPaid ? "Paid" : "Unpaid",
          "Last Approve": lastApprover?.nama || "",
          DP: po.dp_paid ? "Dibayar" : "",
          BP: po.bp_paid ? "Dibayar" : "",
          Invoice: hasInvoice ? "Ada" : "Tidak Ada",
          "Jenis Pembayaran": po.payment_term || "N/A",
          "Total Harga PO": po.total_price,
          "Pembuat PO": po.users_with_profiles?.nama || "N/A",
          Perusahaan: po.company_code,
          "Tanggal Dibuat": formatDateFriendly(po.created_at),
        };

        if (Array.isArray(po.items) && po.items.length > 0) {
          return po.items.map((item: POItem) => ({
            ...basePoInfo,
            "Part Number": item.part_number,
            "Nama Item": item.name,
            Qty: item.qty,
            UoM: item.uom,
            "Harga Satuan": item.price,
            "Total Harga Item": item.total_price,
            "Vendor Item": item.vendor_name,
          }));
        } else {
          return [
            {
              ...basePoInfo,
              "Part Number": "N/A",
              "Nama Item": "N/A",
              Qty: 0,
              UoM: "N/A",
              "Harga Satuan": 0,
              "Total Harga Item": 0,
              "Vendor Item": "N/A",
            },
          ];
        }
      });

      await exportStyledExcel(
        formattedData,
        `Detail_Purchase_Orders_${useFilters ? "Filter" : "Semua"}_${new Date().toISOString().split("T")[0]}.xlsx`,
        "Purchase Orders",
      );

      toast.success("Data PO detail berhasil diunduh!", { id: toastId });
    } catch (error: any) {
      toast.error("Gagal mengunduh data", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const canCreatePO =
    (userProfile?.role === "approver" &&
      userProfile?.department === "Purchasing") ||
    userProfile?.role === "admin";

  const clearFilters = () => {
    resetSearchInput();
    setStartDateInput("");
    setEndDateInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  // --- Chip filter aktif (dari URL, bukan input yang belum diterapkan) ---
  const activeFilters: ActiveFilter[] = [];
  if (searchTerm)
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: searchTerm,
      onRemove: () => {
        resetSearchInput();
        handleFilterChange({ search: undefined });
      },
    });
  if (statusFilter && statusFilter !== "all")
    activeFilters.push({
      key: "status",
      label: "Status PO",
      value: statusFilter,
      onRemove: () => handleFilterChange({ status: undefined }),
    });
  if (paymentFilter && paymentFilter !== "all")
    activeFilters.push({
      key: "payment_status",
      label: "Pembayaran",
      value:
        paymentFilter === "paid"
          ? "Paid"
          : paymentFilter === "unpaid"
            ? "Unpaid"
            : paymentFilter,
      onRemove: () => handleFilterChange({ payment_status: undefined }),
    });
  if (paymentTermFilter && paymentTermFilter !== "all")
    activeFilters.push({
      key: "payment_term_filter",
      label: "Jenis Pembayaran",
      value: filterOptionLabel(PAYMENT_TERM_OPTIONS, paymentTermFilter),
      onRemove: () => handleFilterChange({ payment_term_filter: undefined }),
    });
  if (assetTypeFilter && assetTypeFilter !== "all")
    activeFilters.push({
      key: "asset_type",
      label: "Jenis PO",
      value:
        assetTypeFilter === "asset"
          ? "Asset"
          : assetTypeFilter === "goods"
            ? "Barang (Non-Asset)"
            : assetTypeFilter,
      onRemove: () => handleFilterChange({ asset_type: undefined }),
    });
  if (companyFilter && companyFilter !== "all")
    activeFilters.push({
      key: "company",
      label: "Perusahaan",
      value: companyFilter,
      onRemove: () => handleFilterChange({ company: undefined }),
    });
  if (startDate || endDate)
    activeFilters.push({
      key: "tanggal",
      label: "Tanggal",
      value: formatFilterRange(startDate, endDate, formatFilterDate),
      onRemove: () => {
        setStartDateInput("");
        setEndDateInput("");
        handleFilterChange({ start_date: undefined, end_date: undefined });
      },
    });
  if (minPrice || maxPrice)
    activeFilters.push({
      key: "harga",
      label: "Total Harga",
      value: formatFilterRange(minPrice, maxPrice, formatFilterRupiah),
      onRemove: () => {
        setMinPriceInput("");
        setMaxPriceInput("");
        handleFilterChange({ min_price: undefined, max_price: undefined });
      },
    });

  return (
    <>
      <Content
        title="Daftar Purchase Order"
        description="Kelola seluruh data Purchase Order (PO)"
        cardAction={
          canCreatePO && (
            <div className="flex gap-2">
              <Button onClick={() => setIsModalOpen(true)} variant="outline">
                <Search className="mr-2 h-4 w-4" /> Cari MR untuk PO
              </Button>
              <Button onClick={handleCreatePO}>
                <Plus className="mr-2 h-4 w-4" /> Buat PO Baru
              </Button>
            </div>
          )
        }
        className="col-span-12"
      >
        <div id="printable-area">
          <div className="flex flex-col gap-4 mb-6 no-print">
            <div className="flex flex-col md:flex-row gap-4">
              <ListSearchInput
                placeholder="Cari PO, vendor, barang..."
                value={searchInput}
                onChange={setSearchInput}
                searchableFields={PO_SEARCH_FIELDS}
              />
              <ExcelDownloadMenu
                itemLabel="PO"
                filteredCount={totalItems}
                fetchAllCount={fetchAllPoCount}
                onDownload={handleDownloadExcel}
                isExporting={isExporting}
              />
            </div>

            <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
              <FilterFields>
                <FilterField label="Status PO">
                  <SearchableSelect
                    onValueChange={(value) =>
                      handleFilterChange({
                        status: value === "all" ? undefined : value,
                      })
                    }
                    value={statusFilter || "all"}
                  >
                    <SearchableSelectTrigger className="bg-background">
                      <SearchableSelectValue placeholder="Filter status" />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="all">
                        Semua Status
                      </SearchableSelectItem>
                      {STATUS_OPTIONS.map((status) => (
                        <SearchableSelectItem key={status} value={status}>
                          {status}
                        </SearchableSelectItem>
                      ))}
                    </SearchableSelectContent>
                  </SearchableSelect>
                </FilterField>
                <FilterField label="Status Pembayaran">
                  <SearchableSelect
                    onValueChange={(value) =>
                      handleFilterChange({
                        payment_status: value === "all" ? undefined : value,
                      })
                    }
                    value={paymentFilter || "all"}
                  >
                    <SearchableSelectTrigger className="bg-background">
                      <SearchableSelectValue placeholder="Filter pembayaran..." />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="all">
                        Semua
                      </SearchableSelectItem>
                      <SearchableSelectItem value="paid">
                        Paid
                      </SearchableSelectItem>
                      <SearchableSelectItem value="unpaid">
                        Unpaid
                      </SearchableSelectItem>
                    </SearchableSelectContent>
                  </SearchableSelect>
                </FilterField>
                <FilterField label="Jenis Pembayaran">
                  <SearchableSelect
                    onValueChange={(value) =>
                      handleFilterChange({
                        payment_term_filter:
                          value === "all" ? undefined : value,
                      })
                    }
                    value={paymentTermFilter || "all"}
                  >
                    <SearchableSelectTrigger className="bg-background">
                      <SearchableSelectValue placeholder="Filter jenis..." />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      {PAYMENT_TERM_OPTIONS.map((opt) => (
                        <SearchableSelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SearchableSelectItem>
                      ))}
                    </SearchableSelectContent>
                  </SearchableSelect>
                </FilterField>
                <FilterField label="Jenis PO">
                  <SearchableSelect
                    onValueChange={(value) =>
                      handleFilterChange({
                        asset_type: value === "all" ? undefined : value,
                      })
                    }
                    value={assetTypeFilter || "all"}
                  >
                    <SearchableSelectTrigger className="bg-background">
                      <SearchableSelectValue placeholder="Filter jenis PO..." />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="all">
                        Semua
                      </SearchableSelectItem>
                      <SearchableSelectItem value="asset">
                        Asset
                      </SearchableSelectItem>
                      <SearchableSelectItem value="goods">
                        Barang (Non-Asset)
                      </SearchableSelectItem>
                    </SearchableSelectContent>
                  </SearchableSelect>
                </FilterField>
                {/* FILTER COMPANY DINAMIS */}
                {(userProfile?.company === "LOURDES" ||
                  userProfile?.company === "GMI" ||
                  userProfile?.company === "GIS") && (
                  <FilterField label="Perusahaan">
                    <SearchableSelect
                      onValueChange={(value) =>
                        handleFilterChange({
                          company: value === "all" ? undefined : value,
                        })
                      }
                      value={companyFilter || "all"}
                    >
                      <SearchableSelectTrigger className="bg-background">
                        <SearchableSelectValue placeholder="Filter perusahaan" />
                      </SearchableSelectTrigger>
                      <SearchableSelectContent>
                        <SearchableSelectItem value="all">
                          Semua (Sesuai Akses)
                        </SearchableSelectItem>
                        {/* LOURDES: Bisa lihat GMI & GIS */}
                        {userProfile.company === "LOURDES" && (
                          <>
                            <SearchableSelectItem value="GMI">
                              GMI
                            </SearchableSelectItem>
                            <SearchableSelectItem value="GIS">
                              GIS
                            </SearchableSelectItem>
                            <SearchableSelectItem value="LOURDES">
                              LOURDES
                            </SearchableSelectItem>
                          </>
                        )}
                        {/* GMI: Bisa lihat LOURDES */}
                        {userProfile.company === "GMI" && (
                          <>
                            <SearchableSelectItem value="GMI">
                              GMI
                            </SearchableSelectItem>
                            <SearchableSelectItem value="LOURDES">
                              LOURDES
                            </SearchableSelectItem>
                          </>
                        )}
                        {/* GIS: Bisa lihat LOURDES */}
                        {userProfile.company === "GIS" && (
                          <>
                            <SearchableSelectItem value="GIS">
                              GIS
                            </SearchableSelectItem>
                            <SearchableSelectItem value="LOURDES">
                              LOURDES
                            </SearchableSelectItem>
                          </>
                        )}
                      </SearchableSelectContent>
                    </SearchableSelect>
                  </FilterField>
                )}
              </FilterFields>
              {/* Filter Tanggal & Harga */}
              <FilterRangeFields>
                <FilterField label="Tanggal Dibuat">
                  <FilterRange
                    from={
                      <Input
                        aria-label="Dari tanggal"
                        type="date"
                        value={startDateInput}
                        onChange={(e) => setStartDateInput(e.target.value)}
                        className="bg-background"
                      />
                    }
                    to={
                      <Input
                        aria-label="Sampai tanggal"
                        type="date"
                        value={endDateInput}
                        onChange={(e) => setEndDateInput(e.target.value)}
                        className="bg-background"
                      />
                    }
                  />
                </FilterField>
                <FilterField label="Total Harga">
                  <FilterRange
                    from={
                      <Input
                        aria-label="Min total harga"
                        type="number"
                        placeholder="Min"
                        value={minPriceInput}
                        onChange={(e) => setMinPriceInput(e.target.value)}
                        className="bg-background"
                      />
                    }
                    to={
                      <Input
                        aria-label="Max total harga"
                        type="number"
                        placeholder="Max"
                        value={maxPriceInput}
                        onChange={(e) => setMaxPriceInput(e.target.value)}
                        className="bg-background"
                      />
                    }
                  />
                </FilterField>
                <FilterApplyButton
                  onClick={() =>
                    handleFilterChange({
                      start_date: startDateInput || undefined,
                      end_date: endDateInput || undefined,
                      min_price: minPriceInput || undefined,
                      max_price: maxPriceInput || undefined,
                    })
                  }
                />
              </FilterRangeFields>
            </FilterPanel>

            {columnOrder.isCustomOrder && (
              <ColumnOrderReset onReset={columnOrder.resetOrder} />
            )}
          </div>
          <StickyHeaderTable
            className="min-w-[1600px]"
            containerClassName="rounded-md border overflow-x-auto"
            header={
              <ReorderableHeaderRow
                order={columnOrder.order}
                onMove={columnOrder.moveColumn}
              >
                {columnOrder.orderedColumns.map((column) => (
                  <ReorderableTableHead
                    key={column.id}
                    column={column}
                    sort={{
                      currentSort: sortFilter,
                      onSortChange: (sort) => handleFilterChange({ sort }),
                    }}
                  />
                ))}
                <TableHead className="text-right no-print">Aksi</TableHead>
              </ReorderableHeaderRow>
            }
          >
            <TableBody>
              {loading || isPending ? (
                Array.from({ length: limit }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : dataPO.length > 0 ? (
                dataPO.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(po)}
                  >
                    {columnOrder.order.map((id) => (
                      <Fragment key={id}>{renderPoCell(po, id)}</Fragment>
                    ))}
                    <TableCell
                      className="text-right no-print"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowActionsMenu>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/purchase-order/${po.id}`}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                          </Link>
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center h-24">
                    Tidak ada data ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </StickyHeaderTable>
        </div>
        <TablePaginationFooter
          currentPage={currentPage}
          totalItems={totalItems}
          limit={limit}
          limitOptions={LIMIT_OPTIONS}
          itemLabel="PO"
          onPageChange={handlePageChange}
          onLimitChange={(value) => handleFilterChange({ limit: value })}
          className="mt-6 no-print"
        />
      </Content>

      {canCreatePO && (
        <CreatePOModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          companyCode={userProfile?.company}
        />
      )}

      <VendorDetailModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        vendor={selectedVendor}
      />

      {/* --- QUICK VIEW DIALOG --- */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 flex-wrap pr-6">
              <Newspaper className="h-5 w-5 shrink-0" />
              <span>Ringkasan PO: {selectedPo?.kode_po}</span>
              {selectedPo && (
                <CopyTextButton
                  text={selectedPo.kode_po}
                  label="Salin kode PO"
                  className="size-7 -ml-1"
                />
              )}
              {selectedPo?.is_asset && (
                <Badge className="bg-purple-600 hover:bg-purple-600 text-white shrink-0">
                  PO Asset
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Informasi singkat dan daftar barang.
            </DialogDescription>
          </DialogHeader>

          {selectedPo && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg text-sm border">
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Vendor
                  </p>
                  <p className="font-medium">
                    {selectedPo.vendor_details?.nama_vendor || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <User className="h-3 w-3" /> Pembuat PO
                  </p>
                  <p className="font-medium">
                    {selectedPo.users_with_profiles?.nama || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Status
                  </p>
                  <Badge variant="secondary">{selectedPo.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Dibuat
                  </p>
                  <p className="font-medium">
                    {formatDateFriendly(selectedPo.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    Ref. MR
                  </p>
                  <p className="font-medium">
                    {selectedPo.material_requests?.kode_mr || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Harga
                  </p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedPo.total_price)}
                  </p>
                </div>
              </div>

              <QuickTrackingSlot
                title="Lacak PO"
                state={quickTracking.state}
                onRetry={quickTracking.retry}
              >
                {(data) => (
                  <PoQuickTracking data={data} userId={userProfile?.id} />
                )}
              </QuickTrackingSlot>

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
                        <TableHead>Harga Satuan</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPo.items && selectedPo.items.length > 0 ? (
                        selectedPo.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium whitespace-normal break-words max-w-[260px]">
                              <div className="flex flex-wrap items-center gap-2">
                                {item.name}
                                <AssetGoodsBadge isAsset={item.is_asset} />
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.qty} {item.uom}
                            </TableCell>
                            <TableCell>{formatCurrency(item.price)}</TableCell>
                            <TableCell>
                              {formatCurrency(
                                item.total_price || item.price * item.qty,
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
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
            {selectedPo && (
              <Button asChild>
                <Link href={`/purchase-order/${selectedPo.id}`}>
                  <Eye className="mr-2 h-4 w-4" /> Lihat Detail Lengkap
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <Content className="col-span-12">
          <Skeleton className="h-[60vh] w-full" />
        </Content>
      }
    >
      <PurchaseOrderPageContent />
    </Suspense>
  );
}
