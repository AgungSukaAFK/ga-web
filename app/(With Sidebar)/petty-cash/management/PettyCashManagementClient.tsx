// src/app/(With Sidebar)/petty-cash/management/PettyCashManagementClient.tsx
//
// Management Petty Cash (ADMIN ONLY) - satu halaman untuk memantau SEMUA
// dokumen di alur baru Petty Cash (petty_cash_pengajuan / petty_cash_voucher
// / petty_cash_sub_voucher / petty_cash_deklarasi), lintas user &
// departemen, 4 tab (Pengajuan/Voucher/Sub-Voucher/Deklarasi - tab
// Sub-Voucher BARU, sebelumnya dokumen ini sama sekali tidak termonitor di
// sini). Klik row/Eye buka dialog PREVIEW ringkas (read-only) - untuk
// override status/jalur approval, ganti kode, edit paksa, & hapus
// berantai, admin diarahkan ke link "Detail Lengkap" (halaman
// petty-cash/{stage}/[id]/page.tsx, lihat PcAdminOverridePanel/
// PcAdminSubVoucherPanel di sana) - kecuali HAPUS yang juga tersedia
// sebagai aksi cepat langsung dari baris tabel (tombol tong sampah),
// supaya admin tidak perlu buka detail dulu kalau cuma mau membersihkan
// dokumen sampah.
//
// Proteksi di level RLS/RPC ada di
// supabase/petty-cash-admin-management-setup.sql (override status) &
// supabase/petty-cash-admin-full-management-setup.sql (ganti kode/edit
// paksa/hapus berantai) - guard di komponen ini cuma proteksi UI, bukan
// pengganti itu. `isAdmin` di-cek sendiri di sini (bukan prop dari page.tsx)
// - sama pola dgn ApprovalPettyCashClient.tsx & halaman detail lainnya.

"use client";

import { useEffect, useMemo, useState } from "react";
import { Content } from "@/components/content";
import { ActiveFilter, FilterPanel } from "@/components/filter-panel";
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
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
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
} from "@/type/enum";
import { fetchAllPengajuan } from "@/services/pettyCashPengajuanService";
import { fetchAllVouchers } from "@/services/pettyCashVoucherService";
import { fetchAllSubVouchers } from "@/services/pettyCashSubVoucherService";
import { fetchAllDeklarasi } from "@/services/pettyCashDeklarasiService";
import {
  adminDeletePettyCashDocument,
  getDeleteImpactWarning,
} from "@/services/pettyCashAdminService";
import {
  Loader2,
  RefreshCcw,
  Eye,
  ShieldAlert,
  Search,
  Trash2,
} from "lucide-react";

type StageKey = PcDocType;
type AnyDoc =
  | PettyCashPengajuan
  | PettyCashVoucher
  | PettyCashSubVoucher
  | PettyCashDeklarasi;

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
    fetchAll: () => Promise<AnyDoc[]>;
  }
> = {
  pengajuan: {
    label: "Pengajuan",
    statusOptions: PC_PENGAJUAN_STATUS_OPTIONS,
    statusColors: PC_PENGAJUAN_STATUS_COLORS,
    statusColorDefault: PC_PENGAJUAN_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllPengajuan,
  },
  voucher: {
    label: "Voucher",
    statusOptions: PC_VOUCHER_STATUS_OPTIONS,
    statusColors: PC_VOUCHER_STATUS_COLORS,
    statusColorDefault: PC_VOUCHER_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllVouchers,
  },
  sub_voucher: {
    label: "Sub-Voucher",
    statusOptions: PC_SUB_VOUCHER_STATUS_OPTIONS,
    statusColors: PC_SUB_VOUCHER_STATUS_COLORS,
    statusColorDefault: PC_SUB_VOUCHER_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllSubVouchers,
  },
  deklarasi: {
    label: "Deklarasi",
    statusOptions: PC_DEKLARASI_STATUS_OPTIONS,
    statusColors: PC_DEKLARASI_STATUS_COLORS,
    statusColorDefault: PC_DEKLARASI_STATUS_COLOR_DEFAULT,
    fetchAll: fetchAllDeklarasi,
  },
};

const DETAIL_PATH: Record<StageKey, string> = {
  pengajuan: "pengajuan",
  voucher: "voucher",
  sub_voucher: "sub-voucher",
  deklarasi: "deklarasi",
};

export default function PettyCashManagementClient() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [stage, setStage] = useState<StageKey>("pengajuan");
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
      if (!user) return setIsAdmin(false);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
    };
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await config.fetchAll();
      setDocs(data);
    } catch (error: any) {
      toast.error("Gagal memuat data", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    setStatusFilter("all");
    setSearch("");
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isAdmin]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      const kode = getKode(stage, row).toLowerCase();
      const dept = getDepartment(stage, row).toLowerCase();
      const pemohon = row.users_with_profiles?.nama?.toLowerCase() || "";
      return kode.includes(q) || dept.includes(q) || pemohon.includes(q);
    });
  }, [docs, search, statusFilter, stage]);

  const getStatusBadge = (status: string) => {
    const colorClass = config.statusColors[status] || config.statusColorDefault;
    return (
      <Badge className={`${colorClass} whitespace-nowrap`}>{status}</Badge>
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
    await loadData();
  };

  if (isAdmin === null) {
    return (
      <Content title="Management Petty Cash" className="col-span-12">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-6 w-6 text-primary" />
        </div>
      </Content>
    );
  }

  if (!isAdmin) {
    return (
      <Content
        title="Management Petty Cash"
        description="Khusus untuk role Admin."
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

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <>
      <Content
        title="Management Petty Cash"
        description="Pantau, ganti kode, edit paksa, & hapus (dgn cascade + refund budget otomatis) semua dokumen Petty Cash lintas departemen (admin only)."
        cardAction={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <div className="space-y-4">
          <Tabs value={stage} onValueChange={(v) => setStage(v as StageKey)}>
            <TabsList className="max-w-full justify-start overflow-x-auto">
              <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
              <TabsTrigger value="voucher">Voucher</TabsTrigger>
              <TabsTrigger value="sub_voucher">Sub-Voucher</TabsTrigger>
              <TabsTrigger value="deklarasi">Deklarasi</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode, departemen, atau nama pemohon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <FilterPanel activeFilters={activeFilters} onReset={clearFilters}>
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
                    {config.statusOptions.map((s) => (
                      <SearchableSelectItem key={s} value={s}>
                        {s}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </div>
            </div>
          </FilterPanel>

          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Tanggal</TableHead>
                  <TableHead className="w-[190px]">Kode</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead className="w-[140px]">Departemen</TableHead>
                  <TableHead className="w-[140px] text-right">Total</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[90px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center h-32 text-muted-foreground"
                    >
                      Tidak ada data yang cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocs.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(row)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell className="font-semibold text-sm truncate">
                        {getKode(stage, row)}
                      </TableCell>
                      <TableCell className="text-sm truncate">
                        {row.users_with_profiles?.nama || "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate">
                        {getDepartment(stage, row)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatCurrency(getTotalAmount(stage, row))}
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-center">
                        <div
                          className="flex items-center justify-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => openDetail(row)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                docType: stage,
                                id: row.id,
                                kode: getKode(stage, row),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
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
                neededDate={getNeededDate(stage, selected)}
                weekOfMonth={(selected as any).week_of_month}
                showNeededDate={showsNeededDate(stage)}
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
