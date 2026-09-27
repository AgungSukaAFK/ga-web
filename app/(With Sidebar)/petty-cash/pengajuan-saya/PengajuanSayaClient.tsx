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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  checkPengajuanEligibility,
  fetchMyPengajuanWithChain,
  PengajuanEligibility,
} from "@/services/pettyCashPengajuanService";
import {
  PettyCashDeklarasi,
  PettyCashPengajuanItem,
  PettyCashPengajuanWithChain,
  PettyCashSubVoucherWithChain,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
  Wallet,
  X,
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PettyCashPengajuanWithChain | null>(null);
  const [focusSection, setFocusSection] = useState<string>("pengajuan");

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak terautentikasi.");

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

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    companyFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  // ===== Data turunan dari `chain` (satu sumber data utk 3 mode) =====

  const voucherRows: VoucherRow[] = useMemo(
    () =>
      chain.flatMap((pengajuan) => {
        const voucher = pengajuan.petty_cash_voucher?.[0];
        return voucher ? [{ pengajuan, voucher }] : [];
      }),
    [chain],
  );

  const deklarasiRows: DeklarasiRow[] = useMemo(
    () =>
      voucherRows.flatMap(({ pengajuan, voucher }) =>
        (voucher.petty_cash_sub_voucher ?? []).flatMap((subVoucher) => {
          const deklarasi = subVoucher.petty_cash_deklarasi?.[0];
          return deklarasi
            ? [{ pengajuan, voucher, subVoucher, deklarasi }]
            : [];
        }),
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
    setFocusSection(focus);
    setIsDialogOpen(true);
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

  const selectedVoucher = selectedPengajuan?.petty_cash_voucher?.[0] ?? null;

  const accordionDefaultValue = useMemo(() => {
    if (focusSection === "voucher") return ["pengajuan", "voucher"];
    if (focusSection.startsWith("deklarasi-"))
      return ["pengajuan", "voucher", focusSection];
    return ["pengajuan"];
  }, [focusSection]);

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

  const FilterBar = () => (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode, departemen, catatan, atau nama/keterangan barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-[170px]">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {statusOptionsByMode[mode].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="sm:w-[120px]">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Company</SelectItem>
            {PC_COA_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Dari
          </span>
          <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Tanggal mulai" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            s/d
          </span>
          <DatePicker value={dateTo} onChange={setDateTo} placeholder="Tanggal akhir" />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Reset Filter
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Content
        title="Dokumen Petty Cash Saya"
        description="Pusat dokumen Pengajuan, Voucher, dan Deklarasi Petty Cash Anda - klik baris mana pun untuk melihat rantai dokumen lengkapnya."
        cardAction={
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
            <FilterBar />
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[950px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Pengajuan</TableHead>
                    <TableHead className="w-[130px]">Departemen</TableHead>
                    <TableHead className="w-[80px] text-center">Jml Barang</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[130px]">Voucher</TableHead>
                    <TableHead className="w-[60px] text-center">Aksi</TableHead>
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
                      const voucher = pj.petty_cash_voucher?.[0];
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
                            <StatusBadge status={pj.status} colors={PC_PENGAJUAN_STATUS_COLORS} fallback={PC_PENGAJUAN_STATUS_COLOR_DEFAULT} />
                          </TableCell>
                          <TableCell>
                            {voucher ? (
                              <StatusBadge status={voucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Belum ada</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openChainModal(pj, "pengajuan");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
            <FilterBar />
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[950px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Voucher</TableHead>
                    <TableHead className="w-[190px]">Asal Pengajuan</TableHead>
                    <TableHead className="w-[130px]">Departemen</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[150px]">Tarikan Dana</TableHead>
                    <TableHead className="w-[60px] text-center">Aksi</TableHead>
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
                        (sv) => (sv.petty_cash_deklarasi?.length ?? 0) > 0,
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
                            <div className="font-medium text-sm text-foreground">
                              {formatCurrency(drawn)} / {formatCurrency(voucher.total_amount)}
                            </div>
                            <div className="text-muted-foreground">
                              {declaredCount}/{subVouchers.length} SV dideklarasikan
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openChainModal(pengajuan, "voucher");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
            <FilterBar />
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[950px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[190px]">Kode Deklarasi</TableHead>
                    <TableHead className="w-[220px]">Asal Sub-Voucher / Voucher</TableHead>
                    <TableHead className="w-[130px]">Departemen</TableHead>
                    <TableHead className="w-[130px] text-right">Total</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[60px] text-center">Aksi</TableHead>
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
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openChainModal(row.pengajuan, `deklarasi-${row.deklarasi.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* ===== DIALOG DETAIL: RANTAI DOKUMEN LENGKAP ===== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              {selectedPengajuan?.kode_pengajuan}
            </DialogTitle>
            <DialogDescription>
              {selectedPengajuan && (
                <span className="inline-flex items-center gap-1">
                  {selectedPengajuan.department} -{" "}
                  <CalendarDays className="h-3 w-3" />
                  Dibutuhkan {formatDate(selectedPengajuan.needed_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPengajuan && (
            <div className="space-y-4">
              {/* Ringkasan rantai dokumen */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className="gap-1">
                  <ReceiptText className="h-3 w-3" /> {selectedPengajuan.kode_pengajuan}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {selectedVoucher ? (
                  <Badge variant="outline" className="gap-1">
                    <Wallet className="h-3 w-3" /> {selectedVoucher.kode_voucher}
                  </Badge>
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
                        (sv) => (sv.petty_cash_deklarasi?.length ?? 0) > 0,
                      ).length}
                      /{(selectedVoucher.petty_cash_sub_voucher ?? []).length} Deklarasi
                    </Badge>
                  </>
                )}
              </div>

              <Accordion type="multiple" defaultValue={accordionDefaultValue}>
                <AccordionItem value="pengajuan">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-primary" />
                      Pengajuan
                      <StatusBadge status={selectedPengajuan.status} colors={PC_PENGAJUAN_STATUS_COLORS} fallback={PC_PENGAJUAN_STATUS_COLOR_DEFAULT} />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-end mb-2">
                      <Link
                        href={`/petty-cash/pengajuan/${selectedPengajuan.id}`}
                        target="_blank"
                        className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                      >
                        Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
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
                  <AccordionItem value="voucher">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Voucher
                        <StatusBadge status={selectedVoucher.status} colors={PC_VOUCHER_STATUS_COLORS} fallback={PC_VOUCHER_STATUS_COLOR_DEFAULT} />
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex justify-end mb-2">
                        <Link
                          href={`/petty-cash/voucher/${selectedVoucher.id}`}
                          target="_blank"
                          className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                        >
                          Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
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
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Kode Sub-Voucher</TableHead>
                                  <TableHead className="text-right">Nominal</TableHead>
                                  <TableHead>Status Pembayaran</TableHead>
                                  <TableHead>Status Deklarasi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(selectedVoucher.petty_cash_sub_voucher ?? []).map((sv) => {
                                  const dek = sv.petty_cash_deklarasi?.[0];
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
                                      <TableCell className="text-right text-sm">{formatCurrency(sv.amount)}</TableCell>
                                      <TableCell className="text-sm">
                                        <Badge
                                          className={
                                            PC_SUB_VOUCHER_STATUS_COLORS[sv.status] ||
                                            PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT
                                          }
                                        >
                                          {sv.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm">
                                        {dek ? (
                                          <button
                                            type="button"
                                            className="text-primary hover:underline"
                                            onClick={() => setFocusSection(`deklarasi-${dek.id}`)}
                                          >
                                            {dek.kode_deklarasi} - {dek.status}
                                          </button>
                                        ) : (
                                          <span className="text-muted-foreground italic">Belum dideklarasikan</span>
                                        )}
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

                {(selectedVoucher?.petty_cash_sub_voucher ?? []).map((sv) => {
                  const dek = sv.petty_cash_deklarasi?.[0];
                  if (!dek) return null;
                  return (
                    <AccordionItem key={dek.id} value={`deklarasi-${dek.id}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          Deklarasi ({sv.kode_sub_voucher})
                          <StatusBadge status={dek.status} colors={PC_DEKLARASI_STATUS_COLORS} fallback={PC_DEKLARASI_STATUS_COLOR_DEFAULT} />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex justify-end mb-2">
                          <Link
                            href={`/petty-cash/deklarasi/${dek.id}`}
                            target="_blank"
                            className="text-xs font-normal text-primary hover:underline flex items-center gap-1"
                          >
                            Detail Lengkap / Cetak <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
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
                  );
                })}
              </Accordion>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
