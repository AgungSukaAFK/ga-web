// src/app/(With Sidebar)/petty-cash/pengajuan-saya/PengajuanSayaClient.tsx
//
// "Pengajuan Saya" - PUSAT DOKUMEN Petty Cash milik user yang sedang login.
// Satu query (fetchMyPengajuanWithChain) mengambil tiap Pengajuan berikut
// SELURUH turunannya (Voucher -> Sub-Voucher -> Deklarasi, lihat komentar
// PettyCashPengajuanWithChain di type/index.ts) - dari situ disusun 3 mode
// tampilan (tab) yang menyorot level berbeda dari rantai yang sama:
// Pengajuan (default), Voucher & Sub-Voucher, dan Deklarasi. Klik baris di
// mode mana pun selalu membuka modal yang sama menampilkan rantai LENGKAP
// dokumen terkait (mengikuti permintaan: "pengajuan diklik row muncul modal
// detail berisi voucher, deklarasi, dan data lain ampe beres deklarasi").
//
// Langkah berikutnya (Buat Voucher, Tarik Dana) bisa langsung dikerjakan
// dari sini - tombol shortcut di baris tabel & footer modal membuka dialog
// yang sama dengan halaman Pengajuan Voucher (PcCreateVoucherDialog,
// PcTarikDanaDialog). Tiap dokumen juga bisa langsung di-Download PDF
// (PcDownloadMenu -> halaman detail `?print=`).

"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { useListUrlParams } from "@/hooks/use-list-url-params";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";
import { paginateRows, sortRows } from "@/lib/client-list";
import { formatCurrency } from "@/lib/utils";
import { PcGlossaryButton } from "@/components/petty-cash/PcGlossary";
import {
  canCloseVoucherRemainder,
  canRequestPembatalan,
  computeVoucherSisa,
  deklarasiHref,
  getActiveDoc,
  getPendingPembatalan,
  pickCurrentDoc,
  sortDocsNewestFirst,
} from "@/lib/pcChain";
import { pickPcPayment } from "@/lib/pcPayment";
import { canEscalatePettyCash } from "@/lib/constants/departments";
import {
  checkPengajuanEligibility,
  fetchMyPengajuanWithChain,
  PengajuanEligibility,
} from "@/services/pettyCashPengajuanService";
import {
  PettyCashDeklarasi,
  PettyCashPengajuan,
  PettyCashPengajuanItem,
  PettyCashPengajuanWithChain,
  PettyCashSubVoucherWithChain,
  PettyCashVoucher,
  PettyCashVoucherWithChain,
} from "@/type";
import {
  LIMIT_OPTIONS,
  PC_COA_OPTIONS,
  PC_DEKLARASI_STATUS_COLOR_DEFAULT,
  PC_DEKLARASI_STATUS_COLORS,
  PC_DEKLARASI_STATUS_OPTIONS,
  PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
  PC_PENGAJUAN_STATUS_COLORS,
  PC_PENGAJUAN_STATUS_OPTIONS,
  PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_SUB_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_COLOR_DEFAULT,
  PC_VOUCHER_STATUS_COLORS,
  PC_VOUCHER_STATUS_OPTIONS,
  pcStatusLabel,
} from "@/type/enum";
import { Content } from "@/components/content";
import {
  ActiveFilter,
  FilterApplyButton,
  FilterField,
  FilterFields,
  FilterPanel,
  FilterRange,
  FilterRangeFields,
  formatFilterDate,
  formatFilterRange,
} from "@/components/filter-panel";
import { ListSearchInput } from "@/components/list-search-input";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { SortableTableHead } from "@/components/sortable-table-head";
import { StickyHeaderTable } from "@/components/sticky-header-table";
import { TablePaginationFooter } from "@/components/table-pagination-footer";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SearchableSelect,
  SearchableSelectTrigger,
  SearchableSelectValue,
  SearchableSelectContent,
  SearchableSelectItem,
} from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PcCreateVoucherDialog } from "@/components/petty-cash/PcCreateVoucherDialog";
import {
  PcTarikDanaDialog,
  canDrawVoucher,
  drawnOf,
} from "@/components/petty-cash/PcTarikDanaDialog";
import {
  PcDownloadMenu,
  PcDownloadMenuItems,
} from "@/components/petty-cash/PcPrintMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import { PcEskalasiBadge } from "@/components/petty-cash/PcEskalasiBadge";
import {
  PcAjukanPembatalanButton,
  PcPembatalanStatus,
} from "@/components/petty-cash/PcPembatalan";
import {
  PcSisaDitutupInfo,
  PcTutupSisaButton,
} from "@/components/petty-cash/PcTutupSisaVoucher";
import { computePcOverallStatus } from "@/services/pettyCashDashboardService";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarDays,
  Clock,
  CornerDownRight,
  Eye,
  ExternalLink,
  FileCheck2,
  PlusCircle,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Send,
  Wallet,
} from "lucide-react";

type Mode = "pengajuan" | "voucher" | "deklarasi";

type VoucherRow = {
  pengajuan: PettyCashPengajuanWithChain;
  voucher: PettyCashVoucherWithChain;
};

type DeklarasiRow = {
  pengajuan: PettyCashPengajuanWithChain;
  voucher: PettyCashVoucherWithChain;
  subVoucher: PettyCashSubVoucherWithChain;
  deklarasi: PettyCashDeklarasi;
};

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const toDayKey = (d: string | Date) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const SEARCH_FIELDS = [
  "Kode dokumen",
  "Departemen",
  "Catatan",
  "Nama barang",
];

const createdTime = (doc: { created_at: string | Date }) =>
  new Date(doc.created_at).getTime();

const PENGAJUAN_SORT: Record<
  string,
  (pj: PettyCashPengajuanWithChain) => string | number
> = {
  tanggal: createdTime,
  kode: (pj) => pj.kode_pengajuan,
  departemen: (pj) => pj.department,
  barang: (pj) => pj.items?.length ?? 0,
  total: (pj) => pj.total_amount,
  status: (pj) => pj.status,
};

const VOUCHER_SORT: Record<string, (row: VoucherRow) => string | number> = {
  tanggal: ({ voucher }) => createdTime(voucher),
  kode: ({ voucher }) => voucher.kode_voucher,
  departemen: ({ voucher }) => voucher.department,
  total: ({ voucher }) => voucher.total_amount,
  status: ({ voucher }) => voucher.status,
};

const DEKLARASI_SORT: Record<string, (row: DeklarasiRow) => string | number> = {
  tanggal: ({ deklarasi }) => createdTime(deklarasi),
  kode: ({ deklarasi }) => deklarasi.kode_deklarasi,
  departemen: ({ deklarasi }) => deklarasi.department,
  total: ({ deklarasi }) => deklarasi.total_amount,
  status: ({ deklarasi }) => deklarasi.status,
};

