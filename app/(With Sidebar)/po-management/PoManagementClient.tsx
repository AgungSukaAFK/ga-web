// src/app/(With Sidebar)/po-management/PoManagementClient.tsx

"use client";

import { Content } from "@/components/content";
import {
  ExcelDownloadMenu,
  type ExcelDownloadMode,
} from "@/components/excel-download-menu";
import { ListSearchInput } from "@/components/list-search-input";
import {
  ColumnOrderReset,
  ReorderableHeaderRow,
  ReorderableTableHead,
  type ReorderableColumn,
} from "@/components/reorderable-table-head";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { resolveSort } from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { useColumnOrder } from "@/hooks/use-column-order";
import {
  PO_DEFAULT_SORT,
  PO_SEARCH_FIELDS,
  PO_SORTABLE_COLUMNS,
  applyPoCompanyAccess,
  applyPoFilters,
  buildPoSearchFilter,
  type PoListFilters,
} from "@/lib/po-list";
import { Input } from "@/components/ui/input";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Edit, CreditCard, Eye } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { exportStyledExcel, fetchAllRows } from "@/lib/excel-export";
import { PurchaseOrderListItem, Profile, Approval } from "@/type";
import { formatCurrency, formatDateFriendly } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LIMIT_OPTIONS,
  STATUS_OPTIONS,
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

// --- CONSTANTS ---
const PAYMENT_TERM_OPTIONS = [
  { label: "Semua Jenis", value: "all" },
  { label: "Cash", value: "Cash" },
  { label: "Termin", value: "Termin" },
  { label: "BP & DP", value: "DP" },
];

// Kolom tabel di antara "No" & "Aksi", urutan bawaan. Urutannya bisa digeser
// user - lihat hooks/use-column-order.ts.
const PO_MANAGEMENT_COLUMNS = [
  { id: "kode_po", label: "Kode PO", sortDirection: "asc" },
  { id: "kode_mr", label: "Ref. Kode MR", sortDirection: "asc" },
  { id: "pembuat", label: "Pembuat", sortDirection: "asc" },
  { id: "company", label: "Perusahaan", sortDirection: "asc" },
  { id: "status", label: "Status", sortDirection: "asc" },
  { id: "payment", label: "Payment" },
  { id: "total_price", label: "Total Harga", sortDirection: "desc" },
  { id: "created_at", label: "Tanggal Dibuat", sortDirection: "desc" },
] as const satisfies readonly ReorderableColumn[];
type PoManagementColumnId = (typeof PO_MANAGEMENT_COLUMNS)[number]["id"];

