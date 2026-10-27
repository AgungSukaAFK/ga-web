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

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { PcGlossaryButton } from "@/components/petty-cash/PcGlossary";
import {
  getActiveDoc,
  pickCurrentDoc,
  sortDocsNewestFirst,
} from "@/lib/pcChain";
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
} from "@/type/enum";
import { Content } from "@/components/content";
import {
  ActiveFilter,
  FilterPanel,
  formatFilterRange,
} from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PcDownloadMenu } from "@/components/petty-cash/PcPrintMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DatePicker } from "@/components/date-picker";
import { PcDocumentInfoPanel } from "@/components/petty-cash/PcDocumentInfoPanel";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Eye,
  ExternalLink,
  FileCheck2,
  Loader2,
  PlusCircle,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
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
  pj.status === "Approved" && !getActiveDoc(pj.petty_cash_voucher);

/** Tarikan yang sudah dibayar Finance tapi belum punya Deklarasi aktif. */
const isAwaitingDeklarasi = (sv: PettyCashSubVoucherWithChain) =>
  sv.status === "Selesai" && !getActiveDoc(sv.petty_cash_deklarasi);

// Tombol shortcut kecil di dalam sel tabel - stopPropagation supaya klik
// tidak ikut membuka modal (klik baris).
const cellButtonClass = "h-7 px-2.5";
const stop = (e: React.MouseEvent) => e.stopPropagation();

const sectionsForFocus = (focus: string) => {
  if (focus === "voucher") return ["pengajuan", "voucher"];
  if (focus.startsWith("deklarasi-")) return ["pengajuan", "voucher", focus];
  return ["pengajuan"];
};

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
}: {
  status: string;
  colors: Record<string, string>;
  fallback: string;
}) => (
  <Badge className={`${colors[status] || fallback} whitespace-nowrap`}>
    {status}
  </Badge>
);

