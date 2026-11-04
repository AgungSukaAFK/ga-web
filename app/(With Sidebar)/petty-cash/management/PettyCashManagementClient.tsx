// src/app/(With Sidebar)/petty-cash/management/PettyCashManagementClient.tsx
//
// Management Petty Cash - satu halaman untuk memantau SEMUA
// dokumen di alur baru Petty Cash (petty_cash_pengajuan / petty_cash_voucher
// / petty_cash_sub_voucher / petty_cash_deklarasi), lintas user &
// departemen, 4 tab (Pengajuan/Voucher/Sub-Voucher/Deklarasi - tab
// Sub-Voucher BARU, sebelumnya dokumen ini sama sekali tidak termonitor di
// sini). Klik row buka dialog PREVIEW ringkas (read-only) - untuk
// override status/jalur approval, ganti kode, edit paksa, & hapus
// berantai, admin diarahkan ke link "Detail Lengkap" (halaman
// petty-cash/{stage}/[id]/page.tsx, lihat PcAdminOverridePanel/
// PcAdminSubVoucherPanel di sana) - kecuali HAPUS yang juga tersedia
// sebagai aksi cepat di menu Aksi baris tabel, supaya admin tidak perlu
// buka detail dulu kalau cuma mau membersihkan dokumen sampah.
//
// Tab, search, filter, sort, & halaman tersimpan di URL. Data tiap halaman
// diambil dari server (services/pettyCashManagementService.ts).
//
// AKSES: admin, departemen GA, & departemen Finance (canMonitorPettyCash,
// lib/constants/departments.ts) - GA/Finance cuma MONITOR + Download Excel
// (dibatasi company sendiri, LOURDES lihat semua - sama dgn antrian
// Finance); tombol hapus & semua aksi ubah data tetap admin only.
//
// "Download Excel" = semua dokumen dalam satu file multi-sheet
// (PcExcelExportDialog, services/pettyCashExportService.ts) dgn filter
// sendiri, styling seragam dgn export MR/PO.
//
// Proteksi di level RLS/RPC ada di
// supabase/migrations/0004_petty_cash.sql (asal: petty_cash_admin_management_setup.sql) (override status) &
// supabase/migrations/0004_petty_cash.sql (asal: petty_cash_admin_full_management_setup.sql) (ganti kode/edit
// paksa/hapus berantai) - guard di komponen ini cuma proteksi UI, bukan
// pengganti itu. Hak akses di-cek sendiri di sini (bukan prop dari page.tsx)
// - sama pola dgn ApprovalPettyCashClient.tsx & halaman detail lainnya.

"use client";

import { useEffect, useState } from "react";
import { Content } from "@/components/content";
import {
  ActiveFilter,
  FilterField,
  FilterFields,
  FilterPanel,
} from "@/components/filter-panel";
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { SortableTableHead } from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { createClient } from "@/lib/supabase/client";
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import Link from "next/link";
import {
  PettyCashPengajuan,
  PettyCashVoucher,
  PettyCashSubVoucher,
  PettyCashDeklarasi,
  PcDocType,
} from "@/type";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcAdminDeleteDialog } from "@/components/petty-cash/PcAdminDeleteDialog";
import { PcEskalasiBadge } from "@/components/petty-cash/PcEskalasiBadge";
import { PcExcelExportDialog } from "@/components/petty-cash/PcExcelExportDialog";
import { canMonitorPettyCash } from "@/lib/constants/departments";
import { pickPcPayment, resolveSubVoucherPayment } from "@/lib/pcPayment";
import {
  PC_PENGAJUAN_STATUS_OPTIONS,
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  PC_VOUCHER_STATUS_OPTIONS,
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_SUB_VOUCHER_STATUS_OPTIONS,
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_DEKLARASI_STATUS_OPTIONS,
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  LIMIT_OPTIONS,
  pcStatusLabel,
} from "@/type/enum";
import {
  fetchPcManagementPage,
  PC_MANAGEMENT_DEFAULT_SORT,
  PC_MANAGEMENT_SEARCH_FIELDS,
  PcManagementDoc,
} from "@/services/pettyCashManagementService";
import {
  adminDeletePettyCashDocument,
  getDeleteImpactWarning,
} from "@/services/pettyCashAdminService";
import {
  Loader2,
  RefreshCcw,
  Eye,
  ExternalLink,
  Newspaper,
  ShieldAlert,
  Trash2,
} from "lucide-react";