const isMode = (value: string | null): value is Mode =>
  value === "pengajuan" || value === "voucher" || value === "deklarasi";

const buildHaystack = (
  parts: (string | null | undefined)[],
  items: PettyCashPengajuanItem[],
) => {
  const itemText = items
    .map((it) => `${it.part_name} ${it.note ?? ""}`)
    .join(" ");
  return [...parts, itemText].join(" ").toLowerCase();
};

/** Pengajuan "Approved" yang belum punya Voucher aktif (belum dibuat / ditolak). */
const canCreateVoucher = (pj: PettyCashPengajuanWithChain) =>
  pj.status === "Approved" &&
  !getActiveDoc(pj.petty_cash_voucher) &&
  !getPendingPembatalan(pj.petty_cash_pembatalan);

/** Tarikan yang sudah dibayar Finance tapi belum punya Deklarasi aktif. */
const isAwaitingDeklarasi = (sv: PettyCashSubVoucherWithChain) =>
  sv.status === "Selesai" && !getActiveDoc(sv.petty_cash_deklarasi);

// Tombol shortcut kecil di dalam sel tabel - stopPropagation supaya klik
// tidak ikut membuka modal (klik baris).
const cellButtonClass = "h-7 px-2.5";
const stop = (e: React.MouseEvent) => e.stopPropagation();

// Section accordion di modal: cuma dokumen yang diklik (aktif) yang terbuka,
// sisanya tertutup - supaya user tidak keliru dokumen mana yang dilihat.
const sectionsForFocus = (focus: string) => [focus];

const byCreatedAsc = (a: { created_at: string | Date }, b: { created_at: string | Date }) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

/** Bar aksi di atas tiap dokumen dalam modal - Download PDF & buka halaman detailnya. */
const DocSectionActions = ({ href }: { href: string }) => (
  <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
    <PcDownloadMenu href={href} />
    <Button asChild variant="outline" size="sm">
      <Link href={href} target="_blank">
        <ExternalLink /> Buka Halaman Detail
      </Link>
    </Button>
  </div>
);

const StatusBadge = ({
  status,
  colors,
  fallback,
  label,
}: {
  status: string;
  colors: Record<string, string>;
  fallback: string;
  label?: string;
}) => (
  <Badge className={`${colors[status] || fallback} whitespace-nowrap`}>
    {label ?? pcStatusLabel(status)}
  </Badge>
);