export default function PengajuanSayaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("pengajuan");
  const [chain, setChain] = useState<PettyCashPengajuanWithChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    nama?: string | null;
    email?: string | null;
  } | null>(null);
  const [eligibility, setEligibility] = useState<PengajuanEligibility | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const [userId, setUserId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PettyCashPengajuanWithChain | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(["pengajuan"]);
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
        .select("nama, department, lokasi, company")
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

  // Reset status filter tiap ganti mode - opsinya beda per jenis dokumen
  // (mis. "Selesai" cuma ada di status Voucher).
  useEffect(() => {
    setStatusFilter("all");
  }, [mode]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCompanyFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
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
      if (dateFrom && toDayKey(pj.created_at) < toDayKey(dateFrom))
        return false;
      if (dateTo && toDayKey(pj.created_at) > toDayKey(dateTo)) return false;
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
      if (dateFrom && toDayKey(voucher.created_at) < toDayKey(dateFrom))
        return false;
      if (dateTo && toDayKey(voucher.created_at) > toDayKey(dateTo))
        return false;
      if (!q) return true;
      return buildHaystack(
        [voucher.kode_voucher, pengajuan.kode_pengajuan, voucher.department, voucher.notes],
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
      if (dateFrom && toDayKey(deklarasi.created_at) < toDayKey(dateFrom))
        return false;
      if (dateTo && toDayKey(deklarasi.created_at) > toDayKey(dateTo))
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

  const openChainModal = (
    pengajuan: PettyCashPengajuanWithChain,
    focus: string,
  ) => {
    setSelectedPengajuan(pengajuan);
    setOpenSections(sectionsForFocus(focus));
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
  if (selectedVoucher && canDrawVoucher(selectedVoucher)) {
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
  const awaitingDeklarasi = (
    selectedVoucher?.petty_cash_sub_voucher ?? []
  ).filter(isAwaitingDeklarasi);
  if (awaitingDeklarasi.length > 0) {
    nextSteps.push({
      hint: `${awaitingDeklarasi.length} tarikan sudah dibayar Finance & belum dideklarasikan.`,
      action: (
        <Button asChild key="deklarasi" variant="secondary">
          <Link href="/petty-cash/deklarasi">
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
  const formatChipDate = (d: Date) =>
    d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const activeFilters: ActiveFilter[] = [];
  if (search.trim())
    activeFilters.push({
      key: "search",
      label: "Cari",
      value: search.trim(),
      onRemove: () => setSearch(""),
    });
  if (statusFilter !== "all")
    activeFilters.push({
      key: "status",
      label: "Status",
      value: statusFilter,
      onRemove: () => setStatusFilter("all"),
    });
  if (companyFilter !== "all")
    activeFilters.push({
      key: "company",
      label: "Company",
      value: companyFilter,
      onRemove: () => setCompanyFilter("all"),
    });
  if (dateFrom || dateTo)
    activeFilters.push({
      key: "tanggal",
      label: "Tanggal",
      value: formatFilterRange(
        dateFrom ? formatChipDate(dateFrom) : "",
        dateTo ? formatChipDate(dateTo) : "",
      ),
      onRemove: () => {
        setDateFrom(undefined);
        setDateTo(undefined);
      },
    });

  // Dipanggil sebagai fungsi (bukan <FilterBar />) supaya tidak di-mount
  // ulang tiap render - state buka/tutup panel & fokus input tetap terjaga.
  const renderFilterBar = () => (
    <div className="flex flex-col gap-2 mb-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari kode, departemen, catatan, atau nama/keterangan barang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <FilterPanel activeFilters={activeFilters} onReset={resetFilters}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Status</label>
            <SearchableSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
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
                    {s}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Company</label>
            <SearchableSelect
              value={companyFilter}
              onValueChange={setCompanyFilter}
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
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Dari Tanggal</label>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="Tanggal mulai"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Sampai Tanggal</label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="Tanggal akhir"
            />
          </div>
        </div>
      </FilterPanel>
    </div>
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
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
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
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[1060px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Pengajuan</TableHead>
                    <TableHead className="w-[130px]">Departemen</TableHead>
                    <TableHead className="w-[70px] text-center">Barang</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[160px]">Voucher</TableHead>
                    <TableHead className="w-[140px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredPengajuan.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        {chain.length === 0
                          ? "Belum ada pengajuan Petty Cash."
                          : "Tidak ada data yang cocok dengan filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPengajuan.map((pj) => {
                      const voucher = pickCurrentDoc(pj.petty_cash_voucher);
                      const voucherCreatable = canCreateVoucher(pj);
                      return (
                        <TableRow
                          key={pj.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => openChainModal(pj, "pengajuan")}
                        >
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(pj.created_at)}</TableCell>
                          <TableCell className="font-semibold text-sm text-primary truncate" title={pj.kode_pengajuan}>
                            {pj.kode_pengajuan}
                          </TableCell>
                          <TableCell className="text-sm truncate" title={pj.department}>{pj.department}</TableCell>
                          <TableCell className="text-center text-sm">{pj.items?.length ?? 0}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatCurrency(pj.total_amount)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge status={pj.status} colors={PC_PENGAJUAN_STATUS_COLORS} fallback={PC_PENGAJUAN_STATUS_COLOR_DEFAULT} />
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
                                canDrawVoucher(voucher) && (
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
                          <TableCell onClick={stop}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => openChainModal(pj, "pengajuan")}>
                                <Eye /> Detail
                              </Button>
                              <PcDownloadMenu href={`/petty-cash/pengajuan/${pj.id}`} iconOnly />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ===== MODE: VOUCHER & SUB-VOUCHER ===== */}
          <TabsContent value="voucher">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => router.push(modeMeta.voucher.createHref)}>
                <PlusCircle className="h-4 w-4 mr-1" /> {modeMeta.voucher.createLabel}
              </Button>
            </div>
            {renderFilterBar()}
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[1130px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Voucher</TableHead>
                    <TableHead className="w-[170px]">Asal Pengajuan</TableHead>
                    <TableHead className="w-[120px]">Departemen</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[190px]">Tarikan Dana</TableHead>
                    <TableHead className="w-[140px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredVoucherRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        {voucherRows.length === 0
                          ? "Belum ada Voucher Petty Cash."
                          : "Tidak ada data yang cocok dengan filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVoucherRows.map(({ pengajuan, voucher }) => {
                      const subVouchers = voucher.petty_cash_sub_voucher ?? [];
                      const drawn = subVouchers.reduce((sum, sv) => sum + sv.amount, 0);
                      const declaredCount = subVouchers.filter(
                        (sv) => !!getActiveDoc(sv.petty_cash_deklarasi),
                      ).length;
                      return (
                        <TableRow
                          key={voucher.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => openChainModal(pengajuan, "voucher")}
                        >
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(voucher.created_at)}</TableCell>
                          <TableCell className="font-semibold text-sm text-primary truncate" title={voucher.kode_voucher}>
                            {voucher.kode_voucher}
                          </TableCell>
                          <TableCell className="text-sm truncate" title={pengajuan.kode_pengajuan}>
                            {pengajuan.kode_pengajuan}
                          </TableCell>
                          <TableCell className="text-sm truncate" title={voucher.department}>{voucher.department}</TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatCurrency(voucher.total_amount)}</TableCell>
                          <TableCell>
                            <StatusBadge status={voucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium text-sm text-foreground tabular-nums">
                              {formatCurrency(drawn)} / {formatCurrency(voucher.total_amount)}
                            </div>
                            <div className="text-muted-foreground">
                              {declaredCount}/{subVouchers.length} SV dideklarasikan
                            </div>
                            {canDrawVoucher(voucher) && (
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
                          <TableCell onClick={stop}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => openChainModal(pengajuan, "voucher")}>
                                <Eye /> Detail
                              </Button>
                              <PcDownloadMenu href={`/petty-cash/voucher/${voucher.id}`} iconOnly />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ===== MODE: DEKLARASI ===== */}
          <TabsContent value="deklarasi">
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => router.push(modeMeta.deklarasi.createHref)}>
                <PlusCircle className="h-4 w-4 mr-1" /> {modeMeta.deklarasi.createLabel}
              </Button>
            </div>
            {renderFilterBar()}
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[1040px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Deklarasi</TableHead>
                    <TableHead className="w-[220px]">Asal Sub-Voucher / Voucher</TableHead>
                    <TableHead className="w-[130px]">Departemen</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-32">
                        <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredDeklarasiRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        {deklarasiRows.length === 0
                          ? "Belum ada Deklarasi Petty Cash."
                          : "Tidak ada data yang cocok dengan filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeklarasiRows.map((row) => (
                      <TableRow
                        key={row.deklarasi.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openChainModal(row.pengajuan, `deklarasi-${row.deklarasi.id}`)}
                      >
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(row.deklarasi.created_at)}</TableCell>
                        <TableCell className="font-semibold text-sm text-primary truncate" title={row.deklarasi.kode_deklarasi}>
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
                        <TableCell className="text-right font-semibold text-sm">{formatCurrency(row.deklarasi.total_amount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.deklarasi.status} colors={PC_DEKLARASI_STATUS_COLORS} fallback={PC_DEKLARASI_STATUS_COLOR_DEFAULT} />
                        </TableCell>
                        <TableCell onClick={stop}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openChainModal(row.pengajuan, `deklarasi-${row.deklarasi.id}`)}
                            >
                              <Eye /> Detail
                            </Button>
                            <PcDownloadMenu href={`/petty-cash/deklarasi/${row.deklarasi.id}`} iconOnly />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
                <ReceiptText className="h-5 w-5 shrink-0 text-primary" />
                {selectedPengajuan?.kode_pengajuan}
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {selectedPengajuan && (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {selectedPengajuan.department} -{" "}
                    <CalendarDays className="h-3 w-3" />
                    Dibutuhkan {formatDate(selectedPengajuan.needed_date)}
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
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <DocSectionActions href={`/petty-cash/pengajuan/${selectedPengajuan.id}`} />
                    <PcDocumentInfoPanel
                      requesterName={profile?.nama}
                      requesterEmail={profile?.email}
                      department={selectedPengajuan.department}
                      companyCode={selectedPengajuan.company_code}
                      site={selectedPengajuan.site}
                      budgetName={selectedPengajuan.petty_cash_budget?.name}
                      budgetRemaining={selectedPengajuan.petty_cash_budget?.current_budget}
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
                                        <StatusBadge status={sv.status} colors={PC_SUB_VOUCHER_STATUS_COLORS} fallback={PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT} />
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {dek ? (
                                          <button
                                            type="button"
                                            className="text-primary hover:underline text-left"
                                            onClick={() => focusSection(`deklarasi-${dek.id}`)}
                                          >
                                            {dek.kode_deklarasi} - {dek.status}
                                          </button>
                                        ) : isAwaitingDeklarasi(sv) ? (
                                          <Link href="/petty-cash/deklarasi" className="text-primary hover:underline">
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
              {nextSteps.length > 0
                ? nextSteps.map((step) => step.hint).join(" ")
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
          setOpenSections((prev) =>
            prev.includes("voucher") ? prev : [...prev, "voucher"],
          );
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