type StageKey = PcDocType;
type AnyDoc = PcManagementDoc;

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getKode = (stage: StageKey, row: AnyDoc): string => {
  if (stage === "pengajuan") return (row as PettyCashPengajuan).kode_pengajuan;
  if (stage === "voucher") return (row as PettyCashVoucher).kode_voucher;
  if (stage === "sub_voucher")
    return (row as PettyCashSubVoucher).kode_sub_voucher;
  return (row as PettyCashDeklarasi).kode_deklarasi;
};

// Sub-Voucher tidak punya `total_amount`/`company_code`/`department` sendiri
// di top-level (nominalnya di kolom `amount`, company/dept ikut Voucher
// induk lewat nested join - lihat komentar PettyCashSubVoucher,
// type/index.ts) - tiga helper ini menyamakan aksesnya lintas tab supaya
// render tabel/dialog di bawah bisa dipakai seragam tanpa banyak
// percabangan di tiap tempat.
const getTotalAmount = (stage: StageKey, row: AnyDoc): number =>
  stage === "sub_voucher"
    ? (row as PettyCashSubVoucher).amount
    : (row as PettyCashPengajuan | PettyCashVoucher | PettyCashDeklarasi)
        .total_amount;

const getDepartment = (stage: StageKey, row: AnyDoc): string =>
  stage === "sub_voucher"
    ? (row as PettyCashSubVoucher).petty_cash_voucher?.department || "-"
    : (row as PettyCashPengajuan | PettyCashVoucher | PettyCashDeklarasi)
        .department;

const getCompanyCode = (stage: StageKey, row: AnyDoc): string =>
  stage === "sub_voucher"
    ? (row as PettyCashSubVoucher).petty_cash_voucher?.company_code || "-"
    : (row as PettyCashPengajuan | PettyCashVoucher | PettyCashDeklarasi)
        .company_code;

// Penanda Eskalasi ada di Pengajuan - dokumen turunan membacanya lewat join.
const isEskalasiDoc = (stage: StageKey, row: AnyDoc): boolean => {
  if (stage === "pengajuan") return !!(row as PettyCashPengajuan).is_eskalasi;
  if (stage === "voucher")
    return !!(row as PettyCashVoucher).petty_cash_pengajuan?.is_eskalasi;
  if (stage === "sub_voucher")
    return !!(row as PettyCashSubVoucher).petty_cash_voucher
      ?.petty_cash_pengajuan?.is_eskalasi;
  return !!(row as PettyCashDeklarasi).petty_cash_voucher?.petty_cash_pengajuan
    ?.is_eskalasi;
};

// Metode pencairan cuma ada di Voucher (rencana) & Sub-Voucher (final atau
// rencana Voucher induk) - undefined = panel info tidak menampilkannya.
const getPayment = (stage: StageKey, row: AnyDoc) => {
  if (stage === "voucher") return pickPcPayment(row as PettyCashVoucher);
  if (stage === "sub_voucher")
    return resolveSubVoucherPayment(row as PettyCashSubVoucher);
  return undefined;
};

// Deklarasi & Sub-Voucher tidak punya needed_date (lihat komentar di
// type/index.ts) - dipakai membedakan apa PcDocumentInfoPanel perlu
// menampilkan tanggal/minggu dibutuhkan atau tidak.
const showsNeededDate = (stage: StageKey) =>
  stage === "pengajuan" || stage === "voucher";

const getNeededDate = (stage: StageKey, row: AnyDoc) =>
  stage === "pengajuan"
    ? (row as PettyCashPengajuan).needed_date
    : stage === "voucher"
      ? (row as PettyCashVoucher).needed_date
      : null;