export function PoManagementClientContent() {
  const s = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [poList, setPoList] = useState<PurchaseOrderListItem[]>([]);
  const columnOrder = useColumnOrder(
    "table-column-order:po-management",
    PO_MANAGEMENT_COLUMNS,
  );
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);

  // --- AMBIL PARAMS DARI URL ---
  const currentPage = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || 25);
  const searchTerm = searchParams.get("search") || "";
  const sortFilter = searchParams.get("sort") || PO_DEFAULT_SORT;
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";

  // Filter Tambahan
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";
  const paymentFilter = searchParams.get("payment_status") || "";
  const paymentTermFilter = searchParams.get("payment_term_filter") || "";

  const poFilters = useMemo<PoListFilters>(
    () => ({
      status: statusFilter,
      assetType: "",
      minPrice,
      maxPrice,
      startDate,
      endDate,
      payment: paymentFilter,
      paymentTerm: paymentTermFilter,
    }),
    [
      statusFilter,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      paymentFilter,
      paymentTermFilter,
    ],
  );

  // --- LOCAL STATE UNTUK INPUT (Debounce/Apply Manual) ---
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

  // --- HELPER UPDATE URL ---
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
      // Reset page ke 1 jika filter berubah (kecuali page itu sendiri)
      if (Object.keys(paramsToUpdate).some((k) => k !== "page")) {
        params.set("page", "1");
      }
      return params.toString();
    },
    [searchParams],
  );

  // --- HANDLERS ---
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleFilterChange = (
    updates: Record<string, string | number | undefined>,
  ) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(updates)}`);
    });
  };


  // --- MAIN FETCH EFFECT ---
  useEffect(() => {
    async function fetchPOs() {
      setLoading(true);

      const {
        data: { user },
      } = await s.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak valid.");
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

      // Query Builder
      let query = s.from("purchase_orders").select(
        `
            id, kode_po, status, total_price, created_at, company_code, approvals, payment_term, dp_paid, bp_paid,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr)
          `,
        { count: "exact" },
      );

      // Hak akses company, search & filter sama dengan halaman Purchase Order
      query = applyPoCompanyAccess(query, profileData.company, companyFilter);
      if (searchTerm) {
        query = query.or(await buildPoSearchFilter(s, searchTerm));
      }
      query = applyPoFilters(query, poFilters);

      // Execute
      const sort = resolveSort(sortFilter, PO_SORTABLE_COLUMNS, PO_DEFAULT_SORT);
      query = query
        .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
        .order("id", { ascending: false }) // urutan stabil antar halaman
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error("Gagal mengambil data PO: " + error.message);
        setPoList([]);
      } else {
        const transformedData =
          data?.map((po) => ({
            ...po,
            users_with_profiles: Array.isArray(po.users_with_profiles)
              ? (po.users_with_profiles[0] ?? null)
              : po.users_with_profiles,
            material_requests: (() => {
              const mr = Array.isArray(po.material_requests)
                ? (po.material_requests[0] ?? null)
                : po.material_requests;
              return mr
                ? {
                    ...mr,
                    users_with_profiles: Array.isArray(po.users_with_profiles)
                      ? (po.users_with_profiles[0] ?? null)
                      : po.users_with_profiles,
                  }
                : null;
            })(),
          })) || [];
        setPoList(transformedData as PurchaseOrderListItem[]);
        setTotalItems(count || 0);
      }
      setLoading(false);
    }
    fetchPOs();
  }, [
    s,
    currentPage,
    limit,
    searchTerm,
    statusFilter,
    companyFilter,
    minPrice,
    maxPrice,
    startDate,
    endDate,
    paymentFilter,
    paymentTermFilter,
    sortFilter,
    poFilters,
    router,
  ]);

  // --- EXCEL EXPORT ---
  const fetchAllPoCount = async () => {
    const { count, error } = await applyPoCompanyAccess(
      s.from("purchase_orders").select("id", { count: "exact", head: true }),
      adminProfile?.company,
    );
    if (error) throw error;
    return count ?? 0;
  };

  // mode "all"      : semua PO yang boleh dilihat admin (hak akses company tetap berlaku)
  // mode "filtered" : sesuai filter, pencarian & urutan yang sedang diterapkan di tabel
  const handleDownloadExcel = async (mode: ExcelDownloadMode) => {
    if (!adminProfile) return;
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

      const buildQuery = () => {
        let query = applyPoCompanyAccess(
          s.from("purchase_orders").select(`
            kode_po, status, total_price, company_code, created_at,
            users_with_profiles!user_id (nama),
            material_requests!mr_id (kode_mr),
            approvals, payment_term, dp_paid, bp_paid, attachments
        `),
          adminProfile.company,
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

      const formattedData = data.map((po: any) => {
        const isPaid = isPoPaid(po.approvals as Approval[]);
        const lastApprover = getLastApprovedApprover(po.approvals as Approval[]);
        const hasInvoice =
          Array.isArray(po.attachments) &&
          po.attachments.some((att: any) => att.type === "invoice");

        return {
          "Kode PO": po.kode_po,
          "Ref. Kode MR": po.material_requests?.kode_mr || "N/A",
          Status: po.status,
          "Status Pembayaran": isPaid ? "Paid" : "Unpaid",
          "Last Approve": lastApprover?.nama || "",
          DP: po.dp_paid ? "Dibayar" : "",
          BP: po.bp_paid ? "Dibayar" : "",
          Invoice: hasInvoice ? "Ada" : "Tidak Ada",
          "Jenis Pembayaran": po.payment_term || "N/A",
          "Total Harga": po.total_price,
          Pembuat: po.users_with_profiles?.nama || "N/A",
          Perusahaan: po.company_code,
          "Tanggal Dibuat": formatDateFriendly(po.created_at),
        };
      });

      await exportStyledExcel(
        formattedData,
        `Admin_Purchase_Orders_${useFilters ? "Filter" : "Semua"}_${new Date().toISOString().split("T")[0]}.xlsx`,
        "Purchase Orders",
      );
      toast.success("Data PO berhasil diunduh!", { id: toastId });
    } catch (error: any) {
      toast.error("Gagal mengunduh data", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

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
      label: "Status",
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

  const renderPoCell = (po: PurchaseOrderListItem, column: PoManagementColumnId) => {
    switch (column) {
      case "kode_po":
        return <TableCell className="font-semibold">{po.kode_po}</TableCell>;
      case "kode_mr":
        return (
          <TableCell>
            {po.material_requests?.kode_mr || "N/A"}
          </TableCell>
        );
      case "pembuat":
        return <TableCell>{po.users_with_profiles?.nama || "N/A"}</TableCell>;
      case "company":
        return (
          <TableCell>
            <Badge variant="outline">{po.company_code || "N/A"}</Badge>
          </TableCell>
        );
      case "status":
        return (
          <TableCell>
            <Badge variant="secondary">{po.status}</Badge>
          </TableCell>
        );
      case "payment":
        return (
          <TableCell>
            {isPoPaid(po.approvals) ? (
              <Badge className="flex w-fit items-center gap-1 bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700">
                <CreditCard className="h-3 w-3" /> Paid
              </Badge>
            ) : isDpBpPaymentTerm(po.payment_term) &&
              (po.dp_paid || po.bp_paid) ? (
              <Badge className="flex w-fit items-center gap-1 bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700">
                <CreditCard className="h-3 w-3" />{" "}
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
        return <TableCell>{formatCurrency(po.total_price)}</TableCell>;
      case "created_at":
        return <TableCell>{formatDateFriendly(po.created_at)}</TableCell>;
    }
  };

  return (
    <Content
      title="Manajemen Purchase Order (Admin)"
      size="lg"
      className="col-span-12"
    >
      <div className="flex flex-col gap-4 mb-6">
        {/* --- Top Row: Search & Export --- */}
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

        {/* --- Filter Section --- */}
        <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
          <FilterFields>
            {/* 1. Status PO */}
            <FilterField label="Status">
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
                  <SearchableSelectItem value="all">Semua Status</SearchableSelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SearchableSelectItem key={status} value={status}>
                      {status}
                    </SearchableSelectItem>
                  ))}
                </SearchableSelectContent>
              </SearchableSelect>
            </FilterField>
            {/* 2. Status Pembayaran */}
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
                  <SearchableSelectValue placeholder="Paid / Unpaid" />
                </SearchableSelectTrigger>
                <SearchableSelectContent>
                  <SearchableSelectItem value="all">Semua</SearchableSelectItem>
                  <SearchableSelectItem value="paid">Paid</SearchableSelectItem>
                  <SearchableSelectItem value="unpaid">Unpaid</SearchableSelectItem>
                </SearchableSelectContent>
              </SearchableSelect>
            </FilterField>
            {/* 3. Jenis Pembayaran */}
            <FilterField label="Jenis Pembayaran">
              <SearchableSelect
                onValueChange={(value) =>
                  handleFilterChange({
                    payment_term_filter: value === "all" ? undefined : value,
                  })
                }
                value={paymentTermFilter || "all"}
              >
                <SearchableSelectTrigger className="bg-background">
                  <SearchableSelectValue placeholder="Cash / Termin" />
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
            {/* 4. Filter Perusahaan (Dynamic) */}
            {(adminProfile?.company === "LOURDES" ||
              adminProfile?.company === "GMI" ||
              adminProfile?.company === "GIS") && (
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
                    <SearchableSelectItem value="all">Semua (Sesuai Akses)</SearchableSelectItem>
                    {/* LOURDES */}
                    {adminProfile.company === "LOURDES" && (
                      <>
                        <SearchableSelectItem value="GMI">GMI</SearchableSelectItem>
                        <SearchableSelectItem value="GIS">GIS</SearchableSelectItem>
                        <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
                      </>
                    )}
                    {/* GMI */}
                    {adminProfile.company === "GMI" && (
                      <>
                        <SearchableSelectItem value="GMI">GMI</SearchableSelectItem>
                        <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
                      </>
                    )}
                    {/* GIS */}
                    {adminProfile.company === "GIS" && (
                      <>
                        <SearchableSelectItem value="GIS">GIS</SearchableSelectItem>
                        <SearchableSelectItem value="LOURDES">LOURDES</SearchableSelectItem>
                      </>
                    )}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
            )}
          </FilterFields>
          {/* Row 2: Tanggal & Harga */}
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
        className="min-w-[1200px]"
        containerClassName="border rounded-md overflow-x-auto"
        header={
          <ReorderableHeaderRow
            order={columnOrder.order}
            onMove={columnOrder.moveColumn}
          >
            <TableHead className="w-[50px]">No</TableHead>
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
            <TableHead className="text-right">Aksi</TableHead>
          </ReorderableHeaderRow>
        }
      >
        <TableBody>
          {loading || isPending ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center h-24">
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
                {columnOrder.orderedColumns.map(({ id }) => (
                  <Fragment key={id}>{renderPoCell(po, id)}</Fragment>
                ))}
                <TableCell className="text-right">
                  <RowActionsMenu>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/purchase-order/${po.id}`}
                        className="cursor-pointer"
                      >
                        <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/po-management/edit/${po.id}`}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit Admin
                      </Link>
                    </DropdownMenuItem>
                  </RowActionsMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-center h-24">
                Tidak ada Purchase Order yang ditemukan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </StickyHeaderTable>

      <TablePaginationFooter
        currentPage={currentPage}
        totalItems={totalItems}
        limit={limit}
        limitOptions={LIMIT_OPTIONS}
        itemLabel="PO"
        onPageChange={handlePageChange}
        onLimitChange={(value) => handleFilterChange({ limit: value })}
        className="mt-6"
      />
    </Content>
  );
}