export default function PengajuanSayaClient() {
  const router = useRouter();
  const supabase = createClient();
  const {
    searchParams,
    page,
    limit,
    sort: sortParam,
    setParams,
    setFilters,
  } = useListUrlParams();
  const tabParam = searchParams.get("tab");
  const mode: Mode = isMode(tabParam) ? tabParam : "pengajuan";

  const [chain, setChain] = useState<PettyCashPengajuanWithChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    nama?: string | null;
    email?: string | null;
  } | null>(null);
  const [eligibility, setEligibility] = useState<PengajuanEligibility | null>(
    null,
  );

  const search = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const companyFilter = searchParams.get("company") || "all";
  const dateFrom = searchParams.get("startDate") || "";
  const dateTo = searchParams.get("endDate") || "";
  const [searchInput, setSearchInput, resetSearchInput] = useUrlSearchInput(
    search,
    (value) => setFilters({ search: value }),
  );
  // Rentang tanggal baru berlaku setelah "Terapkan".
  const [dateDraft, setDateDraft] = useState({ from: dateFrom, to: dateTo });
  useEffect(() => {
    setDateDraft({ from: dateFrom, to: dateTo });
  }, [dateFrom, dateTo]);

  const [userId, setUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PettyCashPengajuanWithChain | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(["pengajuan"]);
  // Dokumen yang diklik user utk membuka modal ("pengajuan" | "voucher" |
  // "deklarasi-<id>") - menentukan judul modal & section yang terbuka.
  const [modalFocus, setModalFocus] = useState("pengajuan");
  const [createTarget, setCreateTarget] = useState<PettyCashPengajuan | null>(
    null,
  );
  const [drawTarget, setDrawTarget] = useState<PettyCashVoucher | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terautentikasi.");
      setUserId(user.id);

      const profileRes = await supabase
        .from("profiles")
        .select("nama, department, lokasi, company, role")
        .eq("id", user.id)
        .single();

      const [chainData, eligibilityRes] = await Promise.all([
        fetchMyPengajuanWithChain(user.id),
        profileRes.data?.department && profileRes.data?.company
          ? checkPengajuanEligibility(
              user.id,
              profileRes.data.department,
              profileRes.data.lokasi ?? null,
              profileRes.data.company,
              canEscalatePettyCash(profileRes.data),
            )
          : Promise.resolve(null),
      ]);

      setChain(chainData);
      setProfile({ nama: profileRes.data?.nama, email: user.email });
      setEligibility(eligibilityRes);
    } catch (error: any) {
      toast.error("Gagal memuat data Petty Cash", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Modal tetap menampilkan data terbaru setelah refetch (mis. habis Buat
  // Voucher / Tarik Dana dari dalam modal), bukan objek lama.
  useEffect(() => {
    setSelectedPengajuan((prev) =>
      prev ? (chain.find((p) => p.id === prev.id) ?? prev) : prev,
    );
  }, [chain]);

  // Reset status & sort tiap ganti mode - opsi status beda per jenis dokumen
  // (mis. "Selesai" tidak ada di status Deklarasi).
  const handleModeChange = (value: string) =>
    setFilters({
      tab: value === "pengajuan" ? undefined : value,
      status: undefined,
      sort: undefined,
    });

  const resetFilters = () => {
    resetSearchInput();
    setFilters({
      search: undefined,
      status: undefined,
      company: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  // ===== Data turunan dari `chain` (satu sumber data utk 3 mode) =====

  const voucherRows: VoucherRow[] = useMemo(
    () =>
      // Semua Voucher per Pengajuan, termasuk yang ditolak lalu diajukan
      // ulang - masing-masing tetap dokumen sendiri.
      chain.flatMap((pengajuan) =>
        sortDocsNewestFirst(pengajuan.petty_cash_voucher).map((voucher) => ({
          pengajuan,
          voucher,
        })),
      ),
    [chain],
  );

  const deklarasiRows: DeklarasiRow[] = useMemo(
    () =>
      voucherRows.flatMap(({ pengajuan, voucher }) =>
        // Semua Deklarasi per tarikan, termasuk yang ditolak lalu diajukan
        // ulang - masing-masing tetap dokumen sendiri.
        (voucher.petty_cash_sub_voucher ?? []).flatMap((subVoucher) =>
          sortDocsNewestFirst(subVoucher.petty_cash_deklarasi).map(
            (deklarasi) => ({ pengajuan, voucher, subVoucher, deklarasi }),
          ),
        ),
      ),
    [voucherRows],
  );

  const filteredPengajuan = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chain.filter((pj) => {
      if (statusFilter !== "all" && pj.status !== statusFilter) return false;
      if (companyFilter !== "all" && pj.company_code !== companyFilter)
        return false;
      if (dateFrom && toDayKey(pj.created_at) < dateFrom)
        return false;
      if (dateTo && toDayKey(pj.created_at) > dateTo) return false;
      if (!q) return true;
      return buildHaystack(
        [pj.kode_pengajuan, pj.department, pj.notes],
        pj.items,
      ).includes(q);
    });
  }, [chain, search, statusFilter, companyFilter, dateFrom, dateTo]);

  const filteredVoucherRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voucherRows.filter(({ pengajuan, voucher }) => {
      if (statusFilter !== "all" && voucher.status !== statusFilter)
        return false;
      if (companyFilter !== "all" && voucher.company_code !== companyFilter)
        return false;
      if (dateFrom && toDayKey(voucher.created_at) < dateFrom)
        return false;
      if (dateTo && toDayKey(voucher.created_at) > dateTo)
        return false;
      if (!q) return true;
      return buildHaystack(
        [
          voucher.kode_voucher,
          pengajuan.kode_pengajuan,
          voucher.department,
          voucher.notes,
          ...(voucher.petty_cash_sub_voucher ?? []).map((sv) => sv.kode_sub_voucher),
        ],
        voucher.items,
      ).includes(q);
    });
  }, [voucherRows, search, statusFilter, companyFilter, dateFrom, dateTo]);

  const filteredDeklarasiRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deklarasiRows.filter(({ pengajuan, voucher, subVoucher, deklarasi }) => {
      if (statusFilter !== "all" && deklarasi.status !== statusFilter)
        return false;
      if (companyFilter !== "all" && deklarasi.company_code !== companyFilter)
        return false;
      if (dateFrom && toDayKey(deklarasi.created_at) < dateFrom)
        return false;
      if (dateTo && toDayKey(deklarasi.created_at) > dateTo)
        return false;
      if (!q) return true;
      return buildHaystack(
        [
          deklarasi.kode_deklarasi,
          subVoucher.kode_sub_voucher,
          voucher.kode_voucher,
          pengajuan.kode_pengajuan,
          deklarasi.department,
          deklarasi.notes,
        ],
        deklarasi.items,
      ).includes(q);
    });
  }, [deklarasiRows, search, statusFilter, companyFilter, dateFrom, dateTo]);

  const pengajuanPage = paginateRows(
    sortRows(filteredPengajuan, sortParam, PENGAJUAN_SORT),
    page,
    limit,
  );
  const voucherPage = paginateRows(
    sortRows(filteredVoucherRows, sortParam, VOUCHER_SORT),
    page,
    limit,
  );
  const deklarasiPage = paginateRows(
    sortRows(filteredDeklarasiRows, sortParam, DEKLARASI_SORT),
    page,
    limit,
  );

  const openChainModal = (
    pengajuan: PettyCashPengajuanWithChain,
    focus: string,
  ) => {
    setSelectedPengajuan(pengajuan);
    setOpenSections(sectionsForFocus(focus));
    setModalFocus(focus);
    setIsDialogOpen(true);
  };

  /** Buka (kalau tertutup) lalu scroll ke satu section accordion di modal. */
  const focusSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev : [...prev, section],
    );
    requestAnimationFrame(() =>
      document
        .getElementById(`pc-section-${section}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  // Deep-link "?open=<id pengajuan>" - dipakai Dashboard Petty Cash
  // (PcDashboardClient.tsx) supaya klik kartu/baris di sana langsung buka
  // modal rantai dokumen ini, bukan cuma pindah halaman lalu user cari
  // sendiri. Cuma jalan sekali per kunjungan halaman (ref guard) supaya
  // tidak buka ulang tiap kali `chain` di-refetch (mis. setelah aksi di
  // dalam modal).
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (openedFromQueryRef.current) return;
    if (loading || chain.length === 0) return;
    const openId = searchParams.get("open");
    if (!openId) return;
    const target = chain.find((p) => String(p.id) === openId);
    if (target) {
      openChainModal(target, "pengajuan");
    }
    openedFromQueryRef.current = true;
  }, [chain, loading, searchParams]);

  const selectedVoucher = pickCurrentDoc(selectedPengajuan?.petty_cash_voucher);
  // Voucher lain milik Pengajuan ini = yang ditolak sebelum diajukan ulang.
  const rejectedVoucherHistory = sortDocsNewestFirst(
    selectedPengajuan?.petty_cash_voucher,
  ).filter((v) => v.id !== selectedVoucher?.id);

  const focusedDeklarasi = modalFocus.startsWith("deklarasi-")
    ? ((selectedVoucher?.petty_cash_sub_voucher ?? [])
        .flatMap((sv) => sortDocsNewestFirst(sv.petty_cash_deklarasi))
        .find((d) => `deklarasi-${d.id}` === modalFocus) ?? null)
    : null;
  const modalHeader: { Icon: React.ElementType; kode?: string } =
    focusedDeklarasi
      ? { Icon: FileCheck2, kode: focusedDeklarasi.kode_deklarasi }
      : modalFocus === "voucher" && selectedVoucher
        ? { Icon: Wallet, kode: selectedVoucher.kode_voucher }
        : { Icon: ReceiptText, kode: selectedPengajuan?.kode_pengajuan };

  // Langkah berikutnya utk rantai dokumen yang sedang dibuka di modal -
  // tampil di footer modal sbg tombol utama.
  const nextSteps: { hint: string; action: React.ReactNode }[] = [];
  if (selectedPengajuan?.status === "Rejected") {
    nextSteps.push({
      hint: "Pengajuan ditolak - bisa diajukan ulang dengan data yang sama.",
      action: (
        <Button asChild key="ulang">
          <Link href={`/petty-cash/input-pengajuan?ulang=${selectedPengajuan.id}`}>
            <RotateCcw /> Ajukan Ulang
          </Link>
        </Button>
      ),
    });
  }
  if (selectedPengajuan && canCreateVoucher(selectedPengajuan)) {
    nextSteps.push({
      hint: selectedVoucher
        ? `Voucher ${selectedVoucher.kode_voucher} ditolak - ajukan ulang Voucher dari Pengajuan ini.`
        : "Pengajuan sudah disetujui - lanjut buat Voucher pencairan.",
      action: (
        <Button key="voucher" onClick={() => setCreateTarget(selectedPengajuan)}>
          <Send /> {selectedVoucher ? "Ajukan Ulang Voucher" : "Buat Voucher"}
        </Button>
      ),
    });
  }
  if (
    selectedVoucher &&
    canDrawVoucher(selectedVoucher, selectedPengajuan?.petty_cash_pembatalan)
  ) {
    nextSteps.push({
      hint: `Voucher disetujui - sisa ${formatCurrency(
        selectedVoucher.total_amount - drawnOf(selectedVoucher),
      )} bisa ditarik.`,
      action: (
        <Button key="tarik" onClick={() => setDrawTarget(selectedVoucher)}>
          <Wallet /> Tarik Dana
        </Button>
      ),
    });
  }
  if (
    selectedVoucher &&
    canCloseVoucherRemainder(selectedVoucher, selectedPengajuan?.petty_cash_pembatalan)
  ) {
    nextSteps.push({
      hint: "Sisanya tidak dipakai? Tutup supaya Voucher bisa selesai.",
      action: (
        <PcTutupSisaButton
          key="tutup-sisa"
          size="default"
          voucher={selectedVoucher}
          sisa={computeVoucherSisa(selectedVoucher)}
          onClosed={loadData}
        />
      ),
    });
  }
  if (selectedPengajuan && getPendingPembatalan(selectedPengajuan.petty_cash_pembatalan)) {
    nextSteps.push({
      hint: "Pembatalan sedang menunggu persetujuan Finance - Tarik Dana ditahan.",
      action: null,
    });
  } else if (selectedPengajuan && canRequestPembatalan(selectedPengajuan)) {
    nextSteps.push({
      hint: "",
      action: (
        <PcAjukanPembatalanButton
          key="batal"
          size="default"
          pengajuan={selectedPengajuan}
          onRequested={loadData}
        />
      ),
    });
  }
  const awaitingDeklarasi = (
    selectedVoucher?.petty_cash_sub_voucher ?? []
  ).filter(isAwaitingDeklarasi);
  if (awaitingDeklarasi.length > 0) {
    nextSteps.push({
      hint: `${awaitingDeklarasi.length} tarikan sudah dibayar Finance & belum dideklarasikan.`,
      action: (
        <Button asChild key="deklarasi" variant="secondary">
          <Link
            href={
              awaitingDeklarasi.length === 1
                ? deklarasiHref(awaitingDeklarasi[0].id)
                : "/petty-cash/deklarasi"
            }
          >
            <FileCheck2 /> Buat Deklarasi
          </Link>
        </Button>
      ),
    });
  }

  const modeMeta: Record<
    Mode,
    { label: string; createLabel: string; createHref: string }
  > = {
    pengajuan: {
      label: "Pengajuan",
      createLabel: "Input Pengajuan",
      createHref: "/petty-cash/input-pengajuan",
    },
    voucher: {
      label: "Voucher & Sub-Voucher",
      createLabel: "Pengajuan Voucher",
      createHref: "/petty-cash/pengajuan-voucher",
    },
    deklarasi: {
      label: "Deklarasi",
      createLabel: "Buat Deklarasi",
      createHref: "/petty-cash/deklarasi",
    },
  };

  const statusOptionsByMode: Record<Mode, readonly string[]> = {
    pengajuan: PC_PENGAJUAN_STATUS_OPTIONS,
    voucher: PC_VOUCHER_STATUS_OPTIONS,
    deklarasi: PC_DEKLARASI_STATUS_OPTIONS,
  };

  // --- Chip filter aktif ---
  const activeFilters: ActiveFilter[] = [];
  if (search.trim())
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: search.trim(),
      onRemove: () => {
        resetSearchInput();
        setFilters({ search: undefined });
      },
    });
  if (statusFilter !== "all")
    activeFilters.push({
      key: "status",
      label: "Status",
      value: pcStatusLabel(statusFilter),
      onRemove: () => setFilters({ status: undefined }),
    });
  if (companyFilter !== "all")
    activeFilters.push({
      key: "company",
      label: "Company",
      value: companyFilter,
      onRemove: () => setFilters({ company: undefined }),
    });
  if (dateFrom || dateTo)
    activeFilters.push({
      key: "tanggal",
      label: "Tanggal",
      value: formatFilterRange(dateFrom, dateTo, formatFilterDate),
      onRemove: () => setFilters({ startDate: undefined, endDate: undefined }),
    });

  const sortProps = {
    currentSort: sortParam,
    onSortChange: (sort: string | undefined) => setFilters({ sort }),
  };

  // Dipanggil sebagai fungsi (bukan <FilterBar />) supaya tidak di-mount
  // ulang tiap render - state buka/tutup panel & fokus input tetap terjaga.
  const renderFilterBar = () => (
    <div className="mb-6 flex flex-col gap-4">
      <ListSearchInput
        placeholder="Cari kode, departemen, barang..."
        value={searchInput}
        onChange={setSearchInput}
        searchableFields={SEARCH_FIELDS}
      />
      <FilterPanel activeFilters={activeFilters} onReset={resetFilters}>
        <FilterFields>
          <FilterField label="Status">
            <SearchableSelect
              value={statusFilter}
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
                {statusOptionsByMode[mode].map((s) => (
                  <SearchableSelectItem key={s} value={s}>
                    {pcStatusLabel(s)}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </FilterField>
          <FilterField label="Company">
            <SearchableSelect
              value={companyFilter}
              onValueChange={(value) =>
                setFilters({ company: value === "all" ? undefined : value })
              }
            >
              <SearchableSelectTrigger>
                <SearchableSelectValue placeholder="Company" />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                <SearchableSelectItem value="all">
                  Semua Company
                </SearchableSelectItem>
                {PC_COA_OPTIONS.map((c) => (
                  <SearchableSelectItem key={c} value={c}>
                    {c}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </FilterField>
        </FilterFields>
        <FilterRangeFields>
          <FilterField label="Tanggal Dibuat">
            <FilterRange
              from={
                <Input
                  type="date"
                  aria-label="Dari tanggal"
                  value={dateDraft.from}
                  onChange={(e) =>
                    setDateDraft((draft) => ({
                      ...draft,
                      from: e.target.value,
                    }))
                  }
                />
              }
              to={
                <Input
                  type="date"
                  aria-label="Sampai tanggal"
                  value={dateDraft.to}
                  onChange={(e) =>
                    setDateDraft((draft) => ({ ...draft, to: e.target.value }))
                  }
                />
              }
            />
          </FilterField>
          <FilterApplyButton
            onClick={() =>
              setFilters({ startDate: dateDraft.from, endDate: dateDraft.to })
            }
          />
        </FilterRangeFields>
      </FilterPanel>
    </div>
  );

  const renderTableSkeleton = (colSpan: number) =>
    Array.from({ length: Math.min(limit, 25) }).map((_, i) => (
      <TableRow key={i}>
        <TableCell colSpan={colSpan}>
          <Skeleton className="h-8 w-full" />
        </TableCell>
      </TableRow>
    ));

  const renderFooter = (
    currentPage: number,
    totalItems: number,
    itemLabel: string,
  ) => (
    <TablePaginationFooter
      currentPage={currentPage}
      totalItems={totalItems}
      limit={limit}
      limitOptions={LIMIT_OPTIONS}
      itemLabel={itemLabel}
      onPageChange={(value) => setParams({ page: value })}
      onLimitChange={(value) => setFilters({ limit: value })}
      className="mt-6"
    />
  );

  return (
    <>
      <Content
        title="Dokumen Petty Cash Saya"
        description="Pusat dokumen Pengajuan, Voucher, dan Deklarasi Petty Cash Anda - klik baris mana pun untuk melihat rantai dokumen lengkapnya."
        cardAction={
          <div className="flex items-center gap-1">
            <PcGlossaryButton />
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      >
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
            <TabsTrigger value="voucher">Voucher & Sub-Voucher</TabsTrigger>
            <TabsTrigger value="deklarasi">Deklarasi</TabsTrigger>
          </TabsList>

          {/* ===== MODE: PENGAJUAN ===== */}
          <TabsContent value="pengajuan">
            {eligibility && !eligibility.eligible && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Belum bisa membuat Pengajuan baru</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {eligibility.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {eligibility?.eligible && eligibility.requiresEskalasi && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Pengajuan baru akan ditandai Eskalasi</AlertTitle>
                <AlertDescription>
                  Anda masih punya tarikan yang belum dideklarasikan (
                  {eligibility.pendingSubVoucherKodes.join(", ")}). Sebagai
                  GA/Admin Anda tetap bisa mengajukan, tapi sebaiknya
                  deklarasikan tarikan tersebut secepatnya.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                onClick={() => router.push(modeMeta.pengajuan.createHref)}
                disabled={!!eligibility && !eligibility.eligible}
                title={
                  eligibility && !eligibility.eligible
                    ? eligibility.reasons.join(" ")
                    : undefined
                }
              >
                <PlusCircle className="h-4 w-4 mr-1" /> {modeMeta.pengajuan.createLabel}
              </Button>
            </div>
            {renderFilterBar()}
            <StickyHeaderTable
              className="min-w-[1080px] table-fixed"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <SortableTableHead sortKey="tanggal" defaultDirection="desc" className="w-[120px]" {...sortProps}>
                    Tanggal
                  </SortableTableHead>
                  <SortableTableHead sortKey="kode" className="w-[190px]" {...sortProps}>
                    Kode Pengajuan
                  </SortableTableHead>
                  <SortableTableHead sortKey="departemen" className="w-[130px]" {...sortProps}>
                    Departemen
                  </SortableTableHead>
                  <SortableTableHead sortKey="barang" defaultDirection="desc" className="w-[90px] text-right" {...sortProps}>
                    Barang
                  </SortableTableHead>
                  <SortableTableHead sortKey="total" defaultDirection="desc" className="w-[130px] text-right" {...sortProps}>
                    Total
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" className="w-[140px]" {...sortProps}>
                    Status
                  </SortableTableHead>
                  <TableHead className="w-[160px]">Voucher</TableHead>
                  <TableHead className="w-[70px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  renderTableSkeleton(9)
                ) : pengajuanPage.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {chain.length === 0
                        ? "Belum ada pengajuan Petty Cash."
                        : "Tidak ada data ditemukan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pengajuanPage.rows.map((pj, index) => {
                    const voucher = pickCurrentDoc(pj.petty_cash_voucher);
                    const voucherCreatable = canCreateVoucher(pj);
                    const overall = computePcOverallStatus(pj);
                    return (
                      <TableRow
                        key={pj.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openChainModal(pj, "pengajuan")}
                      >
                        <TableCell>{pengajuanPage.offset + index + 1}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(pj.created_at)}</TableCell>
                        <TableCell title={pj.kode_pengajuan}>
                          <div className="flex flex-col items-start gap-1 min-w-0">
                            <span className="truncate max-w-full font-mono text-xs font-semibold text-primary">{pj.kode_pengajuan}</span>
                            <PcEskalasiBadge show={pj.is_eskalasi} />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm truncate" title={pj.department}>{pj.department}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{pj.items?.length ?? 0}</TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums">{formatCurrency(pj.total_amount)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusBadge status={pj.status} colors={PC_PENGAJUAN_STATUS_COLORS} fallback={PC_PENGAJUAN_STATUS_COLOR_DEFAULT} />
                            {pj.status === "Approved" && overall.key !== "pembatalan_menunggu" && (
                              <span
                                className={`text-[11px] whitespace-normal ${overall.tone === "action" ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}`}
                              >
                                {overall.label}
                              </span>
                            )}
                            {getPendingPembatalan(pj.petty_cash_pembatalan) && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-yellow-700 dark:text-yellow-300">
                                <Ban className="h-3 w-3" /> Pembatalan diajukan
                              </span>
                            )}
                            {pj.status === "Rejected" && (
                              <Button asChild variant="outline" size="sm" className={cellButtonClass} onClick={stop}>
                                <Link href={`/petty-cash/input-pengajuan?ulang=${pj.id}`}>
                                  <RotateCcw /> Ajukan Ulang
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            {voucher ? (
                              <StatusBadge status={voucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                            ) : (
                              !voucherCreatable && (
                                <span className="text-xs text-muted-foreground italic">Belum ada</span>
                              )
                            )}
                            {voucherCreatable ? (
                              <Button
                                size="sm"
                                className={cellButtonClass}
                                onClick={(e) => {
                                  stop(e);
                                  setCreateTarget(pj);
                                }}
                              >
                                <Send /> {voucher ? "Ajukan Ulang" : "Buat Voucher"}
                              </Button>
                            ) : (
                              voucher &&
                              canDrawVoucher(voucher, pj.petty_cash_pembatalan) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cellButtonClass}
                                  onClick={(e) => {
                                    stop(e);
                                    setDrawTarget(voucher);
                                  }}
                                >
                                  <Wallet /> Tarik Dana
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={stop}>
                          <RowActionsMenu>
                            <DropdownMenuItem onSelect={() => openChainModal(pj, "pengajuan")}>
                              <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                            </DropdownMenuItem>
                            <PcDownloadMenuItems href={`/petty-cash/pengajuan/${pj.id}`} />
                          </RowActionsMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </StickyHeaderTable>
            {renderFooter(pengajuanPage.currentPage, filteredPengajuan.length, "pengajuan")}
          </TabsContent>

          {/* ===== MODE: VOUCHER & SUB-VOUCHER ===== */}
          <TabsContent value="voucher">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => router.push(modeMeta.voucher.createHref)}>
                <PlusCircle className="h-4 w-4 mr-1" /> {modeMeta.voucher.createLabel}
              </Button>
            </div>
            {renderFilterBar()}
            <StickyHeaderTable
              className="min-w-[1260px] table-fixed"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <SortableTableHead sortKey="tanggal" defaultDirection="desc" className="w-[120px]" {...sortProps}>
                    Tanggal
                  </SortableTableHead>
                  <SortableTableHead sortKey="kode" className="w-[190px]" {...sortProps}>
                    Kode
                  </SortableTableHead>
                  <TableHead className="w-[170px]">Asal Dokumen</TableHead>
                  <SortableTableHead sortKey="departemen" className="w-[120px]" {...sortProps}>
                    Departemen
                  </SortableTableHead>
                  <SortableTableHead sortKey="total" defaultDirection="desc" className="w-[130px] text-right" {...sortProps}>
                    Total
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" className="w-[170px]" {...sortProps}>
                    Status
                  </SortableTableHead>
                  <TableHead className="w-[240px]">Tarikan / Deklarasi</TableHead>
                  <TableHead className="w-[70px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  renderTableSkeleton(9)
                ) : voucherPage.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {voucherRows.length === 0
                        ? "Belum ada Voucher Petty Cash."
                        : "Tidak ada data ditemukan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  voucherPage.rows.map(({ pengajuan, voucher }, index) => {
                    const subVouchers = voucher.petty_cash_sub_voucher ?? [];
                    const drawn = drawnOf(voucher);
                    const declaredCount = subVouchers.filter(
                      (sv) => !!getActiveDoc(sv.petty_cash_deklarasi),
                    ).length;
                    return (
                      <Fragment key={voucher.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => openChainModal(pengajuan, "voucher")}
                        >
                          <TableCell>{voucherPage.offset + index + 1}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(voucher.created_at)}</TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-primary truncate" title={voucher.kode_voucher}>
                            {voucher.kode_voucher}
                          </TableCell>
                          <TableCell className="text-sm truncate" title={pengajuan.kode_pengajuan}>
                            {pengajuan.kode_pengajuan}
                          </TableCell>
                          <TableCell className="text-sm truncate" title={voucher.department}>{voucher.department}</TableCell>
                          <TableCell className="text-right font-semibold text-sm tabular-nums">{formatCurrency(voucher.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge status={voucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                          </TableCell>
                          <TableCell className="text-xs whitespace-normal">
                            <div className="font-medium text-sm text-foreground tabular-nums">
                              {formatCurrency(drawn)} / {formatCurrency(voucher.total_amount)}
                            </div>
                            <div className="text-muted-foreground">
                              {declaredCount}/{subVouchers.length} SV dideklarasikan
                            </div>
                            {canDrawVoucher(voucher, pengajuan.petty_cash_pembatalan) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${cellButtonClass} mt-1.5`}
                                onClick={(e) => {
                                  stop(e);
                                  setDrawTarget(voucher);
                                }}
                              >
                                <Wallet /> Tarik Dana
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={stop}>
                            <RowActionsMenu>
                              <DropdownMenuItem onSelect={() => openChainModal(pengajuan, "voucher")}>
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </DropdownMenuItem>
                              <PcDownloadMenuItems href={`/petty-cash/voucher/${voucher.id}`} />
                            </RowActionsMenu>
                          </TableCell>
                        </TableRow>

                        {/* Sub-Voucher (tarikan dana) tampil menjorok di bawah Voucher induknya */}
                        {[...subVouchers].sort(byCreatedAsc).map((sv) => {
                          const dek = pickCurrentDoc(sv.petty_cash_deklarasi);
                          return (
                            <TableRow
                              key={`sv-${sv.id}`}
                              className="cursor-pointer bg-muted/30 hover:bg-muted/60 transition-colors"
                              onClick={() => openChainModal(pengajuan, "voucher")}
                            >
                              <TableCell />
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(sv.created_at)}</TableCell>
                              <TableCell>
                                <div className="flex items-start gap-1.5 pl-2 min-w-0">
                                  <CornerDownRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                                  <div className="flex min-w-0 flex-col gap-1">
                                    <Badge variant="outline" className="w-fit px-1.5 py-0 text-[10px] font-medium border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300">
                                      Sub-Voucher
                                    </Badge>
                                    <span className="truncate font-mono text-xs font-medium" title={sv.kode_sub_voucher}>
                                      {sv.kode_sub_voucher}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <span className="block">Tarikan dari Voucher</span>
                                <span className="block truncate text-sm" title={voucher.kode_voucher}>{voucher.kode_voucher}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground truncate" title={voucher.department}>{voucher.department}</TableCell>
                              <TableCell className="text-right font-medium text-sm tabular-nums">{formatCurrency(sv.amount)}</TableCell>
                              <TableCell>
                                <StatusBadge status={sv.status} label={pcStatusLabel(sv.status, "sub_voucher")} colors={PC_SUB_VOUCHER_STATUS_COLORS} fallback={PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT} />
                              </TableCell>
                              <TableCell className="text-xs whitespace-normal">
                                {sv.status === "Menunggu Pembayaran" ? (
                                  <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                                    <Clock className="h-3 w-3 shrink-0" /> Menunggu pembayaran Finance
                                  </span>
                                ) : dek ? (
                                  <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
                                    Deklarasi
                                    <StatusBadge status={dek.status} colors={PC_DEKLARASI_STATUS_COLORS} fallback={PC_DEKLARASI_STATUS_COLOR_DEFAULT} />
                                  </span>
                                ) : (
                                  <span className="block text-muted-foreground italic">Belum dideklarasikan</span>
                                )}
                                {isAwaitingDeklarasi(sv) && (
                                  <Button asChild size="sm" variant="outline" className={`${cellButtonClass} mt-1.5`} onClick={stop}>
                                    <Link href={deklarasiHref(sv.id)}>
                                      <FileCheck2 /> Deklarasikan
                                    </Link>
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right" onClick={stop}>
                                <RowActionsMenu>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/petty-cash/sub-voucher/${sv.id}`} className="cursor-pointer">
                                      <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                                    </Link>
                                  </DropdownMenuItem>
                                  <PcDownloadMenuItems href={`/petty-cash/sub-voucher/${sv.id}`} />
                                </RowActionsMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </StickyHeaderTable>
            {renderFooter(voucherPage.currentPage, filteredVoucherRows.length, "voucher")}
          </TabsContent>

          {/* ===== MODE: DEKLARASI ===== */}
          <TabsContent value="deklarasi">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => router.push(modeMeta.deklarasi.createHref)}>
                <PlusCircle className="h-4 w-4 mr-1" /> {modeMeta.deklarasi.createLabel}
              </Button>
            </div>
            {renderFilterBar()}
            <StickyHeaderTable
              className="min-w-[1100px] table-fixed"
              containerClassName="rounded-md border overflow-x-auto"
              header={
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <SortableTableHead sortKey="tanggal" defaultDirection="desc" className="w-[120px]" {...sortProps}>
                    Tanggal
                  </SortableTableHead>
                  <SortableTableHead sortKey="kode" className="w-[190px]" {...sortProps}>
                    Kode Deklarasi
                  </SortableTableHead>
                  <TableHead className="w-[220px]">Asal Sub-Voucher / Voucher</TableHead>
                  <SortableTableHead sortKey="departemen" className="w-[130px]" {...sortProps}>
                    Departemen
                  </SortableTableHead>
                  <SortableTableHead sortKey="total" defaultDirection="desc" className="w-[130px] text-right" {...sortProps}>
                    Total
                  </SortableTableHead>
                  <SortableTableHead sortKey="status" className="w-[170px]" {...sortProps}>
                    Status
                  </SortableTableHead>
                  <TableHead className="w-[70px] text-right">Aksi</TableHead>
                </TableRow>
              }
            >
              <TableBody>
                {loading ? (
                  renderTableSkeleton(8)
                ) : deklarasiPage.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {deklarasiRows.length === 0
                        ? "Belum ada Deklarasi Petty Cash."
                        : "Tidak ada data ditemukan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  deklarasiPage.rows.map((row, index) => (
                    <TableRow
                      key={row.deklarasi.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openChainModal(row.pengajuan, `deklarasi-${row.deklarasi.id}`)}
                    >
                      <TableCell>{deklarasiPage.offset + index + 1}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(row.deklarasi.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-primary truncate" title={row.deklarasi.kode_deklarasi}>
                        {row.deklarasi.kode_deklarasi}
                      </TableCell>
                      <TableCell className="text-xs truncate">
                        <div className="text-sm">{row.subVoucher.kode_sub_voucher}</div>
                        <div className="text-muted-foreground">
                          {row.voucher.kode_voucher} · {row.pengajuan.kode_pengajuan}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm truncate" title={row.deklarasi.department}>
                        {row.deklarasi.department}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm tabular-nums">{formatCurrency(row.deklarasi.total_amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.deklarasi.status} colors={PC_DEKLARASI_STATUS_COLORS} fallback={PC_DEKLARASI_STATUS_COLOR_DEFAULT} />
                      </TableCell>
                      <TableCell className="text-right" onClick={stop}>
                        <RowActionsMenu>
                          <DropdownMenuItem onSelect={() => openChainModal(row.pengajuan, `deklarasi-${row.deklarasi.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                          </DropdownMenuItem>
                          <PcDownloadMenuItems href={`/petty-cash/deklarasi/${row.deklarasi.id}`} />
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </StickyHeaderTable>
            {renderFooter(deklarasiPage.currentPage, filteredDeklarasiRows.length, "deklarasi")}
          </TabsContent>
        </Tabs>
      </Content>

      {/* ===== DIALOG DETAIL: RANTAI DOKUMEN LENGKAP =====
          Header & footer tetap, isi yang scroll. Footer = langkah
          berikutnya (nextSteps) supaya user tidak perlu pindah halaman. */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="gap-3 border-b px-4 pt-5 pb-4 text-left sm:px-6">
            <div className="pr-8">
              <DialogTitle className="flex items-center gap-2 [overflow-wrap:anywhere]">
                <modalHeader.Icon className="h-5 w-5 shrink-0 text-primary" />
                {modalHeader.kode}
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {selectedPengajuan && (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {modalFocus !== "pengajuan" && (
                      <>
                        {focusedDeklarasi ? "Deklarasi" : "Voucher"} dari
                        Pengajuan {selectedPengajuan.kode_pengajuan} -{" "}
                      </>
                    )}
                    {selectedPengajuan.department}
                    {!focusedDeklarasi && (
                      <>
                        {" "}-{" "}
                        <CalendarDays className="h-3 w-3" />
                        Dibutuhkan {formatDate(selectedPengajuan.needed_date)}
                      </>
                    )}
                  </span>
                )}
              </DialogDescription>
            </div>

            {/* Ringkasan rantai dokumen - klik utk lompat ke section-nya */}
            {selectedPengajuan && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button type="button" onClick={() => focusSection("pengajuan")}>
                  <Badge variant="outline" className="gap-1 hover:bg-muted">
                    <ReceiptText className="h-3 w-3" /> {selectedPengajuan.kode_pengajuan}
                  </Badge>
                </button>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {selectedVoucher ? (
                  <button type="button" onClick={() => focusSection("voucher")}>
                    <Badge variant="outline" className="gap-1 hover:bg-muted">
                      <Wallet className="h-3 w-3" /> {selectedVoucher.kode_voucher}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant="outline" className="italic text-muted-foreground">
                    Belum ada Voucher
                  </Badge>
                )}
                {selectedVoucher && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="gap-1">
                      <FileCheck2 className="h-3 w-3" />
                      {(selectedVoucher.petty_cash_sub_voucher ?? []).filter(
                        (sv) => !!getActiveDoc(sv.petty_cash_deklarasi),
                      ).length}
                      /{(selectedVoucher.petty_cash_sub_voucher ?? []).length} Deklarasi
                    </Badge>
                  </>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedPengajuan && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6">
              <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
                <AccordionItem value="pengajuan" id="pc-section-pengajuan" className="scroll-mt-2">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      Pengajuan
                      <StatusBadge status={selectedPengajuan.status} colors={PC_PENGAJUAN_STATUS_COLORS} fallback={PC_PENGAJUAN_STATUS_COLOR_DEFAULT} />
                      <PcEskalasiBadge show={selectedPengajuan.is_eskalasi} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <DocSectionActions href={`/petty-cash/pengajuan/${selectedPengajuan.id}`} />
                    <div className="mb-3 empty:hidden">
                      <PcPembatalanStatus pembatalan={selectedPengajuan.petty_cash_pembatalan} />
                    </div>
                    <PcDocumentInfoPanel
                      requesterName={profile?.nama}
                      requesterEmail={profile?.email}
                      department={selectedPengajuan.department}
                      companyCode={selectedPengajuan.company_code}
                      site={selectedPengajuan.site}
                      budgetName={selectedPengajuan.petty_cash_budget?.name}
                      budgetRemaining={selectedPengajuan.petty_cash_budget?.current_budget}
                      penggunaBudgetName={selectedPengajuan.pengguna_budget_nama}
                      neededDate={selectedPengajuan.needed_date}
                      weekOfMonth={selectedPengajuan.week_of_month}
                      notes={selectedPengajuan.notes}
                      items={selectedPengajuan.items}
                      totalAmount={selectedPengajuan.total_amount}
                      attachments={selectedPengajuan.attachments}
                      approvals={selectedPengajuan.approvals}
                      discussions={selectedPengajuan.discussions}
                      revisions={selectedPengajuan.revisions}
                    />
                  </AccordionContent>
                </AccordionItem>

                {selectedVoucher && (
                  <AccordionItem value="voucher" id="pc-section-voucher" className="scroll-mt-2">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Voucher
                        <StatusBadge status={selectedVoucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <DocSectionActions href={`/petty-cash/voucher/${selectedVoucher.id}`} />
                      {selectedVoucher.closed_remainder && (
                        <div className="mb-2">
                          <PcSisaDitutupInfo closed={selectedVoucher.closed_remainder} />
                        </div>
                      )}
                      {rejectedVoucherHistory.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Voucher sebelumnya ditolak:{" "}
                          {rejectedVoucherHistory.map((v, i) => (
                            <span key={v.id}>
                              {i > 0 && ", "}
                              <Link
                                href={`/petty-cash/voucher/${v.id}`}
                                target="_blank"
                                className="text-primary hover:underline"
                              >
                                {v.kode_voucher}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}
                      <PcDocumentInfoPanel
                        requesterName={profile?.nama}
                        requesterEmail={profile?.email}
                        department={selectedVoucher.department}
                        companyCode={selectedVoucher.company_code}
                        site={selectedVoucher.site}
                        budgetName={selectedVoucher.petty_cash_budget?.name}
                        budgetRemaining={selectedVoucher.petty_cash_budget?.current_budget}
                        neededDate={selectedVoucher.needed_date}
                        weekOfMonth={selectedVoucher.week_of_month}
                        payment={pickPcPayment(selectedVoucher)}
                        notes={selectedVoucher.notes}
                        items={selectedVoucher.items}
                        totalAmount={selectedVoucher.total_amount}
                        attachments={selectedVoucher.attachments}
                        approvals={selectedVoucher.approvals}
                        discussions={selectedVoucher.discussions}
                        revisions={selectedVoucher.revisions}
                      />

                      {/* Riwayat Sub-Voucher (tarikan dana) - sama pola dengan
                          halaman detail Voucher (voucher/[id]/page.tsx). */}
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Riwayat Sub-Voucher (Tarikan Dana)
                        </p>
                        {(selectedVoucher.petty_cash_sub_voucher ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            Belum ada dana yang ditarik.
                          </p>
                        ) : (
                          <div className="rounded-md border overflow-x-auto">
                            <Table className="min-w-[620px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Kode Sub-Voucher</TableHead>
                                  <TableHead className="text-right">Nominal</TableHead>
                                  <TableHead>Status Pembayaran</TableHead>
                                  <TableHead>Status Deklarasi</TableHead>
                                  <TableHead className="w-[60px] text-right">PDF</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(selectedVoucher.petty_cash_sub_voucher ?? []).map((sv) => {
                                  const dek = pickCurrentDoc(sv.petty_cash_deklarasi);
                                  return (
                                    <TableRow key={sv.id}>
                                      <TableCell className="font-medium text-sm">
                                        <Link
                                          href={`/petty-cash/sub-voucher/${sv.id}`}
                                          target="_blank"
                                          className="text-primary hover:underline"
                                        >
                                          {sv.kode_sub_voucher}
                                        </Link>
                                      </TableCell>
                                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(sv.amount)}</TableCell>
                                      <TableCell className="text-sm">
                                        <StatusBadge status={sv.status} label={pcStatusLabel(sv.status, "sub_voucher")} colors={PC_SUB_VOUCHER_STATUS_COLORS} fallback={PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT} />
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {dek ? (
                                          <button
                                            type="button"
                                            className="text-primary hover:underline text-left"
                                            onClick={() => focusSection(`deklarasi-${dek.id}`)}
                                          >
                                            {dek.kode_deklarasi} - {pcStatusLabel(dek.status)}
                                          </button>
                                        ) : isAwaitingDeklarasi(sv) ? (
                                          <Link href={deklarasiHref(sv.id)} className="text-primary hover:underline">
                                            Belum dideklarasikan - buat sekarang
                                          </Link>
                                        ) : (
                                          <span className="text-muted-foreground italic">Belum dideklarasikan</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <PcDownloadMenu href={`/petty-cash/sub-voucher/${sv.id}`} iconOnly />
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {(selectedVoucher?.petty_cash_sub_voucher ?? []).flatMap((sv) =>
                  sortDocsNewestFirst(sv.petty_cash_deklarasi).map((dek) => (
                    <AccordionItem
                      key={dek.id}
                      value={`deklarasi-${dek.id}`}
                      id={`pc-section-deklarasi-${dek.id}`}
                      className="scroll-mt-2"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex flex-wrap items-center gap-2 text-left">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          Deklarasi ({sv.kode_sub_voucher})
                          <StatusBadge status={dek.status} colors={PC_DEKLARASI_STATUS_COLORS} fallback={PC_DEKLARASI_STATUS_COLOR_DEFAULT} />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <DocSectionActions href={`/petty-cash/deklarasi/${dek.id}`} />
                        <PcDocumentInfoPanel
                          requesterName={profile?.nama}
                          requesterEmail={profile?.email}
                          department={dek.department}
                          companyCode={dek.company_code}
                          site={dek.site}
                          showNeededDate={false}
                          notes={dek.notes}
                          items={dek.items}
                          totalAmount={dek.total_amount}
                          attachments={dek.attachments}
                          approvals={dek.approvals}
                          discussions={dek.discussions}
                          revisions={dek.revisions}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )),
                )}
              </Accordion>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="min-w-0 text-xs text-muted-foreground">
              {nextSteps.some((step) => step.hint)
                ? nextSteps
                    .map((step) => step.hint)
                    .filter(Boolean)
                    .join(" ")
                : "Tidak ada langkah yang perlu Anda kerjakan untuk dokumen ini."}
            </p>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Tutup
              </Button>
              {nextSteps.map((step) => step.action)}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PcCreateVoucherDialog
        pengajuan={createTarget}
        userId={userId}
        onOpenChange={(open) => !open && setCreateTarget(null)}
        onCreated={async () => {
          await loadData();
          setOpenSections(sectionsForFocus("voucher"));
          setModalFocus("voucher");
        }}
      />

      <PcTarikDanaDialog
        voucher={drawTarget}
        onOpenChange={(open) => !open && setDrawTarget(null)}
        onCreated={loadData}
      />
    </>
  );
}