// Budget yang menanggung dokumen ini - Pengajuan/Voucher punya budget_id
// sendiri (join langsung), Sub-Voucher/Deklarasi tidak (budget-nya ikut
// Voucher asalnya, nested).
const getBudget = (
  stage: StageKey,
  row: AnyDoc,
): { name: string; current_budget: number } | null | undefined => {
  if (stage === "deklarasi")
    return (row as PettyCashDeklarasi).petty_cash_voucher?.petty_cash_budget;
  if (stage === "sub_voucher")
    return (row as PettyCashSubVoucher).petty_cash_voucher?.petty_cash_budget;
  return (row as PettyCashPengajuan | PettyCashVoucher).petty_cash_budget;
};

// Kode dokumen asal (rantai Pengajuan -> Voucher -> Sub-Voucher ->
// Deklarasi) - dipakai nunjukin konteks di dialog detail.
const getSourceLabel = (stage: StageKey, row: AnyDoc): string | null => {
  if (stage === "voucher") {
    const kode = (row as PettyCashVoucher).petty_cash_pengajuan?.kode_pengajuan;
    return kode ? `Dari Pengajuan ${kode}` : null;
  }
  if (stage === "sub_voucher") {
    const voucher = (row as PettyCashSubVoucher).petty_cash_voucher;
    return voucher ? `Dari Voucher ${voucher.kode_voucher}` : null;
  }
  if (stage === "deklarasi") {
    const voucher = (row as PettyCashDeklarasi).petty_cash_voucher;
    if (!voucher) return null;
    const pengajuanKode = voucher.petty_cash_pengajuan?.kode_pengajuan;
    return `Dari Voucher ${voucher.kode_voucher}${pengajuanKode ? ` (Pengajuan ${pengajuanKode})` : ""}`;
  }
  return null;
};

const STAGE_CONFIG: Record<
  StageKey,
  {
    label: string;
    statusOptions: readonly string[];
    statusColors: Record<string, string>;
    statusColorDefault: string;
  }
> = {
  pengajuan: {
    label: "Pengajuan",
    statusOptions: PC_PENGAJUAN_STATUS_OPTIONS,
    statusColors: PC_PENGAJUAN_STATUS_COLORS,
    statusColorDefault: PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  },
  voucher: {
    label: "Voucher",
    statusOptions: PC_VOUCHER_STATUS_OPTIONS,
    statusColors: PC_VOUCHER_STATUS_COLORS,
    statusColorDefault: PC_VOUCHER_STATUS_COLOR_DEFAULT,
  },
  sub_voucher: {
    label: "Sub-Voucher",
    statusOptions: PC_SUB_VOUCHER_STATUS_OPTIONS,
    statusColors: PC_SUB_VOUCHER_STATUS_COLORS,
    statusColorDefault: PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
  },
  deklarasi: {
    label: "Deklarasi",
    statusOptions: PC_DEKLARASI_STATUS_OPTIONS,
    statusColors: PC_DEKLARASI_STATUS_COLORS,
    statusColorDefault: PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  },
};

const DETAIL_PATH: Record<StageKey, string> = {
  pengajuan: "pengajuan",
  voucher: "voucher",
  sub_voucher: "sub-voucher",
  deklarasi: "deklarasi",
};

const isStageKey = (value: string | null): value is StageKey =>
  !!value && value in STAGE_CONFIG;

export default function PettyCashManagementClient() {
  const supabase = createClient();
  // null = masih memuat profil.
  const [access, setAccess] = useState<{
    canView: boolean;
    isAdmin: boolean;
    // null = tanpa batas company (admin / company LOURDES).
    allowedCompanies: string[] | null;
  } | null>(null);
  const isAdmin = access?.isAdmin ?? false;
  const [isExportOpen, setIsExportOpen] = useState(false);

  const {
    searchParams,
    page,
    limit,
    sort: sortParam,
    setParams,
    setFilters,
  } = useListUrlParams();
  const tabParam = searchParams.get("tab");
  const stage: StageKey = isStageKey(tabParam) ? tabParam : "pengajuan";
  const searchTerm = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "";
  const companyFilter = searchParams.get("company") || "";

  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    searchTerm,
    (value) => setFilters({ search: value }),
  );

  // `stage` ikut disimpan: baris tab lama tidak boleh dirender dengan aturan
  // tab baru selama data tab baru belum datang.
  const [result, setResult] = useState<{
    stage: StageKey;
    rows: AnyDoc[];
    count: number;
  }>({ stage, rows: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<AnyDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    docType: StageKey;
    id: number;
    kode: string;
  } | null>(null);

  const config = STAGE_CONFIG[stage];

  useEffect(() => {
    const loadAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return setAccess({ canView: false, isAdmin: false, allowedCompanies: [] });
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, department, company")
        .eq("id", user.id)
        .single();
      const admin = profile?.role === "admin";
      setAccess({
        canView: canMonitorPettyCash(profile),
        isAdmin: admin,
        allowedCompanies:
          admin || profile?.company === "LOURDES"
            ? null
            : [profile?.company ?? ""],
      });
    };
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canView = access?.canView ?? false;
  const allowedCompanies = access?.allowedCompanies ?? null;

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    fetchPcManagementPage(stage, {
      page,
      limit,
      search: searchTerm,
      status: statusFilter,
      company: companyFilter,
      allowedCompanies,
      sort: sortParam,
    })
      .then(({ data, count }) => {
        if (!cancelled) setResult({ stage, rows: data, count });
      })
      .catch((error) => {
        if (cancelled) return;
        setResult({ stage, rows: [], count: 0 });
        toast.error("Gagal memuat data", { description: error.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    canView,
    stage,
    page,
    limit,
    searchTerm,
    statusFilter,
    companyFilter,
    allowedCompanies,
    sortParam,
    reloadKey,
  ]);

  // Back/Forward bisa mengganti tab saat preview masih terbuka.
  useEffect(() => {
    setSelected(null);
  }, [stage]);

  const reload = () => setReloadKey((key) => key + 1);
  const isLoading = loading || result.stage !== stage;

  const getStatusBadge = (status: string) => {
    const colorClass = config.statusColors[status] || config.statusColorDefault;
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>
        {pcStatusLabel(status, stage)}
      </Badge>
    );
  };

  const openDetail = (row: AnyDoc) => setSelected(row);

  const handleConfirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    await adminDeletePettyCashDocument(
      deleteTarget.docType,
      deleteTarget.id,
      reason,
    );
    toast.success(`${deleteTarget.kode} berhasil dihapus.`);
    setDeleteTarget(null);
    // Baris terakhir di halaman ini terhapus - range-nya jadi di luar data.
    if (result.rows.length === 1 && page > 1) setParams({ page: page - 1 });
    else reload();
  };

  const handleStageChange = (value: string) => {
    resetSearchInput();
    setFilters({
      tab: value === "pengajuan" ? undefined : value,
      search: undefined,
      status: undefined,
      sort: undefined,
    });
  };

  if (access === null) {
    return (
      <Content title="Management Petty Cash" className="col-span-12">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-6 w-6 text-primary" />
        </div>
      </Content>
    );
  }

  if (!canView) {
    return (
      <Content
        title="Management Petty Cash"
        description="Khusus untuk Admin, GA, dan Finance."
      >
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
          <ShieldAlert className="h-10 w-10" />
          <p className="text-sm">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </Content>
    );
  }

  // --- Chip filter aktif ---
  const activeFilters: ActiveFilter[] = [];
  if (searchTerm)
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: searchTerm,
      onRemove: () => {
        resetSearchInput();
        setFilters({ search: undefined });
      },
    });
  if (statusFilter)
    activeFilters.push({
      key: "status",
      label: "Status",
      value: statusFilter,
      onRemove: () => setFilters({ status: undefined }),
    });
  if (companyFilter)
    activeFilters.push({
      key: "company",
      label: "Company",
      value: companyFilter,
      onRemove: () => setFilters({ company: undefined }),
    });

  const clearFilters = () => {
    resetSearchInput();
    setFilters({ search: undefined, status: undefined, company: undefined });
  };
  const companyOptions = allowedCompanies ?? ["GMI", "GIS", "LOURDES"];
  const sortProps = {
    currentSort: sortParam,
    onSortChange: (sort: string | undefined) => setFilters({ sort }),
  };

  return (
    <>
      <Content
        title="Management Petty Cash"
        description={
          isAdmin
            ? "Pantau, ganti kode, edit paksa, & hapus (dgn cascade + refund budget otomatis) semua dokumen Petty Cash lintas departemen, plus Download Excel."
            : "Pantau semua dokumen Petty Cash lintas departemen & Download Excel (read-only)."
        }
        cardAction={
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={isLoading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <Tabs value={stage} onValueChange={handleStageChange} className="mb-4">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
            <TabsTrigger value="voucher">Voucher</TabsTrigger>
            <TabsTrigger value="sub_voucher">Sub-Voucher</TabsTrigger>
            <TabsTrigger value="deklarasi">Deklarasi</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <ListSearchInput
              placeholder="Cari kode, departemen, pemohon..."
              value={searchInput}
              onChange={setSearchInput}
              searchableFields={PC_MANAGEMENT_SEARCH_FIELDS}
            />
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => setIsExportOpen(true)}
            >
              <Newspaper className="mr-2 h-4 w-4" />
              Download Data (Excel)
            </Button>
          </div>

          <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
            <FilterFields>
              <FilterField label="Status">
                <SearchableSelect
                  value={statusFilter || "all"}
                  onValueChange={(value) =>
                    setFilters({ status: value === "all" ? undefined : value })
                  }
                >
                  <SearchableSelectTrigger>
                    <SearchableSelectValue placeholder="Semua Status" />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value="all">
                      Semua Status
                    </SearchableSelectItem>
                    {config.statusOptions.map((s) => (
                      <SearchableSelectItem key={s} value={s}>
                        {pcStatusLabel(s, stage)}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              {companyOptions.length > 1 && (
                <FilterField label="Company">
                  <SearchableSelect
                    value={companyFilter || "all"}
                    onValueChange={(value) =>
                      setFilters({
                        company: value === "all" ? undefined : value,
                      })
                    }
                  >
                    <SearchableSelectTrigger>
                      <SearchableSelectValue placeholder="Semua Company" />
                    </SearchableSelectTrigger>
                    <SearchableSelectContent>
                      <SearchableSelectItem value="all">
                        Semua Company
                      </SearchableSelectItem>
                      {companyOptions.map((c) => (
                        <SearchableSelectItem key={c} value={c}>
                          {c}
                        </SearchableSelectItem>
                      ))}
                    </SearchableSelectContent>
                  </SearchableSelect>
                </FilterField>
              )}
            </FilterFields>
          </FilterPanel>
        </div>

        <StickyHeaderTable
          className="min-w-[960px]"
          containerClassName="rounded-md border overflow-x-auto"
          header={
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <SortableTableHead
                sortKey="tanggal"
                defaultDirection="desc"
                className="w-[120px]"
                {...sortProps}
                currentSort={sortParam || PC_MANAGEMENT_DEFAULT_SORT}
              >
                Tanggal
              </SortableTableHead>
              <SortableTableHead sortKey="kode" className="w-[210px]" {...sortProps}>
                Kode
              </SortableTableHead>
              <TableHead>Pemohon</TableHead>
              {/* Departemen Sub-Voucher ada di Voucher induknya. */}
              {stage === "sub_voucher" ? (
                <TableHead className="w-[140px]">Departemen</TableHead>
              ) : (
                <SortableTableHead
                  sortKey="departemen"
                  className="w-[140px]"
                  {...sortProps}
                >
                  Departemen
                </SortableTableHead>
              )}
              <SortableTableHead
                sortKey="total"
                defaultDirection="desc"
                className="w-[140px] text-right"
                {...sortProps}
              >
                Total
              </SortableTableHead>
              <SortableTableHead sortKey="status" className="w-[150px]" {...sortProps}>
                Status
              </SortableTableHead>
              <TableHead className="w-[70px] text-right">Aksi</TableHead>
            </TableRow>
          }
        >
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(limit, 25) }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  Tidak ada data ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(row)}
                >
                  <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1 min-w-0">
                      <span className="truncate max-w-full font-mono text-xs font-semibold">
                        {getKode(stage, row)}
                      </span>
                      <PcEskalasiBadge show={isEskalasiDoc(stage, row)} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm truncate">
                    {row.users_with_profiles?.nama || "-"}
                  </TableCell>
                  <TableCell className="text-sm truncate">
                    {getDepartment(stage, row)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm tabular-nums">
                    {formatCurrency(getTotalAmount(stage, row))}
                  </TableCell>
                  <TableCell>{getStatusBadge(row.status)}</TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowActionsMenu>
                      <DropdownMenuItem onSelect={() => openDetail(row)}>
                        <Eye className="mr-2 h-4 w-4" /> Lihat Ringkasan
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/petty-cash/${DETAIL_PATH[stage]}/${row.id}`}
                          className="cursor-pointer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> Lihat Detail
                          Lengkap
                        </Link>
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() =>
                            setDeleteTarget({
                              docType: stage,
                              id: row.id,
                              kode: getKode(stage, row),
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                      )}
                    </RowActionsMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </StickyHeaderTable>

        <TablePaginationFooter
          currentPage={page}
          totalItems={result.stage === stage ? result.count : 0}
          limit={limit}
          limitOptions={LIMIT_OPTIONS}
          itemLabel="dokumen"
          onPageChange={(value) => setParams({ page: value })}
          onLimitChange={(value) => setFilters({ limit: value })}
          className="mt-6"
        />
      </Content>

      {/* DIALOG PREVIEW (read-only) - override/edit paksa/ganti kode ada di
          halaman detail lengkap */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected && getKode(stage, selected)}</DialogTitle>
            <DialogDescription>
              Diajukan oleh {selected?.users_with_profiles?.nama || "-"} (
              {selected && getDepartment(stage, selected)})
              {selected && getSourceLabel(stage, selected)
                ? ` - ${getSourceLabel(stage, selected)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <PcDocumentInfoPanel
                requesterName={selected.users_with_profiles?.nama}
                requesterEmail={selected.users_with_profiles?.email}
                department={getDepartment(stage, selected)}
                companyCode={getCompanyCode(stage, selected)}
                site={(selected as any).site}
                budgetName={getBudget(stage, selected)?.name}
                budgetRemaining={getBudget(stage, selected)?.current_budget}
                penggunaBudgetName={
                  stage === "pengajuan"
                    ? (selected as PettyCashPengajuan).pengguna_budget_nama
                    : undefined
                }
                neededDate={getNeededDate(stage, selected)}
                weekOfMonth={(selected as any).week_of_month}
                showNeededDate={showsNeededDate(stage)}
                payment={getPayment(stage, selected)}
                paymentPlanned={
                  stage === "sub_voucher" &&
                  !(selected as PettyCashSubVoucher).payment_method
                }
                notes={selected.notes}
                items={selected.items}
                totalAmount={getTotalAmount(stage, selected)}
                attachments={(selected as any).attachments ?? []}
                approvals={(selected as any).approvals ?? []}
                showApprovals={stage !== "sub_voucher"}
                discussions={selected.discussions}
                revisions={(selected as any).revisions}
              />
              <p className="text-xs text-muted-foreground text-center">
                Ini preview ringkas & read-only - untuk approve/reject/edit
                dokumen, ganti kode, edit paksa, atau override status/jalur
                approval, buka &quot;Lihat Detail Lengkap&quot; di bawah (akses
                aksi tetap mengikuti role Anda - approver giliran berjalan atau
                admin).
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Tutup
            </Button>
            {selected && (
              <Button asChild>
                <Link href={`/petty-cash/${DETAIL_PATH[stage]}/${selected.id}`}>
                  <Eye className="mr-2 h-4 w-4" /> Lihat Detail Lengkap
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PcExcelExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        allowedCompanies={allowedCompanies}
      />

      {deleteTarget && (
        <PcAdminDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          docLabel={STAGE_CONFIG[deleteTarget.docType].label}
          kode={deleteTarget.kode}
          impactWarning={getDeleteImpactWarning(deleteTarget.docType)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
